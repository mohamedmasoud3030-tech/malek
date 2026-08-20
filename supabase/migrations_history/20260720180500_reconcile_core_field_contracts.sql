begin;

-- Historical production snapshots contain a handful of renamed columns that
-- remain writable beside the canonical application columns. Reconcile the
-- pairs without inventing values and keep both write paths synchronized.

do $reconcile_properties$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'location'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'address'
  ) then
    update public.properties
    set address = nullif(btrim(location), '')
    where nullif(btrim(coalesce(address, '')), '') is null
      and nullif(btrim(coalesce(location, '')), '') is not null;

    execute $property_function$
      create or replace function public.sync_property_compatibility_fields()
      returns trigger
      language plpgsql
      set search_path to 'public', 'pg_temp'
      as $function$
      begin
        if tg_op = 'UPDATE' then
          if new.title is distinct from old.title and new.name is not distinct from old.name then
            new.name := new.title;
          elsif new.name is distinct from old.name and new.title is not distinct from old.title then
            new.title := new.name;
          end if;

          if new.address is distinct from old.address and new.location is not distinct from old.location then
            new.location := new.address;
          elsif new.location is distinct from old.location and new.address is not distinct from old.address then
            new.address := new.location;
          end if;
        end if;

        new.title := coalesce(nullif(btrim(new.title), ''), nullif(btrim(new.name), ''));
        new.name := coalesce(nullif(btrim(new.name), ''), new.title);
        new.address := coalesce(nullif(btrim(new.address), ''), nullif(btrim(new.location), ''));
        new.location := coalesce(nullif(btrim(new.location), ''), new.address);

        if new.name is null or new.title is null then
          raise exception 'اسم العقار مطلوب';
        end if;
        return new;
      end;
      $function$
    $property_function$;
  end if;
end
$reconcile_properties$;

do $reconcile_owners$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'owners' and column_name = 'id_no'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'owners' and column_name = 'national_id'
  ) then
    update public.owners
    set national_id = nullif(btrim(id_no), '')
    where nullif(btrim(coalesce(national_id, '')), '') is null
      and nullif(btrim(coalesce(id_no, '')), '') is not null;

    update public.owners
    set id_no = nullif(btrim(national_id), '')
    where nullif(btrim(coalesce(id_no, '')), '') is null
      and nullif(btrim(coalesce(national_id, '')), '') is not null;

    execute $owner_function$
      create or replace function public.sync_owner_compatibility_fields()
      returns trigger
      language plpgsql
      set search_path to 'public', 'pg_temp'
      as $function$
      begin
        if tg_op = 'UPDATE' then
          if new.full_name is distinct from old.full_name and new.name is not distinct from old.name then
            new.name := new.full_name;
          elsif new.name is distinct from old.name and new.full_name is not distinct from old.full_name then
            new.full_name := new.name;
          end if;

          if new.national_id is distinct from old.national_id and new.id_no is not distinct from old.id_no then
            new.id_no := new.national_id;
          elsif new.id_no is distinct from old.id_no and new.national_id is not distinct from old.national_id then
            new.national_id := new.id_no;
          end if;
        end if;

        new.full_name := coalesce(nullif(btrim(new.full_name), ''), nullif(btrim(new.name), ''), nullif(btrim(new.display_name), ''));
        new.name := coalesce(nullif(btrim(new.name), ''), new.full_name);
        new.national_id := coalesce(nullif(btrim(new.national_id), ''), nullif(btrim(new.id_no), ''));
        new.id_no := coalesce(nullif(btrim(new.id_no), ''), new.national_id);

        if new.name is null or new.full_name is null then
          raise exception 'اسم المالك مطلوب';
        end if;
        return new;
      end;
      $function$
    $owner_function$;
  end if;
end
$reconcile_owners$;

-- Related records can point to entities whose identifiers are text in the
-- canonical model. Production kept this column as uuid without a foreign key,
-- causing valid text identifiers to fail before RLS or validation was reached.
do $reconcile_communication_id$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'communication_records'
      and column_name = 'related_entity_id'
      and data_type = 'uuid'
  ) then
    alter table public.communication_records
      alter column related_entity_id type text
      using related_entity_id::text;
  end if;
end
$reconcile_communication_id$;

-- Production historically stores invoice due_date as text, while a clean
-- replay uses a real date column. Only the historical text layout needs repair.
do $reconcile_invoice_due_date$
declare
  v_data_type text;
begin
  select data_type into v_data_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'invoices'
    and column_name = 'due_date';

  if v_data_type in ('text', 'character varying', 'character') then
    execute $invoice_backfill$
      update public.invoices
      set due_date = substring(btrim(due_date::text) from 1 for 10)
      where due_date is not null
        and btrim(due_date::text) ~ '^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])([ T].+)$'
    $invoice_backfill$;

    execute $invoice_function$
      create or replace function public.normalize_invoice_due_date_text()
      returns trigger
      language plpgsql
      set search_path to 'public', 'pg_temp'
      as $function$
      declare
        v_date text;
      begin
        if new.due_date is null then
          return new;
        end if;

        if btrim(new.due_date::text) ~ '^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])([ T].*)?$' then
          v_date := substring(btrim(new.due_date::text) from 1 for 10);
          begin
            perform v_date::date;
            new.due_date := v_date;
          exception when invalid_datetime_format or datetime_field_overflow then
            null;
          end;
        end if;
        return new;
      end;
      $function$
    $invoice_function$;

    execute 'drop trigger if exists normalize_invoice_due_date_on_invoices on public.invoices';
    execute 'create trigger normalize_invoice_due_date_on_invoices before insert or update of due_date on public.invoices for each row execute function public.normalize_invoice_due_date_text()';
  end if;
end
$reconcile_invoice_due_date$;

-- Keep the retired monthly_rent compatibility column aligned when it exists.
do $reconcile_contract_rent$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'contracts' and column_name = 'monthly_rent'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'contracts' and column_name = 'rent_amount'
  ) then
    update public.contracts
    set monthly_rent = rent_amount
    where coalesce(rent_amount, 0) > 0
      and coalesce(monthly_rent, 0) = 0;

    execute $contract_function$
      create or replace function public.sync_contract_rent_fields()
      returns trigger
      language plpgsql
      set search_path to 'public', 'pg_temp'
      as $function$
      begin
        if tg_op = 'INSERT' then
          new.rent_amount := coalesce(new.rent_amount, new.monthly_rent);
          new.monthly_rent := coalesce(new.monthly_rent, new.rent_amount);
          return new;
        end if;

        if new.rent_amount is distinct from old.rent_amount and new.monthly_rent is not distinct from old.monthly_rent then
          new.monthly_rent := new.rent_amount;
        elsif new.monthly_rent is distinct from old.monthly_rent and new.rent_amount is not distinct from old.rent_amount then
          new.rent_amount := new.monthly_rent;
        elsif new.monthly_rent is distinct from new.rent_amount then
          new.monthly_rent := new.rent_amount;
        end if;
        return new;
      end;
      $function$
    $contract_function$;

    drop trigger if exists sync_contract_rent_fields_on_contracts on public.contracts;
    create trigger sync_contract_rent_fields_on_contracts
    before insert or update of rent_amount, monthly_rent on public.contracts
    for each row execute function public.sync_contract_rent_fields();
  end if;
end
$reconcile_contract_rent$;

notify pgrst, 'reload schema';

commit;
