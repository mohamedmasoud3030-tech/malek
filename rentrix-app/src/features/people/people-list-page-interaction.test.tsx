// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PeopleListPage } from './people-list-page';

const createPersonMock = vi.fn();
const updatePersonMock = vi.fn();
let peopleRows: any[] = [];

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('./use-people', () => ({
  usePeople: () => ({
    data: { rows: peopleRows, count: peopleRows.length },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  usePerson: (personId: string) => ({
    data: peopleRows.find((person) => person.id === personId),
    isLoading: false,
  }),
  useCreatePerson: () => ({ isPending: false, mutateAsync: createPersonMock }),
  useUpdatePerson: () => ({ isPending: false, mutateAsync: updatePersonMock }),
  useSoftDeletePerson: () => ({ isPending: false, mutate: vi.fn() }),
}));

describe('PeopleListPage mobile workflow interactions', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    createPersonMock.mockResolvedValue({ id: 'person-new' });
    updatePersonMock.mockResolvedValue({ id: 'person-1' });
    peopleRows = [
      {
        id: 'person-1',
        full_name: 'أحمد علي',
        type: 'tenant',
        phone: '+966501234567',
        email: 'ahmad@example.com',
        national_id: 'ID12345',
        address: 'الرياض',
        notes: 'ملاحظات',
      },
    ];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    document.body.innerHTML = '';
  });

  it('opens the shared person form from the header create action and shows Arabic validation', async () => {
    await act(async () => root.render(<PeopleListPage />));

    const addButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('إضافة شخص'));
    expect(addButton).toBeTruthy();

    await act(async () => addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('إضافة شخص');
    expect(document.body.textContent).toContain('الاسم الكامل');
    expect(document.body.textContent).toContain('الهاتف');
    expect(document.body.textContent).toContain('البريد الإلكتروني');
    expect(document.body.textContent).toContain('رقم الهوية');

    const saveButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('حفظ'));
    await act(async () => saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('الاسم الكامل مطلوب');
  });

  it('opens a prefilled edit form from mobile card actions', async () => {
    await act(async () => root.render(<PeopleListPage />));

    const editButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('تعديل'));
    expect(editButton).toBeTruthy();

    await act(async () => editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('تعديل شخص');
    const nameInput = document.body.querySelector('input[name="full_name"]') as HTMLInputElement | null;
    expect(nameInput?.value).toBe('أحمد علي');
  });

  it('exposes the empty-state create action', async () => {
    peopleRows = [];
    await act(async () => root.render(<PeopleListPage />));

    const addButtons = Array.from(container.querySelectorAll('button')).filter((button) => button.textContent?.includes('إضافة شخص'));
    expect(addButtons.length).toBeGreaterThanOrEqual(1);
  });
});
