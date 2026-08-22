export function createProtocol({ config }) {
  return {
    id: 'http-webhook',
    name: 'HTTP webhook',
    async cast({ screenId, target, url }) {
      const endpoint = target.endpoint || config.endpoint;
      if (!endpoint) throw new Error('http-webhook protocol requires endpoint');
      const method = target.method || config.method || 'POST';
      const timeoutMs = Number(target.timeoutMs || config.timeoutMs || 10000);
      let response;
      try {
        response = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json', ...(config.headers || {}), ...(target.headers || {}) },
          body: method === 'GET' ? undefined : JSON.stringify({ screenId, url, target: target.name || null }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (error.name === 'TimeoutError') throw new Error(`Cast webhook timed out after ${timeoutMs}ms`);
        throw error;
      }
      if (!response.ok) throw new Error(`Cast webhook returned HTTP ${response.status}`);
      return { endpoint, status: response.status, url };
    },
  };
}
