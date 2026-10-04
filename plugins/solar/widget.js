import { escapeHtml, formatNumber, getPluginData, schedule, title, unavailable } from '/widget-kit.js?v=0.13.0';

export function mount({ element, config, context }) {
  element.classList.toggle('solar-compact',config.compact===true);
  const unit=config.powerUnit || 'kW';
  const display=value=>value===null || value===undefined?'—':formatNumber(unit==='W'?value*1000:value,config.precision ?? 1);
  const load = async () => {
    try {
      const data = await context.data();
      const generated = Number(data.generatedKw) || 0;
      const loadKw = Number(data.loadKw) || 0;
      const share = generated > 0 ? Math.min(100, Math.round((Math.min(generated, loadKw) / generated) * 100)) : 0;
      element.style.setProperty('--solar-share', `${share}%`);
      element.innerHTML = `${title(config.title || 'Solar',config.compact?(config.demo?'Sample':''):data.gridImportKw>0?'Importing':data.gridExportKw>0?'Exporting':data.gridImportKw===0 && data.gridExportKw===0?'Balanced':'Unavailable')}<div class="solar-metrics"><div class="solar-metric"><strong>${display(data.generatedKw)} ${unit}</strong><span>Generated</span></div><div class="solar-metric"><strong>${display(data.loadKw)} ${unit}</strong><span>${escapeHtml(config.loadLabel || 'Home load')}</span></div><div class="solar-metric"><strong>${display(data.gridImportKw>0?data.gridImportKw:data.gridExportKw)} ${unit}</strong><span>${Number(data.gridImportKw) > 0 ? 'Grid used' : 'Exported'}</span></div></div><div class="solar-flow"></div>`;
    } catch (error) { unavailable(element, config.title || 'Solar', error); }
    if(config.showGrid===false)element.querySelectorAll('.solar-metric')[2]?.remove();
  };
  context.schedule(load, (config.refreshSeconds || 15)*1000);
}
