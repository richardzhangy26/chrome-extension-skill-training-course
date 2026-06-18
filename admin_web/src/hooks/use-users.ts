import { authClient } from '@/auth/client';
import { listUsers } from '@/api/users';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnSort } from '@tanstack/react-table';

type UsersSortingState = ColumnSort[];

interface SimpleFilter {
  id: string;
  value: string;
}

export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'lists'] as const,
  list: (params: {
    pageIndex: number;
    pageSize: number;
    search: string;
    sorting: UsersSortingState;
    filters: SimpleFilter[];
  }) => [...usersKeys.lists(), params] as const,
};

/**
 * Fetch users with pagination, search, sort, filters
 */
export function useUsers(
  pageIndex: number,
  pageSize: number,
  search: string,
  sorting: UsersSortingState,
  filters: SimpleFilter[]
) {
  return useQuery({
    queryKey: usersKeys.list({
      pageIndex,
      pageSize,
      search,
      sorting,
      filters,
    }),
    queryFn: async () => {
      const first = sorting[0];
      const sortId = first?.id ?? 'createdAt';
      const sortDesc = first?.desc ?? true;
      const roleFilter = filters.find((f) => f.id === 'role');
      const statusFilter = filters.find((f) => f.id === 'status');
      const status =
        statusFilter?.value === 'active' || statusFilter?.value === 'inactive'
          ? statusFilter.value
          : undefined;
      return listUsers({
        data: {
          pageIndex,
          pageSize,
          search,
          sortId,
          sortDesc,
          role: roleFilter?.value,
          status,
        },
      });
    },
  });
}

/**
 * Ban user via Better Auth admin plugin
 */
export function useBanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (opts: {
      userId: string;
      banReason: string;
      banExpiresIn?: number;
    }) =>
      authClient.admin.banUser({
        userId: opts.userId,
        banReason: opts.banReason,
        banExpiresIn: opts.banExpiresIn,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}

/**
 * Unban user via Better Auth admin plugin
 */
export function useUnbanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (opts: { userId: string }) =>
      authClient.admin.unbanUser({ userId: opts.userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}
