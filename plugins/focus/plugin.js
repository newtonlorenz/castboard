export function createPlugin({config}) {
  return { id: 'focus', assets: ['style.css'], styles: ['style.css'], name: 'Focus lane', publicConfig: () => ({title:config.title||'',emptyText:config.emptyText||'Open focus time',showRecovery:config.showRecovery!==false}) };
}
