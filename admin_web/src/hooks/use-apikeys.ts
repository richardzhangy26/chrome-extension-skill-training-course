import { authClient } from '@/auth/client';
import type { ApiKey } from '@/db/types';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

export const apiKeysKeys = {
  all: ['apikeys'] as const,
  lists: () => [...apiKeysKeys.all, 'lists'] as const,
  list: (params: { pageIndex: number; pageSize: number }) =>
    [...apiKeysKeys.lists(), params] as const,
};

export function useApiKeys(pageIndex: number, pageSize: number) {
  return useQuery({
    queryKey: apiKeysKeys.list({ pageIndex, pageSize }),
    queryFn: async () => {
      const result = await authClient.apiKey.list({
        query: {
          limit: pageSize,
          offset: pageIndex * pageSize,
          sortBy: 'createdAt',
          sortDirection: 'desc',
        },
      });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to fetch API keys');
      }

      const items = (result.data ?? []) as ApiKey[];
      return { items, total: items.length };
    },
    placeholderData: keepPreviousData,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const { data, error } = await authClient.apiKey.create({ name });

      if (error) {
        throw new Error(error.message || 'Failed to create API key');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysKeys.all });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ keyId }: { keyId: string }) => {
      const { error } = await authClient.apiKey.delete({ keyId });

      if (error) {
        throw new Error(error.message || 'Failed to delete API key');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysKeys.all });
    },
  });
}
