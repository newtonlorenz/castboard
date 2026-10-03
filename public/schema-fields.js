// Small documented JSON Schema subset; advanced JSON remains available for
// extension-defined structures that do not have a generated control.
export function schemaFields(container, schema, values, changed) {
  container.replaceChildren();
  for (const [key, field] of Object.entries(schema?.properties || {})) {
    const label = document.createElement('label');
    label.className = 'field';
    const text = document.createElement('span');
    text.textContent = field.title || key;
    let input;
    if (field.enum) {
      input = document.createElement('select');
      for (const value of field.enum) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = field.enumLabels?.[value] || String(value);
        input.append(option);
      }
    } else if (['object', 'array'].includes(field.type)) {
      input = document.createElement('textarea');
      input.rows = 3;
    } else {
      input = document.createElement('input');
      input.type = field.type === 'boolean' ? 'checkbox' : ['number', 'integer'].includes(field.type) ? 'number' : 'text';
      if (field.minimum !== undefined) input.min = field.minimum;
      if (field.maximum !== undefined) input.max = field.maximum;
      if (field.type === 'integer') input.step = 1;
    }
    input.id = `${container.id}-${key}`;
    input.required = field.type !== 'boolean' && Boolean(schema.required?.includes(key));
    const current = values[key] ?? field.default;
    if (field.type === 'boolean') input.checked = Boolean(current);
    else input.value = ['object', 'array'].includes(field.type) ? JSON.stringify(current ?? (field.type === 'array' ? [] : {}), null, 2) : current ?? '';
    input.addEventListener(field.enum || field.type === 'boolean' ? 'change' : 'input', () => {
      try {
        const value = field.enum ? field.enum[input.selectedIndex] : field.type === 'boolean' ? input.checked : ['object', 'array'].includes(field.type) ? JSON.parse(input.value) : ['number', 'integer'].includes(field.type) ? (input.value === '' ? undefined : Number(input.value)) : input.value;
        input.setCustomValidity('');
        if (field.type === 'array' && !Array.isArray(value)) throw new Error('Expected an array');
        if (field.type === 'object' && (!value || typeof value !== 'object' || Array.isArray(value))) throw new Error('Expected an object');
        if (!input.validity.valid) return;
        changed(key, value);
      } catch { input.setCustomValidity('Enter valid JSON'); }
    });
    label.append(text, input);
    if (field.description) {
      const description = document.createElement('small');
      description.textContent = field.description;
      label.append(description);
    }
    container.append(label);
  }
  container.hidden = !container.children.length;
}
