#!/usr/bin/env node
/**
 * Local audit aid: extract regex literals + new RegExp() patterns from
 * analyzed scopes, and flag candidates vulnerable to catastrophic
 * backtracking (the class of pattern Sonar rule S8786 targets).
 * Heuristic only — final arbiter is the Sonar scan.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.argv[2] ?? '.';
const SCOPES = ['rentrix-app/src', 'scripts', 'supabase/functions'];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      yield* walk(abs);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) {
      yield abs;
    }
  }
}

/** Strip string literals and comments so we don't pick regex-like text inside them. */
function stripSource(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
          // keep template expression contents (crude: just continue)
          i += 2;
          continue;
        }
        if (src[i] === quote) { i++; break; }
        if (src[i] === '\n') out += '\n';
        i++;
      }
      out += quote === '`' ? '``' : '""';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function extractRegexLiterals(src) {
  // A '/' starts a regex only after certain tokens; crude but effective:
  // previous non-space char is one of ( , = : [ ! & | ? { } ; return typeof => + - * % < > ~ ^
  const results = [];
  const stripped = src;
  let i = 0;
  const n = stripped.length;
  const canStart = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
  while (i < n) {
    const c = stripped[i];
    if (c === '/') {
      // find previous significant char
      let j = i - 1;
      while (j >= 0 && /\s/.test(stripped[j])) j--;
      const prev = j >= 0 ? stripped[j] : '';
      const prevWord = stripped.slice(Math.max(0, j - 10), j + 1);
      const startsAfterKeyword = /\b(return|typeof|case|in|of|new|delete|void|throw|instanceof|await|yield|do|else)$/.test(prevWord);
      if (canStart.has(prev) || startsAfterKeyword || prev === '') {
        // try to parse regex literal
        let k = i + 1;
        let inClass = false;
        let valid = false;
        while (k < n) {
          const ch = stripped[k];
          if (ch === '\\') { k += 2; continue; }
          if (ch === '\n') break;
          if (ch === '[') inClass = true;
          else if (ch === ']') inClass = false;
          else if (ch === '/' && !inClass) { valid = true; break; }
          k++;
        }
        if (valid) {
          const body = stripped.slice(i + 1, k);
          let f = k + 1;
          let flags = '';
          while (f < n && /[a-z]/i.test(stripped[f])) { flags += stripped[f]; f++; }
          results.push({ start: i, body, flags });
          i = f;
          continue;
        }
      }
    }
    i++;
  }
  return results;
}

function extractRegExpCtors(src) {
  const results = [];
  const re = /new RegExp\(\s*"((?:[^"\\]|\\.)*)"|new RegExp\(\s*'((?:[^'\\]|\\.)*)'|RegExp\(\s*"((?:[^"\\]|\\.)*)"|RegExp\(\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(src))) {
    const raw = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (raw === undefined) continue;
    // unescape minimally
    const body = raw.replace(/\\(["'\\])/g, '$1');
    results.push({ start: m.index, body, flags: '', ctor: true });
  }
  return results;
}

/**
 * Catastrophic-backtracking heuristics (superset of what S8786 flags):
 *  - nested quantifier over a group containing a quantifier:  ( ... [+*] ... ) [+*{]
 *  - quantified group whose alternatives can overlap: (a|ab)+ style via prefix rule (approx)
 */
function auditPattern(body) {
  const notes = [];
  // find groups with inner quantifier followed by outer quantifier
  const groupRe = /\(([^()]*(?:\[[^\]]*\])?[^()]*)\)([+*]|\{\d+,?\d*\})/g;
  let m;
  while ((m = groupRe.exec(body))) {
    const inner = m[1];
    // inner contains an unescaped quantifier?
    if (/(^|[^\\])[*+](?![?+])/.test(inner) || /\{\d+,/.test(inner)) {
      notes.push(`nested quantifier: (${inner})${m[2]}`);
    }
    // alternation with overlapping branches under a quantifier (approx: same leading char)
    if (inner.includes('|')) {
      const branches = inner.split('|').filter(Boolean);
      const firsts = branches.map((b) => b[0]);
      if (new Set(firsts).size < firsts.length && branches.length > 1) {
        notes.push(`overlapping alternation under quantifier: (${inner})${m[2]}`);
      }
      // branches where one is a prefix of another
      for (let a = 0; a < branches.length; a++) {
        for (let b = 0; b < branches.length; b++) {
          if (a !== b && branches[a].startsWith(branches[b]) && branches[b].length > 0) {
            notes.push(`prefix-overlap alternation under quantifier: (${inner})${m[2]}`);
            a = branches.length; break;
          }
        }
      }
    }
  }
  // classic greedy backtracking traps: (\s+\w+)+ style already covered above.
  // (.*x)+ or (.+x)+
  if (/\(\s*\\?[sdwSDW.][+*][^()]*\)[+*{]/.test(body)) {
    notes.push('dot/class quantifier inside quantified group');
  }
  return notes;
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

let total = 0;
for (const scope of SCOPES) {
  const base = join(ROOT, scope);
  let files;
  try { files = [...walk(base)]; } catch { continue; }
  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    const src = stripSource(raw);
    const regs = [
      ...extractRegexLiterals(src),
      ...extractRegExpCtors(stripSource(raw)),
    ];
    for (const r of regs) {
      total++;
      const notes = auditPattern(r.body);
      if (notes.length > 0) {
        const ln = lineOf(raw, r.start);
        console.log(`${relative(ROOT, file)}:${ln}`);
        console.log(`  pattern: /${r.body}/${r.flags}${r.ctor ? ' (ctor)' : ''}`);
        for (const nte of notes) console.log(`  ⚠ ${nte}`);
      }
    }
  }
}
console.error(`scanned ${total} regexes`);
