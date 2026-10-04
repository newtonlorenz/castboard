const RESERVED = new Set(['/display-guide.js', '/draft-model.js', '/record-list-field.js', '/setup', '/admin-preview', '/app.js', '/styles.css', '/admin.js', '/admin.css', '/setup.js', '/setup.css', '/studio-model.js', '/widget-kit.js', '/schema-fields.js', '/appearance-model.js', '/plugin-admin.js', '/plugin-admin.css', '/screen-path.js']);

export function screenPathError(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return 'The web address path must start with /.';
  if (value.startsWith('//') || /[\\\s?#]/.test(value)) return 'Use a path such as /screens/kitchen, without a host, spaces, query or fragment.';
  // Reject paths the browser would normalize into a different route.
  try { if (new URL(value, 'http://castboard.local').pathname !== value) return 'Use a web address path without relative segments or unescaped characters.'; }
  catch { return 'Enter a valid web address path, such as /screens/kitchen.'; }
  if (/^\/(api|plugins|screen-types|assets|admin)(\/|$)/.test(value) || RESERVED.has(value)) return 'This web address is reserved by Castboard. Choose another path, such as /screens/kitchen.';
  return '';
}
