import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tenantWorkspaceKeys } from '@/features/tenants/useTenantWorkspace';

const mutationMock = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  useMutation: vi.fn((options) => options),
  useQuery: vi.fn((options) => options),
  useQueryClient: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

const serviceMock = vi.hoisted(() => ({
  createPerson: vi.fn(),
  updatePerson: vi.fn(),
  softDeletePerson: vi.fn(),
  getPerson: vi.fn(),
  listPeople: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: mutationMock.useMutation,
  useQuery: mutationMock.useQuery,
  useQueryClient: mutationMock.useQueryClient,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mutationMock.toastSuccess,
    error: mutationMock.toastError,
  },
}));

vi.mock('./people-service', () => serviceMock);

describe('people query keys and mutation invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationMock.useQueryClient.mockReturnValue({ invalidateQueries: mutationMock.invalidateQueries });
    mutationMock.invalidateQueries.mockResolvedValue(undefined);
  });

  it('invalidates people and tenant workspace caches after create success', async () => {
    const { peopleKeys, useCreatePerson } = await import('./use-people');

    const mutationOptions = useCreatePerson() as unknown as { onSuccess: (person: { id: string }) => Promise<void> };
    await mutationOptions.onSuccess({ id: 'person-1' });

    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: peopleKeys.all });
    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: tenantWorkspaceKeys.all });
    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: peopleKeys.detail('person-1') });
    expect(mutationMock.toastSuccess).toHaveBeenCalledWith('تم إنشاء الشخص بنجاح');
  });

  it('invalidates detail, lists, and tenant workspace caches after edit success', async () => {
    const { peopleKeys, useUpdatePerson } = await import('./use-people');

    const mutationOptions = useUpdatePerson('person-1') as unknown as { onSuccess: () => Promise<void> };
    await mutationOptions.onSuccess();

    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: peopleKeys.all });
    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: peopleKeys.detail('person-1') });
    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: tenantWorkspaceKeys.all });
  });

  it('invalidates detail, lists, and tenant workspace caches after archive success', async () => {
    const { peopleKeys, useSoftDeletePerson } = await import('./use-people');

    const mutationOptions = useSoftDeletePerson() as unknown as { onSuccess: (_data: unknown, personId: string) => Promise<void> };
    await mutationOptions.onSuccess(undefined, 'person-1');

    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: peopleKeys.all });
    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: peopleKeys.detail('person-1') });
    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: tenantWorkspaceKeys.all });
  });
});
