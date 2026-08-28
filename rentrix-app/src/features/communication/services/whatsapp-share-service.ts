/**
 * Compatibility seam — P4 WhatsApp composer boundary.
 *
 * The reusable neutral implementation lives in `@/lib/whatsapp-share`
 * (shared across reports and communication). This feature-local re-export
 * keeps the Communication feature's internal imports explicit while avoiding
 * a cross-feature runtime edge from other features.
 */
export * from '@/lib/whatsapp-share';
