import { escapeHtml, formatNumber, getPluginData, schedule, title, unavailable } from '/widget-kit.js?v=0.14.0';

export function mount({ element, config, context }) {
  element.classList.toggle('solar-compact',config.compact===true);
  const unit=config.powerUnit || 'kW';
  const display=value=>value===null || value===undefined?'—':formatNumber(unit==='W'?value*1000:value,config.precision ?? 1);
  const flowIcon = state => `<svg class="energy-direction" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${state==='supply'?'M2 10 10 2M4 2h6v6':state==='demand'?'M2 2l8 8M4 10h6V4':'M2 6h8'}"/></svg>`;
  const flowState = (value, active) => typeof value==='number' && Number.isFinite(value) && value>0 ? active : 'idle';
  const metric = (value, label, state) => `<div class="solar-metric" data-energy="${state}"><strong>${display(value)} ${unit}</strong><span>${config.compact?flowIcon(state):''}${escapeHtml(label)}</span></div>`;
  const load = async () => {
    try {
      const data = await context.data();
      const generated = Number(data.generatedKw) || 0;
      const loadKw = Number(data.loadKw) || 0;
      const share = generated > 0 ? Math.min(100, Math.round((Math.min(generated, loadKw) / generated) * 100)) : 0;
      element.style.setProperty('--solar-share', `${share}%`);
      const importing = Number(data.gridImportKw)>0;
      const gridKnown = typeof data.gridImportKw==='number' && Number.isFinite(data.gridImportKw) && typeof data.gridExportKw==='number' && Number.isFinite(data.gridExportKw);
      const gridValue = importing ? data.gridImportKw : gridKnown ? data.gridExportKw : null;
      const gridState = flowState(gridValue, importing ? 'demand' : 'supply');
      const gridLabel = gridValue===null ? 'Grid unknown' : gridValue===0 ? 'Grid idle' : importing ? (config.compact?'Grid in':'Grid used') : (config.compact?'Grid out':'Exported');
      element.innerHTML = `${title(config.title || 'Solar',config.compact?(config.demo?'Sample':''):importing?'Importing':data.gridExportKw>0?'Exporting':gridKnown?'Balanced':'Unavailable')}<div class="solar-metrics">${metric(data.generatedKw,'Generated',flowState(data.generatedKw,'supply'))}${metric(data.loadKw,config.loadLabel || (config.compact?'Home use':'Home load'),flowState(data.loadKw,'demand'))}${metric(gridValue,gridLabel,gridState)}</div><div class="solar-flow"></div>`;
    } catch (error) { unavailable(element, config.title || 'Solar', error); }
    if(config.showGrid===false)element.querySelectorAll('.solar-metric')[2]?.remove();
  };
  context.schedule(load, (config.refreshSeconds || 15)*1000);
}
