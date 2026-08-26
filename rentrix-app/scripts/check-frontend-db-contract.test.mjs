import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discoverFrontendUsageFromSources,
  parseDatabaseTypes,
  validateFrontendUsage,
  parseSelectColumns,
} from './frontend-db-contract-lib.mjs';

const types = `
export type Database = {
  public: {
    Tables: {
      invoices: {
        Row: {
          id: string;
          amount: number;
          status: string;
        };
        Insert: {
          id?: string;
          amount: number;
          status?: string;
        };
        Update: {
          id?: string;
          amount?: number;
          status?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          amount: number;
          payment_date: string;
        };
        Insert: {
          id?: string;
          amount: number;
          payment_date: string;
        };
        Update: {
          id?: string;
          amount?: number;
          payment_date?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      invoice_summary: {
        Row: {
          id: string;
          amount: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      record_invoice_payment_atomic: {
        Args: {
          payload: Json | null;
        };
        Returns: Json;
      };
      ping: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {};
  };
};
`;

const source = `
import { supabase } from '@/lib/supabase';
const selectFields = 'id, amount, tenant:people(id,full_name)';
const rpcArgs = { payload };
await supabase.from('invoices').select(selectFields).eq('status', 'UNPAID').update({ amount: 10 });
await supabase.from('invoice_summary').select('id, amount');
await supabase.rpc('record_invoice_payment_atomic', rpcArgs);
await supabase.rpc('ping');
`;

test('discovers literal tables, columns, mutations and RPC arguments', () => {
  const usage = discoverFrontendUsageFromSources([{ path: 'service.ts', source }]);
  assert.deepEqual([...usage.tables.keys()].sort(), ['invoice_summary', 'invoices']);
  assert.deepEqual([...usage.tables.get('invoices').columns].sort(), ['amount', 'id', 'status']);
  assert.deepEqual([...usage.rpcs.get('record_invoice_payment_atomic').calls[0].argShape.keys], ['payload']);
  const result = validateFrontendUsage(usage, parseDatabaseTypes(types));
  assert.deepEqual(result.errors, []);
});

test('keeps consecutive Supabase query chains isolated', () => {
  const usage = discoverFrontendUsageFromSources([{
    path: 'chains.ts',
    source: `
      import { supabase } from '@/lib/supabase';
      await supabase.from('invoices').select('id').eq('status', 'UNPAID');
      await supabase.from('payments').select('amount, payment_date');
    `,
  }]);
  assert.deepEqual([...usage.tables.get('invoices').columns].sort(), ['id', 'status']);
  assert.deepEqual([...usage.tables.get('payments').columns].sort(), ['amount', 'payment_date']);
  assert.deepEqual(validateFrontendUsage(usage, parseDatabaseTypes(types)).errors, []);
});

test('shadowed payload variable names fail safe instead of borrowing another scope', () => {
  const usage = discoverFrontendUsageFromSources([{
    path: 'shadowed.ts',
    source: `
      import { supabase } from '@/lib/supabase';
      async function saveInvoice() {
        const updatePayload = { amount: 12 };
        await supabase.from('invoices').update(updatePayload).eq('id', '1');
      }
      function unrelatedHelper() {
        const updatePayload = { deleted_at: 'not-an-invoice-field' };
        return updatePayload;
      }
    `,
  }]);
  const result = validateFrontendUsage(usage, parseDatabaseTypes(types));
  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join('\n'), /Dynamic update payload for 'invoices'/);
});

test('missing relation fails closed', () => {
  const usage = discoverFrontendUsageFromSources([{
    path: 'bad.ts',
    source: `import { supabase } from '@/lib/supabase'; supabase.from('missing_table').select('id');`,
  }]);
  const result = validateFrontendUsage(usage, parseDatabaseTypes(types));
  assert.match(result.errors.join('\n'), /Missing database relation 'missing_table'/);
});

test('missing selected/filter column fails closed', () => {
  const usage = discoverFrontendUsageFromSources([{
    path: 'bad.ts',
    source: `import { supabase } from '@/lib/supabase'; supabase.from('invoices').select('id, ghost').eq('status', 'x');`,
  }]);
  const result = validateFrontendUsage(usage, parseDatabaseTypes(types));
  assert.match(result.errors.join('\n'), /Missing column 'invoices\.ghost'/);
});

test('unknown mutation field fails closed', () => {
  const usage = discoverFrontendUsageFromSources([{
    path: 'bad.ts',
    source: `import { supabase } from '@/lib/supabase'; supabase.from('invoices').update({ ghost: 1 });`,
  }]);
  const result = validateFrontendUsage(usage, parseDatabaseTypes(types));
  assert.match(result.errors.join('\n'), /Unknown update field 'invoices\.ghost'/);
});

test('missing RPC and mismatched RPC args fail closed', () => {
  const usage = discoverFrontendUsageFromSources([{
    path: 'bad.ts',
    source: `
      import { supabase } from '@/lib/supabase';
      supabase.rpc('record_invoice_payment_atomic', { wrong: 1 });
      supabase.rpc('missing_rpc');
    `,
  }]);
  const result = validateFrontendUsage(usage, parseDatabaseTypes(types));
  const text = result.errors.join('\n');
  assert.match(text, /Unknown RPC argument 'record_invoice_payment_atomic\.wrong'/);
  assert.match(text, /Missing required RPC argument 'record_invoice_payment_atomic\.payload'/);
  assert.match(text, /Missing RPC 'missing_rpc'/);
});

test('nested relation selects are not misclassified as root columns', () => {
  assert.deepEqual(
    [...parseSelectColumns('id, amount, tenant:people(id, full_name)')].sort(),
    ['amount', 'id'],
  );
});
