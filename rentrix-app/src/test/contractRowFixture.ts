import type { Database } from '@/types/database';

type ContractRow = Database['public']['Tables']['contracts']['Row'];

/** Required database-owned contract fields shared by typed test fixtures. */
export const contractRowFixtureDefaults = {
  company_id: '00000000-0000-4000-8000-0000000000c1',
  reference: null,
  agreement_version_id: null,
  collection_role_snapshot: null,
  operating_model_snapshot: null,
  maker_user_id: null,
  checker_user_id: null,
  maker_signature: null,
  checker_signature: null,
  approval_status: null,
  submitted_at: null,
  approved_at: null,
  rejected_at: null,
  rejection_reason: null,
  approval_evidence: null,
} satisfies Pick<
  ContractRow,
  | 'company_id'
  | 'reference'
  | 'agreement_version_id'
  | 'collection_role_snapshot'
  | 'operating_model_snapshot'
  | 'maker_user_id'
  | 'checker_user_id'
  | 'maker_signature'
  | 'checker_signature'
  | 'approval_status'
  | 'submitted_at'
  | 'approved_at'
  | 'rejected_at'
  | 'rejection_reason'
  | 'approval_evidence'
>;
