import { UsersTable } from '@/components/admin/users/users-table';
import { useUsers } from '@/hooks/use-users';
import type { ColumnFiltersState, SortingState } from '@tanstack/react-table';
import {
  parseAsIndex,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from 'nuqs';
import { useMemo, useTransition } from 'react';

const SORTABLE_IDS = ['name', 'email', 'createdAt'] as const;
const defaultSorting: SortingState = [{ id: 'createdAt', desc: true }];

export function AdminUsersContent() {
  const [, startTransition] = useTransition();
  const [state, setQueryStates] = useQueryStates(
    {
      page: parseAsIndex.withDefault(0),
      size: parseAsInteger.withDefault(10),
      search: parseAsString.withDefault(''),
      sort: parseAsString.withDefault(''),
      role: parseAsString.withDefault(''),
      status: parseAsString.withDefault(''),
    },
    { startTransition, history: 'replace' }
  );

  const { page, size, search, sort, role, status } = state;

  const effectiveSort = useMemo<SortingState>(() => {
    if (!sort) return defaultSorting;
    try {
      const parsed = JSON.parse(sort) as SortingState;
      const valid = parsed.filter((item) =>
        SORTABLE_IDS.includes(item.id as (typeof SORTABLE_IDS)[number])
      );
      return valid.length > 0 ? valid : defaultSorting;
    } catch {
      return defaultSorting;
    }
  }, [sort]);

  const clientFilters = useMemo(
    () =>
      [
        role && { id: 'role', value: role },
        status && { id: 'status', value: status },
      ].filter(Boolean) as Array<{ id: string; value: string }>,
    [role, status]
  );

  const serverFilters: ColumnFiltersState = useMemo(
    () => clientFilters.map((f) => ({ id: f.id, value: [f.value] })),
    [clientFilters]
  );

  const { data, isLoading } = useUsers(
    page,
    size,
    search,
    effectiveSort,
    clientFilters
  );

  const handleFilterChange = (filters: ColumnFiltersState) => {
    const getValue = (id: string) => {
      const f = filters.find((x) => x.id === id);
      return Array.isArray(f?.value)
        ? f.value[0]
        : ((f?.value as string) ?? '');
    };
    void setQueryStates({
      role: getValue('role'),
      status: getValue('status'),
      page: 0,
    });
  };

  const handleSortChange = (newSorting: SortingState) => {
    const valid = newSorting.filter((item) =>
      SORTABLE_IDS.includes(item.id as (typeof SORTABLE_IDS)[number])
    );
    const normalized = valid.length > 0 ? valid : defaultSorting;
    void setQueryStates({ sort: JSON.stringify(normalized), page: 0 });
  };

  return (
    <UsersTable
      data={data?.items ?? []}
      total={data?.total ?? 0}
      pageIndex={page}
      pageSize={size}
      search={search}
      sorting={effectiveSort}
      filters={serverFilters}
      loading={isLoading}
      onSearch={(newSearch) => setQueryStates({ search: newSearch, page: 0 })}
      onPageChange={(newPage) => setQueryStates({ page: newPage })}
      onPageSizeChange={(newSize) => setQueryStates({ size: newSize, page: 0 })}
      onSortingChange={handleSortChange}
      onFiltersChange={handleFilterChange}
    />
  );
}
