/**
 * Security layer: every string that comes from an uploaded spec (untrusted input)
 * is passed through these helpers BEFORE it can reach a code template.
 * This prevents code injection into the generated SDK files (TS / Python / Go / CI yaml / README).
 */

export const MAX_SPEC_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ENDPOINTS = 2000;
export const MAX_SCHEMAS = 2000;
export const MAX_DEPTH = 20;
export const DEFAULT_BASE_URL = 'https://api.example.com';

const RESERVED_WORDS = new Set([
  // JS / TS
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else',
  'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
  'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void',
  'while', 'with', 'yield', 'let', 'static', 'implements', 'interface', 'package', 'private', 'protected',
  'public', 'await', 'async', 'constructor', 'prototype', 'arguments', 'eval',
  // Python
  'and', 'as', 'assert', 'del', 'elif', 'except', 'from', 'global', 'is', 'lambda', 'nonlocal', 'not', 'or',
  'pass', 'raise', 'None', 'True', 'False', 'self', 'print', 'exec',
  // Go
  'chan', 'defer', 'fallthrough', 'go', 'goto', 'map', 'range', 'select', 'struct', 'type', 'string', 'int',
  'bool', 'error', 'len', 'make'
]);

const RESERVED_TYPE_NAMES = new Set([
  'Record', 'Array', 'Promise', 'Date', 'String', 'Number', 'Boolean', 'Object', 'Error', 'Map', 'Set',
  'Function', 'Symbol', 'Partial', 'Types', 'ClientConfig', 'APIError', 'Any', 'Optional', 'List', 'Dict',
  'Union', 'Client'
]);

/** Free text used inside comments / docstrings / README tables. Cannot break out of any of them. */
export function safeText(input: unknown, max = 300): string {
  let s = String(input ?? '');
  s = s
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
    .replace(/\*\//g, '* /')
    .replace(/\/\*/g, '/ *')
    .replace(/["`]/g, "'")
    .replace(/\$\{/g, '$ {')
    .replace(/\\/g, '/')
    .replace(/\|/g, '/')
    .replace(/</g, '\u2039')
    .replace(/>/g, '\u203A')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (s.length > max) s = s.slice(0, max - 1) + '\u2026';
  return s;
}

/** Strict identifier: [A-Za-z_][A-Za-z0-9_]* only. */
export function safeIdent(input: unknown, fallback = 'item'): string {
  let id = String(input ?? '')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  if (!id) id = fallback;
  if (/^[0-9]/.test(id)) id = `n${id}`;
  return id;
}

/** Identifier that is also not a keyword in TS / Python / Go. */
export function safeVarName(input: unknown, fallback = 'value'): string {
  const id = safeIdent(input, fallback);
  return RESERVED_WORDS.has(id) ? `${id}_` : id;
}

/** PascalCase-ish type/schema name, never colliding with built-ins. */
export function safeTypeName(input: unknown, fallback = 'Model'): string {
  let n = safeIdent(input, fallback);
  if (!/^[A-Za-z]/.test(n)) n = `T${n}`;
  n = n.charAt(0).toUpperCase() + n.slice(1);
  if (RESERVED_TYPE_NAMES.has(n) || RESERVED_WORDS.has(n)) n = `${n}Model`;
  return n;
}

/** Parameter name used inside a URL path template: {name}. */
export function safePathParamName(input: unknown): string {
  return safeIdent(input, 'param');
}

/** Wire name for query params / JSON keys (kept readable but cannot contain quotes, backslashes, etc.). */
export function safeWireName(input: unknown, fallback = 'field'): string {
  const s = String(input ?? '').replace(/[^A-Za-z0-9_\-.\[\]]/g, '').slice(0, 100);
  return s || fallback;
}

/** Only plain http(s) URLs. Credentials, query, hash and every quote-like char are stripped. */
export function safeBaseUrl(input: unknown): string {
  try {
    const u = new URL(String(input ?? '').trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return DEFAULT_BASE_URL;
    const clean = `${u.protocol}//${u.host}${u.pathname}`
      .replace(/[^A-Za-z0-9\-._~:/%@!*+,;=]/g, '')
      .replace(/\/+$/, '');
    return clean || DEFAULT_BASE_URL;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

/** URL path template such as /users/{id}. */
export function safePath(input: unknown): string {
  let s = String(input ?? '/').split(/[?#]/)[0];
  s = s.replace(/\{([^}]*)\}/g, (_m, name) => `{${safePathParamName(name)}}`);
  s = s.replace(/[^A-Za-z0-9\-._~/{}:@%!&*+,;=]/g, '');
  if (!s.startsWith('/')) s = `/${s}`;
  return s.slice(0, 500);
}

/** Enum values allowed inside generated string-literal unions. */
export function isSafeEnumValue(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_\-. :/]{1,64}$/.test(v);
}

/** Package / npm / pip / go module name coming from the UI form. */
export function safePackageName(input: unknown, fallback = 'api-client-sdk'): string {
  const s = String(input ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9._\-@/]/g, '')
    .replace(/^[._\-/]+/, '')
    .slice(0, 80);
  return s || fallback;
}

export function safeVersion(input: unknown): string {
  const s = String(input ?? '').trim();
  return /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.\-]{1,30})?$/.test(s) ? s : '1.0.0';
}

export function safeAuthor(input: unknown): string {
  return safeText(input, 80).replace(/'/g, '') || 'API Platform Team';
}

/** Header name for API key auth. */
export function safeHeaderName(input: unknown, fallback = 'X-API-KEY'): string {
  const s = String(input ?? '').replace(/[^A-Za-z0-9\-_]/g, '').slice(0, 60);
  return s || fallback;
}

/** Resolve a local JSON pointer ($ref: "#/components/...") with a depth guard. */
export function derefNode(doc: any, node: any, depth = 0): any {
  if (!node || typeof node !== 'object' || depth > 5) return node;
  const ref = node.$ref;
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return node;
  let cur: any = doc;
  for (const raw of ref.slice(2).split('/')) {
    const key = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
    if (cur == null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, key)) return undefined;
    cur = cur[key];
  }
  return derefNode(doc, cur, depth + 1);
}
