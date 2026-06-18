import { m } from '@/locale/paraglide/messages';
import { ApiKeysTable } from '@/components/settings/apikeys/apikeys-table';
import {
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
} from '@/hooks/use-apikeys';
import { toast } from 'sonner';
import { useState } from 'react';
export function ApiKeysPageContent() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const { data, isLoading } = useApiKeys(page, pageSize);
  const createMutation = useCreateApiKey();
  const deleteMutation = useDeleteApiKey();
  const handleCreate = (name: string) =>
    new Promise<
      | {
          key: string;
        }
      | undefined
    >((resolve) => {
      createMutation.mutate(
        { name },
        {
          onSuccess: (data) => {
            toast.success(m.settings_api_keys_create_success());
            resolve(data?.key ? { key: data.key } : undefined);
          },
          onError: () => {
            toast.error(m.settings_api_keys_create_error());
            resolve(undefined);
          },
        }
      );
    });
  const handleDelete = (keyId: string) => {
    deleteMutation.mutate(
      { keyId },
      {
        onSuccess: () => toast.success(m.settings_api_keys_delete_success()),
        onError: () => toast.error(m.settings_api_keys_delete_error()),
      }
    );
  };
  return (
    <ApiKeysTable
      data={data?.items ?? []}
      total={data?.total ?? 0}
      pageIndex={page}
      pageSize={pageSize}
      loading={isLoading}
      creating={createMutation.isPending}
      onPageChange={setPage}
      onPageSizeChange={(size) => {
        setPageSize(size);
        setPage(0);
      }}
      onDelete={handleDelete}
      onCreate={handleCreate}
    />
  );
}
