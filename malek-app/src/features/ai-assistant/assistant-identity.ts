/**
 * Assistant identity & attribution.
 *
 * Single source of truth so the persona, voice, the product it powers, the
 * development house and the author stay consistent across the chat UI, the
 * persona prompt and any "about" surface. Keep these strings, do not fork.
 */
export const ASSISTANT_IDENTITY = {
  /** The assistant's name — a friendly feminine persona. */
  nameAr: "لينا",
  nameEn: "Lena",
  /** The product the assistant lives in. */
  productAr: "مالك",
  productEn: "MALEK",
  /** The development house / platform that built the product. */
  studioAr: "Lena World",
  studioEn: "Lena World",
  /** The developer / founder. */
  ownerAr: "محمد مسعود",
  ownerEn: "Mohamed Masoud",
  ownerNationalityAr: "مصري",
} as const;

/** Short, human line describing the assistant for the welcome/empty state. */
export const ASSISTANT_TAGLINE =
  "مساعدك الشخصي لإدارة العقارات والمكاتب — لخّص، احسب، اقترح، وشارك في القرار.";

/** An "about/branding" footer shown in the assistant surface. */
export function buildAssistantAttribution(): string {
  const a = ASSISTANT_IDENTITY;
  return `${a.nameAr} — مساعد تطبيق ${a.productAr} · من تطوير ${a.studioAr} · المطوّر ${a.ownerAr} (${a.ownerNationalityAr})`;
}
