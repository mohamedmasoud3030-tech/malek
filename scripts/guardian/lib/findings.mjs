// Database Guardian — finding model.
//
// Every Guardian check returns findings in this shape. The runner aggregates
// them, renders a human report, and emits machine-readable JSON. Severity
// decides the exit code:
//
//   CRITICAL  -> exit 1 (CI blocks merge)
//   HIGH      -> exit 1 (CI blocks merge)
//   MEDIUM    -> exit 0 in local runs, recorded in artifact
//   LOW       -> exit 0, recorded in artifact
//   INFO      -> exit 0, recorded in artifact
//
// Findings are deterministic — they must come from an actual query/assertion
// against a real (ephemeral) PostgreSQL, never from a model's opinion.

export const SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO',
});

export const SEVERITY_RANK = Object.freeze({
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INFO: 0,
});

export const BLOCKING_SEVERITIES = new Set([SEVERITY.CRITICAL, SEVERITY.HIGH]);

let counter = 0;

/**
 * @param {object} spec
 * @param {string} spec.id          stable finding code, e.g. DG-FIN-001
 * @param {string} spec.severity    CRITICAL|HIGH|MEDIUM|LOW|INFO
 * @param {string} spec.category    inventory|rls|data|financial|drift|migration|operation-map|security
 * @param {string} spec.title       one-line human summary
 * @param {string} [spec.evidence]  the concrete row/value/predicate that proves it
 * @param {string} [spec.detail]    longer explanation
 * @param {string} [spec.remediation] how to fix
 * @param {object} [spec.meta]      arbitrary structured data for the JSON artifact
 */
export function finding({ id, severity, category, title, evidence, detail, remediation, meta }) {
  if (!id || !severity || !category || !title) {
    throw new Error(`finding() requires id, severity, category, title (got ${JSON.stringify({ id, severity, category, title })})`);
  }
  if (!SEVERITY[severity]) throw new Error(`unknown severity ${severity} for ${id}`);
  return {
    id,
    severity,
    category,
    title,
    evidence: evidence ?? null,
    detail: detail ?? null,
    remediation: remediation ?? null,
    meta: meta ?? null,
    seq: counter++,
  };
}

export function summarise(findings) {
  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  const byId = {};
  const byCategory = {};
  for (const f of findings) {
    bySeverity[f.severity]++;
    byId[f.id] = (byId[f.id] ?? 0) + 1;
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
  }
  const blocking = findings.filter((f) => BLOCKING_SEVERITIES.has(f.severity));
  return { total: findings.length, bySeverity, byId, byCategory, blocking };
}

export function renderReport(findings, { title = 'Database Guardian' } = {}) {
  const s = summarise(findings);
  const lines = [];
  lines.push('='.repeat(72));
  lines.push(`${title} — ${findings.length} finding(s)`);
  lines.push('='.repeat(72));
  lines.push(
    `  CRITICAL ${s.bySeverity.CRITICAL}   HIGH ${s.bySeverity.HIGH}   MEDIUM ${s.bySeverity.MEDIUM}   LOW ${s.bySeverity.LOW}   INFO ${s.bySeverity.INFO}`,
  );
  lines.push('');
  for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']) {
    const group = findings.filter((f) => f.severity === sev);
    if (!group.length) continue;
    lines.push(`[${sev}] (${group.length})`);
    for (const f of group) {
      lines.push(`  ${f.id}  ${f.title}`);
      if (f.evidence) {
        const ev = String(f.evidence).split('\n').join('\n      ');
        lines.push(`      evidence: ${ev}`);
      }
      if (f.detail) lines.push(`      detail: ${f.detail}`);
      if (f.remediation) lines.push(`      fix: ${f.remediation}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
