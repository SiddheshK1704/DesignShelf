/**
 * Read JSON that is still being streamed: close any open string, drop a
 * dangling key or comma, and close open objects and arrays, then parse.
 * Returns null when nothing usable has arrived yet.
 *
 *   '{"summary": "Treat rugged'  ->  { summary: 'Treat rugged' }
 */
export function parsePartialJson(text: string): unknown {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  let s = text;
  if (inString) {
    // An unfinished escape can't be closed; drop it.
    if (escaped) s = s.slice(0, -1);
    s += '"';
  }
  const closers = stack.reverse().join('');

  // Try as is, then without a trailing key, comma or half-written value.
  const attempts = [
    s,
    s.replace(/,\s*$/, ''),
    s.replace(/,?\s*"[^"]*"\s*:\s*$/, ''),
    s.replace(/,?\s*"[^"]*"\s*$/, ''),
    s.replace(/,?\s*"[^"]*"\s*:\s*"[^"]*"\s*$/, ''),
    s.replace(/,?\s*[^,{[]*$/, ''),
  ];
  for (const a of attempts) {
    try {
      return JSON.parse(a.trimEnd().replace(/,$/, '') + closers);
    } catch {
      // Try the next, more forgiving version.
    }
  }
  return null;
}
