export function recordDefaults(schema, record = {}) {
  const defaults = Object.fromEntries(Object.entries(schema.properties || {}).filter(([, field]) => field.default !== undefined).map(([key, field]) => [key, structuredClone(field.default)]));
  return { ...defaults, ...record };
}

export function recordInputValue(field, value, checked) {
  if (field.type === 'boolean' && !field.enum) return checked;
  if (value === '') return undefined;
  if (field.enum) return field.enum.find(option => String(option) === value);
  return ['number', 'integer'].includes(field.type) ? Number(value) : value;
}

// Repeated schema-defined records use ordinary controls while retaining unknown fields.
export function recordListField(key, schema, initial, changed) {
  const root=document.createElement('section');root.className='record-list field';root.dataset.setting=key;
  const title=document.createElement('h4');title.textContent=schema.title||key;root.append(title);
  if(schema.description){const hint=document.createElement('p');hint.className='hint';hint.textContent=schema.description;root.append(hint);}
  const rows=document.createElement('div');root.append(rows);
  const add=document.createElement('button');add.type='button';add.className='button';add.textContent=schema.addLabel||'Add item';root.append(add);
  let records=structuredClone(Array.isArray(initial)?initial:[]).map(item=>recordDefaults(schema.items,typeof item==='string'&&schema.stringItemProperty?{[schema.stringItemProperty]:item}:item));
  function publish(){changed(structuredClone(records));}
  function render(focusIndex){
    rows.replaceChildren();
    add.disabled=schema.maxItems!==undefined&&records.length>=schema.maxItems;add.dataset.recordLimit=String(add.disabled);
    records.forEach((record,index)=>{
      const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=`${schema.itemLabel||'Item'} ${index+1}`;group.append(legend);
      const fields=document.createElement('div');fields.className='record-fields';group.append(fields);
      for(const [property,field]of Object.entries(schema.items.properties)){
        const label=document.createElement('label');label.className='field';const name=document.createElement('span');name.textContent=field.title||property;
        const input=document.createElement(field.enum?'select':'input');
        if(field.enum){
          const empty=document.createElement('option');empty.value='';empty.textContent='Choose…';input.append(empty);
          for(const value of field.enum){const option=document.createElement('option');option.value=value;option.textContent=field.enumLabels?.[value]||value;input.append(option);}
        }
        else input.type=field.type==='boolean'?'checkbox':['integer','number'].includes(field.type)?'number':field.format==='uri'?'url':'text';
        input.id=`record-${key}-${index}-${property}`;input.required=(field.type!=='boolean'||Boolean(field.enum))&&Boolean(schema.items.required?.includes(property));
        if(field.minimum!==undefined)input.min=field.minimum;if(field.maximum!==undefined)input.max=field.maximum;if(field.type==='number')input.step='any';
        if(field.type==='boolean'&&!field.enum)input.checked=Boolean(record[property]);else input.value=record[property]??'';
        input.addEventListener(field.enum||field.type==='boolean'?'change':'input',()=>{
          records[index]={...records[index]};
          const value=recordInputValue(field,input.value,input.checked);
          if(value===undefined)delete records[index][property];else records[index][property]=value;
          publish();
        });
        label.append(name,input);fields.append(label);
      }
      const remove=document.createElement('button');remove.type='button';remove.className='button danger';remove.textContent='Remove';remove.setAttribute('aria-label',`Remove ${schema.itemLabel||'item'} ${index+1}`);
      remove.onclick=()=>{records.splice(index,1);publish();render(Math.min(index,records.length-1));};group.append(remove);rows.append(group);
    });
    if(!records.length){const empty=document.createElement('p');empty.className='hint';empty.textContent=schema.emptyLabel||'No items added yet.';rows.append(empty);}
    if(focusIndex!==undefined)(rows.children[focusIndex]?.querySelector('input,select')||add).focus();
  }
  add.onclick=()=>{records.push(recordDefaults(schema.items));publish();render(records.length-1);};render();return root;
}
