// WP-DB0 — contract drift engine.
//
// Compares the four contract layers and classifies every mismatch:
//
//   migrations (replayed schema)  ↔  generated types  ↔  frontend usage
//
// Findings are the WP-DB0 bug classes from the work-package definition:
//   DB0-01 frontend expects a column that does not exist
//   DB0-02 DB has a relation/column the types do not declare
//   DB0-03 RPC exists in migrations but missing from types
//   DB0-04 service calls an RPC that does not exist in the database
//   DB0-05 RPC argument signature drift
//   DB0-06 scalar type drift (text/uuid/date/numeric)
//   DB0-07 financial precision is not numeric(_,3)
//   DB0-08 cross-company FK / RLS integrity
//   DB0-09 frontend queries a relation that does not exist

import { columnTypeSignature } from './introspect.mjs';
import { tsTypeToPgCandidates } from './types-parse.mjs';

export const SEVERITY = { BLOCKER: 'BLOCKER', MAJOR: 'MAJOR', MINOR: 'MINOR', INFO: 'INFO' };

/**
 * Columns that hold money and must be numeric(_,3) per the canonical
 * 3-decimal financial precision rule.
 */
const MONEY_NAME = /(^|_)(amount|total|balance|price|rent|value|fee|cost|paid|due|net|gross|subtotal|tax|vat|commission|payout|deposit|debit|credit|charge|discount|penalty|refund|payment)(_|$)/i;

/** Names that look monetary but are not money. */
const MONEY_EXCLUDE = /(_count|_rate|_percent|_percentage|_pct|_days|_id$|_type$|_status$|_method$|_currency|_code$|_at$|_on$|_by$|_ratio|_index)/i;

export function isMoneyColumn(col) {
  const n = col.column_name;
  if (MONEY_EXCLUDE.test(n)) return false;
  if (!MONEY_NAME.test(n)) return false;
  return col.udt_name === 'numeric';
}

function pushFinding(findings, f) {
  findings.push({ severity: SEVERITY.MAJOR, ...f });
}

export function buildDrift({ schema, types, frontend }) {
  const findings = [];

  // ---- index the replayed schema -----------------------------------------
  const dbTables = new Map();
  for (const t of schema.tables) dbTables.set(t.name, { ...t, columns: new Map() });
  const dbViews = new Map();
  for (const v of schema.views) dbViews.set(v.name, { ...v, columns: new Map() });

  for (const c of schema.columns) {
    const holder = dbTables.get(c.table_name) ?? dbViews.get(c.table_name);
    if (holder) holder.columns.set(c.column_name, c);
  }

  const dbRelations = new Map([...dbTables, ...dbViews]);

  const dbFunctions = new Map();
  for (const f of schema.functions) {
    if (!dbFunctions.has(f.name)) dbFunctions.set(f.name, []);
    dbFunctions.get(f.name).push(f);
  }

  const dbEnums = new Map(schema.enums.map((e) => [e.name, e.labels]));

  // ---- DB0-09 / DB0-01: frontend usage vs database ------------------------
  for (const rel of frontend.relations) {
    const target = dbRelations.get(rel.name);
    if (!target) {
      pushFinding(findings, {
        id: 'DB0-09',
        severity: SEVERITY.BLOCKER,
        relation: rel.name,
        title: `Frontend queries relation "${rel.name}" which does not exist in the migrated schema`,
        evidence: rel.files.slice(0, 6),
        useCount: rel.count,
      });
      continue;
    }
    for (const col of rel.columns) {
      if (!target.columns.has(col.name)) {
        pushFinding(findings, {
          id: 'DB0-01',
          severity: SEVERITY.BLOCKER,
          relation: rel.name,
          column: col.name,
          title: `Frontend selects "${rel.name}.${col.name}" which does not exist in the migrated schema`,
          evidence: col.files.slice(0, 6),
        });
      }
    }
  }

  // ---- embedded resources -------------------------------------------------
  // `alias:target(...)` resolves either to a relation named `target`, or to an
  // FK column on the parent whose referenced table is the real target.
  // Only SINGLE-column foreign keys can be used as a PostgREST embed target
  // hint. A composite FK such as `(unit_id, property_id) REFERENCES units`
  // must not make `property_id` resolve to `units`.
  const fkColumnTarget = new Map(); // `${table}.${column}` -> referenced table
  const compositeFkColumnTarget = new Map();
  const fkPairCount = new Map(); // `${table}->${target}` -> number of FKs
  for (const fk of schema.foreign_keys) {
    const cols = /FOREIGN KEY \(([^)]+)\) REFERENCES ([\w".]+)/i.exec(fk.definition);
    if (!cols) continue;
    const columns = cols[1].split(',').map((s) => s.trim().replace(/"/g, ''));
    if (columns.length === 1) {
      fkColumnTarget.set(`${fk.table_name}.${columns[0]}`, fk.references_table);
    } else {
      // Composite FK: the leading column is still a usable embed hint, but
      // PostgREST resolution is far more fragile — record it separately.
      compositeFkColumnTarget.set(`${fk.table_name}.${columns[0]}`, {
        target: fk.references_table,
        columns,
      });
    }
    const pair = `${fk.table_name}->${fk.references_table}`;
    fkPairCount.set(pair, (fkPairCount.get(pair) ?? 0) + 1);
  }

  for (const emb of frontend.embeds ?? []) {
    let resolved = null;
    let via = null;

    if (dbRelations.has(emb.target)) {
      resolved = emb.target;
      via = 'relation';
    } else if (fkColumnTarget.has(`${emb.parent}.${emb.target}`)) {
      resolved = fkColumnTarget.get(`${emb.parent}.${emb.target}`);
      via = `fk:${emb.parent}.${emb.target}`;
    } else if (emb.alias && dbRelations.has(emb.alias)) {
      resolved = emb.alias;
      via = 'alias';
    } else if (compositeFkColumnTarget.has(`${emb.parent}.${emb.target}`)) {
      const composite = compositeFkColumnTarget.get(`${emb.parent}.${emb.target}`);
      resolved = composite.target;
      via = `composite-fk:(${composite.columns.join(', ')})`;
      findings.push({
        id: 'DB0-09C',
        severity: SEVERITY.MAJOR,
        relation: emb.parent,
        embed: emb.target,
        target: composite.target,
        fkColumns: composite.columns,
        title: `Embed "${emb.parent} -> ${emb.target}(...)" resolves only through the composite foreign key (${composite.columns.join(', ')}); PostgREST cannot use a column hint for composite relationships, so the embed name must be the relation or the constraint`,
        evidence: [emb.file],
      });
    }

    if (!resolved) {
      pushFinding(findings, {
        id: 'DB0-09E',
        severity: SEVERITY.BLOCKER,
        relation: emb.parent,
        embed: emb.target,
        title: `Embedded resource "${emb.parent} -> ${emb.target}(...)" resolves to no relation and no foreign key`,
        evidence: [emb.file],
      });
      continue;
    }

    // PostgREST rejects an embed (PGRST201) when several relationships exist
    // between the two tables and the request does not disambiguate.
    const relCount = fkPairCount.get(`${emb.parent}->${resolved}`) ?? 0;
    if (relCount > 1 && via === 'relation' && !emb.hint) {
      pushFinding(findings, {
        id: 'DB0-09A',
        severity: SEVERITY.BLOCKER,
        relation: emb.parent,
        embed: resolved,
        relationships: relCount,
        title: `Ambiguous embed "${emb.parent} -> ${resolved}(...)": ${relCount} foreign keys connect these tables and the query does not disambiguate (PostgREST PGRST201)`,
        evidence: [emb.file],
      });
    }

    const target = dbRelations.get(resolved);
    if (!target) continue;
    for (const colName of emb.columns) {
      if (!target.columns.has(colName)) {
        pushFinding(findings, {
          id: 'DB0-01E',
          severity: SEVERITY.BLOCKER,
          relation: resolved,
          column: colName,
          via,
          title: `Embedded select "${emb.parent} -> ${resolved}.${colName}" does not exist in the migrated schema`,
          evidence: [emb.file],
        });
      }
    }
  }

  // ---- DB0-04: frontend RPC vs database ----------------------------------
  for (const rpc of frontend.rpcs) {
    if (!dbFunctions.has(rpc.name)) {
      pushFinding(findings, {
        id: 'DB0-04',
        severity: SEVERITY.BLOCKER,
        rpc: rpc.name,
        title: `Service calls RPC "${rpc.name}" which does not exist in the migrated schema`,
        evidence: rpc.files.slice(0, 6),
        useCount: rpc.count,
      });
    }
  }

  // ---- DB0-02: database relations missing from generated types ------------
  const typeTables = new Set(Object.keys(types.tables));
  const typeViews = new Set(Object.keys(types.views));
  const frontendRelNames = new Set(frontend.relations.map((r) => r.name));
  const frontendRpcNames = new Set(frontend.rpcs.map((r) => r.name));

  for (const [name] of dbTables) {
    if (!typeTables.has(name)) {
      findings.push({
        id: 'DB0-02',
        severity: frontendRelNames.has(name) ? SEVERITY.BLOCKER : SEVERITY.MAJOR,
        relation: name,
        usedByFrontend: frontendRelNames.has(name),
        title: `Table "${name}" exists in the schema but is absent from generated types`,
      });
    }
  }
  for (const [name] of dbViews) {
    if (!typeViews.has(name) && !typeTables.has(name)) {
      findings.push({
        id: 'DB0-02',
        severity: frontendRelNames.has(name) ? SEVERITY.BLOCKER : SEVERITY.MAJOR,
        relation: name,
        isView: true,
        usedByFrontend: frontendRelNames.has(name),
        title: `View "${name}" exists in the schema but is absent from generated types`,
      });
    }
  }

  // ---- DB0-02b: types declare a relation the database does not have -------
  for (const name of [...typeTables, ...typeViews]) {
    if (!dbRelations.has(name)) {
      findings.push({
        id: 'DB0-02B',
        severity: SEVERITY.MAJOR,
        relation: name,
        title: `Generated types declare "${name}" which does not exist in the migrated schema`,
      });
    }
  }

  // ---- DB0-02c / DB0-06: column-level drift for typed relations -----------
  for (const [name, typeDef] of Object.entries({ ...types.tables, ...types.views })) {
    const target = dbRelations.get(name);
    if (!target) continue;
    const declared = new Map(typeDef.row.map((f) => [f.name, f]));

    for (const [colName, col] of target.columns) {
      if (!declared.has(colName)) {
        findings.push({
          id: 'DB0-02C',
          severity: SEVERITY.MAJOR,
          relation: name,
          column: colName,
          dbType: columnTypeSignature(col),
          title: `Column "${name}.${colName}" exists in the schema but is missing from generated types`,
        });
      }
    }
    for (const [fieldName, field] of declared) {
      if (!target.columns.has(fieldName)) {
        findings.push({
          id: 'DB0-02D',
          severity: frontendRelNames.has(name) ? SEVERITY.BLOCKER : SEVERITY.MAJOR,
          relation: name,
          column: fieldName,
          tsType: field.type,
          title: `Generated types declare "${name}.${fieldName}" which does not exist in the migrated schema`,
        });
        continue;
      }

      // scalar type drift
      const col = target.columns.get(fieldName);
      const mapped = tsTypeToPgCandidates(field.type);
      if (mapped.kind === 'scalar' && Array.isArray(mapped.candidates)) {
        if (!mapped.candidates.includes(col.udt_name)) {
          findings.push({
            id: 'DB0-06',
            severity: SEVERITY.MAJOR,
            relation: name,
            column: fieldName,
            tsType: field.type,
            dbType: columnTypeSignature(col),
            title: `Type drift on "${name}.${fieldName}": types say \`${field.type}\`, schema is \`${columnTypeSignature(col)}\``,
          });
        }
      }
      if (mapped.kind === 'enum-like') {
        const pgEnum = dbEnums.get(col.udt_name);
        if (pgEnum) {
          const missing = mapped.literals.filter((l) => !pgEnum.includes(l));
          const extra = pgEnum.filter((l) => !mapped.literals.includes(l));
          if (missing.length || extra.length) {
            findings.push({
              id: 'DB0-06E',
              severity: SEVERITY.MAJOR,
              relation: name,
              column: fieldName,
              title: `Enum drift on "${name}.${fieldName}": types-only [${missing.join(', ')}], db-only [${extra.join(', ')}]`,
            });
          }
        }
      }

      // nullability drift
      const tsNullable = /\|\s*null/.test(field.type);
      const dbNullable = col.is_nullable === 'YES';
      if (tsNullable !== dbNullable && mapped.kind !== 'enum-like') {
        findings.push({
          id: 'DB0-06N',
          severity: SEVERITY.MINOR,
          relation: name,
          column: fieldName,
          title: `Nullability drift on "${name}.${fieldName}": types ${tsNullable ? 'nullable' : 'non-null'}, schema ${dbNullable ? 'nullable' : 'non-null'}`,
        });
      }
    }
  }

  // ---- DB0-03: RPCs in the schema but not in the types --------------------
  const typeFns = new Set(Object.keys(types.functions));
  for (const [name, overloads] of dbFunctions) {
    const isTrigger = overloads.every((o) => o.returns === 'trigger');
    if (isTrigger) continue;
    if (!typeFns.has(name)) {
      findings.push({
        id: 'DB0-03',
        severity: frontendRpcNames.has(name) ? SEVERITY.BLOCKER : SEVERITY.MINOR,
        rpc: name,
        usedByFrontend: frontendRpcNames.has(name),
        overloads: overloads.length,
        title: `Function "${name}" exists in the schema but is absent from generated types`,
      });
    }
  }

  // ---- DB0-03B: types declare an RPC the schema does not have -------------
  for (const name of typeFns) {
    if (!dbFunctions.has(name)) {
      findings.push({
        id: 'DB0-03B',
        severity: frontendRpcNames.has(name) ? SEVERITY.BLOCKER : SEVERITY.MAJOR,
        rpc: name,
        title: `Generated types declare RPC "${name}" which does not exist in the migrated schema`,
      });
    }
  }

  // ---- DB0-05: RPC argument signature drift -------------------------------
  for (const [name, def] of Object.entries(types.functions)) {
    const overloads = dbFunctions.get(name);
    if (!overloads) continue;

    const declared = new Set(def.args);
    const matches = overloads.some((o) => {
      const dbArgs = new Set(
        (o.args || '')
          .split(',')
          .map((a) => a.trim().split(/\s+/)[0])
          .filter(Boolean),
      );
      if (dbArgs.size !== declared.size) return false;
      for (const a of declared) if (!dbArgs.has(a)) return false;
      return true;
    });

    if (!matches) {
      findings.push({
        id: 'DB0-05',
        severity: frontendRpcNames.has(name) ? SEVERITY.BLOCKER : SEVERITY.MAJOR,
        rpc: name,
        tsArgs: [...declared],
        dbOverloads: overloads.map((o) => o.args),
        title: `RPC signature drift on "${name}": generated types do not match any database overload`,
      });
    }
  }

  // ---- DB0-05B: ambiguous overloads reachable from PostgREST --------------
  for (const [name, overloads] of dbFunctions) {
    if (overloads.length > 1 && frontendRpcNames.has(name)) {
      findings.push({
        id: 'DB0-05B',
        severity: SEVERITY.MAJOR,
        rpc: name,
        overloads: overloads.map((o) => o.args),
        title: `RPC "${name}" has ${overloads.length} overloads and is called from the frontend — PostgREST resolution is ambiguous`,
      });
    }
  }

  // ---- DB0-07: financial precision ---------------------------------------
  for (const col of schema.columns) {
    if (!dbTables.has(col.table_name)) continue; // tables only, views inherit
    if (!isMoneyColumn(col)) continue;
    if (col.numeric_scale !== 3) {
      findings.push({
        id: 'DB0-07',
        severity: SEVERITY.MAJOR,
        relation: col.table_name,
        column: col.column_name,
        dbType: columnTypeSignature(col),
        title: `Financial precision drift: "${col.table_name}.${col.column_name}" is ${columnTypeSignature(col)}, canonical rule requires 3 decimal places`,
      });
    }
  }

  // ---- DB0-08: company isolation -----------------------------------------
  const policyByTable = new Map();
  for (const p of schema.policies) {
    if (!policyByTable.has(p.tablename)) policyByTable.set(p.tablename, []);
    policyByTable.get(p.tablename).push(p);
  }

  for (const [name, table] of dbTables) {
    const hasCompany = table.columns.has('company_id');
    if (!hasCompany) continue;

    if (!table.rls_enabled) {
      findings.push({
        id: 'DB0-08',
        severity: SEVERITY.BLOCKER,
        relation: name,
        title: `Tenant table "${name}" has company_id but RLS is not enabled`,
      });
      continue;
    }
    const policies = policyByTable.get(name) ?? [];
    if (policies.length === 0) {
      findings.push({
        id: 'DB0-08',
        severity: SEVERITY.BLOCKER,
        relation: name,
        title: `Tenant table "${name}" has RLS enabled but no policies — it is unreadable and unwritable`,
      });
      continue;
    }
    // An explicit deny-all policy (`using (false)`) is strictly stronger than
    // company scoping: no client role can read or write the table at all, and
    // only SECURITY DEFINER functions reach it. Treat it as compliant.
    const deniesAll = policies.every((p) => {
      const qual = (p.qual ?? '').trim().toLowerCase();
      const check = (p.with_check ?? '').trim().toLowerCase();
      return (qual === 'false' || qual === '') && (check === 'false' || check === '');
    });
    const mentionsCompany = policies.some((p) =>
      /company/i.test(`${p.qual ?? ''} ${p.with_check ?? ''}`),
    );
    if (!mentionsCompany && !deniesAll) {
      findings.push({
        id: 'DB0-08',
        severity: SEVERITY.MAJOR,
        relation: name,
        policies: policies.map((p) => p.name),
        title: `Tenant table "${name}" has company_id but no policy references company scope`,
      });
    }
  }

  // company_id FK integrity
  const fkByTable = new Map();
  for (const fk of schema.foreign_keys) {
    if (!fkByTable.has(fk.table_name)) fkByTable.set(fk.table_name, []);
    fkByTable.get(fk.table_name).push(fk);
  }
  for (const [name, table] of dbTables) {
    if (!table.columns.has('company_id')) continue;
    const fks = fkByTable.get(name) ?? [];
    // Either a direct company_id -> companies FK, or a composite FK that
    // carries company_id into a parent that is itself company-scoped. The
    // composite form is the stronger guarantee: it makes a cross-company row
    // unrepresentable rather than merely referentially valid.
    const hasDirectCompanyFk = fks.some(
      (fk) => /FOREIGN KEY \(company_id\)/i.test(fk.definition) && fk.references_table === 'companies',
    );
    const hasCompositeCompanyFk = fks.some((fk) => {
      const m = /FOREIGN KEY \(([^)]+)\)/i.exec(fk.definition);
      if (!m) return false;
      const cols = m[1].split(',').map((s) => s.trim().replace(/"/g, ''));
      return cols.length > 1 && cols.includes('company_id');
    });
    if (!hasDirectCompanyFk && !hasCompositeCompanyFk) {
      findings.push({
        id: 'DB0-08F',
        severity: SEVERITY.MAJOR,
        relation: name,
        title: `Tenant table "${name}.company_id" has no foreign key to companies`,
      });
    }
  }

  // ---- DB0-10: security-definer functions without a pinned search_path ----
  for (const [name, overloads] of dbFunctions) {
    for (const o of overloads) {
      if (!o.security_definer) continue;
      if (!/search_path/.test(o.config)) {
        findings.push({
          id: 'DB0-10',
          severity: SEVERITY.MAJOR,
          rpc: name,
          args: o.args,
          title: `SECURITY DEFINER function "${name}(${o.args})" has no pinned search_path`,
        });
      }
    }
  }

  return findings;
}

export function summarise(findings) {
  const byId = {};
  const bySeverity = {};
  for (const f of findings) {
    byId[f.id] = (byId[f.id] ?? 0) + 1;
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  }
  return { total: findings.length, byId, bySeverity };
}
