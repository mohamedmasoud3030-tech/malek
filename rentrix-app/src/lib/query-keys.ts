/**
 * Generic TanStack Query key factory for domain entities.
 *
 * Produces the standard key shape pattern used across features:
 * ```
 * all         →  ['entityName']
 * lists()     →  ['entityName', 'list']
 * list(p)     →  ['entityName', 'list', params]
 * detail(id)  →  ['entityName', 'detail', id]
 * ```
 *
 * Additional sub-keys can be composed as needed:
 * ```ts
 * const myKeys = defineEntityKeys('myEntity');
 * // Add custom sub-key:
 * const paginated = (p: Params) => [...myKeys.lists(), 'paginated', p] as const;
 * ```
 *
 * All arrays use `as const` for precise TypeScript inference, matching the
 * identical pattern each feature previously defined inline.
 *
 * @example
 * ```ts
 * export const contractKeys = {
 *   ...defineEntityKeys('contracts'),
 *   allPages: (status: ContractStatusFilter) =>
 *     [...defineEntityKeys('contracts').lists(), 'all-pages', status] as const,
 * };
 * ```
 */
export function defineEntityKeys(name: string) {
  const all = [name] as const;

  return {
    /** Root key: `[name]` */
    all,
    /** List prefix: `[name, 'list']` */
    lists: () => [...all, 'list'] as const,
    /** Parameterised list: `[name, 'list', params]` */
    list: <T>(params: T) => [...all, 'list', params] as const as unknown as readonly [typeof name, 'list', T],
    /** Single entity detail: `[name, 'detail', id]` */
    detail: (id: string) => [...all, 'detail', id] as const,
  } as const;
}