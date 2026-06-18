import { IconCircleCheck } from '@tabler/icons-react';

interface FormSuccessProps {
  message?: string;
}

export function FormSuccess({ message }: FormSuccessProps) {
  if (!message) return null;
  return (
    <output className="bg-emerald-500/15 p-3 rounded-md flex items-center gap-x-2 text-sm text-emerald-500">
      <IconCircleCheck className="size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </output>
  );
}
