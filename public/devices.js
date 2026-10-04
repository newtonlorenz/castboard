const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
let report, editing, busy = false;
let token = sessionStorage.getItem('castboard-admin-token') || '';
async function request(body) {
  const response = await fetch('/api/admin/devices', {method:body?'POST':'GET',cache:'no-store',headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify({...body,revision:report.revision})}:{})});
  const payload = await response.json();
  if (response.status===403) {
    $('#token-error').textContent=token?'Access denied. Check your admin token.':'';
    if(!$('#token-dialog').open) $('#token-dialog').showModal();
    $('#admin-token').focus();
  }
  if(!response.ok) throw new Error(payload.error?.message || 'Could not update displays');
  return payload;
}
function toast(text) {$('#toast').textContent=text;$('#toast').classList.add('visible');setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
function render() {
  $('#device-status').textContent=`${report.devices.length} display${report.devices.length===1?'':'s'} · ${report.rendererConfigured?'Image renderer configured':'Image renderer not configured'}`;
  $('#device-list').innerHTML=report.devices.map(device=>{
    const screen=report.screens.find(screen=>screen.id===device.screenId);
    const seen=device.status?.lastSeenAt;
    const connected=seen && Date.now()-new Date(seen).getTime()<Math.max(60000,device.refreshMs*3);
    const state=!device.enabled?'Disabled':connected?'Connected':seen?'Not checking in':'Waiting for first connection';
    return `<article class="device-row"><div><h3>${escape(device.name)}</h3><p>${escape(device.id)} · ${device.width} × ${device.height}</p><span class="pill">${state}</span>${seen?`<p>Last request ${escape(new Date(seen).toLocaleString())}</p>`:''}</div><div><p><strong>${escape(screen?.title || device.screenId)}</strong></p><p>${device.mode==='frame'?'Image':'Native'} mode · every ${device.refreshMs/1000}s · ${device.touch?'Touch enabled':'View only'}</p>${device.mode==='native' && device.nativeIssues.length?`<details><summary>${device.nativeIssues.length} compatibility issue${device.nativeIssues.length===1?'':'s'}</summary><ul>${device.nativeIssues.map(issue=>`<li>${escape(issue)}</li>`).join('')}</ul><p>Use image mode or add native views to these extensions.</p></details>`:device.mode==='frame'&&!report.rendererConfigured?'<p>Set up the image renderer before connecting.</p>':''}</div><div class="device-actions"><button type="button" class="button secondary" data-edit="${escape(device.id)}">Edit</button><button type="button" class="button secondary" data-key="${escape(device.id)}">New key</button><button type="button" class="button danger" data-remove="${escape(device.id)}">Remove</button></div></article>`;
  }).join('') || '<div class="device-empty"><h3>Add your first small display</h3><p>Choose a screen, enter its resolution, then use the connection details in your receiver firmware.</p><button type="button" class="button primary" id="first-device">Add display</button></div>';
  $('#first-device')?.addEventListener('click',()=>edit());
  $('#device-list').querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>edit(button.dataset.edit));
  $('#device-list').querySelectorAll('[data-key]').forEach(button=>button.onclick=()=>changeKey(button.dataset.key));
  $('#device-list').querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>remove(button.dataset.remove));
}
async function load() {try {report=await request();render();} catch(error){$('#device-status').textContent=error.message;}}
function edit(id) {
  if(!report || busy)return;
  editing=id;
  const device=report.devices.find(item=>item.id===id)||{width:800,height:480,refreshMs:5000,mode:'frame',format:'rgb565',touch:true,enabled:true,allowActions:false};
  $('#device-dialog-title').textContent=id?'Display settings':'Add display';
  $('#device-name').value=device.name||'';$('#device-id').value=id||'';$('#device-id').disabled=Boolean(id);
  $('#device-screen').innerHTML=report.screens.map(screen=>`<option value="${escape(screen.id)}">${escape(screen.title)}</option>`).join('');
  if(device.screenId)$('#device-screen').value=device.screenId;
  for(const field of ['mode','width','height','format'])$(`#device-${field}`).value=device[field];
  $('#device-refresh').value=device.refreshMs/1000;
  for(const [field,key] of [['touch','touch'],['actions','allowActions'],['enabled','enabled']])$(`#device-${field}`).checked=device[key];
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
  busy=true;document.querySelectorAll('button').forEach(button=>button.disabled=true);
  try {const payload=await request(body);report=payload;render();return payload;}
  finally {busy=false;document.querySelectorAll('button').forEach(button=>button.disabled=false);}
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
  if(busy||!await confirm('Remove display?','This display will lose access to Castboard. Its screen design will still be available in Studio.','Remove display'))return;
  try {await change({action:'remove',id});toast('Display removed');}catch(error){toast(error.message);}
}
$('#device-form').onsubmit=async event=>{
  event.preventDefault();const id=editing||$('#device-id').value.trim();
  const device={name:$('#device-name').value.trim(),screenId:$('#device-screen').value,mode:$('#device-mode').value,width:Number($('#device-width').value),height:Number($('#device-height').value),refreshMs:Number($('#device-refresh').value)*1000,format:$('#device-format').value,touch:$('#device-touch').checked,allowActions:$('#device-actions').checked,enabled:$('#device-enabled').checked};
  try {const payload=await change({action:editing?'update':'create',id,device});if(!payload)return;$('#device-dialog').close();if(payload.connectionKey)showKey(payload,id);else toast('Display saved');}
  catch(error){$('#device-form-error').textContent=error.message;}
};
$('#device-mode').onchange=()=>{$('#device-format').disabled=$('#device-mode').value==='native';};
$('#device-name').addEventListener('input',()=>{if(!editing && !$('#device-id').matches(':focus'))$('#device-id').value=$('#device-name').value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^[^a-z]+|^-+|-+$/g,'').slice(0,64);});
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$('#key-dialog').addEventListener('close',()=>{$('#device-connection').value='';});
$('#copy-connection').onclick=async()=>{try{await navigator.clipboard.writeText($('#device-connection').value);toast('Connection details copied');}catch{$('#device-connection').focus();$('#device-connection').select();toast('Select and copy the connection details');}};
$('#add-device').onclick=()=>edit();$('#refresh-devices').onclick=load;
$('#token-form').onsubmit=async event=>{event.preventDefault();token=$('#admin-token').value.trim();sessionStorage.setItem('castboard-admin-token',token);$('#token-dialog').close();await load();};
load();
