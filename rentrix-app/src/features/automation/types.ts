export type AutomationChannel = 'whatsapp' | 'email' | 'in_app' | 'sms';
export type AutomationStatus = 'active' | 'paused' | 'draft';
export type AutomationFrequency = 'daily' | 'weekly' | 'monthly' | 'on_event';

export type AutomationRule = Readonly<{
  id: string;
  name: string;
  description: string;
  category: 'contracts' | 'rent' | 'owners' | 'maintenance' | 'collections';
  channel: AutomationChannel;
  status: AutomationStatus;
  frequency: AutomationFrequency;
  triggerLabel: string;
  audienceLabel: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  successRate: number;
}>;

export type AutomationTemplatePreview = Readonly<{
  id: string;
  title: string;
  channel: AutomationChannel;
  body: string;
}>;
