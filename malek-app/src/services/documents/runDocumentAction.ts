/**
 * Canonical UI entry point for every Print/PDF action.
 *
 * Two guarantees live here, both required by UX-008 / "Printing and
 * documents":
 *
 *  1. **Fail closed at the handler.** `requireDocumentReadiness` is called
 *     *inside* the handler, not only reflected in a `disabled` prop. A
 *     disabled button is a UX affordance; it is not enforcement, because the
 *     handler is still reachable through keyboard activation, a stale
 *     closure, an automated click, or a future refactor that forgets the
 *     prop. When readiness is absent the action never reaches the engine.
 *
 *  2. **User-safe Arabic errors.** Only messages the document platform
 *     itself authored (`DocumentRenderError`, `MissingDocumentSettingsError`,
 *     `DocumentDataError`, `DocumentReadinessError`) are shown verbatim —
 *     each is already a complete, user-facing Arabic sentence. Anything else
 *     (a TypeError, a network/stack detail, a Supabase payload) is replaced
 *     by the caller's Arabic fallback so implementation details and
 *     potentially sensitive data never reach the toast.
 */
import { toast } from 'sonner';
import { MissingDocumentSettingsError } from './companyIdentity';

/**
 * Thrown when a Print/PDF handler runs without confirmed company/document
 * readiness. The message is a complete, user-facing Arabic sentence.
 */
export class DocumentReadinessError extends Error {
  constructor(
    message = 'تعذر إنشاء المستند: بيانات الشركة غير مكتملة أو المستند غير جاهز للإصدار. يرجى إكمال بيانات الشركة في الإعدادات ثم إعادة المحاولة.',
  ) {
    super(message);
    this.name = 'DocumentReadinessError';
  }
}

/**
 * Error names whose `message` is a curated, user-facing Arabic sentence and
 * may therefore be surfaced verbatim. Matched by `name` rather than by
 * `instanceof` so this module stays a leaf (no import cycle into the
 * renderer/engine, which pull the PDF toolchain).
 */
const USER_SAFE_ERROR_NAMES: ReadonlySet<string> = new Set([
  'DocumentRenderError',
  'MissingDocumentSettingsError',
  'DocumentDataError',
  'DocumentReadinessError',
]);

/** True when `error` carries a message the platform authored for end users. */
export function isUserSafeDocumentError(error: unknown): error is Error {
  if (!(error instanceof Error)) return false;
  if (error instanceof MissingDocumentSettingsError) return true;
  return USER_SAFE_ERROR_NAMES.has(error.name) && Boolean(error.message?.trim());
}

/** Resolves the message to show for a failed document action. */
export function documentActionErrorMessage(error: unknown, fallbackMessage: string): string {
  return isUserSafeDocumentError(error) ? error.message : fallbackMessage;
}

/**
 * Handler-level readiness guard. Call this at the TOP of every Print/PDF
 * handler, before building a payload or touching `documentService`.
 *
 * @throws {DocumentReadinessError} when readiness is not confirmed.
 */
export function requireDocumentReadiness(isReady: boolean, message?: string): void {
  if (!isReady) throw new DocumentReadinessError(message);
}

/**
 * Runs a document operation from a UI handler and surfaces a user-safe
 * Arabic failure message. Never rethrows: the toast is the user-visible
 * outcome, and the caller's `finally` blocks still run.
 */
export async function runDocumentAction(operation: () => Promise<void>, fallbackMessage: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    toast.error(documentActionErrorMessage(error, fallbackMessage));
  }
}

/**
 * Readiness-guarded variant: the canonical shape a Print/PDF handler should
 * use. Readiness is enforced inside the async boundary, so a handler that
 * somehow runs while the company identity is incomplete fails closed with a
 * visible Arabic explanation instead of producing a document.
 */
export async function runGuardedDocumentAction(
  options: Readonly<{
    isReady: boolean;
    operation: () => Promise<void>;
    fallbackMessage: string;
    readinessMessage?: string;
  }>,
): Promise<void> {
  await runDocumentAction(async () => {
    requireDocumentReadiness(options.isReady, options.readinessMessage);
    await options.operation();
  }, options.fallbackMessage);
}
