import { demoTimestamp, readJsonSource } from '../../src/core/providers.js';

export function createPlugin({ config, context }) {
  return {
    id: 'recovery',
    name: 'Recovery',
    publicConfig: () => ({ title: config.title || 'Recovery' }),
    async getData() {
      if (config.provider === 'demo') return { score: 82, status: 'Ready', detail: 'Sleep 91% · HRV balanced', updatedAt: demoTimestamp() };
      return readJsonSource(config, context);
    },
  };
}
