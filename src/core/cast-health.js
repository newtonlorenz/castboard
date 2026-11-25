import net from 'node:net';

export async function probeCastTarget({ address }, {
  timeoutMs = 6500, connect = net.connect,
} = {}) {
  if (!net.isIP(address || '')) return { reachable: false, reason: 'invalid-receiver-address' };

  return new Promise(resolve => {
    let socket;
    let settled = false;
    const timer = setTimeout(() => finish(false), timeoutMs);
    function finish(reachable) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.destroy();
      resolve({ reachable, reason: reachable ? 'cast-reachable' : 'cast-unreachable' });
    }
    try {
      socket = connect({ host: address, port: 8009 });
      socket.once('connect', () => finish(true));
      socket.once('error', () => finish(false));
      socket.once('close', () => finish(false));
    } catch { finish(false); }
  });
}
