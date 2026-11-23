/**
 * Guard shared by the isolated smoke scripts.
 *
 * Why this is a module and not two copy-pasted preludes: the production-refusal
 * check is the only thing standing between an operator's stray command and a
 * write against the live Supabase project. Two hand-written copies of a safety
 * check are two chances to fix a bug in one and forget the other, and the
 * failure mode is silent (the script simply proceeds).
 *
 * The scripts differ in what they are allowed to touch — Storage smoke permits
 * `local` and `staging`, the single-office mutation smoke permits `local` and
 * the dedicated `qa` stack — so the allowed kinds are an argument, not a
 * constant. Everything else (required variables, the refusal itself) is shared.
 */

/** Refuse before any Supabase client is constructed, so nothing can be written. */
function isProductionProject(supabaseUrl, productionRef) {
  return (
    supabaseUrl.hostname === `${productionRef}.supabase.co` ||
    supabaseUrl.hostname.startsWith(`${productionRef}.`)
  );
}

/**
 * @param {object} options
 * @param {readonly string[]} options.required Environment variables that must be set.
 * @param {readonly string[]} options.allowedKinds Permitted `E2E_ENVIRONMENT_KIND` values.
 * @param {string} options.label Human-readable name used in error messages.
 * @returns {{ kind: string, supabaseUrl: URL }} The validated environment.
 */
export function requireIsolatedEnvironment({ required, allowedKinds, label }) {
  for (const name of required) {
    if (!process.env[name]?.trim()) throw new Error(`${name} is required for ${label}.`);
  }

  const kind = process.env.E2E_ENVIRONMENT_KIND.trim().toLowerCase();
  if (!allowedKinds.includes(kind)) {
    throw new Error(`${label} is allowed only for: ${allowedKinds.join(', ')}.`);
  }

  const supabaseUrl = new URL(process.env.VITE_SUPABASE_URL.trim());
  const productionRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF.trim();

  // Production refusal happens BEFORE any Supabase client call — no write of
  // any kind may ever reach the production project from a smoke script.
  if (isProductionProject(supabaseUrl, productionRef)) {
    throw new Error(`Refusing ${label} against the production Supabase project.`);
  }

  return { kind, supabaseUrl };
}
