export function createPlugin() {
  return { id: 'focus', assets: ['style.css'], styles: ['style.css'], name: 'Focus lane', publicConfig: () => ({}) };
}
