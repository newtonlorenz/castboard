// Repeated schema-defined records use ordinary controls while retaining unknown fields.
export function recordListField(key, schema, initial, changed) {
  const root=document.createElement('section');root.className='record-list field';root.dataset.setting=key;
  const title=document.createElement('h4');title.textContent=schema.title||key;root.append(title);
  if(schema.description){const hint=document.createElement('p');hint.className='hint';hint.textContent=schema.description;root.append(hint);}
  const rows=document.createElement('div');root.append(rows);
  const add=document.createElement('button');add.type='button';add.className='button';add.textContent=schema.addLabel||'Add item';root.append(add);
  let records=structuredClone(Array.isArray(initial)?initial:[]).map(item=>typeof item==='string'&&schema.stringItemProperty?{[schema.stringItemProperty]:item}:item);
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
        if(field.enum)for(const value of field.enum){const option=document.createElement('option');option.value=value;option.textContent=field.enumLabels?.[value]||value;input.append(option);}
        else input.type=field.type==='boolean'?'checkbox':['integer','number'].includes(field.type)?'number':field.format==='uri'?'url':'text';
        input.id=`record-${key}-${index}-${property}`;input.required=field.type!=='boolean'&&Boolean(schema.items.required?.includes(property));
        if(field.minimum!==undefined)input.min=field.minimum;if(field.maximum!==undefined)input.max=field.maximum;if(field.type==='number')input.step='any';
        if(field.type==='boolean')input.checked=Boolean(record[property]??field.default);else input.value=record[property]??field.default??'';
        input.addEventListener(field.enum||field.type==='boolean'?'change':'input',()=>{
          records[index]={...records[index]};
          if(input.value===''&&field.type!=='boolean')delete records[index][property];
          else records[index][property]=field.type==='boolean'?input.checked:['number','integer'].includes(field.type)?Number(input.value):input.value;
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
  add.onclick=()=>{records.push({});publish();render(records.length-1);};render();return root;
}
