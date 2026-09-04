/** Canonical money text used by the assistant's Arabic responses and attention labels. */
export function formatAssistantOmr(value: number): string {
  return `${Number(value || 0).toFixed(3)} ر.ع.`;
}
