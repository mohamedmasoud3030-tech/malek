import { useMutation } from '@tanstack/react-query';
import { requestAiOperatingResponse } from './services/ai-assistant-operating-service';

/**
 * Assistant errors are rendered by the canonical conversation surface.
 * Keeping the mutation silent prevents the same failure from appearing as
 * both a global toast and an inline alert.
 */
export function useSmartAssistant() {
  return useMutation({
    mutationFn: requestAiOperatingResponse,
  });
}
