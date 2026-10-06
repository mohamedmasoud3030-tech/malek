import { useState } from 'react';

type CrudFormStateOptions<TRecord, TDraft> = Readonly<{
  emptyDraft: TDraft;
  draftFromRecord: (record: TRecord) => TDraft;
}>;

export function useCrudFormState<TRecord, TDraft>({ emptyDraft, draftFromRecord }: CrudFormStateOptions<TRecord, TDraft>) {
  const [editingRecord, setEditingRecord] = useState<TRecord | null>(null);
  const [draft, setDraft] = useState<TDraft>(emptyDraft);
  const [formOpen, setFormOpen] = useState(false);

  const openCreate = () => {
    setEditingRecord(null);
    setDraft(emptyDraft);
    setFormOpen(true);
  };

  const openEdit = (record: TRecord) => {
    setEditingRecord(record);
    setDraft(draftFromRecord(record));
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  return {
    editingRecord,
    draft,
    formOpen,
    setDraft,
    setFormOpen,
    openCreate,
    openEdit,
    closeForm,
  };
}
