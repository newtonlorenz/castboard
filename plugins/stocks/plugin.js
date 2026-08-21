import { demoTimestamp, readJsonSource } from '../../src/core/providers.js';

export function createPlugin({ config, context }) {
  return {
    id: 'stocks',
    name: 'Stocks',
    publicConfig: () => ({ title: config.title || 'Portfolio', currency: config.currency || 'EUR', maxRows: config.maxRows || 6 }),
    async getData() {
      if (config.provider === 'demo') {
        const positions = [
          { symbol: 'ACME', name: 'Acme Systems', quantity: 12, price: 128.4, value: 1540.8, changePct: 1.8, currency: config.currency || 'EUR' },
          { symbol: 'NOVA', name: 'Nova Energy', quantity: 20, price: 48.1, value: 962, changePct: -0.7, currency: config.currency || 'EUR' },
          { symbol: 'BTC', name: 'Bitcoin', quantity: 0.02, price: 81240, value: 1624.8, changePct: 2.4, currency: config.currency || 'EUR' },
        ];
        return { positions, totalValue: positions.reduce((sum, item) => sum + item.value, 0), dailyChange: 54.2, updatedAt: demoTimestamp() };
      }
      return readJsonSource(config, context);
    },
  };
}
