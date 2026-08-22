-- Financial precision hardening: normalize monetary numeric columns to OMR 3dp.
--
-- This migration is intentionally conservative:
--   * only numeric money-like columns already detected by the DB0 money rule;
--   * only widens scale when the current scale is below 3;
--   * increases precision by the same delta so integer capacity is preserved;
--   * refuses to touch unbounded numeric or scale > 3 columns, because those
--     would require an explicit rounding/data decision rather than a silent cast.

begin;

do $preflight$
declare
  v_unsafe text;
begin
  select string_agg(format('%I.%I numeric(%s,%s)', c.table_name, c.column_name,
                           coalesce(c.numeric_precision::text, 'null'),
                           coalesce(c.numeric_scale::text, 'null')), ', ' order by c.table_name, c.column_name)
    into v_unsafe
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema
   and t.table_name = c.table_name
   and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public'
    and c.data_type = 'numeric'
    and c.column_name ~* '(^|_)(amount|total|balance|price|rent|value|fee|cost|paid|due|net|gross|subtotal|tax|vat|commission|payout|deposit|debit|credit|charge|discount|penalty|refund|payment)(_|$)'
    and c.column_name !~* '(_count|_rate|_percent|_percentage|_pct|_days|_id$|_type$|_status$|_method$|_currency|_code$|_at$|_on$|_by$|_ratio|_index)'
    and (c.numeric_precision is null or c.numeric_scale is null or c.numeric_scale > 3);

  if v_unsafe is not null then
    raise exception 'OMR_PRECISION_REQUIRES_MANUAL_REVIEW: refusing lossy or unbounded conversion for %', v_unsafe
      using errcode = '22003';
  end if;
end
$preflight$;

do $widen_money_columns$
declare
  r record;
  v_target_precision integer;
begin
  for r in
    select c.table_name, c.column_name, c.numeric_precision, c.numeric_scale
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
     and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.data_type = 'numeric'
      and c.column_name ~* '(^|_)(amount|total|balance|price|rent|value|fee|cost|paid|due|net|gross|subtotal|tax|vat|commission|payout|deposit|debit|credit|charge|discount|penalty|refund|payment)(_|$)'
      and c.column_name !~* '(_count|_rate|_percent|_percentage|_pct|_days|_id$|_type$|_status$|_method$|_currency|_code$|_at$|_on$|_by$|_ratio|_index)'
      and c.numeric_scale < 3
    order by c.table_name, c.column_name
  loop
    -- Preserve the exact integer capacity while adding missing OMR decimals.
    v_target_precision := r.numeric_precision + (3 - r.numeric_scale);

    execute format(
      'alter table public.%I alter column %I type numeric(%s,3) using %I::numeric(%s,3)',
      r.table_name,
      r.column_name,
      v_target_precision,
      r.column_name,
      v_target_precision
    );
  end loop;
end
$widen_money_columns$;

do $verify$
declare
  v_remaining text;
begin
  select string_agg(format('%I.%I scale=%s', c.table_name, c.column_name,
                           coalesce(c.numeric_scale::text, 'null')), ', ' order by c.table_name, c.column_name)
    into v_remaining
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema
   and t.table_name = c.table_name
   and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public'
    and c.data_type = 'numeric'
    and c.column_name ~* '(^|_)(amount|total|balance|price|rent|value|fee|cost|paid|due|net|gross|subtotal|tax|vat|commission|payout|deposit|debit|credit|charge|discount|penalty|refund|payment)(_|$)'
    and c.column_name !~* '(_count|_rate|_percent|_percentage|_pct|_days|_id$|_type$|_status$|_method$|_currency|_code$|_at$|_on$|_by$|_ratio|_index)'
    and c.numeric_scale is distinct from 3;

  if v_remaining is not null then
    raise exception 'OMR_PRECISION_DRIFT_REMAINS: %', v_remaining using errcode = '23514';
  end if;
end
$verify$;

commit;
