import { demoTimestamp, fetchJson, readJsonSource } from '../../src/core/providers.js';

const number = value => Number.isFinite(Number(value)) ? Number(value) : null;
const kw = value => number(value) === null ? null : Math.round(number(value) / 10) / 100;

export function createPlugin({ config, context }) {
  return {
    id: 'solar',
    name: 'Solar',
    publicConfig: () => ({ title: config.title || 'Solar' }),
    async getData() {
      if (config.provider === 'demo') return { generatedKw: 3.8, loadKw: 2.1, gridImportKw: 0, gridExportKw: 1.7, updatedAt: demoTimestamp() };
      if (config.provider === 'fronius') {
        if (!config.baseUrl) throw new Error('fronius provider requires baseUrl');
        const data = await fetchJson(`${String(config.baseUrl).replace(/\/$/, '')}/solar_api/v1/GetPowerFlowRealtimeData.fcgi`);
        const site = data?.Body?.Data?.Site || {};
        const generated = number(site.P_PV);
        const load = Math.abs(number(site.P_Load) || 0);
        const grid = number(site.P_Grid) || 0;
        return { generatedKw: kw(generated), loadKw: kw(load), gridImportKw: kw(Math.max(0, grid)), gridExportKw: kw(Math.max(0, -grid)), updatedAt: data?.Head?.Timestamp || demoTimestamp() };
      }
      return readJsonSource(config, context);
    },
  };
}
