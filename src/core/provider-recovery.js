// Persistent, bounded recovery decisions. Probes/actions own their I/O deadlines.
export class RecoveryLoop {
  constructor({tasks, state = {}, now = Date.now, save = async()=>{}, log = ()=>{}, intervalMs = 30000}) {
    Object.assign(this,{tasks,state,now,save,log,intervalMs});
    this.stopped=false; this.running=null;
  }
  tick() {
    if(this.stopped)return Promise.resolve();
    if(this.running)return this.running;
    this.running=this.run().finally(()=>{this.running=null;});
    return this.running;
  }
  async run() {
    await Promise.all(this.tasks.map(async task=>{
      const s=this.state[task.id] ||= {failures:0,healthyChecks:0,attempts:0,nextAttemptAt:0};
      let result;
      try{result=await task.probe();}catch{result={healthy:false,reason:'probe-unavailable'};}
      if(this.stopped)return;
      const now=this.now(),previous=s.status;
      s.checkedAt=now;s.status=result.healthy?'healthy':'unavailable';s.reason=result.reason;
      if(result.healthy){
        s.failures=0;s.failureSince=null;s.healthyChecks=(s.healthyChecks||0)+1;
        // A single lucky response must not reset backoff during flapping.
        if(s.healthyChecks>=3){s.attempts=0;s.nextAttemptAt=0;}
      }else{
        s.healthyChecks=0;s.failures=(s.failures||0)+1;s.failureSince ??= now;
        if(result.action && s.failures>=3 && now-s.failureSince>=Math.max(60000,result.minFailureMs||0) && now>=(s.nextAttemptAt||0)){
          s.attempts=Math.min((s.attempts||0)+1,20);
          s.nextAttemptAt=now+Math.min(1800000,120000*2**(s.attempts-1));
          s.lastAttemptAt=now;s.lastAction=result.action;s.actionResult='pending';
          // Persist cooldown BEFORE a side effect so a bridge restart cannot loop.
          try{await this.save(this.state);}catch{s.actionResult='state-write-failed';return;}
          if(this.stopped)return;
          try{await task.recover(result);s.actionResult='completed';}
          catch{s.actionResult='failed';}
          this.log(task.id,s.lastAction,s.actionResult);
          // Recovery is confirmed only by later successful probes.
        }
      }
      if(previous && previous!==s.status)this.log(task.id,s.status,s.reason);
    }));
    await this.save(this.state);
  }
  start() {
    if(this.timer || this.stopped)return;
    const run=()=>this.tick().catch(()=>this.log('supervisor','state-save-failed',''));
    this.timer=setInterval(run,this.intervalMs);this.timer.unref?.();void run();
  }
  stop(){this.stopped=true;clearInterval(this.timer);this.timer=null;}
}
