import fs from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { validateAdapterManifest, loadDisplayAdapter } from './display-adapters.js';
import { deviceError } from './devices.js';

export const MAX_PACKAGE_BYTES = 8 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 24 * 1024 * 1024;
const crcTable = Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(data) {let crc=0xffffffff;for(const byte of data)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
const fail = message => {throw deviceError(message,422);};
function validPath(name) {
  return name.length<=240 && !name.includes('\\') && !name.startsWith('/') && !/[:\x00-\x1f]/.test(name) && name.split('/').every(part=>part && part!=='.' && part!=='..') && !name.split('/').some(part=>['.git','node_modules'].includes(part.toLowerCase()) || /^\.env(?:\.|$)/i.test(part));
}

// Read only ordinary ZIP files. Sizes, paths, CRCs and regular-file attributes
// are checked before any uploaded file can reach an extension directory.
export function unpackDisplayPackage(zip) {
  if(!Buffer.isBuffer(zip) || zip.length>MAX_PACKAGE_BYTES || zip.length<22) fail('Upload a ZIP package of at most 8 MiB');
  let end=-1;
  for(let pos=zip.length-22;pos>=Math.max(0,zip.length-65557);pos--) if(zip.readUInt32LE(pos)===0x06054b50 && pos+22+zip.readUInt16LE(pos+20)===zip.length){end=pos;break;}
  if(end<0) fail('The uploaded file is not a supported ZIP package');
  const count=zip.readUInt16LE(end+10),size=zip.readUInt32LE(end+12),offset=zip.readUInt32LE(end+16);
  if(zip.readUInt16LE(end+4) || zip.readUInt16LE(end+6) || zip.readUInt16LE(end+8)!==count || !count || count>256 || offset+size!==end) fail('Split, ZIP64 or oversized ZIP packages are not supported');
  const files=new Map(), names=new Set(), spans=[];
  let cursor=offset,total=0;
  for(let index=0;index<count;index++) {
    if(cursor+46>end || zip.readUInt32LE(cursor)!==0x02014b50) fail('Invalid ZIP directory');
    const flags=zip.readUInt16LE(cursor+8),method=zip.readUInt16LE(cursor+10),crc=zip.readUInt32LE(cursor+16),packed=zip.readUInt32LE(cursor+20),unpacked=zip.readUInt32LE(cursor+24);
    const nameLength=zip.readUInt16LE(cursor+28),extraLength=zip.readUInt16LE(cursor+30),commentLength=zip.readUInt16LE(cursor+32),mode=(zip.readUInt32LE(cursor+38)>>>16)&0xf000,local=zip.readUInt32LE(cursor+42);
    if(cursor+46+nameLength+extraLength+commentLength>end || flags&1 || ![0,8].includes(method) || ![0,0x8000,0x4000].includes(mode) || packed===0xffffffff || unpacked>MAX_PACKAGE_BYTES) fail('Encrypted, linked or unsupported ZIP entries are not allowed');
    const rawName=zip.subarray(cursor+46,cursor+46+nameLength),name=rawName.toString('utf8'),directory=name.endsWith('/');
    if(!rawName.equals(Buffer.from(name)) || !validPath(directory?name.slice(0,-1):name)) fail('The ZIP contains an unsafe file path');
    const key=name.normalize('NFC').toLowerCase();
    if(names.has(key)) fail('The ZIP contains duplicate file names');
    names.add(key);
    total+=unpacked;if(total>MAX_EXPANDED_BYTES) fail('The expanded package exceeds 24 MiB');
    if(local+30>offset || zip.readUInt32LE(local)!==0x04034b50) fail('Invalid ZIP file record');
    const localName=zip.readUInt16LE(local+26),localExtra=zip.readUInt16LE(local+28),start=local+30+localName+localExtra,finish=start+packed;
    if(finish>offset || zip.readUInt16LE(local+6)!==flags || zip.readUInt16LE(local+8)!==method || !zip.subarray(local+30,local+30+localName).equals(rawName) || spans.some(([a,b])=>local<b && finish>a)) fail('Inconsistent ZIP file records');
    spans.push([local,finish]);
    let data;
    try {data=method===0?zip.subarray(start,finish):inflateRawSync(zip.subarray(start,finish),{maxOutputLength:MAX_PACKAGE_BYTES});} catch {fail('A ZIP entry could not be unpacked within its size limit');}
    if(data.length!==unpacked || crc32(data)!==crc || directory && data.length) fail('A ZIP entry failed its integrity check');
    if(!directory && !name.startsWith('__MACOSX/') && !name.endsWith('/.DS_Store') && name!=='.DS_Store')files.set(name,Buffer.from(data));
    cursor+=46+nameLength+extraLength+commentLength;
  }
  if(cursor!==end) fail('Invalid ZIP directory size');
  if(!files.has('adapter.json')) {
    const candidates=[...files.keys()].filter(name=>name.split('/').length===2 && name.endsWith('/adapter.json'));
    if(candidates.length!==1) fail('The ZIP needs adapter.json at its root or inside one package folder');
    const prefix=candidates[0].slice(0,-'adapter.json'.length);
    if([...files.keys()].some(name=>!name.startsWith(prefix))) fail('The ZIP must contain one display plugin');
    const entries=[...files];files.clear();for(const [name,data] of entries)files.set(name.slice(prefix.length),data);
  }
  if(files.get('adapter.json').length>32768) fail('The display plugin manifest exceeds 32 KiB');
  let manifest;try{manifest=validateAdapterManifest(JSON.parse(files.get('adapter.json')));}catch(error){fail(error.message);}
  if(manifest.entry && !files.has(manifest.entry)) fail('The ZIP is missing adapter.mjs');
  if([...files.keys()].some(name=>['secrets.h','config.local.h'].includes(path.basename(name)))) fail('Remove private receiver configuration from the package before uploading');
  return {manifest,files};
}

export async function installDisplayPackage({zip,configDir,existing}) {
  const {manifest,files}=unpackDisplayPackage(zip);
  if(existing.has(manifest.id)) throw deviceError('This display plugin is already installed. Remove unused copies before installing a replacement.',409);
  const root=path.resolve(configDir,'extensions/displayAdapters');
  await fs.mkdir(root,{recursive:true});
  if((await fs.lstat(root)).isSymbolicLink()) fail('The upload directory cannot be a symbolic link');
  const destination=path.join(root,manifest.id),staging=await fs.mkdtemp(path.join(root,'.install-'));
  let reserved=false,moved=false;
  try {
    for(const [name,data] of files){const file=path.join(staging,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data,{flag:'wx',mode:0o600});}
    try{await fs.mkdir(destination);reserved=true;}catch(error){if(error.code==='EEXIST')throw deviceError('A package with this ID already exists',409);throw error;}
    await fs.rename(staging,destination);moved=true;
    await loadDisplayAdapter(destination,manifest.id);
    return manifest.id;
  } catch(error) {
    if(reserved)await fs.rm(destination,{recursive:true,force:true});
    if(moved)throw Object.assign(deviceError('The display plugin could not load. Its files were removed; restart Castboard before trying this package ID again.'),{requiresRestart:true});
    throw error;
  } finally {if(!moved)await fs.rm(staging,{recursive:true,force:true});}
}

export async function removeDisplayPackage({id,adapters,config,configDir}) {
  const adapter=adapters.get(id);
  if(!adapter)throw deviceError('Display plugin not found',404);
  const root=path.resolve(configDir,'extensions/displayAdapters');
  if(adapter.origin==='Bundled' || path.dirname(adapter.directory)!==root) throw deviceError('Only uploaded display plugins can be removed here');
  if(Object.values(config.devices || {}).some(device=>(device.adapter || 'standard')===id)) throw deviceError('Choose another plugin for displays using this one before removing it',409);
  // Retain the files for recovery, outside normal extension discovery.
  const trash=await fs.mkdtemp(path.join(root,'.removed-'));
  await fs.rename(adapter.directory,path.join(trash,id));
}

// Stored ZIP output keeps the downloadable example dependency-free and readable
// by standard ZIP tools. The upload reader also supports deflated packages.
export function zipFiles(files) {
  const local=[],central=[];let offset=0;
  for(const [name,value] of files) {
    const data=Buffer.from(value),filename=Buffer.from(name),crc=crc32(data);
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);
    local.push(header,filename,data);
    const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt32LE(crc,16);record.writeUInt32LE(data.length,20);record.writeUInt32LE(data.length,24);record.writeUInt16LE(filename.length,28);record.writeUInt32LE(offset,42);central.push(record,filename);
    offset+=header.length+filename.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.size,8);end.writeUInt16LE(files.size,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
