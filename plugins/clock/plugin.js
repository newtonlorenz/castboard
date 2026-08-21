export function createPlugin({ config }) {
  return {
    id: 'clock',
    name: 'Clock',
    publicConfig: () => ({ showSeconds: config.showSeconds === true }),
  };
}
