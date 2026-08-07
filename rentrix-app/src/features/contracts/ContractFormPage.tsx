import { useNavigate, useParams } from '@tanstack/react-router';
import { ContractFormModal } from './contract-form-modal';
import { ContractsListPage } from './ContractsListPage';
import { ContractDetailPage } from './pages/ContractDetailPage';

/**
 * Contract create/edit route surface (Wave A UX simplification).
 *
 * - /contracts/new: renders the contracts workspace with the compact centered
 *   create modal (ContractFormModal) on top — the same modal used by the
 *   workspace "إنشاء عقد" action; closing returns to the contracts list.
 * - /contracts/$contractId/edit: renders the contract detail workspace with
 *   the compact centered edit modal on top, so editing never leaves the
 *   contract context.
 *
 * Business logic, validation, permissions, and the owner-agreement coverage
 * recovery surface (ContractAgreementMissingAlert) are unchanged — they live
 * in ContractFormModal / useContractForm, shared with the in-workspace flows.
 */
export function ContractFormPage() {
  const { contractId } = useParams({ strict: false }) as { contractId?: string };
  return contractId ? <ContractEditRoute contractId={contractId} /> : <ContractCreateRoute />;
}

function ContractCreateRoute() {
  const navigate = useNavigate();
  const closeToContracts = () => {
    void navigate({ to: '/contracts' });
  };

  return (
    <>
      <ContractsListPage />
      <ContractFormModal open onClose={closeToContracts} />
    </>
  );
}

function ContractEditRoute({ contractId }: Readonly<{ contractId: string }>) {
  const navigate = useNavigate();
  const closeToDetail = () => {
    void navigate({ to: '/contracts/$contractId', params: { contractId } });
  };

  return (
    <>
      <ContractDetailPage />
      <ContractFormModal open contractId={contractId} onClose={closeToDetail} />
    </>
  );
}
