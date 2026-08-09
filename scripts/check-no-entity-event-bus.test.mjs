import assert from 'node:assert';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'rentrix-app/src');

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) return collect(full);
    if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name)) return [full];
    return [];
  });
}

let violations = [];
for (const file of collect(SRC)) {
  const content = readFileSync(file, 'utf8');
  if (content.includes('malek:entity-preview') || content.includes('entity-preview-events')) {
    violations.push(relative(ROOT, file));
  }
}
const legacyEvent = resolve(SRC, 'components/ui/entity-preview-events.ts');
const legacyHost = resolve(SRC, 'components/ui/entity-preview-host.tsx');
if (existsSync(legacyEvent)) violations.push('entity-preview-events.ts still exists');
if (existsSync(legacyHost)) violations.push('entity-preview-host.tsx still exists');

assert.equal(violations.length, 0, `Entity Event Bus violations: ${violations.join(', ')}`);
console.log('check-no-entity-event-bus.test.mjs: PASS');
