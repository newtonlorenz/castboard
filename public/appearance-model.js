export const FONT_STACKS = {
  sans: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  rounded: '"Avenir Next Rounded", "Arial Rounded MT Bold", ui-rounded, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
};
export const PANEL_SHADOWS = {
  none: 'none',
  soft: 'inset 0 1px rgba(255,255,255,.035), 0 8px 22px rgba(0,0,0,.14)',
  deep: 'inset 0 1px rgba(255,255,255,.05), 0 18px 42px rgba(0,0,0,.42)',
};
export function panelStyle(appearance = {}, screen = {}) {
  const inherited = {...screen,background:screen.panelBackground,padding:screen.panelPadding};
  const effective = {...inherited,...appearance};
  const styles = {'font-size':`${16*(screen.fontScale??100)/100*(appearance.fontScale??100)/100}px`,'--castboard-text-scale':String((screen.fontScale??100)/100*(appearance.fontScale??100)/100)};
  const vars={accent:'--accent',textColor:'--text',mutedColor:'--muted',borderColor:'--line',positiveColor:'--good',negativeColor:'--bad',background:'--panel-background'};
  for(const [field,variable] of Object.entries(vars)) if(effective[field]!==undefined) {styles[variable]=effective[field];styles[`--castboard-${field}`]=effective[field];}
  for(const field of ['fontFamily','headingFontFamily']) if(effective[field]) {const variable=field==='fontFamily'?'--font-family':'--heading-font-family';styles[variable]=FONT_STACKS[effective[field]];styles[`--castboard-${field}`]=FONT_STACKS[effective[field]];}
  if(effective.fontFamily)styles['font-family']=FONT_STACKS[effective.fontFamily];
  for(const [field,property] of Object.entries({background:'background',textColor:'color',radius:'border-radius',padding:'padding',borderWidth:'border-width',borderColor:'border-color'}))if(effective[field]!==undefined) {styles[property]=['radius','padding','borderWidth'].includes(field)?`${effective[field]}px`:effective[field];styles[`--castboard-${field}`]=styles[property];}
  for(const [field,variable] of Object.entries({radius:'--panel-radius',padding:'--panel-padding',borderWidth:'--panel-border-width'}))if(effective[field]!==undefined)styles[variable]=`${effective[field]}px`;
  if(effective.shadow){styles['--panel-shadow']=PANEL_SHADOWS[effective.shadow];styles['box-shadow']=PANEL_SHADOWS[effective.shadow];styles['--castboard-shadow']=PANEL_SHADOWS[effective.shadow];}
  return styles;
}
export function previewStructure(config, screenId) {
  const screen=config.screens[screenId];
  if(!screen)return '';
  const {appearance,layout,panels,...rest}=screen;
  return JSON.stringify({plugins:config.plugins,sources:config.sources,screenTypes:config.screenTypes,branding:config.branding,screen:{...rest,panels:panels.map(({appearance,position,size,...panel})=>panel)}});
}
