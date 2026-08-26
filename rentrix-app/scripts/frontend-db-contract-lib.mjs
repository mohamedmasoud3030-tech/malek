import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '__snapshots__']);
const FILTER_METHODS = new Set([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in',
  'contains', 'containedBy', 'overlaps', 'textSearch', 'order',
]);

function extensionOf(path) {
  return path.match(/(\.[^.\/]+)$/)?.[1] ?? '';
}

export function listProductionSourceFiles(root) {
  const files = [];
  function visit(dir) {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const abs = join(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) {
        if (name !== '__tests__') visit(abs);
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(extensionOf(name))) continue;
      if (/\.d\.ts$/.test(name) || /\.(test|spec)\.[jt]sx?$/.test(name)) continue;
      files.push(abs);
    }
  }
  visit(root);
  return files.sort();
}

function lineNumber(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

function readString(text, index) {
  const quote = text[index];
  let i = index + 1;
  let value = '';
  let dynamic = false;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      if (i + 1 < text.length) {
        value += text[i + 1];
        i += 2;
        continue;
      }
    }
    if (quote === '`' && ch === '$' && text[i + 1] === '{') dynamic = true;
    if (ch === quote) return { end: i + 1, value, dynamic };
    value += ch;
    i++;
  }
  return { end: text.length, value, dynamic: true };
}

function skipComment(text, index) {
  if (text[index] !== '/') return null;
  if (text[index + 1] === '/') {
    const end = text.indexOf('\n', index + 2);
    return end === -1 ? text.length : end + 1;
  }
  if (text[index + 1] === '*') {
    const end = text.indexOf('*/', index + 2);
    return end === -1 ? text.length : end + 2;
  }
  return null;
}

function skipTrivia(text, index) {
  let i = index;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }
    const commentEnd = skipComment(text, i);
    if (commentEnd != null) {
      i = commentEnd;
      continue;
    }
    break;
  }
  return i;
}

export function findMatchingDelimiter(text, start, open, close) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = readString(text, i).end - 1;
      continue;
    }
    const commentEnd = skipComment(text, i);
    if (commentEnd != null) {
      i = commentEnd - 1;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) return i;
  }
  return -1;
}

function splitTopLevel(text, delimiter = ',') {
  const parts = [];
  let start = 0;
  const stack = [];
  const pairs = { '(': ')', '{': '}', '[': ']' };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = readString(text, i).end - 1;
      continue;
    }
    const commentEnd = skipComment(text, i);
    if (commentEnd != null) {
      i = commentEnd - 1;
      continue;
    }
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (stack.length && ch === stack[stack.length - 1]) stack.pop();
    else if (ch === delimiter && stack.length === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

function parseLiteral(text) {
  const expr = text.trim();
  if (!expr || !['"', "'", '`'].includes(expr[0])) return null;
  const parsed = readString(expr, 0);
  if (parsed.end !== expr.length || parsed.dynamic) return null;
  return parsed.value;
}

function collectConstStrings(source) {
  const result = new Map();
  const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*(["'`])/g;
  let match;
  while ((match = re.exec(source))) {
    const name = match[1];
    const quoteIndex = re.lastIndex - 1;
    const parsed = readString(source, quoteIndex);
    if (!parsed.dynamic) {
      if (result.has(name)) result.set(name, null);
      else result.set(name, parsed.value);
    }
    re.lastIndex = Math.max(re.lastIndex, parsed.end);
  }
  return result;
}

function collectConstObjects(source) {
  const result = new Map();
  const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*\{/g;
  let match;
  while ((match = re.exec(source))) {
    const name = match[1];
    const braceIndex = re.lastIndex - 1;
    const end = findMatchingDelimiter(source, braceIndex, '{', '}');
    if (end !== -1) {
      if (result.has(name)) result.set(name, null);
      else result.set(name, source.slice(braceIndex, end + 1));
      re.lastIndex = end + 1;
    }
  }
  return result;
}

function resolveStringExpression(expr, constStrings) {
  const literal = parseLiteral(expr);
  if (literal != null) return literal;
  const id = expr.trim();
  return /^[A-Za-z_$][\w$]*$/.test(id) ? (constStrings.get(id) ?? null) : null;
}

function parseObjectLiteralKeys(expr, constObjects, seen = new Set()) {
  const text = expr.trim();
  if (/^[A-Za-z_$][\w$]*$/.test(text)) {
    if (seen.has(text)) return { known: false, keys: new Set() };
    const resolved = constObjects.get(text);
    if (!resolved) return { known: false, keys: new Set() };
    return parseObjectLiteralKeys(resolved, constObjects, new Set([...seen, text]));
  }
  if (text.startsWith('[')) {
    const end = findMatchingDelimiter(text, 0, '[', ']');
    if (end !== text.length - 1) return { known: false, keys: new Set() };
    const keys = new Set();
    for (const item of splitTopLevel(text.slice(1, -1))) {
      const parsed = parseObjectLiteralKeys(item, constObjects, seen);
      if (!parsed.known) return { known: false, keys };
      for (const key of parsed.keys) keys.add(key);
    }
    return { known: true, keys };
  }
  if (!text.startsWith('{')) return { known: false, keys: new Set() };
  const end = findMatchingDelimiter(text, 0, '{', '}');
  if (end !== text.length - 1) return { known: false, keys: new Set() };
  const keys = new Set();
  for (const part of splitTopLevel(text.slice(1, -1))) {
    const token = part.trim();
    if (!token) continue;
    if (token.startsWith('...') || token.startsWith('[')) return { known: false, keys };
    const quoted = token.match(/^(?:'([^']+)'|"([^"]+)"|`([^`]+)`)\s*:/);
    if (quoted) {
      keys.add(quoted[1] ?? quoted[2] ?? quoted[3]);
      continue;
    }
    const named = token.match(/^([A-Za-z_$][\w$]*)\s*(?::|$)/);
    if (!named) return { known: false, keys };
    keys.add(named[1]);
  }
  return { known: true, keys };
}

function supabaseBindings(source) {
  const bindings = new Set();
  const re = /import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]*lib\/supabase)['"]/g;
  let match;
  while ((match = re.exec(source))) {
    for (const specifier of match[1].split(',')) {
      const normalized = specifier.trim();
      const named = normalized.match(/^supabase(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (named) bindings.add(named[1] ?? 'supabase');
    }
  }
  if (/\bsupabase\s*\.\s*(?:from|rpc)\s*\(/.test(source)) bindings.add('supabase');
  return bindings;
}

function readCall(source, openParen) {
  const close = findMatchingDelimiter(source, openParen, '(', ')');
  return close === -1 ? null : { close, args: splitTopLevel(source.slice(openParen + 1, close)) };
}

function readContinuousChain(source, start) {
  const calls = [];
  let i = start;
  while (i < source.length) {
    i = skipTrivia(source, i);
    if (source[i] === '?' && source[i + 1] === '.') i += 2;
    else if (source[i] === '.') i += 1;
    else break;

    i = skipTrivia(source, i);
    const id = source.slice(i).match(/^([A-Za-z_$][\w$]*)/);
    if (!id) break;
    const name = id[1];
    i += name.length;
    i = skipTrivia(source, i);
    if (source[i] !== '(') break;
    const parsed = readCall(source, i);
    if (!parsed) break;
    calls.push({ name, args: parsed.args });
    i = parsed.close + 1;
  }
  return calls;
}

function analyzeChain(calls, constStrings, constObjects) {
  const columns = new Set();
  const mutations = [];
  for (const call of calls) {
    if (call.name === 'select' && call.args[0]) {
      const selection = resolveStringExpression(call.args[0], constStrings);
      if (selection != null) for (const col of parseSelectColumns(selection)) columns.add(col);
    }
    if (FILTER_METHODS.has(call.name) && call.args[0]) {
      const col = resolveStringExpression(call.args[0], constStrings);
      if (col && /^[A-Za-z_][\w]*$/.test(col)) columns.add(col);
    }
    if (call.name === 'match' && call.args[0]) {
      const parsed = parseObjectLiteralKeys(call.args[0], constObjects);
      if (parsed.known) for (const col of parsed.keys) columns.add(col);
    }
    if (['insert', 'update', 'upsert'].includes(call.name) && call.args[0]) {
      mutations.push({ method: call.name, ...parseObjectLiteralKeys(call.args[0], constObjects) });
    }
  }
  return { columns, mutations };
}

export function parseSelectColumns(selection) {
  const columns = new Set();
  for (const raw of splitTopLevel(selection)) {
    const token = raw.trim();
    if (!token || token === '*' || token.includes('(')) continue;
    const aliasParts = token.split(':').map((part) => part.trim()).filter(Boolean);
    const candidate = aliasParts.length > 1 ? aliasParts.at(-1) : aliasParts[0];
    const cleaned = candidate?.replace(/!\w+$/g, '').trim();
    if (cleaned && /^[A-Za-z_][\w]*$/.test(cleaned)) columns.add(cleaned);
  }
  return columns;
}

export function discoverFrontendUsageFromSources(sources) {
  const tables = new Map();
  const rpcs = new Map();
  const dynamic = [];

  for (const { path, source } of sources) {
    const bindings = supabaseBindings(source);
    if (bindings.size === 0) continue;
    const constStrings = collectConstStrings(source);
    const constObjects = collectConstObjects(source);

    for (const binding of bindings) {
      const escaped = binding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${escaped}\\s*\\.\\s*(from|rpc)\\s*\\(`, 'g');
      let match;
      while ((match = re.exec(source))) {
        const method = match[1];
        const openParen = re.lastIndex - 1;
        const parsed = readCall(source, openParen);
        if (!parsed) continue;
        const line = lineNumber(source, match.index);
        const name = parsed.args[0] ? resolveStringExpression(parsed.args[0], constStrings) : null;
        if (!name) {
          dynamic.push({ path, line, method, expression: parsed.args[0] ?? '' });
          re.lastIndex = parsed.close + 1;
          continue;
        }

        if (method === 'from') {
          const detail = analyzeChain(readContinuousChain(source, parsed.close + 1), constStrings, constObjects);
          const entry = tables.get(name) ?? { name, calls: [], columns: new Set(), mutations: [] };
          entry.calls.push({ path, line });
          for (const col of detail.columns) entry.columns.add(col);
          entry.mutations.push(...detail.mutations.map((m) => ({ ...m, path, line })));
          tables.set(name, entry);
        } else {
          const argShape = parsed.args.length < 2
            ? { known: true, keys: new Set() }
            : parseObjectLiteralKeys(parsed.args[1], constObjects);
          const entry = rpcs.get(name) ?? { name, calls: [] };
          entry.calls.push({ path, line, argShape });
          rpcs.set(name, entry);
        }
        re.lastIndex = parsed.close + 1;
      }
    }
  }
  return { tables, rpcs, dynamic };
}

export function discoverFrontendUsage(root) {
  const sources = listProductionSourceFiles(root).map((abs) => ({
    path: relative(root, abs).replaceAll('\\', '/'),
    source: readFileSync(abs, 'utf8'),
  }));
  return discoverFrontendUsageFromSources(sources);
}

function sectionBlock(types, name) {
  const re = new RegExp(`\\n\\s{4}${name}: \\{`);
  const match = re.exec(types);
  if (!match) return '';
  const brace = types.indexOf('{', match.index);
  const end = findMatchingDelimiter(types, brace, '{', '}');
  return end === -1 ? '' : types.slice(brace + 1, end);
}

function namedObjectBlocks(section) {
  const map = new Map();
  const re = /^\s{6}([A-Za-z_][\w]*): \{/gm;
  let match;
  while ((match = re.exec(section))) {
    const brace = section.indexOf('{', match.index);
    const end = findMatchingDelimiter(section, brace, '{', '}');
    if (end === -1) continue;
    map.set(match[1], section.slice(brace + 1, end));
    re.lastIndex = end + 1;
  }
  return map;
}

function nestedObjectBlock(block, name) {
  const re = new RegExp(`(?:^|\\n)\\s+${name}: \\{`);
  const match = re.exec(block);
  if (!match) return '';
  const brace = block.indexOf('{', match.index);
  const end = findMatchingDelimiter(block, brace, '{', '}');
  return end === -1 ? '' : block.slice(brace + 1, end);
}

function objectTypeFields(block) {
  const fields = new Map();
  const re = /^\s*([A-Za-z_][\w]*)(\?)?:/gm;
  let match;
  while ((match = re.exec(block))) fields.set(match[1], { optional: Boolean(match[2]) });
  return fields;
}

function parseRpcArgs(block) {
  if (/Args:\s*Record<PropertyKey, never>\s*;/.test(block)) return { known: true, fields: new Map() };
  const marker = /(?:^|\n)\s+Args: \{/m.exec(block);
  if (!marker) return { known: false, fields: new Map() };
  const brace = block.indexOf('{', marker.index);
  const end = findMatchingDelimiter(block, brace, '{', '}');
  if (end === -1) return { known: false, fields: new Map() };
  return { known: true, fields: objectTypeFields(block.slice(brace + 1, end)) };
}

export function parseDatabaseTypes(types) {
  const tables = new Map();
  for (const [name, block] of namedObjectBlocks(sectionBlock(types, 'Tables'))) {
    tables.set(name, {
      kind: 'table',
      row: objectTypeFields(nestedObjectBlock(block, 'Row')),
      insert: objectTypeFields(nestedObjectBlock(block, 'Insert')),
      update: objectTypeFields(nestedObjectBlock(block, 'Update')),
    });
  }
  for (const [name, block] of namedObjectBlocks(sectionBlock(types, 'Views'))) {
    tables.set(name, {
      kind: 'view',
      row: objectTypeFields(nestedObjectBlock(block, 'Row')),
      insert: new Map(),
      update: new Map(),
    });
  }
  const rpcs = new Map();
  for (const [name, block] of namedObjectBlocks(sectionBlock(types, 'Functions'))) {
    rpcs.set(name, { args: parseRpcArgs(block) });
  }
  return { tables, rpcs };
}

function callLabel(call) {
  return `${call.path}:${call.line}`;
}

export function validateFrontendUsage(usage, database) {
  const errors = [];
  const warnings = [];

  for (const [name, entry] of usage.tables) {
    const contract = database.tables.get(name);
    const origin = entry.calls[0] ? callLabel(entry.calls[0]) : name;
    if (!contract) {
      errors.push(`Missing database relation '${name}' used at ${origin}`);
      continue;
    }
    for (const column of entry.columns) {
      if (!contract.row.has(column)) errors.push(`Missing column '${name}.${column}' used by frontend (${origin})`);
    }
    for (const mutation of entry.mutations) {
      if (!mutation.known) {
        warnings.push(`Dynamic ${mutation.method} payload for '${name}' at ${callLabel(mutation)}; key-level mutation verification skipped`);
        continue;
      }
      if (contract.kind === 'view') {
        errors.push(`Frontend attempts ${mutation.method} against read-only view '${name}' at ${callLabel(mutation)}`);
        continue;
      }
      const allowed = mutation.method === 'update' ? contract.update : contract.insert;
      for (const key of mutation.keys) {
        if (!allowed.has(key)) errors.push(`Unknown ${mutation.method} field '${name}.${key}' at ${callLabel(mutation)}`);
      }
    }
  }

  for (const [name, entry] of usage.rpcs) {
    const contract = database.rpcs.get(name);
    const origin = entry.calls[0] ? callLabel(entry.calls[0]) : name;
    if (!contract) {
      errors.push(`Missing RPC '${name}' used at ${origin}`);
      continue;
    }
    for (const call of entry.calls) {
      if (!contract.args.known) {
        warnings.push(`RPC '${name}' has an unparsed generated Args contract; argument verification skipped (${callLabel(call)})`);
        continue;
      }
      if (!call.argShape.known) {
        warnings.push(`Dynamic RPC payload for '${name}' at ${callLabel(call)}; argument-key verification skipped`);
        continue;
      }
      const expected = contract.args.fields;
      for (const key of call.argShape.keys) {
        if (!expected.has(key)) errors.push(`Unknown RPC argument '${name}.${key}' at ${callLabel(call)}`);
      }
      for (const [key, meta] of expected) {
        if (!meta.optional && !call.argShape.keys.has(key)) errors.push(`Missing required RPC argument '${name}.${key}' at ${callLabel(call)}`);
      }
    }
  }

  for (const item of usage.dynamic) {
    warnings.push(`Dynamic Supabase ${item.method} target at ${item.path}:${item.line}; name-level verification skipped`);
  }
  return { errors, warnings };
}
