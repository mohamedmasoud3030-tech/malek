/**
 * Public compatibility entry point for operational financial reports.
 *
 * Consumers historically import this module directly; implementations now live
 * in `financial-reporting/`, separated into contracts, filters, calculations,
 * Supabase loaders, and report orchestration.
 */
export * from './financial-reporting';
