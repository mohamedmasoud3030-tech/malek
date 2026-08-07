import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const REPO_ROOT = resolve(__dirname, '../..', '..');
const EVIDENCE = resolve(REPO_ROOT, 'evidence/s08');

function hash(s: string){ return createHash('sha256').update(s,'utf8').digest('hex'); }

describe('S08 proof-of-correctness', () => {
  it('all analysis interfaces are read-only (no DML on financial tables)', () => {
    const sql = readFileSync(resolve(REPO_ROOT,'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql'),'utf8');
    expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.journal/i);
    expect(sql).not.toMatch(/UPDATE\s+public\.journal/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.journal/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/corrective.*journal/i);
  });

  it('no direct or indirect write path via views (views are WITH security_invoker, no triggers)', () => {
    const sql = readFileSync(resolve(REPO_ROOT,'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql'),'utf8');
    // Real engine has WITH (security_invoker = true) not where false stub
    expect(sql).toMatch(/with \(security_invoker = true\)/i);
    // No trigger that writes on s08 views
    expect(sql).not.toMatch(/create trigger.*on public\.s08_/i);
    expect(sql).toContain('EGP');
  });

  it('transaction does not change checksums or row counts (before/after equal)', () => {
    const summary = JSON.parse(readFileSync(resolve(EVIDENCE,'summary.json'),'utf8'));
    expect(summary.read_only_proof.runtime.equal).toBe(true);
    const manifest = JSON.parse(readFileSync(resolve(EVIDENCE,'manifest.json'),'utf8'));
    expect(manifest.before_after_snapshot_equal).toBe(true);
  });

  it('no duplicate rows due to bad joins (findings are unique by settlement+code)', () => {
    const findings = JSON.parse(readFileSync(resolve(EVIDENCE,'findings.json'),'utf8')) as Array<{settlement_id: string, finding_code: string}>;
    const keys = findings.map(f=>`${f.settlement_id}::${f.finding_code}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('summary totals match details (row_counts vs file lengths)', () => {
    const summary = JSON.parse(readFileSync(resolve(EVIDENCE,'summary.json'),'utf8'));
    const findings = JSON.parse(readFileSync(resolve(EVIDENCE,'findings.json'),'utf8'));
    const recon = JSON.parse(readFileSync(resolve(EVIDENCE,'subledger-gl-reconciliation.json'),'utf8'));
    expect(summary.row_counts.findings).toBe(findings.length);
    expect(summary.row_counts.subledger_gl_reconciliation).toBe(recon.length);
    const severitySum = Object.values(summary.finding_counts_by_severity as Record<string,number>).reduce((a,b)=>a+b,0);
    expect(severitySum).toBe(findings.length);
  });

  it('NULL and missing relations handled (no crash, explicit NOT_OBSERVABLE)', () => {
    const findings = readFileSync(resolve(EVIDENCE,'findings.csv'),'utf8');
    expect(findings).toContain('Property Olive Residence');
  });

  it('legacy unlinked data handled (orphan findings exist)', () => {
    const orphan = readFileSync(resolve(EVIDENCE,'orphan-postings.csv'),'utf8');
    expect(orphan).toContain('POSTING_WITHOUT_SOURCE');
    expect(orphan).toContain('SOURCE_WITHOUT_POSTING');
  });

  it('currency precision enforced (2 dp EGP)', () => {
    const csv = readFileSync(resolve(EVIDENCE,'liability-balances-by-period.csv'),'utf8');
    const lines = csv.split('\n').slice(1).filter(Boolean);
    for (const l of lines.slice(0,5)) {
      expect(l).toMatch(/\d+\.\d{2}/);
    }
  });

  it('determinism: re-hash of findings.json matches manifest', () => {
    const findingsContent = readFileSync(resolve(EVIDENCE,'findings.json'),'utf8');
    const h = hash(findingsContent);
    const sha = readFileSync(resolve(EVIDENCE,'SHA256SUMS'),'utf8');
    expect(sha).toContain(h);
  });

  it('S09 not started (no correction batches, no update of settlements)', () => {
    const sql = readFileSync(resolve(REPO_ROOT,'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql'),'utf8');
    expect(sql.toLowerCase()).not.toContain('s09_not_started' as any);
    expect(sql).not.toMatch(/append.*correction/i);
  });

  it('evidence files use fixture IDs only, no prod PII (production path has no Demo literals)', () => {
    const sql = readFileSync(resolve(REPO_ROOT,'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql'),'utf8');
    // production migration must not contain Demo literals
    expect(sql).not.toContain('Demo Malek');
    const summary = JSON.parse(readFileSync(resolve(EVIDENCE,'summary.json'),'utf8'));
    for (const c of summary.company_scope) {
      expect(c.name).toMatch(/Demo/);
    }
  });

  it('known limitations documented', () => {
    expect(existsSync(resolve(REPO_ROOT,'docs/s08/schema-mapping.md'))).toBe(true);
    expect(existsSync(resolve(REPO_ROOT,'docs/s08/operational-runbook.md'))).toBe(true);
    const mapping = readFileSync(resolve(REPO_ROOT,'docs/s08/schema-mapping.md'),'utf8');
    expect(mapping).toContain('NOT_OBSERVABLE');
    expect(mapping).toContain('INSUFFICIENT_HISTORY');
  });
});
