import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { maintenanceRequestSchema } from '@/features/maintenance/useMaintenancePageController';

const migrationPath = resolve(
  import.meta.dirname,
  '../../../../../supabase/migrations/20260720180500_reconcile_core_field_contracts.sql',
);

const migrationSql = readFileSync(migrationPath, 'utf8').toLowerCase();

describe('core field contract reconciliation', () => {
  it('accepts selected text property identifiers in maintenance forms', () => {
    const result = maintenanceRequestSchema.safeParse({
      property_id: 'test-qa-prop-fullcycle-01',
      unit_id: null,
      title: 'فحص تكييف',
      description: '',
      priority: 'medium',
      assigned_to: '',
      scheduled_date: '',
      attachment_url: null,
    });

    expect(result.success).toBe(true);
  });

  it('still rejects a missing maintenance property selection', () => {
    const result = maintenanceRequestSchema.safeParse({
      property_id: '',
      unit_id: null,
      title: 'فحص تكييف',
      description: '',
      priority: 'medium',
      assigned_to: '',
      scheduled_date: '',
      attachment_url: null,
    });

    expect(result.success).toBe(false);
  });

  it('reconciles property address/location only when legacy columns exist', () => {
    expect(migrationSql).toContain("table_name = 'properties' and column_name = 'location'");
    expect(migrationSql).toContain("set address = nullif(btrim(location), '')");
    expect(migrationSql).toContain('new.location := new.address');
    expect(migrationSql).toContain('new.address := new.location');
  });

  it('keeps owner identity and contract rent aliases synchronized', () => {
    expect(migrationSql).toContain("table_name = 'owners' and column_name = 'id_no'");
    expect(migrationSql).toContain('new.id_no := new.national_id');
    expect(migrationSql).toContain('new.national_id := new.id_no');
    expect(migrationSql).toContain("table_name = 'contracts' and column_name = 'monthly_rent'");
    expect(migrationSql).toContain('sync_contract_rent_fields_on_contracts');
  });

  it('widens polymorphic communication identifiers without weakening value checks', () => {
    expect(migrationSql).toContain('alter column related_entity_id type text');
    expect(migrationSql).toContain('using related_entity_id::text');
    expect(migrationSql).not.toContain('drop constraint communication_records_channel_chk');
    expect(migrationSql).not.toContain('drop constraint communication_records_direction_chk');
    expect(migrationSql).not.toContain('drop constraint communication_records_status_chk');
  });

  it('canonicalizes only historical text invoice dates and leaves date columns untouched', () => {
    expect(migrationSql).toContain("v_data_type in ('text', 'character varying', 'character')");
    expect(migrationSql).toContain('normalize_invoice_due_date_text');
    expect(migrationSql).toContain('substring(btrim(due_date::text) from 1 for 10)');
    expect(migrationSql).toContain('before insert or update of due_date on public.invoices');
  });
});
