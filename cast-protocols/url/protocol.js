export function createProtocol() {
  return {
    id: 'url',
    name: 'URL only',
    async cast({ target, url }) {
      return { target: target.name || target.device || 'manual', url, message: `Open ${url} on the target screen` };
    },
  };
}
