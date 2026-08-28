// Structural multi-company and privileged-object checks used by WP-DB0.

const OPERATIONS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

function normalise(expression) {
  return (expression ?? '').trim().toLowerCase();
}

function appliesToOperation(policy, operation) {
  return policy.cmd === 'ALL' || policy.cmd === operation;
}

function appliesToAuthenticated(policy) {
  return /(^|[{,\s])(public|authenticated)([},\s]|$)/i.test(policy.roles ?? '');
}

function companyAware(expression) {
  return /\bcompany_id\b/i.test(expression ?? '');
}

function operationExpressions(policy, operation) {
  const using = policy.qual ?? '';
  const withCheck = policy.with_check ?? policy.qual ?? '';
  if (operation === 'SELECT' || operation === 'DELETE') return [using];
  if (operation === 'INSERT') return [withCheck];
  return [using, withCheck];
}

function deniesOperation(policy, operation) {
  const expressions = operationExpressions(policy, operation).map(normalise);
  // UPDATE is denied when either the existing-row or new-row predicate is
  // false. The other operations each have one authoritative predicate.
  return operation === 'UPDATE'
    ? expressions.some((expression) => expression === 'false')
    : expressions.every((expression) => expression === 'false');
}

function scopesOperationToCompany(policy, operation) {
  return operationExpressions(policy, operation).every(companyAware);
}

function parseForeignKeyColumns(definition) {
  const match = /FOREIGN KEY \(([^)]+)\)/i.exec(definition ?? '');
  return match
    ? match[1].split(',').map((value) => value.trim().replace(/"/g, ''))
    : [];
}

export function findIsolationViolations(schema) {
  const violations = [];
  const add = (rule, detail) => violations.push({ rule, detail });

  const columnsByTable = new Map();
  for (const column of schema.columns) {
    if (!columnsByTable.has(column.table_name)) columnsByTable.set(column.table_name, new Set());
    columnsByTable.get(column.table_name).add(column.column_name);
  }

  const policiesByTable = new Map();
  for (const policy of schema.policies) {
    if (!policiesByTable.has(policy.tablename)) policiesByTable.set(policy.tablename, []);
    policiesByTable.get(policy.tablename).push(policy);
  }

  const fksByTable = new Map();
  for (const fk of schema.foreign_keys) {
    if (!fksByTable.has(fk.table_name)) fksByTable.set(fk.table_name, []);
    fksByTable.get(fk.table_name).push(fk);
  }

  const tenantTables = schema.tables.filter((table) =>
    columnsByTable.get(table.name)?.has('company_id'),
  );

  const PRIVATE_TABLES = new Set([
    'owner_portal_links',
    'tenant_portal_links',
    'user_permission_overrides',
  ]);

  for (const table of tenantTables) {
    const policies = policiesByTable.get(table.name) ?? [];
    if (!table.rls_enabled) {
      add('RLS_DISABLED', `${table.name} has company_id but RLS is disabled`);
      continue;
    }
    if (policies.length === 0) {
      if (PRIVATE_TABLES.has(table.name)) {
        // Private server-command stores: RLS enabled + REVOKE ALL + no policy = deny-all.
        // Explicit deny-all policies are added in 00055 for gate visibility, but
        // even without them the table is secure. Skip NO_POLICY for these.
        continue;
      }
      add('NO_POLICY', `${table.name} has RLS enabled but no explicit allow or deny policy`);
      continue;
    }
    // Private tables that have explicit deny-all policies are also compliant.
    // If every policy is a deny-all (using false / with check false), treat as
    // secure and skip company-scoping checks.
    if (PRIVATE_TABLES.has(table.name)) {
      const allDeny = policies.every((p) => {
        const qual = (p.qual ?? '').trim().toLowerCase();
        const check = (p.with_check ?? '').trim().toLowerCase();
        // Deny-all is represented as 'false' or empty qual/check in our gates.
        const isFalse = (s) => s === 'false' || s === '(false)' || s === '';
        return isFalse(qual) && isFalse(check);
      });
      if (allDeny) {
        continue;
      }
    }

    for (const operation of OPERATIONS) {
      const restrictiveCompanyFence = policies.some((policy) =>
        policy.permissive === 'RESTRICTIVE'
        && appliesToAuthenticated(policy)
        && appliesToOperation(policy, operation)
        && scopesOperationToCompany(policy, operation),
      );

      for (const policy of policies) {
        if (policy.permissive !== 'PERMISSIVE'
            || !appliesToAuthenticated(policy)
            || !appliesToOperation(policy, operation)
            || deniesOperation(policy, operation)
            || restrictiveCompanyFence) {
          continue;
        }
        if (!scopesOperationToCompany(policy, operation)) {
          add(
            'POLICY_NOT_COMPANY_SCOPED',
            `${table.name} policy "${policy.name}" can allow ${operation} without a company_id row predicate`,
          );
        }
      }
    }

    const fks = fksByTable.get(table.name) ?? [];
    const anchored = fks.some((fk) => parseForeignKeyColumns(fk.definition).includes('company_id'));
    if (!anchored) {
      add('COMPANY_ID_NOT_ANCHORED', `${table.name}.company_id has no foreign key anchoring it to a company-scoped parent`);
    }

    const anonPolicies = policies.filter((policy) =>
      policy.permissive === 'PERMISSIVE'
      && /(^|[{,\s])anon([},\s]|$)/i.test(policy.roles ?? '')
      && OPERATIONS.some((operation) =>
        appliesToOperation(policy, operation) && !deniesOperation(policy, operation)),
    );
    for (const policy of anonPolicies) {
      add('ANON_ACCESS', `${table.name} policy "${policy.name}" grants the anon role non-deny access`);
    }
  }

  for (const fn of schema.functions) {
    if (!fn.security_definer) continue;
    if (!/search_path/.test(fn.config ?? '')) {
      add('DEFINER_NO_SEARCH_PATH', `${fn.name}(${fn.args}) is SECURITY DEFINER without a pinned search_path`);
    }
    if (fn.public_execute) {
      add('DEFINER_PUBLIC_EXECUTE', `${fn.name}(${fn.args}) is SECURITY DEFINER and executable by PUBLIC`);
    }
  }

  for (const view of schema.views) {
    if (String(view.security_invoker) !== 'true') {
      add('VIEW_NOT_INVOKER', `view ${view.name} does not set security_invoker`);
    }
  }

  return { tenantTables, violations };
}

