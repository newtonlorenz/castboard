import { formatNumber, getPluginData, schedule, title, unavailable } from '/widget-kit.js';

export function mount({ element, config, context }) {
  element.classList.toggle('solar-compact',config.compact===true);
  const display=value=>value===null || value===undefined?'—':formatNumber(value);
  const load = async () => {
    try {
      const data = await context.data();
      const generated = Number(data.generatedKw) || 0;
      const loadKw = Number(data.loadKw) || 0;
      const share = generated > 0 ? Math.min(100, Math.round((Math.min(generated, loadKw) / generated) * 100)) : 0;
      element.style.setProperty('--solar-share', `${share}%`);
      element.innerHTML = `${title(config.title || 'Solar',config.compact?(config.demo?'Sample':''):data.gridImportKw>0?'Importing':data.gridExportKw>0?'Exporting':data.gridImportKw===0 && data.gridExportKw===0?'Balanced':'Unavailable')}<div class="solar-metrics"><div class="solar-metric"><strong>${display(data.generatedKw)} kW</strong><span>Generated</span></div><div class="solar-metric"><strong>${display(data.loadKw)} kW</strong><span>Home load</span></div><div class="solar-metric"><strong>${display(data.gridImportKw>0?data.gridImportKw:data.gridExportKw)} kW</strong><span>${Number(data.gridImportKw) > 0 ? 'Grid used' : 'Exported'}</span></div></div><div class="solar-flow"></div>`;
    } catch (error) { unavailable(element, config.title || 'Solar', error); }
  };
  context.schedule(load, 15000);
}
