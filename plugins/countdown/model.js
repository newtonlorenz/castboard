export function countdownState(data, options = {}, now = Date.now()) {
  const target = Date.parse(data?.target);
  if (!data?.target || !Number.isFinite(target) || !/(Z|[+-]\d{2}:\d{2})$/.test(data.target)) throw new Error('Countdown needs a valid target date and time with a time zone');
  const reached = now >= target;
  const total = Math.floor(Math.abs(target - now)/1000);
  return {target, reached, elapsed:reached && options.afterTarget === 'elapsed', complete:reached && options.afterTarget !== 'elapsed', days:Math.floor(total/86400),hours:Math.floor(total/3600)%24,minutes:Math.floor(total/60)%60,seconds:total%60};
}
export function countdownText(state, options = {}) {
  if (state.complete) return options.completionText || 'The time has arrived';
  return `${state.days}d ${state.hours}h ${state.minutes}m${options.showSeconds ? ` ${state.seconds}s` : ''}${state.elapsed ? ' elapsed' : ' remaining'}`;
}
