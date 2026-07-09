import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isAiAssistantConfigurationError, requestAiAssistantResponse } from './services/ai-assistant-service';

export function useSmartAssistant() {
  return useMutation({
    mutationFn: requestAiAssistantResponse,
    onError: (error) => {
      if (isAiAssistantConfigurationError(error)) return;
      toast.error(error instanceof Error ? error.message : 'تعذر تشغيل مساعد الذكاء الاصطناعي');
    },
  });
}
