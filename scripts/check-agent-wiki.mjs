#!/usr/bin/env node
/**
 * MALEK — agent wiki consistency guard.
 *
 * The wiki is only useful if it stays navigable and every claim stays dated. Those two properties
 * decay silently: a new page gets written, nobody links it from the index, and it becomes
 * unreachable; or a claim is copied without its date and starts reading like present reality.
 *
 * Rules enforced here:
 *   1. docs/agent-wiki/index.md exists and has an H1.
 *   2. Every other page in docs/agent-wiki is linked from index.md (no orphans).
 *   3. Every page links back to index.md (navigation works in both directions).
 *   4. Every non-index page declares a `> **Recorded:** <YYYY-MM-DD>` line containing a commit
 *      reference, so no claim is undated.
 *   5. Every intra-wiki link in index.md resolves to a file that exists.
 *
 * This checks form, not truth. It cannot tell whether a claim is still correct — only whether the
 * page admits when it was made. Truth is established by re-running the commands the page cites.
 *
 * Usage: node scripts/check-agent-wiki.mjs
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const WIKI_DIR = resolve(process.cwd(), 'docs/agent-wiki');
const INDEX_NAME = 'index.md';
const RECORDED_PATTERN = /^>\s*\*\*Recorded:\*\*\s*(\d{4}-\d{2}-\d{2})\b(.*)$/;
const COMMIT_PATTERN = /\b[0-9a-f]{7,40}\b/;

const violations = [];
function violate(file, message) {
  violations.push(`${file}: ${message}`);
}

function extractLinks(markdown) {
  const links = [];
  const pattern = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = pattern.exec(markdown)) !== null) links.push(match[1]);
  return links;
}

function isNavigablePageLink(target) {
  if (/^[a-z]+:/i.test(target)) return false; // external URL
  if (target.startsWith('#')) return false; // same-page anchor
  if (target.startsWith('../../') || target.startsWith('../')) return false; // leaves the wiki
  return target.endsWith('.md') || target.includes('.md#');
}

if (!existsSync(WIKI_DIR)) {
  console.error('docs/agent-wiki does not exist. If the wiki was intentionally removed, remove this guard too.');
  process.exit(1);
}

const pages = readdirSync(WIKI_DIR)
  .filter((name) => name.endsWith('.md'))
  .sort();

if (!pages.includes(INDEX_NAME)) {
  console.error('docs/agent-wiki/index.md is missing.');
  process.exit(1);
}

const indexed = [];
for (const page of pages) {
  const file = join(WIKI_DIR, page);
  const markdown = readFileSync(file, 'utf8');
  const rel = `docs/agent-wiki/${page}`;

  if (!/^#\s+\S/m.test(markdown)) violate(rel, 'missing an H1 heading');

  const links = extractLinks(markdown);
  const navigable = links.filter(isNavigablePageLink);

  if (page === INDEX_NAME) {
    for (const target of navigable) {
      const targetFile = target.split('#')[0];
      indexed.push(targetFile);
      if (!existsSync(resolve(WIKI_DIR, targetFile))) {
        violate(rel, `index links to a page that does not exist: ${target}`);
      }
    }
    continue;
  }

  if (!navigable.some((target) => target.split('#')[0] === INDEX_NAME)) {
    violate(rel, 'does not link back to index.md');
  }

  const recordedLine = markdown
    .split('\n')
    .map((line) => line.trim())
    .find((line) => RECORDED_PATTERN.test(line));

  if (!recordedLine) {
    violate(rel, 'missing a `> **Recorded:** YYYY-MM-DD ...` line');
  } else {
    const rest = recordedLine.match(RECORDED_PATTERN)[2];
    if (!COMMIT_PATTERN.test(rest)) {
      violate(rel, '`Recorded:` line does not cite a commit hash');
    }
  }
}

for (const page of pages) {
  if (page === INDEX_NAME) continue;
  if (!indexed.includes(page)) violate(`docs/agent-wiki/${page}`, 'is not linked from index.md');
}

const checkedPages = pages.length;
const checkedLinks = indexed.length;

if (violations.length > 0) {
  console.error(`Agent wiki guard: FAIL — ${violations.length} violation(s)`);
  for (const violation of violations) console.error(`  - ${violation}`);
  console.error('');
  console.error('Fix: keep every page linked from index.md, linked back to it, and dated.');
  process.exit(1);
}

console.log(`Agent wiki guard: OK — ${checkedPages} page(s), ${checkedLinks} index link(s), all dated.`);
