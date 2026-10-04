const LIMIT=2*1024*1024;
const failure=()=>new Error('Camera snapshot unavailable');

// Read one bounded image, including one MIME part from an MJPEG camera. Abort
// after that part so snapshot polling never leaves an upstream stream running.
export async function fetchSnapshot(url,{headers={},signal,timeoutMs=10000}={}) {
  const controller=new AbortController(),abort=()=>controller.abort();
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeoutMs);let reader;
  try {
    const response=await fetch(url,{headers:{Accept:'image/jpeg,image/png,multipart/x-mixed-replace',...headers},signal:controller.signal,redirect:'error'});
    if(!response.ok || !response.body)throw failure();
    reader=response.body.getReader();
    const type=response.headers.get('content-type') || '';
    const multipart=/^multipart\/x-mixed-replace/i.test(type);
    const boundaryMatch=/boundary=(?:"([^"\r\n]{1,100})"|([^;\s]{1,100}))/i.exec(type);
    const declared=boundaryMatch?.[1] || boundaryMatch?.[2];
    const boundaries=declared?[Buffer.from('--'+declared),...(declared.startsWith('--')?[Buffer.from(declared)]:[])]:[];
    if(multipart && !declared || !multipart && !/^image\/(jpeg|png)(?:;|$)/i.test(type))throw failure();
    let boundary;
    let buffer=Buffer.alloc(0),start=-1,partType='',partLength=null;
    for(;;){
      const {value,done}=await reader.read();
      if(done){if(!multipart && buffer.length)return {data:buffer,contentType:type.split(';')[0]};throw failure();}
      if(buffer.length+value.length>LIMIT+16384)throw failure();
      buffer=Buffer.concat([buffer,Buffer.from(value)]);
      if(!multipart){if(buffer.length>LIMIT)throw failure();continue;}
      if(start<0){
        let marker=-1;
        for(const candidate of boundaries){
          let at=buffer.indexOf(candidate);
          while(at>=0){
            if((at===0 || buffer.subarray(at-2,at).toString()==='\r\n') && buffer.subarray(at+candidate.length,at+candidate.length+2).toString()==='\r\n'){marker=at;boundary=candidate;break;}
            at=buffer.indexOf(candidate,at+1);
          }
          if(marker>=0)break;
        }
        if(marker<0){if(buffer.length>4096)throw failure();continue;}
        const end=buffer.indexOf('\r\n\r\n',marker+boundary.length);if(end<0){if(buffer.length>16384)throw failure();continue;}
        const header=buffer.subarray(marker+boundary.length,end).toString('latin1');
        partType=/content-type:\s*(image\/(?:jpeg|png))/i.exec(header)?.[1] || '';
        if(!partType)throw failure();
        const length=/content-length:\s*(\d+)/i.exec(header)?.[1];
        if(length!==undefined){partLength=Number(length);if(partLength<1 || partLength>LIMIT)throw failure();}
        start=end+4;
      }
      let end=partLength===null?buffer.indexOf(Buffer.concat([Buffer.from('\r\n'),boundary]),start):start+partLength;
      if(end>=start && end<=buffer.length){if(end-start>LIMIT)throw failure();return {data:Buffer.from(buffer.subarray(start,end)),contentType:partType};}
    }
  }catch{throw failure();}
  finally {controller.abort();await reader?.cancel().catch(()=>{});clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
