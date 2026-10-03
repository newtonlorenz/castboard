// Three-way reconciliation keeps unrelated saved changes and makes collisions explicit.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const copy = value => value === undefined ? undefined : structuredClone(value);
export function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
  if (object(left) && object(right)) {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
  }
  return false;
}
export function mergeDraft(base, local, latest) {
  const conflicts = [];
  function merge(before, mine, saved, path) {
    if (sameValue(mine, before) || sameValue(mine, saved)) return copy(saved);
    if (sameValue(saved, before)) return copy(mine);
    if (Array.isArray(before) && Array.isArray(mine) && Array.isArray(saved) && before.length === mine.length && before.length === saved.length && before.every((item,index) => object(item) && typeof item.id === 'string' && item.id === mine[index]?.id && item.id === saved[index]?.id)) {
      return before.map((item,index)=>merge(item,mine[index],saved[index],[...path,index]));
    }
    if ((object(before) || before === undefined) && object(mine) && object(saved)) {
      return Object.fromEntries([...new Set([...Object.keys(before || {}), ...Object.keys(mine), ...Object.keys(saved)])].flatMap(key => {
        const value = merge(before?.[key], mine[key], saved[key], [...path, key]);
        return value === undefined ? [] : [[key, value]];
      }));
    }
    conflicts.push({ path, local: copy(mine), latest: copy(saved) });
    return copy(saved);
  }
  const value = merge(base, local, latest, []);
  return { value, conflicts };
}
export function resolveDraft(result, choices) {
  let value = copy(result.value);
  result.conflicts.forEach((conflict, index) => {
    if (choices[index] !== 'local' && choices[index] !== 'latest') throw new Error('Choose which version to keep for each changed setting.');
    if (choices[index] === 'latest') return;
    if (!conflict.path.length) { value = copy(conflict.local); return; }
    let parent = value;
    for (const key of conflict.path.slice(0, -1)) parent = parent[key];
    const key = conflict.path.at(-1);
    if (conflict.local === undefined) delete parent[key];
    else Object.defineProperty(parent, key, {value:copy(conflict.local),enumerable:true,writable:true,configurable:true});
  });
  return value;
}

export function protectedSetting(key, schema, value, protectedFields = []) {
  return protectedFields.includes(key) || Boolean(schema?.sensitive) || /token|password|secret|apiKey|headers/i.test(key) || (typeof value === 'string' && /:\/\/[^/]+@|[?&](token|key|auth|signature|password)=/i.test(value));
}
export function safePluginDraft(draft) {
  const safe = copy(draft);
  safe.omitted = [...(safe.omitted || [])];
  for (const key of new Set([...Object.keys(safe.edits || {}), ...Object.keys(safe.inputs || {}), ...Object.keys(safe.base.settings || {})])) {
    if (!protectedSetting(key, safe.base.settingsSchema?.properties?.[key], safe.inputs?.[key]?.value ?? safe.edits?.[key] ?? safe.base.settings[key], safe.base.protectedFields)) continue;
    if ((Object.hasOwn(safe.edits || {}, key) || Object.hasOwn(safe.inputs || {}, key)) && !safe.omitted.includes(key)) safe.omitted.push(key);
    delete safe.edits[key]; delete safe.inputs?.[key]; delete safe.base.settings[key];
  }
  return safe;
}
