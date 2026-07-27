import { applyBrandText } from '@/lib/brand';
import { legalContent } from './legal';
import type { LegalContent, LegalSlug } from './legal';
import type { Lang } from './messages';

export const brandLegalContent: Record<LegalSlug, Record<Lang, LegalContent>> = applyBrandText(legalContent);
