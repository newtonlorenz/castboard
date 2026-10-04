import {escapeHtml,mountPagedRecords} from '/widget-kit.js?v=0.14.0';
const labels={ok:'Operational',warning:'Attention needed',error:'Unavailable',unknown:'Unknown'};
export function mount(args){mountPagedRecords({...args,field:'items',name:'Status Board',rowHeight:88,renderItem:item=>`<article class="status-entry" data-state="${item.status}"><div><strong>${escapeHtml(item.name)}</strong><span class="status-label">${labels[item.status]}</span></div>${item.detail?`<p>${escapeHtml(item.detail)}</p>`:''}</article>`});}
