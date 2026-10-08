import { schemaFields } from '/schema-fields.js';
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
let report, delivery, editing, busy = false, adapterValues = {};
let token = sessionStorage.getItem('castboard-admin-token') || '';
async function adminFetch(route, options = {}) {
  const response=await fetch(route,{...options,cache:'no-store',headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...options.headers}});
  if(response.status===403){
    $('#token-error').textContent=token?'Access denied. Check your admin token.':'';
    if(!$('#token-dialog').open)$('#token-dialog').showModal();
    $('#admin-token').focus();
  }
  if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload.error?.message || 'The request could not be completed');}
  return response;
}
async function request(body) {
  const response=await adminFetch('/api/admin/devices',{method:body?'POST':'GET',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,revision:report.revision})}:{})});
  return response.json();
}
function toast(text) {$('#toast').textContent=text;$('#toast').classList.add('visible');setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
function render() {
  renderCastDisplays();
  $('#device-status').textContent=`${castReceivers().length + report.devices.length} saved display${castReceivers().length + report.devices.length===1?'':'s'} · Choose a dashboard below`;
  $('#device-list').innerHTML=report.devices.map(device=>{
    const screen=report.screens.find(screen=>screen.id===device.screenId);
    const seen=device.status?.lastSeenAt;
    const connected=seen && Date.now()-new Date(seen).getTime()<Math.max(60000,device.refreshMs*3);
    const state=!device.enabled?'Disabled':connected?'Connected':seen?'Not checking in':'Waiting for first connection';
    return `<article class="device-row"><div><h3>${escape(device.name)}</h3><p>${escape(device.id)} · ${device.width} × ${device.height}</p><span class="pill">${state}</span>${seen?`<p>Last request ${escape(new Date(seen).toLocaleString())}</p>`:''}</div><div><label class="field dashboard-assignment"><span>Dashboard for ${escape(device.name)}</span><select data-device-dashboard="${escape(device.id)}">${dashboardOptions(device.screenId)}</select></label><button type="button" class="button secondary" data-assign="${escape(device.id)}">Apply dashboard</button><p>${escape(report.adapters?.find(adapter=>adapter.id===(device.adapter || 'standard'))?.name || 'Standard receiver')} · ${device.mode==='frame'?'Image':'Native'} mode · every ${device.refreshMs/1000}s · ${device.touch?'Touch enabled':'View only'}</p>${device.mode==='native' && device.nativeIssues.length?`<details><summary>${device.nativeIssues.length} compatibility issue${device.nativeIssues.length===1?'':'s'}</summary><ul>${device.nativeIssues.map(issue=>`<li>${escape(issue)}</li>`).join('')}</ul><p>Use image mode or add native views to these extensions.</p></details>`:device.mode==='frame'&&!report.rendererConfigured?'<p>Set up the image renderer before connecting.</p>':''}</div><div class="device-actions"><button type="button" class="button secondary" data-edit="${escape(device.id)}">Edit</button><button type="button" class="button secondary" data-key="${escape(device.id)}">New key</button><button type="button" class="button danger" data-remove="${escape(device.id)}">Remove</button></div></article>`;
  }).join('') || '<div class="device-empty"><h3>Add your first display</h3><p>Choose a dashboard, enter its resolution, then use the connection details in your receiver firmware.</p><button type="button" class="button primary" id="first-device">Add display</button></div>';
  renderAdapters();
  $('#device-list').querySelectorAll('[data-assign]').forEach(button=>button.onclick=()=>assignDashboard(button.dataset.assign));
  $('#first-device')?.addEventListener('click',()=>edit());
  $('#device-list').querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>edit(button.dataset.edit));
  $('#device-list').querySelectorAll('[data-key]').forEach(button=>button.onclick=()=>changeKey(button.dataset.key));
  $('#device-list').querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>remove(button.dataset.remove));
}
async function load(force=false) {
  if(busy && force!==true)return;
  $('#refresh-devices').disabled=true;
  try {
    const results=await Promise.allSettled([request(),adminFetch('/api/admin/delivery').then(response=>response.json())]);
    if(results[0].status==='rejected')throw results[0].reason;
    report=results[0].value;
    delivery=results[1].status==='fulfilled'?results[1].value:null;
    $('#cast-status').textContent='';
    render();
    if(!delivery)$('#cast-status').textContent='Cast connections could not be loaded. Refresh to try again.';
  } catch(error){$('#device-status').textContent=error.message;}
  finally {$('#refresh-devices').disabled=false;}
}
function edit(id) {
  if(!report || busy)return;
  editing=id;
  const device=report.devices.find(item=>item.id===id)||{width:800,height:480,refreshMs:5000,mode:'frame',format:'rgb565',touch:true,enabled:true,allowActions:false};
  $('#device-dialog-title').textContent=id?'Display settings':'Add display';
  $('#device-name').value=device.name||'';$('#device-id').value=id||'';$('#device-id').disabled=Boolean(id);
  $('#device-screen').innerHTML=report.screens.map(screen=>`<option value="${escape(screen.id)}">${escape(screen.title)}</option>`).join('');
  $('#device-screen').value=device.screenId || preferredDashboard(report.screens[0]?.id);
  for(const field of ['mode','width','height','format'])$(`#device-${field}`).value=device[field];
  $('#device-refresh').value=device.refreshMs/1000;
  for(const [field,key] of [['touch','touch'],['actions','allowActions'],['enabled','enabled']])$(`#device-${field}`).checked=device[key];
  $('#device-adapter').innerHTML=(report.adapters || []).map(adapter=>`<option value="${escape(adapter.id)}">${escape(adapter.name)}</option>`).join('');
  $('#device-adapter').value=device.adapter || 'standard';
  adapterValues={...device.options};configureAdapter(false,device);
  $('#device-format').disabled=device.mode==='native';$('#device-form-error').textContent='';$('#device-dialog').showModal();$('#device-name').focus();
}
function showKey(payload,id) {
  const base=payload.publicUrl || location.origin;
  $('#device-connection').value=JSON.stringify({server:base,deviceId:id,connectionKey:payload.connectionKey},null,2);
  $('#key-note').textContent=payload.publicUrl?'Keep this key private. Anyone with it can access this display’s assigned content.':'Set a server address reachable from the display. localhost and 127.0.0.1 only work on this computer.';
  $('#key-dialog').showModal();
}
async function change(body) {
  if(busy)return;
  busy=true;const unlock=lockControls();
  try {const payload=await request(body);report=payload;
    delivery=await adminFetch('/api/admin/delivery').then(response=>response.json()).catch(()=>null);
    render();return payload;}
  finally {busy=false;unlock();}
}
function confirm(title,copy,label) {
  $('#device-confirm-title').textContent=title;$('#device-confirm-copy').textContent=copy;$('#device-confirm-ok').textContent=label;
  const dialog=$('#device-confirm');dialog.showModal();$('#device-confirm-cancel').focus();
  return new Promise(resolve=>{
    const done=value=>{dialog.close();dialog.oncancel=null;resolve(value);};
    $('#device-confirm-cancel').onclick=()=>done(false);$('#device-confirm-ok').onclick=()=>done(true);
    dialog.oncancel=event=>{event.preventDefault();done(false);};
  });
}
async function changeKey(id) {
  if(busy||!await confirm('Replace connection key?','The current key will stop working. Update the display with the new key to reconnect.','Replace key'))return;
  try {const payload=await change({action:'rotate',id});if(payload)showKey(payload,id);} catch(error){toast(error.message);}
}
async function remove(id) {
  if(busy||!await confirm('Remove display?','This display will lose access to Castboard. Its dashboard design will still be available in Studio.','Remove display'))return;
  try {await change({action:'remove',id});toast('Display removed');}catch(error){toast(error.message);}
}
$('#device-form').onsubmit=async event=>{
  event.preventDefault();const id=editing||$('#device-id').value.trim();
  const device={adapter:$('#device-adapter').value,options:adapterValues,name:$('#device-name').value.trim(),screenId:$('#device-screen').value,mode:$('#device-mode').value,width:Number($('#device-width').value),height:Number($('#device-height').value),refreshMs:Number($('#device-refresh').value)*1000,format:$('#device-format').value,touch:$('#device-touch').checked,allowActions:$('#device-actions').checked,enabled:$('#device-enabled').checked};
  try {const payload=await change({action:editing?'update':'create',id,device});if(!payload)return;$('#device-dialog').close();if(payload.connectionKey)showKey(payload,id);else toast('Display saved');}
  catch(error){$('#device-form-error').textContent=error.message;}
};
function configureAdapter(reset, saved = {}) {
  const adapter=report.adapters?.find(item=>item.id===$('#device-adapter').value);
  if(!adapter)return;
  const mode=reset?adapter.defaults?.mode:(saved.mode || $('#device-mode').value),format=reset?adapter.defaults?.format:(saved.format || $('#device-format').value);
  $('#device-mode').innerHTML=adapter.modes.map(value=>`<option value="${escape(value)}">${value==='frame'?'Image — full browser design':'Native — lightweight plugin views'}</option>`).join('');
  $('#device-format').innerHTML=adapter.formats.map(value=>`<option value="${escape(value)}">${escape({rgb565:'RGB565 — ready to draw',jpeg:'JPEG — smaller download'}[value] || value)}</option>`).join('');
  if(adapter.modes.includes(mode))$('#device-mode').value=mode;
  if(adapter.formats.includes(format))$('#device-format').value=format;
  if(reset){
    for(const key of ['width','height'])if(adapter.defaults?.[key])$(`#device-${key}`).value=adapter.defaults[key];
    if(adapter.defaults?.refreshMs)$('#device-refresh').value=adapter.defaults.refreshMs/1000;
    if(adapter.defaults?.touch!==undefined)$('#device-touch').checked=adapter.defaults.touch;
    adapterValues={};
  }
  adapterValues={...adapter.defaultOptions,...adapterValues};
  for(const [key,field] of Object.entries(adapter.optionSchema?.properties || {}))if(adapterValues[key]===undefined && field.default!==undefined)adapterValues[key]=structuredClone(field.default);
  schemaFields($('#device-adapter-options'),adapter.optionSchema,adapterValues,(key,value)=>{if(value===undefined)delete adapterValues[key];else adapterValues[key]=value;});
  $('#device-adapter-description').textContent=adapter.description || '';
  $('#device-format').disabled=$('#device-mode').value==='native';
}
function renderAdapters() {
  $('#adapter-list').innerHTML=(report.adapters || []).map(adapter=>`<article class="adapter-row" id="adapter-${escape(adapter.id)}" tabindex="-1"><div><h3>${escape(adapter.name)} <small>${escape(adapter.version)}</small></h3><p>${escape(adapter.description || '')}</p><p class="adapter-meta">${adapter.origin==='Bundled'?'Included with Castboard':adapter.origin==='Uploaded package'?'Uploaded plugin':'Local package'} · ${adapter.modes.map(mode=>mode==='frame'?'Image':'Native').join(' and ')}${adapter.usedBy.length?` · Used by ${adapter.usedBy.length} display${adapter.usedBy.length===1?'':'s'}`:''}</p>${adapter.instructions?`<details><summary>Connection instructions</summary><p>${escape(adapter.instructions)}</p></details>`:''}</div>${adapter.origin!=='Uploaded package'?'':`<div class="adapter-remove"><button type="button" class="button danger" data-remove-adapter="${escape(adapter.id)}" ${adapter.usedBy.length?'disabled':''}>Remove</button>${adapter.usedBy.length?'<small>In use</small>':''}</div>`}</article>`).join('');
  $('#adapter-list').querySelectorAll('[data-remove-adapter]').forEach(button=>button.onclick=()=>removeAdapter(button.dataset.removeAdapter));
}
async function removeAdapter(id) {
  if(busy || !await confirm('Remove display plugin?','Its files will be retained for recovery. Restart Castboard before reinstalling the same plugin.','Remove plugin'))return;
  try {await adminFetch('/api/admin/display-adapters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'remove',id})});await load();$('#adapter-status').textContent='Display plugin removed.';}
  catch(error){$('#adapter-status').textContent=error.message;}
}
$('#device-adapter').onchange=()=>configureAdapter(true);
$('#adapter-upload-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  const file=$('#adapter-file').files[0];if(!file)return;
  $('#adapter-upload-error').textContent='';
  if(file.size>8*1024*1024){$('#adapter-upload-error').textContent='Choose a ZIP file smaller than 8 MB.';return;}
  busy=true;$('#install-adapter').disabled=true;$('#install-adapter').textContent='Installing…';
  try {
    const response=await adminFetch('/api/admin/display-adapters',{method:'POST',headers:{'Content-Type':'application/zip','X-Castboard-Trust-Package':$('#adapter-trust').checked?'yes':'no'},body:file});
    const result=await response.json();await load(true);$('#adapter-upload-form').reset();$('#adapter-upload').open=false;
    const adapter=report.adapters.find(item=>item.id===result.installed);$('#adapter-status').textContent=`${adapter?.name || 'Display plugin'} installed. Choose it when adding or editing a display.`;
    $(`#adapter-${result.installed}`)?.focus();
  } catch(error){$('#adapter-upload-error').textContent=error.message;}
  finally{busy=false;$('#install-adapter').disabled=false;$('#install-adapter').textContent='Install display plugin';}
};
$('#show-adapter-upload').onclick=()=>{$('#adapter-upload').open=true;$('#adapter-file').focus();};
$('#download-adapter-example').onclick=async()=>{
  try {
    const response=await adminFetch('/api/admin/display-adapters/example'),url=URL.createObjectURL(await response.blob()),link=document.createElement('a');
    link.href=url;link.download='castboard-monochrome-example.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  } catch(error){$('#adapter-status').textContent=error.message;}
};
$('#device-mode').onchange=()=>{$('#device-format').disabled=$('#device-mode').value==='native';};
$('#device-name').addEventListener('input',()=>{if(!editing && !$('#device-id').matches(':focus'))$('#device-id').value=$('#device-name').value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^[^a-z]+|^-+|-+$/g,'').slice(0,64);});
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$('#key-dialog').addEventListener('close',()=>{$('#device-connection').value='';});
$('#copy-connection').onclick=async()=>{try{await navigator.clipboard.writeText($('#device-connection').value);toast('Connection details copied');}catch{$('#device-connection').focus();$('#device-connection').select();toast('Select and copy the connection details');}};
$('#add-device').onclick=()=>edit();$('#refresh-devices').onclick=()=>load();
$('#token-form').onsubmit=async event=>{event.preventDefault();token=$('#admin-token').value.trim();sessionStorage.setItem('castboard-admin-token',token);$('#token-dialog').close();await load();};


// Cast connections use their saved destination; selectors only choose content.
const dashboardChoices = new Map();
function preferredDashboard(fallback) {
  const id=new URLSearchParams(location.search).get('screen');
  return report?.screens.some(screen=>screen.id===id)?id:fallback;
}
function dashboardOptions(selected) {
  return (report?.screens || []).map(screen=>`<option value="${escape(screen.id)}"${screen.id===selected?' selected':''}>${escape(screen.title)}</option>`).join('');
}
function castReceivers() {
  const receivers=new Map();
  for(const screen of delivery?.screens || [])for(const target of screen.targets){
    if(!receivers.has(target.id))receivers.set(target.id,{...target,targetScreenId:screen.id,dashboardIds:[]});
    receivers.get(target.id).dashboardIds.push(screen.id);
  }
  return [...receivers.values()];
}
function renderCastDisplays() {
  if(!report)return;
  if(!delivery){$('#cast-list').replaceChildren();return;}
  const receivers=castReceivers();
  $('#connect-cast').href=`/setup?device=cast&screen=${encodeURIComponent(preferredDashboard(report.screens[0]?.id || ''))}`;
  $('#cast-list').innerHTML=receivers.map(receiver=>{
    const selected=dashboardChoices.get(receiver.id) || preferredDashboard(receiver.targetScreenId);
    const type=receiver.protocol==='google-cast'?'Google Cast':receiver.protocol==='url'?'Browser link':receiver.protocol;
    return `<article class="device-row cast-row" data-receiver="${escape(receiver.id)}"><div><h3>${escape(receiver.name)}</h3><p>${escape(type)}</p><p>Saved connection</p></div><div><label class="field dashboard-assignment"><span>Dashboard for ${escape(receiver.name)}</span><select data-cast-dashboard="${escape(receiver.id)}">${dashboardOptions(selected)}</select></label><p class="cast-result" role="status" aria-live="polite"></p></div><div class="device-actions">${receiver.canSend?`<button type="button" class="button primary" data-cast="${escape(receiver.id)}">Cast</button>${receiver.protocol==='google-cast'?`<button type="button" class="button secondary" data-recast="${escape(receiver.id)}">Recast</button>`:''}`:'<a class="button secondary" href="/setup">Connection setup</a>'}<a class="cast-settings" href="/setup?device=cast&screen=${encodeURIComponent(receiver.targetScreenId)}">Connection settings</a></div></article>`;
  }).join('') || '<div class="device-empty"><h3>Connect a Cast display</h3><p>Your Google Nest or Chromecast will appear here once its connection is saved.</p><a class="button primary" href="/setup?device=cast">Connect Cast display</a></div>';
  $('#cast-list').querySelectorAll('[data-cast-dashboard]').forEach(select=>select.onchange=()=>dashboardChoices.set(select.dataset.castDashboard,select.value));
  $('#cast-list').querySelectorAll('[data-cast]').forEach(button=>button.onclick=()=>sendDashboard(button.dataset.cast,false));
  $('#cast-list').querySelectorAll('[data-recast]').forEach(button=>button.onclick=()=>sendDashboard(button.dataset.recast,true));
}
function lockControls() {
  const controls=[...document.querySelectorAll('button,select')].map(control=>[control,control.disabled]);
  controls.forEach(([control])=>control.disabled=true);
  return ()=>controls.forEach(([control,disabled])=>control.disabled=disabled);
}
async function sendDashboard(id,reset) {
  if(busy || !delivery)return;
  const receiver=castReceivers().find(item=>item.id===id);
  if(!receiver?.canSend)return;
  const row=[...$('#cast-list').querySelectorAll('[data-receiver]')].find(row=>row.dataset.receiver===id);
  const screenId=row.querySelector('select').value;
  const feedback=row.querySelector('.cast-result');
  busy=true;const unlock=lockControls();
  feedback.textContent=reset?'Restarting Cast session…':'Sending dashboard…';feedback.classList.remove('failed');
  try {
    const response=await adminFetch('/api/admin/delivery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'send',screenId,targetScreenId:receiver.targetScreenId,index:receiver.index,reset,revision:delivery.revision})});
    const result=await response.json();feedback.textContent=result.message;
  } catch(error){feedback.textContent=error.message;feedback.classList.add('failed');}
  finally {busy=false;unlock();}
}
async function assignDashboard(id) {
  if(busy)return;
  const select=[...$('#device-list').querySelectorAll('[data-device-dashboard]')].find(select=>select.dataset.deviceDashboard===id);
  try {const result=await change({action:'update',id,device:{screenId:select.value}});
    if(result)toast('Dashboard assigned. The receiver will load it on its next update.');
  } catch(error){toast(error.message);}
}

load();
