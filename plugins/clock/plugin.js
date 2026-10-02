export function createPlugin({ config }) {
  return {
    id: 'clock',
    assets: ['style.css'],
    styles: ['style.css'],
    name: 'Clock',
    publicConfig: () => ({ showSeconds: config.showSeconds === true }),
  };
}
