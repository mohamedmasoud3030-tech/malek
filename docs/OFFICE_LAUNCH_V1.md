# MALEK Office Launch v1

Status: IMPLEMENTING

## Goal

Turn an already-capable MALEK workspace into something a real-estate office can prepare for first use without manual re-entry of every master-data record.

This phase does not reopen Reports.

## Launch readiness contract

The office setup surface exposes a compact readiness checklist for:

1. office identity (company name + country + city),
2. at least one contact channel,
3. local operating format (currency, locale, timezone, date/number format),
4. document prefixes for invoice, contract, and receipt.

The checklist is guidance, not a second settings store. Existing company settings remain the single authority.

## Spreadsheet import — preview gate

The first import slice supports CSV and XLSX for:

- owners,
- properties,
- units,
- tenants,
- contracts.

The browser parses the file locally and produces a dry-run preview. It accepts Arabic and English header aliases, validates required fields and common values, detects duplicate natural keys inside the file, and blocks approval while any issue remains.

MALEK also generates Arabic CSV/XLSX templates from the same field specification used by the validator, preventing template and parser drift.

## Safety boundary

The preview layer performs **zero database writes**.

The apply layer must be implemented only through existing canonical service/RPC boundaries:

- owners through the owner service/schema boundary,
- tenants through the people service with `type=tenant`,
- properties through the canonical property + owner-agreement atomic workflow,
- units through the canonical unit service/schema boundary,
- contracts through the canonical contract lifecycle and approval/activation controls.

No spreadsheet import may directly insert financial records, receipts, payments, journal entries, settlements, or bypass maker/checker controls.

A file with validation errors is never partially applied. Cross-file references (owner/property/unit/tenant) must be resolved before apply begins. Failure recovery/idempotency belongs to the apply slice rather than being improvised in UI code.

## Scope boundary

Opening balances are intentionally not part of the preview contract yet. They are financial state and require a dedicated governed migration/import path rather than being treated as ordinary spreadsheet rows.

Reports remains CLOSED.
