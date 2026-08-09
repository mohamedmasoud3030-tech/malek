#!/usr/bin/env node
/**
 * Guard: no new production usage of global Entity Preview event bus.
 * Targeted: only checks for `malek:entity-preview` and `entity-preview-events`
 * in production code (src/features, src/routes, src/app, src/components
 * excluding tests and the legacy file itself which is now deleted).
 * Browser events for other purposes (e.g., pointerdown, keydown) are allowed.
 */

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

const violations = [];
for (const file of collect(SRC)) {
  const rel = relative(ROOT, file).split(sep).join('/');
  // Allow the guard test itself and the deleted file check
  if (rel.includes('check-no-entity-event-bus')) continue;
  const content = readFileSync(file, 'utf8');
  if (content.includes('malek:entity-preview') || content.includes('entity-preview-events')) {
    violations.push(rel);
  }
  // Also check for global dispatch of preview event (targeted)
  if (content.includes("dispatchEvent") && content.includes("preview")) {
    // Only flag if it's entity preview related
    if (content.toLowerCase().includes('preview')) {
      // Check if it's the legacy file itself (now deleted) — skip
      if (!rel.endsWith('entity-preview-dialog.tsx') && !rel.endsWith('entity-preview-events.ts')) {
        // Allowlist: none, but be precise — only flag if it mentions entity
        if (content.includes('entity') || content.includes('Entity')) {
          if (!violations.includes(rel)) violations.push(rel + ' (dispatchEvent with preview)');
        }
      }
    }
  }
}

// Also ensure the legacy files are actually deleted
const legacyEvent = resolve(SRC, 'components/ui/entity-preview-events.ts');
const legacyHost = resolve(SRC, 'components/ui/entity-preview-host.tsx');
if (existsSync(legacyEvent)) violations.push('rentrix-app/src/components/ui/entity-preview-events.ts still exists (should be deleted)');
if (existsSync(legacyHost)) violations.push('rentrix-app/src/components/ui/entity-preview-host.tsx still exists (should be deleted)');

if (violations.length > 0) {
  console.error('Entity Event Bus guard — violations found:');
  for (const v of violations) console.error(`- ${v}`);
  console.error('\nPolicy: route-native dialogs only for entity navigation. Do not use global event bus for property/unit/contract/owner/people.');
  process.exitCode = 1;
} else {
  console.log('Entity Event Bus guard: PASS — no production usage, legacy files deleted.');
}
