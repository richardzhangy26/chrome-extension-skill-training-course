import { IconBug } from '@tabler/icons-react';

interface FormErrorProps {
  message?: string;
}

export function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="bg-destructive/15 p-3 rounded-md flex items-center gap-x-2 text-sm text-destructive"
    >
      <IconBug className="size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
