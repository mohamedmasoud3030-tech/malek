export function createEntityQueryKeys<TFilters>(scope: string) {
  const all = [scope] as const;

  return {
    all,
    list: (filters: TFilters) => [...all, 'list', filters] as const,
  };
}
