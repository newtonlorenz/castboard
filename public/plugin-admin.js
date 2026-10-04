import { recordListField } from '/record-list-field.js';
import { mergeDraft, resolveDraft, sameValue, safePluginDraft, protectedSetting } from '/draft-model.js';
const $=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const categoryName=item=>item.category||pkgFor(item.type)?.category||(item.hasWidget?'Displays':'Sources & support');
const packageIcon=item=>{const category=categoryName(item).toLowerCase();const paths=category.includes('display')||item.hasWidget?'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8m-4-3v3M7 8h4v6H7zm8 0h2m-2 4h2"/>':category.includes('source')?'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>':'<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>';return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;};
let data,collection=new URLSearchParams(location.search).get('collection')==='library'?'library':'installed',selected=new URLSearchParams(location.search).get('plugin')||'',installType='',busy=false,dirty=false;
let token=sessionStorage.getItem('castboard-admin-token')||'';
const edits={},clears=new Set();let sourceEdits;
const pluginDraftKey='castboard-plugin-drafts';
const drafts=new Map();
let draftRevision='',draftBase,pendingPluginMerge,editVersion=0;
try { for(const [id,draft] of Object.entries(JSON.parse(sessionStorage.getItem(pluginDraftKey)||'{}'))) drafts.set(id,draft); } catch {}
function saveDrafts(){try{sessionStorage.setItem(pluginDraftKey,JSON.stringify(Object.fromEntries([...drafts].map(([id,draft])=>[id,safePluginDraft(draft)]))));}catch{}}
function rememberSelection(){const url=new URL(location.href);selected?url.searchParams.set('plugin',selected):url.searchParams.delete('plugin');collection==='library'?url.searchParams.set('collection','library'):url.searchParams.delete('collection');history.replaceState(null,'',url);}
function captureDraft(){
 if(!dirty||!draftBase)return;
 const inputs={};for(const input of document.querySelectorAll('#settings-fields input[name],#settings-fields select[name],#settings-fields textarea[name]'))if(!input.validity.valid)inputs[input.name]={value:input.value,message:input.validationMessage};
 drafts.set(selected,{revision:draftRevision,base:structuredClone(draftBase),edits:structuredClone(edits),clears:[...clears],...(sourceEdits?{bindings:structuredClone(sourceEdits)}:{}),inputs,omitted:drafts.get(selected)?.omitted||[]});saveDrafts();
}
function clearDraft(id=selected){drafts.delete(id);saveDrafts();}
function restoreEdits(instance){
 const draft=drafts.get(instance.id);draftBase=draft?.base||structuredClone(instance);draftRevision=draft?.revision||data.revision;
 if(!draft)return;
 Object.assign(edits,draft.edits);for(const key of draft.clears||[])clears.add(key);sourceEdits=draft.bindings;dirty=true;
}
function revealRecovery(message,actions=[]){const box=$('#plugin-recovery');box.replaceChildren();box.hidden=!message;if(!message)return;const text=document.createElement('p');text.textContent=message;box.append(text);for(const [label,action]of actions){const button=document.createElement('button');button.className='button secondary';button.type='button';button.textContent=label;button.onclick=action;box.append(button);}}

async function request(url,init={}){
 let response;
 try{response=await fetch(url,{...init,headers:{...(init.body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},cache:'no-store'});}
 catch{throw new Error('Could not reach Castboard. Check your connection, then try again.');}
 const payload=await response.json();
 if(response.status===403){$('#token-error').textContent=token?'Access was denied. Check your token and the server’s admin access settings.':'';$('#admin-token').setAttribute('aria-invalid',String(Boolean(token)));if(!$('#token-dialog').open)$('#token-dialog').showModal();$('#admin-token').focus();$('#admin-token').select();throw new Error('Enter your admin token to continue.');}
 if(!response.ok){const error=new Error(payload.error?.message||'The request failed.');error.code=payload.error?.code;error.status=response.status;throw error;}
 return payload;
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');setTimeout(()=>$('#toast').classList.remove('visible'),2500);}
function resetEdits(){for(const key of Object.keys(edits))delete edits[key];clears.clear();sourceEdits=undefined;dirty=false;}
function canLeave(){if(busy)return false;captureDraft();return true;}
function stateMessage(message){const el=$('#plugin-save-state');if(el)el.textContent=message;}
function changed(){editVersion++;dirty=true;captureDraft();stateMessage('Unsaved changes');const save=$('#save-plugin');if(save)save.disabled=busy;const reset=$('#reset-settings');if(reset)reset.disabled=busy;const test=$('#test-plugin');if(test){test.disabled=true;$('#test-result').classList.remove('bad');$('#test-result').textContent='Save settings before testing your changes.';}}
function pkgFor(type){return data.packages.find(pkg=>pkg.id===type);}
function renderList(){
 if(!data)return;
 const search=$('#plugin-search').value.toLowerCase(),category=$('#plugin-category').value;
 $('.plugin-workspace').classList.toggle('library-mode',collection==='library');
 const missing=[...drafts].filter(([id])=>!data.instances.some(item=>item.id===id)).map(([id,draft])=>({...draft.base,id,missing:true,usedBy:[],enabled:false}));
 const entries=(collection==='installed'?[...data.instances,...missing]:data.packages).filter(item=>`${item.name} ${item.id} ${item.type||''} ${item.category||pkgFor(item.type)?.category||''}`.toLowerCase().includes(search)&&(!category||categoryName(item)===category)).sort((a,b)=>Number(Boolean(b.hasWidget))-Number(Boolean(a.hasWidget))||a.name.localeCompare(b.name));
 $('#show-installed').setAttribute('aria-pressed',String(collection==='installed'));$('#show-library').setAttribute('aria-pressed',String(collection==='library'));$('#show-installed').classList.toggle('active',collection==='installed');$('#show-library').classList.toggle('active',collection==='library');
 $('#plugin-roster').innerHTML=entries.map(item=>{
  const pkg=collection==='installed'?pkgFor(item.type):item;
  const count=collection==='installed'?item.usedBy.filter(use=>use.kind==='panel').length:data.instances.filter(instance=>instance.type===item.id).length;
  return `<article class="plugin-row ${collection==='installed'&&item.id===selected?'selected':''}"><div class="plugin-row-icon">${packageIcon(item)}</div><div class="plugin-row-copy"><h2>${escapeHtml(item.name)}</h2><p class="plugin-description">${escapeHtml(pkg?.description||'Locally installed plugin.')}</p><p class="plugin-meta">${collection==='installed'?`${count} panel${count===1?'':'s'} · ${escapeHtml(item.id)}`:escapeHtml(categoryName(item))+' · '+escapeHtml(item.origin)}</p>${collection==='installed'?`<span class="plugin-status ${item.enabled?'enabled':''}">${item.missing?'Removed copy':item.enabled?'Enabled':'Disabled'}${drafts.has(item.id)?' · Draft':''}</span>`:`<span class="plugin-version">v${escapeHtml(item.version||'1.0.0')}${count?` · ${count} installed`:''}</span>`}</div><button class="button row-action" ${collection==='library'&&!item.managed?'disabled':''} data-${collection==='installed'?'select':'install'}="${escapeHtml(item.id)}" aria-label="${collection==='installed'?'Configure':'Install'} ${escapeHtml(item.name)} (${escapeHtml(item.id)})">${collection==='installed'?'Configure':'Install'}</button></article>`;
 }).join('')||'<p class="plugin-empty">No plugins match this search.</p>';
 for(const button of document.querySelectorAll('[data-select]'))button.onclick=()=>{if(selected===button.dataset.select)return;if(!canLeave())return;selected=button.dataset.select;resetEdits();rememberSelection();renderList();renderDetail();if(innerWidth<=1000)$('#plugin-detail').scrollIntoView({behavior:'auto',block:'start'});};
 for(const button of document.querySelectorAll('[data-install]'))button.onclick=()=>{if(canLeave())void mutate({action:'install',id:nextCopyId(button.dataset.install),type:button.dataset.install});};
}
function showRelevantFields(instance){
 const values={...pkgFor(instance.type)?.defaultConfig,...instance.settings,...edits};
 for(const label of document.querySelectorAll('[data-setting]')){
  const field=instance.settingsSchema.properties[label.dataset.setting];
  label.hidden=Boolean(field.showWhen&&!Object.entries(field.showWhen).every(([key,allowed])=>allowed.includes(values[key])));
  for(const input of label.querySelectorAll('input,select,textarea,button'))input.disabled=label.hidden||Boolean(input.dataset.recordLimit==='true')||Boolean(input.id===`setting-${label.dataset.setting}`&&label.querySelector('[data-clear-secret]')?.checked);
 }
 for(const group of document.querySelectorAll('.advanced-plugin-settings,.plugin-settings-group')){group.hidden=![...group.querySelectorAll('[data-setting]')].some(label=>!label.hidden);
 }
}
function settingField(key,field,instance){
 const protectedField=protectedSetting(key,field,instance.settings[key],instance.protectedFields);
 const lineList=field.type==='array'&&field.items?.type==='string'&&!protectedField;
 const value=Object.hasOwn(edits,key)?edits[key]:clears.has(key)?'':protectedField?'':instance.settings[key]??pkgFor(instance.type)?.defaultConfig?.[key]??field.default??'';
 const recordSchema=field.items?.anyOf?.find(item=>item.type==='object')||field.items;
 if(!protectedField&&field.type==='array'&&recordSchema?.type==='object'&&recordSchema.properties&&Object.values(recordSchema.properties).every(item=>['string','number','integer','boolean'].includes(item.type)))return recordListField(key,{...field,items:recordSchema},value,next=>{edits[key]=next;clears.delete(key);changed();});
 const label=document.createElement('label');label.className=`field${field.type==='boolean'?' boolean-field':''}${protectedField?' secret-field':''}`;label.dataset.setting=key;
 const heading=document.createElement('span');heading.textContent=field.title||key;label.append(heading);
 if(protectedField){const status=document.createElement('small');status.className='field-state';status.textContent=instance.protectedFields.includes(key)?'Configured · hidden':'Not configured';heading.append(status);}
 let input;
 if(field.enum){input=document.createElement('select');if(value===''){const option=document.createElement('option');option.value='';option.textContent='Use default';input.append(option);}for(const optionValue of field.enum){const option=document.createElement('option');option.value=optionValue;option.textContent=field.enumLabels?.[optionValue]||optionValue;input.append(option);}}
 else if(field.multiline || ['array','object'].includes(field.type)){input=document.createElement('textarea');input.rows=3;}
 else{input=document.createElement('input');input.type=protectedField?'password':field.type==='boolean'?'checkbox':['integer','number'].includes(field.type)?'number':field.format==='date-time'?'datetime-local':field.format==='uri'?'url':'text';if(field.minimum!==undefined)input.min=field.minimum;if(field.maximum!==undefined)input.max=field.maximum;if(field.type==='number')input.step='any';}
 input.id=`setting-${key}`;input.name=key;input.autocomplete='off';if(field.maxLength!==undefined)input.maxLength=field.maxLength;if(field.minLength!==undefined)input.minLength=field.minLength;input.required=field.type!=='boolean'&&Boolean(instance.settingsSchema.required?.includes(key))&&!instance.protectedFields.includes(key);
 if(field.type==='boolean')input.checked=Boolean(value);else input.value=field.format==='date-time'&&value?new Date(Date.parse(value)-new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16):lineList?(Array.isArray(value)?value.join('\n'):''):['array','object'].includes(field.type)&&value!==''?JSON.stringify(value,null,2):value;
 if(!protectedField&&field.placeholder)input.placeholder=field.placeholder;
 if(lineList)input.placeholder='One item per line';
 if(protectedField)input.placeholder=instance.protectedFields.includes(key)?'Leave empty to keep the saved value':'Enter a value';
 input.addEventListener(field.enum||field.type==='boolean'?'change':'input',()=>{
  input.setCustomValidity('');
  try{
   const raw=input.value;
   if(raw===''&&field.type!=='boolean'){delete edits[key];if(!protectedField)clears.add(key);}
   else{let value=field.enum?field.enum.find(item=>String(item)===raw):lineList?raw.split(/\r?\n/).map(item=>item.trim()).filter(Boolean):field.type==='boolean'?input.checked:['integer','number'].includes(field.type)?Number(raw):['array','object'].includes(field.type)?JSON.parse(raw):field.format==='date-time'?new Date(raw).toISOString():raw;if(field.type==='array'&&!Array.isArray(value))throw new Error();if(field.type==='object'&&(!value||typeof value!=='object'||Array.isArray(value)))throw new Error();edits[key]=value;clears.delete(key);}
   const stored=drafts.get(instance.id);if(stored?.omitted)stored.omitted=stored.omitted.filter(item=>item!==key);changed();showRelevantFields(instance);
  }catch{input.setCustomValidity('Enter valid JSON for this field.');changed();}
 });label.append(input);
 if(field.description){const text=document.createElement('small');text.textContent=field.description;label.append(text);}
 if(protectedField&&instance.protectedFields.includes(key)){
  const clearLabel=document.createElement('span');clearLabel.className='clear-setting';const clear=document.createElement('input');clear.type='checkbox';clear.dataset.clearSecret='';clear.setAttribute('aria-label',`Clear saved ${field.title||key}`);clear.checked=clears.has(key);input.disabled=clear.checked;clear.onchange=()=>{if(clear.checked){clears.add(key);delete edits[key];input.disabled=true;}else{clears.delete(key);input.disabled=false;}changed();};clearLabel.append(clear,document.createTextNode('Clear saved value'));label.append(clearLabel);
 }
 return label;
}
function renderUnavailableDraft(instance,draft){
 const replaced=Boolean(instance),pkg=pkgFor(draft.base.type),detail=$('#plugin-detail');
 detail.innerHTML=`<header class="detail-heading"><div><h2>${escapeHtml(draft.base.name)}</h2><p>${escapeHtml(selected)} · Unsaved draft</p></div></header><div id="plugin-recovery" class="plugin-recovery" role="status"></div><p id="save-error" class="field-error" role="alert"></p>`;
 const recover=()=>mutate({action:'install',id:replaced?nextCopyId(draft.base.type):selected,type:draft.base.type},{draft,previousId:selected});
 const discard=()=>{clearDraft();resetEdits();void load();};
 const actions=[];
 if(pkg?.managed)actions.push([replaced?'Restore as a new copy':'Reinstall this copy',recover]);
 actions.push(['Discard this draft',discard]);
 revealRecovery(replaced?'A different plugin now uses this copy’s name. Restore your draft as a new copy to keep both.':'This copy was removed in another window. Your draft is still here.'+(pkg?.managed?' Reinstall it to continue editing.':' Its package must be added to the library before it can be restored.'),actions);
}
function renderDetail(){
 const instance=data.instances.find(item=>item.id===selected),detail=$('#plugin-detail'),draft=drafts.get(selected);
 if(draft&&(!instance||draft.base.type!==instance.type)){resetEdits();renderUnavailableDraft(instance,draft);return;}
 if(!instance){detail.innerHTML='<div class="detail-empty"><h2>Choose a plugin</h2><p>Select an installed plugin to edit its settings, or browse the library to add something new.</p></div>';return;}
 restoreEdits(instance);
 const pkg=pkgFor(instance.type),usage=instance.usedBy;
 detail.innerHTML=`<header class="detail-heading"><div class="detail-icon">${packageIcon(instance)}</div><div><h2>${escapeHtml(instance.name)}</h2><p>${escapeHtml(categoryName(instance))} · v${escapeHtml(instance.version)}</p></div><span class="plugin-status ${instance.enabled?'enabled':''}">${instance.enabled?'Enabled':'Disabled'}</span></header><p class="detail-description">${escapeHtml(pkg?.description||'Settings for this installed plugin.')}</p><div class="detail-actions"><button class="button" id="test-plugin" ${!instance.hasData?'hidden':''} ${!instance.enabled?'disabled':''}>Test connection</button>${instance.hasWidget&&instance.enabled?'<button class="button primary" id="choose-screen" type="button">Add to a screen</button>':''}</div><div id="screen-choice" hidden><label class="field"><span>Screen</span><select id="plugin-screen">${data.screens.map(screen=>`<option value="${escapeHtml(screen.id)}" ${screen.type==='single'&&screen.panelCount?'disabled':''}>${escapeHtml(screen.title)}${screen.type==='single'&&screen.panelCount?' · full':''}</option>`).join('')}</select></label><button id="screen-editor-link" class="button primary" type="button">Add panel</button><p class="hint">Opens a draft in Screen Studio. Save there to update the display.</p></div><p id="test-result" role="status"></p><div id="plugin-recovery" class="plugin-recovery" role="status" hidden></div><form id="plugin-form"><h3 class="settings-heading">Settings</h3><div id="settings-fields"></div><section id="source-section" hidden><h3>Source connections</h3><div id="source-fields"></div></section><section><h3>Used by</h3>${usage.length?`<ul class="usage-list">${usage.map(use=>`<li>${use.kind==='panel'?`<a href="/admin?screen=${encodeURIComponent(use.screenId)}&panel=${encodeURIComponent(use.panelId)}">${escapeHtml(use.screenTitle)}</a> · ${escapeHtml(use.title)}`:`Plugin ${escapeHtml(use.title)}`}</li>`).join('')}</ul>`:'<p class="hint">No panels or plugins use this copy yet.</p>'}</section><p id="plugin-save-state" class="saved-state" role="status">All changes saved</p><p id="save-error" class="field-error" role="alert"></p><footer><button id="save-plugin" class="button primary" type="submit" disabled>Save settings</button><button class="button" id="reset-settings" type="button" disabled>Reset draft</button>${pkg?.managed?'<button class="button" id="new-copy" type="button">New copy…</button>':''}<button class="button" id="toggle-plugin" type="button" ${usage.length&&instance.enabled?'disabled':''}>${instance.enabled?'Disable':'Enable'}</button><button id="remove-plugin" class="button danger" type="button" ${usage.length?'disabled':''}>Remove</button></footer>${usage.length?'<p class="hint">Remove its panels and source connections before disabling or removing this plugin.</p>':''}</form>`;
 const fields=$('#settings-fields'),advanced=document.createElement('details');advanced.className='advanced-plugin-settings';const advancedTitle=document.createElement('summary');advancedTitle.textContent='Advanced connection settings';advanced.append(advancedTitle);const groups=new Map();for(const [key,field]of Object.entries(instance.settingsSchema.properties||{})){if(field.advanced){advanced.append(settingField(key,field,instance));continue;}const name=field.group||'General';if(!groups.has(name))groups.set(name,[]);groups.get(name).push([key,field]);}for(const name of ['General','Data source','Content','Display','Updates',...groups.keys()]){if(!groups.has(name))continue;const group=document.createElement('section');group.className='plugin-settings-group';const heading=document.createElement('h4');heading.textContent=name;group.append(heading);for(const [key,field]of groups.get(name))group.append(settingField(key,field,instance));groups.delete(name);fields.append(group);}if(advanced.children.length>1)fields.append(advanced);
 if(!fields.children.length)fields.innerHTML='<p class="settings-empty">This plugin has no connection settings. Its display options are in the screen editor.</p>';
 const aliases=[...new Set([...Object.keys(pkg?.defaultBindings||{}),...Object.keys(instance.bindings)])];
 if(aliases.length){$('#source-section').hidden=false;for(const alias of aliases){const label=document.createElement('label');label.className='field';const text=document.createElement('span');text.textContent=({runtime:'Display runtime',theme:'Theme',config:'Shared configuration',services:'Data services',upstream:'Data source'})[alias]||alias.replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());const input=document.createElement('select');input.innerHTML='<option value="">Not connected</option>'+data.instances.filter(item=>{const expected=data.instances.find(source=>source.id===instance.bindings[alias])||data.instances.find(source=>source.type===pkg?.defaultBindings?.[alias]);return item.enabled&&item.id!==instance.id&&(!expected||(expected.contract?item.contract===expected.contract:expected.hasData?item.hasData:expected.hasAction?item.hasAction:item.type===expected.type));}).map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} (${escapeHtml(item.id)})</option>`).join('');input.value=(sourceEdits||instance.bindings)[alias]||'';input.onchange=()=>{sourceEdits||={...instance.bindings};if(input.value)sourceEdits[alias]=input.value;else delete sourceEdits[alias];changed();};label.append(text,input);$('#source-fields').append(label);}}
 showRelevantFields(instance);
 const stored=drafts.get(instance.id);
 if(stored){
  for(const [key,inputState]of Object.entries(stored.inputs||{})){const input=document.getElementById(`setting-${key}`);if(input){input.value=inputState.value;input.setCustomValidity(inputState.message);}}
  stateMessage('Unsaved draft · kept in this tab');$('#save-plugin').disabled=false;$('#reset-settings').disabled=false;$('#test-plugin').disabled=true;
  const omitted=stored.omitted||[];
  if(omitted.length)revealRecovery(`Draft restored. Re-enter these protected values before saving: ${omitted.map(key=>instance.settingsSchema.properties[key]?.title||key).join(', ')}.`,[['Keep their saved values',()=>{stored.omitted=[];saveDrafts();revealRecovery('');}]]);
  else if(stored.revision!==data.revision)revealRecovery('Saved settings changed since this draft began. Review them before saving.',[['Review latest settings',reviewPluginChanges]]);
 }
 if($('#choose-screen')){
  const choices=data.screens.filter(screen=>screen.type!=='single'||!screen.panelCount);
  const add=()=>{if(!canLeave())return;resetEdits();location.assign(`/admin?screen=${encodeURIComponent($('#plugin-screen').value)}&addPlugin=${encodeURIComponent(instance.id)}`);};
  $('#plugin-screen').value=choices[0]?.id||'';
  $('#screen-editor-link').disabled=!choices.length;
  $('#screen-editor-link').onclick=add;
  $('#choose-screen').onclick=()=>{if(choices.length===1)return add();$('#screen-choice').hidden=!$('#screen-choice').hidden;if(!$('#screen-choice').hidden)$('#plugin-screen').focus();};
  if(!choices.length){$('#choose-screen').disabled=true;$('#screen-choice').hidden=false;$('#screen-choice .hint').textContent='Your single-panel screens are full. Add a screen or change a layout in Screen Studio.';}
 }
 $('#plugin-form').addEventListener('invalid',event=>{for(let el=event.target.parentElement;el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;},true);
 $('#plugin-form').onsubmit=async event=>{event.preventDefault();if(!event.target.reportValidity())return;captureDraft();const omitted=(drafts.get(instance.id)?.omitted||[]).filter(key=>!Object.hasOwn(edits,key)&&!clears.has(key));if(omitted.length){$('#save-error').textContent='Re-enter the protected values above, or choose to keep their saved values.';return;}await mutate({action:'configure',id:instance.id,settings:{...edits},clear:[...clears],...(sourceEdits?{bindings:sourceEdits}:{})});};
 if($('#new-copy'))$('#new-copy').onclick=()=>openInstall(instance.type);
 $('#reset-settings').onclick=()=>{clearDraft();resetEdits();renderList();renderDetail();};
 $('#toggle-plugin').onclick=()=>{if(canLeave())void mutate({action:'enable',id:instance.id,enabled:!instance.enabled});};
 $('#remove-plugin').onclick=()=>{if(!canLeave())return;revealRecovery('Remove this plugin and its saved settings? Its private connection values will also be removed.', [['Keep plugin',()=>revealRecovery('')],['Remove plugin',()=>mutate({action:'remove',id:instance.id})]]);$('#plugin-recovery button').focus();};
 $('#test-plugin').onclick=async()=>{
  const button=$('#test-plugin'),output=$('#test-result'),version=editVersion;
  const current=()=>button.isConnected&&version===editVersion;
  button.disabled=true;output.classList.remove('bad');output.textContent='Testing connection…';
  try{const result=await request('/api/admin/setup/test-plugin',{method:'POST',body:JSON.stringify({pluginId:instance.id})});if(current()){output.textContent=result.message;output.classList.toggle('bad',!result.ok);}}
  catch(error){if(current()){output.textContent=error.message;output.classList.add('bad');}}
  finally{if(button.isConnected)button.disabled=busy||dirty||!instance.enabled;}
 };
}
async function mutate(change,recovery){
 if(busy)return;captureDraft();const focused=document.activeElement;busy=true;stateMessage('Saving…');if(change.action==='install')$('#page-status').textContent=`Installing ${pkgFor(change.type)?.name||'plugin'}…`;const form=$('#plugin-form');const locked=[...document.querySelectorAll('.plugin-workspace button,.plugin-workspace input,.plugin-workspace select,.plugin-workspace textarea,#refresh-plugins,#install-form button,#install-form input')].map(el=>[el,el.disabled]);for(const [el]of locked)el.disabled=true;
 try{data=await request('/api/admin/plugins',{method:'POST',body:JSON.stringify({...change,revision:change.action==='configure'?draftRevision:data.revision})});if(change.action==='configure'||change.action==='remove')clearDraft(change.id);if(recovery){drafts.delete(recovery.previousId);drafts.set(change.id,recovery.draft);saveDrafts();}resetEdits();renderCategories();if(change.action==='install'){selected=change.id;collection='installed';$('#plugin-search').value='';$('#plugin-category').value='';if($('#install-dialog').open)$('#install-dialog').close();}if(change.action==='remove')selected=data.instances.find(item=>item.hasWidget)?.id||data.instances[0]?.id||'';rememberSelection();renderList();renderDetail();$('#page-status').textContent=`${data.instances.length} installed · ${data.packages.length} in the library`;if(change.action==='install'&&innerWidth<=1000)$('#plugin-detail').scrollIntoView({behavior:'auto',block:'start'});toast(change.action==='configure'?'Settings saved and applied.':change.action==='install'?`${pkgFor(change.type)?.name||'Plugin'} installed. Ready to configure.`:'Plugin list updated.');}
 catch(error){if(error.code==='REVISION_CONFLICT'&&change.action==='configure')revealRecovery('Settings changed in another window. Your draft is still here.',[['Review latest settings',reviewPluginChanges]]);const output=change.action==='install'?($('#install-dialog').open?$('#install-error'):$('#page-status')):$('#save-error');if(output)output.textContent=error.message;else toast(error.message);if(form){$('#save-plugin').disabled=!dirty;$('#reset-settings').disabled=false;const current=data.instances.find(item=>item.id===selected);$('#toggle-plugin').disabled=Boolean(current?.enabled&&current?.usedBy.length);$('#remove-plugin').disabled=Boolean(current?.usedBy.length);}}
 finally{for(const [el,disabled]of locked)if(el.isConnected)el.disabled=disabled;busy=false;if(dirty)stateMessage('Unsaved draft · kept in this tab');if(focused?.isConnected&&!focused.disabled)focused.focus();else if(change.action==='configure')$('#save-plugin')?.focus();}
}
function applyPluginMerge(merged, latest, draft, protectedChoices = []) {
 const instance=latest.instances.find(item=>item.id===selected);
 const nextEdits={},nextClears=[];
 for(const key of new Set([...Object.keys(instance.settings),...Object.keys(merged.settings)])){
  if(sameValue(instance.settings[key],merged.settings[key]))continue;
  if(merged.settings[key]===undefined)nextClears.push(key);else nextEdits[key]=merged.settings[key];
 }
 for(const key of protectedChoices)if(draft.clears.includes(key)&&!nextClears.includes(key))nextClears.push(key);
 const next={revision:latest.revision,base:structuredClone(instance),edits:nextEdits,clears:nextClears,inputs:draft.inputs,omitted:draft.omitted||[],...(!sameValue(instance.bindings,merged.bindings)?{bindings:merged.bindings}:{})};
 data=latest;drafts.set(selected,next);saveDrafts();resetEdits();renderList();renderDetail();
 if(!(next.omitted||[]).some(key=>!Object.hasOwn(next.edits,key)&&!next.clears.includes(key)))revealRecovery('Your draft includes the latest saved changes. Review it, then save.');
 $('#save-plugin')?.focus();
}
async function reviewPluginChanges(){
 if(busy||!$('#plugin-form').reportValidity())return;captureDraft();const draft=drafts.get(selected);if(!draft)return;
 const locked=[...document.querySelectorAll('.plugin-workspace button,.plugin-workspace input,.plugin-workspace select,.plugin-workspace textarea,#refresh-plugins')].map(el=>[el,el.disabled]);
 for(const [el]of locked)el.disabled=true;
 busy=true;
 try{
  const latest=await request('/api/admin/plugins');
  const current=latest.instances.find(item=>item.id===selected);
  if(!current||current.type!==draft.base.type){data=latest;resetEdits();renderList();renderDetail();return;}
  const base={settings:draft.base.settings,bindings:draft.base.bindings};
  const mine=structuredClone(base);Object.assign(mine.settings,draft.edits);for(const key of draft.clears)delete mine.settings[key];if(draft.bindings)mine.bindings=draft.bindings;
  const result=mergeDraft(base,mine,{settings:current.settings,bindings:current.bindings});
  for(const key of new Set([...Object.keys(draft.edits),...draft.clears])){
   if(!protectedSetting(key,current.settingsSchema.properties[key],draft.edits[key], [...current.protectedFields,...draft.base.protectedFields]))continue;
   result.conflicts=result.conflicts.filter(conflict=>!(conflict.path[0]==='settings'&&conflict.path[1]===key));
   delete result.value.settings[key];
   result.conflicts.push({path:['settings',key],local:draft.edits[key],latest:undefined,protected:true});
  }
  if(!result.conflicts.length)return applyPluginMerge(result.value,latest,draft);
  pendingPluginMerge={result,latest,draft};
  const list=$('#plugin-conflicts');list.replaceChildren();
  result.conflicts.forEach((conflict,index)=>{
   const fieldset=document.createElement('fieldset'),legend=document.createElement('legend');
   legend.textContent=conflict.path[0]==='settings'?(current.settingsSchema.properties[conflict.path[1]]?.title||conflict.path[1]):`Source: ${conflict.path.slice(1).join(' / ')}`;fieldset.append(legend);
   for(const [value,label]of [['local','Your draft'],['latest','Latest saved']]){
    const option=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span'),title=document.createElement('strong'),summary=document.createElement('small');
    input.type='radio';input.name=`plugin-conflict-${index}`;input.value=value;input.required=true;title.textContent=label;
    summary.textContent=conflict.protected?(value==='latest'?'Keep the saved protected value':conflict.local===undefined?'Clear the saved value':'Use your new protected value'):conflict[value]===undefined?'Use default':typeof conflict[value]==='object'?JSON.stringify(conflict[value]):String(conflict[value]);
    text.append(title,summary);option.append(input,text);fieldset.append(option);
   }
   list.append(fieldset);
  });
  $('#plugin-conflict-dialog').showModal();
 }catch(error){revealRecovery(`${error.message} Your draft is still here.`,[['Try again',reviewPluginChanges]]);}
 finally{busy=false;for(const [el,disabled]of locked)if(el.isConnected)el.disabled=disabled;}
}
function nextCopyId(type){let id=type,n=2;while(data.instances.some(item=>item.id===id))id=`${type}-${n++}`;return id;}
function openInstall(type){if(!canLeave())return;installType=type;const pkg=pkgFor(type);$('#install-title').textContent=`Install ${pkg.name}`;$('#install-note').textContent=`${pkg.description||'Add this plugin to your library.'}${pkg.dependencies?.length?' Required support plugins are connected automatically.':''}`;$('#install-advanced').open=false;$('#install-id').value=nextCopyId(type);$('#install-error').textContent='';$('#install-dialog').showModal();}
async function load(){
 if(busy)return;captureDraft();busy=true;
 const locked=[...document.querySelectorAll('.plugin-workspace button,.plugin-workspace input,.plugin-workspace select,.plugin-workspace textarea,#refresh-plugins')].map(el=>[el,el.disabled]);
 for(const [el]of locked)el.disabled=true;
 $('#page-status').textContent='Loading plugins…';
 try{data=await request('/api/admin/plugins');if(!data.instances.some(item=>item.id===selected)&&!drafts.has(selected))selected=data.instances.find(item=>item.hasWidget)?.id||data.instances[0]?.id||'';renderCategories();resetEdits();rememberSelection();renderList();renderDetail();$('#page-status').textContent=`${data.instances.length} installed · ${data.packages.length} in the library`;}
 catch(error){$('#page-status').textContent=error.message;}
 finally{busy=false;for(const [el,disabled]of locked)if(el.isConnected)el.disabled=disabled;}
}
function renderCategories(){const input=$('#plugin-category'),previous=input.value;const categories=[...new Set([...data.packages,...data.instances].map(categoryName))].sort();input.innerHTML='<option value="">All categories</option>'+categories.map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');input.value=categories.includes(previous)?previous:'';}
$('#cancel-plugin-review').onclick=()=>$('#plugin-conflict-dialog').close();
$('#plugin-conflict-form').onsubmit=event=>{
 event.preventDefault();const fields=new FormData(event.target);const {result,latest,draft}=pendingPluginMerge;
 const choices=result.conflicts.map((_,index)=>fields.get(`plugin-conflict-${index}`));
 const resolved=resolveDraft(result,choices);
 const protectedChoices=result.conflicts.filter((conflict,index)=>conflict.protected&&choices[index]==='local').map(conflict=>conflict.path[1]);
 $('#plugin-conflict-dialog').close();applyPluginMerge(resolved,latest,draft,protectedChoices);
};
$('#plugin-category').onchange=renderList;
$('#show-installed').onclick=()=>{collection='installed';rememberSelection();renderList();};$('#show-library').onclick=()=>{captureDraft();collection='library';rememberSelection();renderList();};$('#plugin-search').oninput=renderList;
$('#refresh-plugins').onclick=()=>{if(canLeave())void load();};$('#cancel-install').onclick=()=>$('#install-dialog').close();
$('#install-form').addEventListener('invalid',()=>{$('#install-advanced').open=true;},true);
$('#install-form').onsubmit=async event=>{event.preventDefault();if(event.target.reportValidity())await mutate({action:'install',id:$('#install-id').value,type:installType});};
$('#token-form').onsubmit=async event=>{event.preventDefault();token=$('#admin-token').value.trim();$('#token-error').textContent='';$('#admin-token').removeAttribute('aria-invalid');sessionStorage.setItem('castboard-admin-token',token);$('#token-dialog').close();await load();};
window.addEventListener('beforeunload',event=>{captureDraft();if(dirty&&draftBase&&Object.keys(edits).some(key=>protectedSetting(key,draftBase.settingsSchema.properties[key],edits[key],draftBase.protectedFields))){event.preventDefault();event.returnValue='';}});
void load();
