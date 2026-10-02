import { demoTimestamp, readJsonSource, validateProviderConfig } from '../../src/core/providers.js';

export function createPlugin({ config, context }) {
  validateProviderConfig('recovery', config, ['demo', 'http-json', 'file-json']);
  return {
    id: 'recovery',
    assets: ['style.css'],
    styles: ['style.css'],
    name: 'Recovery',
    publicConfig: () => ({ title: config.title || 'Recovery' }),
    async getData() {
      if (config.provider === 'demo') return { score: 82, status: 'Ready', detail: 'Sleep 91% · HRV balanced', updatedAt: demoTimestamp() };
      return readJsonSource(config, context);
    },
  };
}
