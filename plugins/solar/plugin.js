import { nativeViews } from '../../src/core/native-views.js';
import { demoTimestamp, fetchJson, readJsonSource, validateProviderConfig } from '../../src/core/providers.js';

const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const kw = value => number(value) === null ? null : Math.round(number(value) / 10) / 100;

export function createPlugin({ config, context }) {
  validateProviderConfig('solar', config, ['demo', 'fronius', 'http-json', 'file-json']);
  if (config.provider === 'fronius' && !config.baseUrl) throw new Error('Plugin solar fronius provider requires baseUrl');
  return {
    id: 'solar',
    nativeView: nativeViews.solar,
    assets: ['style.css'],
    styles: ['style.css'],
    name: 'Solar',
    publicConfig: () => ({compact:config.compact===true,  demo: config.provider==='demo', title: config.title || 'Solar' }),
    async getData() {
      if (config.provider === 'demo') return { generatedKw: 3.8, loadKw: 2.1, gridImportKw: 0, gridExportKw: 1.7, updatedAt: demoTimestamp() };
      if (config.provider === 'fronius') {
        if (!config.baseUrl) throw new Error('fronius provider requires baseUrl');
        const data = await fetchJson(`${String(config.baseUrl).replace(/\/$/, '')}/solar_api/v1/GetPowerFlowRealtimeData.fcgi`, {headers:config.headers || {}}, config.timeoutMs || 8000);
        const site = data?.Body?.Data?.Site || {};
        const generated = number(site.P_PV);
        const load = number(site.P_Load);
        const grid = number(site.P_Grid);
        return { generatedKw: kw(generated), loadKw: load===null?null:kw(Math.abs(load)), gridImportKw: grid===null?null:kw(Math.max(0, grid)), gridExportKw: grid===null?null:kw(Math.max(0, -grid)), updatedAt: data?.Head?.Timestamp || demoTimestamp() };
      }
      return readJsonSource(config, context);
    },
  };
}
