import { authClient } from '@/auth/client';
import { useQuery } from '@tanstack/react-query';

export const userAccountsKeys = {
  all: ['userAccounts'] as const,
  list: (userId: string) => [...userAccountsKeys.all, 'list', userId] as const,
};

export function useUserAccounts(userId: string | undefined) {
  return useQuery({
    queryKey: userAccountsKeys.list(userId ?? ''),
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      const accounts = await authClient.listAccounts();
      if ('data' in accounts && Array.isArray(accounts.data))
        return accounts.data;
      throw new Error('Failed to fetch user accounts');
    },
    enabled: !!userId,
  });
}

export function useHasCredentialProvider(userId: string | undefined) {
  const { data: accounts, isLoading, error } = useUserAccounts(userId);
  const hasCredentialProvider =
    accounts?.some((account) => account.providerId === 'credential') ?? false;
  return { hasCredentialProvider, isLoading, error };
}
