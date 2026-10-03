const $=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const categoryName=item=>item.category||pkgFor(item.type)?.category||(item.hasWidget?'Displays':'Sources & support');
const packageIcon=item=>{const category=categoryName(item).toLowerCase();const paths=category.includes('display')||item.hasWidget?'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8m-4-3v3M7 8h4v6H7zm8 0h2m-2 4h2"/>':category.includes('source')?'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>':'<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>';return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;};
let data,collection='installed',selected=new URLSearchParams(location.search).get('plugin')||'',installType='',busy=false,dirty=false;
let token=sessionStorage.getItem('castboard-admin-token')||'';
const edits={},clears=new Set();let sourceEdits;
async function request(url,init={}){
 const response=await fetch(url,{...init,headers:{...(init.body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},cache:'no-store'});
 const payload=await response.json();
 if(response.status===403){if(!$('#token-dialog').open)$('#token-dialog').showModal();throw new Error('Enter your admin token to continue.');}
 if(!response.ok)throw new Error(payload.error?.message||'The request failed.');
 return payload;
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');setTimeout(()=>$('#toast').classList.remove('visible'),2500);}
function resetEdits(){for(const key of Object.keys(edits))delete edits[key];clears.clear();sourceEdits=undefined;dirty=false;}
function canLeave(){if(busy)return false;return !dirty||confirm('Discard the unsaved plugin settings?');}
function stateMessage(message){const el=$('#plugin-save-state');if(el)el.textContent=message;}
function changed(){dirty=true;stateMessage('Unsaved changes');const save=$('#save-plugin');if(save)save.disabled=busy;}
function pkgFor(type){return data.packages.find(pkg=>pkg.id===type);}
function renderList(){
 if(!data)return;
 const search=$('#plugin-search').value.toLowerCase(),category=$('#plugin-category').value;
 $('.plugin-workspace').classList.toggle('library-mode',collection==='library');
 const entries=(collection==='installed'?data.instances:data.packages).filter(item=>`${item.name} ${item.id} ${item.type||''} ${item.category||pkgFor(item.type)?.category||''}`.toLowerCase().includes(search)&&(!category||categoryName(item)===category)).sort((a,b)=>Number(Boolean(b.hasWidget))-Number(Boolean(a.hasWidget))||a.name.localeCompare(b.name));
 $('#show-installed').setAttribute('aria-pressed',String(collection==='installed'));$('#show-library').setAttribute('aria-pressed',String(collection==='library'));$('#show-installed').classList.toggle('active',collection==='installed');$('#show-library').classList.toggle('active',collection==='library');
 $('#plugin-roster').innerHTML=entries.map(item=>{
  const pkg=collection==='installed'?pkgFor(item.type):item;
  const count=collection==='installed'?item.usedBy.filter(use=>use.kind==='panel').length:data.instances.filter(instance=>instance.type===item.id).length;
  return `<article class="plugin-row ${collection==='installed'&&item.id===selected?'selected':''}"><div class="plugin-row-icon">${packageIcon(item)}</div><div class="plugin-row-copy"><h2>${escapeHtml(item.name)}</h2><p class="plugin-description">${escapeHtml(pkg?.description||'Locally installed plugin.')}</p><p class="plugin-meta">${collection==='installed'?`${count} panel${count===1?'':'s'} · ${escapeHtml(item.id)}`:escapeHtml(categoryName(item))+' · '+escapeHtml(item.origin)}</p>${collection==='installed'?`<span class="plugin-status ${item.enabled?'enabled':''}">${item.enabled?'Enabled':'Disabled'}</span>`:`<span class="plugin-version">v${escapeHtml(item.version||'1.0.0')}${count?` · ${count} installed`:''}</span>`}</div><button class="button row-action" ${collection==='library'&&!item.managed?'disabled':''} data-${collection==='installed'?'select':'install'}="${escapeHtml(item.id)}" aria-label="${collection==='installed'?'Configure':'Install'} ${escapeHtml(item.name)} (${escapeHtml(item.id)})">${collection==='installed'?'Configure':'Install'}</button></article>`;
 }).join('')||'<p class="plugin-empty">No plugins match this search.</p>';
 for(const button of document.querySelectorAll('[data-select]'))button.onclick=()=>{if(!canLeave())return;selected=button.dataset.select;resetEdits();renderList();renderDetail();if(innerWidth<=1000)$('#plugin-detail').scrollIntoView({behavior:'auto',block:'start'});};
 for(const button of document.querySelectorAll('[data-install]'))button.onclick=()=>openInstall(button.dataset.install);
}
function showRelevantFields(instance){
 const values={...pkgFor(instance.type)?.defaultConfig,...instance.settings,...edits};
 for(const label of document.querySelectorAll('[data-setting]')){
  const field=instance.settingsSchema.properties[label.dataset.setting];
  label.hidden=Boolean(field.showWhen&&!Object.entries(field.showWhen).every(([key,allowed])=>allowed.includes(values[key])));
 }
}
function settingField(key,field,instance){
 const protectedField=instance.protectedFields.includes(key)||field.sensitive;
 const value=protectedField?'':instance.settings[key]??pkgFor(instance.type)?.defaultConfig?.[key]??field.default??'';
 const label=document.createElement('label');label.className=`field${field.type==='boolean'?' boolean-field':''}${protectedField?' secret-field':''}`;label.dataset.setting=key;
 const heading=document.createElement('span');heading.textContent=field.title||key;label.append(heading);
 if(protectedField){const status=document.createElement('small');status.className='field-state';status.textContent=instance.protectedFields.includes(key)?'Configured · hidden':'Not configured';heading.append(status);}
 let input;
 if(field.enum){input=document.createElement('select');if(value===''){const option=document.createElement('option');option.value='';option.textContent='Use default';input.append(option);}for(const optionValue of field.enum){const option=document.createElement('option');option.value=optionValue;option.textContent=field.enumLabels?.[optionValue]||optionValue;input.append(option);}}
 else if(['array','object'].includes(field.type)){input=document.createElement('textarea');input.rows=3;}
 else{input=document.createElement('input');input.type=protectedField?'password':field.type==='boolean'?'checkbox':['integer','number'].includes(field.type)?'number':'text';if(field.minimum!==undefined)input.min=field.minimum;if(field.maximum!==undefined)input.max=field.maximum;if(field.type==='number')input.step='any';}
 input.id=`setting-${key}`;input.name=key;input.autocomplete='off';input.required=Boolean(instance.settingsSchema.required?.includes(key))&&!instance.protectedFields.includes(key);
 if(field.type==='boolean')input.checked=Boolean(value);else input.value=['array','object'].includes(field.type)&&value!==''?JSON.stringify(value,null,2):value;
 if(protectedField)input.placeholder=instance.protectedFields.includes(key)?'Leave empty to keep the saved value':'Enter a value';
 input.addEventListener(field.enum||field.type==='boolean'?'change':'input',()=>{
  input.setCustomValidity('');
  try{
   const raw=input.value;
   if(raw===''&&field.type!=='boolean'){delete edits[key];if(!protectedField)clears.add(key);}
   else{let value=field.type==='boolean'?input.checked:['integer','number'].includes(field.type)?Number(raw):['array','object'].includes(field.type)?JSON.parse(raw):raw;if(field.type==='array'&&!Array.isArray(value))throw new Error();if(field.type==='object'&&(!value||typeof value!=='object'||Array.isArray(value)))throw new Error();edits[key]=value;clears.delete(key);}
   changed();showRelevantFields(instance);
  }catch{input.setCustomValidity('Enter valid JSON for this field.');changed();}
 });label.append(input);
 if(field.description){const text=document.createElement('small');text.textContent=field.description;label.append(text);}
 if(protectedField&&instance.protectedFields.includes(key)){
  const clearLabel=document.createElement('span');clearLabel.className='clear-setting';const clear=document.createElement('input');clear.type='checkbox';clear.setAttribute('aria-label',`Clear saved ${field.title||key}`);clear.onchange=()=>{if(clear.checked){clears.add(key);delete edits[key];input.disabled=true;}else{clears.delete(key);input.disabled=false;}changed();};clearLabel.append(clear,document.createTextNode('Clear saved value'));label.append(clearLabel);
 }
 return label;
}
function renderDetail(){
 const instance=data.instances.find(item=>item.id===selected),detail=$('#plugin-detail');
 if(!instance){detail.innerHTML='<div class="detail-empty"><h2>Choose a plugin</h2><p>Select an installed plugin to edit its settings, or browse the library to add something new.</p></div>';return;}
 const pkg=pkgFor(instance.type),usage=instance.usedBy;
 detail.innerHTML=`<header class="detail-heading"><div class="detail-icon">${packageIcon(instance)}</div><div><h2>${escapeHtml(instance.name)}</h2><p>${escapeHtml(categoryName(instance))} · v${escapeHtml(instance.version)}</p></div><span class="plugin-status ${instance.enabled?'enabled':''}">${instance.enabled?'Enabled':'Disabled'}</span></header><p class="detail-description">${escapeHtml(pkg?.description||'Settings for this installed plugin.')}</p><div class="detail-actions"><button class="button" id="test-plugin" ${!instance.enabled?'disabled':''}>Test connection</button>${instance.hasWidget?'<button class="button" id="choose-screen" type="button">Add to a screen</button>':''}</div><div id="screen-choice" hidden><label class="field"><span>Screen</span><select id="plugin-screen">${data.screens.map(screen=>`<option value="${escapeHtml(screen.id)}">${escapeHtml(screen.title)}</option>`).join('')}</select></label><a id="screen-editor-link" class="button" href="/admin">Open editor</a></div><p id="test-result" role="status"></p><form id="plugin-form"><h3 class="settings-heading">Settings</h3><div id="settings-fields"></div><section id="source-section" hidden><h3>Source connections</h3><div id="source-fields"></div></section><section><h3>Used by</h3>${usage.length?`<ul class="usage-list">${usage.map(use=>`<li>${use.kind==='panel'?`<a href="/admin?screen=${encodeURIComponent(use.screenId)}">${escapeHtml(use.screenTitle)}</a> · ${escapeHtml(use.title)}`:`Plugin ${escapeHtml(use.title)}`}</li>`).join('')}</ul>`:'<p class="hint">No panels or plugins use this copy yet.</p>'}</section><p id="plugin-save-state" class="saved-state" role="status">All changes saved</p><p id="save-error" class="field-error" role="alert"></p><footer><button id="save-plugin" class="button primary" type="submit" disabled>Save settings</button><button class="button" id="reset-settings" type="button">Reset draft</button><button class="button" id="toggle-plugin" type="button" ${usage.length&&instance.enabled?'disabled':''}>${instance.enabled?'Disable':'Enable'}</button><button id="remove-plugin" class="button danger" type="button" ${usage.length?'disabled':''}>Remove</button></footer>${usage.length?'<p class="hint">Remove its panels and source connections before disabling or removing this plugin.</p>':''}</form>`;
 const fields=$('#settings-fields');for(const [key,field]of Object.entries(instance.settingsSchema.properties||{}))fields.append(settingField(key,field,instance));
 if(!fields.children.length)fields.innerHTML='<p class="settings-empty">This plugin has no connection settings. Its display options are in the screen editor.</p>';
 const aliases=[...new Set([...Object.keys(pkg?.defaultBindings||{}),...Object.keys(instance.bindings)])];
 if(aliases.length){$('#source-section').hidden=false;for(const alias of aliases){const label=document.createElement('label');label.className='field';const text=document.createElement('span');text.textContent=({runtime:'Display runtime',theme:'Theme',config:'Shared configuration',services:'Data services',upstream:'Data source'})[alias]||alias.replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());const input=document.createElement('select');input.innerHTML='<option value="">Not connected</option>'+data.instances.filter(item=>{const expected=data.instances.find(source=>source.id===instance.bindings[alias])||data.instances.find(source=>source.type===pkg?.defaultBindings?.[alias]);return item.enabled&&item.id!==instance.id&&(!expected||(expected.contract?item.contract===expected.contract:expected.hasData?item.hasData:expected.hasAction?item.hasAction:item.type===expected.type));}).map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} (${escapeHtml(item.id)})</option>`).join('');input.value=instance.bindings[alias]||'';input.onchange=()=>{sourceEdits||={...instance.bindings};if(input.value)sourceEdits[alias]=input.value;else delete sourceEdits[alias];changed();};label.append(text,input);$('#source-fields').append(label);}}
 showRelevantFields(instance);
 if($('#choose-screen')){$('#choose-screen').onclick=()=>{$('#screen-choice').hidden=!$('#screen-choice').hidden;};const updateLink=()=>{$('#screen-editor-link').href=`/admin?screen=${encodeURIComponent($('#plugin-screen').value)}&plugin=${encodeURIComponent(instance.id)}`;};$('#plugin-screen').onchange=updateLink;updateLink();}
 $('#plugin-form').onsubmit=async event=>{event.preventDefault();if(!event.target.reportValidity())return;await mutate({action:'configure',id:instance.id,settings:{...edits},clear:[...clears],...(sourceEdits?{bindings:sourceEdits}:{})});};
 $('#reset-settings').onclick=()=>{resetEdits();renderDetail();};
 $('#toggle-plugin').onclick=()=>{if(canLeave())void mutate({action:'enable',id:instance.id,enabled:!instance.enabled});};
 $('#remove-plugin').onclick=()=>{if(canLeave())void mutate({action:'remove',id:instance.id});};
 $('#test-plugin').onclick=async()=>{const button=$('#test-plugin');button.disabled=true;$('#test-result').textContent='Testing connection…';try{const result=await request('/api/admin/setup/test-plugin',{method:'POST',body:JSON.stringify({pluginId:instance.id})});$('#test-result').textContent=result.message;}catch(error){$('#test-result').textContent=error.message;}finally{button.disabled=false;}};
}
async function mutate(change){
 if(busy)return;busy=true;stateMessage('Saving…');const form=$('#plugin-form');const locked=[...document.querySelectorAll('.plugin-workspace button,.plugin-workspace input,.plugin-workspace select,.plugin-workspace textarea,#refresh-plugins,#install-form button,#install-form input')].map(el=>[el,el.disabled]);for(const [el]of locked)el.disabled=true;
 try{data=await request('/api/admin/plugins',{method:'POST',body:JSON.stringify({...change,revision:data.revision})});resetEdits();renderCategories();if(change.action==='install'){selected=change.id;collection='installed';$('#plugin-search').value='';$('#plugin-category').value='';$('#install-dialog').close();}if(change.action==='remove')selected='';renderList();renderDetail();$('#page-status').textContent=`${data.instances.length} installed · ${data.packages.length} in the library`;toast(change.action==='configure'?'Settings saved and applied.':'Plugin list updated.');}
 catch(error){const output=change.action==='install'?$('#install-error'):$('#save-error');if(output)output.textContent=error.message;else toast(error.message);if(form){$('#save-plugin').disabled=!dirty;$('#reset-settings').disabled=false;const current=data.instances.find(item=>item.id===selected);$('#toggle-plugin').disabled=Boolean(current?.enabled&&current?.usedBy.length);$('#remove-plugin').disabled=Boolean(current?.usedBy.length);}}
 finally{for(const [el,disabled]of locked)if(el.isConnected)el.disabled=disabled;busy=false;if(dirty)stateMessage('Unsaved changes · save failed');}
}
function openInstall(type){if(!canLeave())return;installType=type;const pkg=pkgFor(type);$('#install-title').textContent=`Install ${pkg.name}`;$('#install-note').textContent=pkg.dependencies?.length?`Also connects required plugins: ${pkg.dependencies.join(', ')}.`:'Default settings are ready to try. Configure the data provider after installing.';let id=type,n=2;while(data.instances.some(item=>item.id===id))id=`${type}-${n++}`;$('#install-id').value=id;$('#install-error').textContent='';$('#install-dialog').showModal();}
async function load(){try{data=await request('/api/admin/plugins');if(!selected)selected=data.instances.find(item=>item.hasWidget)?.id||data.instances[0]?.id||'';renderCategories();resetEdits();renderList();renderDetail();$('#page-status').textContent=`${data.instances.length} installed · ${data.packages.length} in the library`;}catch(error){$('#page-status').textContent=error.message;}}
function renderCategories(){const input=$('#plugin-category'),previous=input.value;const categories=[...new Set([...data.packages,...data.instances].map(categoryName))].sort();input.innerHTML='<option value="">All categories</option>'+categories.map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');input.value=categories.includes(previous)?previous:'';}
$('#plugin-category').onchange=renderList;
$('#show-installed').onclick=()=>{collection='installed';renderList();};$('#show-library').onclick=()=>{collection='library';renderList();};$('#plugin-search').oninput=renderList;
$('#refresh-plugins').onclick=()=>{if(canLeave())void load();};$('#cancel-install').onclick=()=>$('#install-dialog').close();
$('#install-form').onsubmit=async event=>{event.preventDefault();if(event.target.reportValidity())await mutate({action:'install',id:$('#install-id').value,type:installType});};
$('#token-form').onsubmit=async event=>{event.preventDefault();token=$('#admin-token').value.trim();sessionStorage.setItem('castboard-admin-token',token);$('#token-dialog').close();await load();};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
void load();
