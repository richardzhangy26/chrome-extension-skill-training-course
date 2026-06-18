import {
  getNewsletterStatus,
  subscribeNewsletter,
  unsubscribeNewsletter,
} from '@/api/newsletter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const newsletterKeys = {
  all: ['newsletter'] as const,
  status: (email: string) => [...newsletterKeys.all, 'status', email] as const,
};

export function useNewsletterStatus(email: string | undefined) {
  return useQuery({
    queryKey: newsletterKeys.status(email ?? ''),
    queryFn: () => getNewsletterStatus({ data: { email: email! } }),
    enabled: !!email,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubscribeNewsletter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => subscribeNewsletter({ data: { email } }),
    onSuccess: (_, email) => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.status(email) });
    },
  });
}

export function useUnsubscribeNewsletter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => unsubscribeNewsletter({ data: { email } }),
    onSuccess: (_, email) => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.status(email) });
    },
  });
}
