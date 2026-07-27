import { applyBrandText } from '@/lib/brand';
import { messages } from './messages';
import type { Lang, Messages } from './messages';

export const brandMessages: Record<Lang, Messages> = applyBrandText(messages);
