/**
 * Expired feature‑flag cleanup guard.
 *
 * Checks every flag definition against today's date and fails if any
 * `cleanupBy` has passed.  Run before every release:
 *
 *   node scripts/check-expired-flags.mjs
 *
 * When a flag's cleanup date passes, the owning team must either:
 *   a) remove the gated code and the flag definition, or
 *   b) extend `cleanupBy` with an explicit timestamp and reason in git.
 */

const flags = [
  { key: 'ai-assistant', cleanupBy: '2026-12-01' },
  { key: 'reports-v2', cleanupBy: '2026-11-01' },
  { key: 'financial-wave-2', cleanupBy: '2026-11-01' },
  { key: 'owner-agreements-v2', cleanupBy: '2026-10-15' },
  { key: 'dashboard-v2', cleanupBy: '2026-10-01' },
  { key: 'malek-pro-visual', cleanupBy: '2026-09-15' },
  { key: 'commission-lifecycle-v2', cleanupBy: '2026-10-01' },
];

const today = /* @__PURE__ */ new Date();
today.setHours(0, 0, 0, 0);

let exitCode = 0;

for (const flag of flags) {
  const deadline = new Date(flag.cleanupBy + 'T00:00:00Z');
  if (deadline <= today) {
    console.error(`❌ Flag "${flag.key}" expired on ${flag.cleanupBy}. Remove or extend.`);
    exitCode = 1;
  }
}

if (exitCode === 0) {
  console.log('✅ All flags within their cleanup windows.');
}

process.exit(exitCode);