const modules = import.meta.glob('./*/*.ts', { eager: true });

// Build resources keyed by language and namespace (= filename without .ts, e.g. 'common').
// We also mirror everything under the default 'translation' namespace as a safety net.
const messages: Record<string, Record<string, Record<string, string>>> = {};

Object.keys(modules).forEach((path) => {
  const match = path.match(/\/?([^/]+)\/([^/]+)\.ts$/);
  if (match) {
    const [, lang, ns] = match;
    const module = modules[path] as { default?: Record<string, string> };
    if (!module.default) return;

    if (!messages[lang]) messages[lang] = { translation: {} };
    messages[lang][ns] = { ...(messages[lang][ns] || {}), ...module.default };
    // Mirror into the default 'translation' namespace too
    messages[lang].translation = { ...messages[lang].translation, ...module.default };
  }
});

export default messages;