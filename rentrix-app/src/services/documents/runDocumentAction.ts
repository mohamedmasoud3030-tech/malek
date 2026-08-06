import { toast } from 'sonner';

/** Runs a document operation from a UI handler and surfaces the real failure message. */
export async function runDocumentAction(operation: () => Promise<void>, fallbackMessage: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : fallbackMessage);
  }
}
