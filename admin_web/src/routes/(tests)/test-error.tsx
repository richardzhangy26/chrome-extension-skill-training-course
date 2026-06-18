import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(tests)/test-error')({
  loader: () => {
    throw new Error(
      'Intentional error for testing DefaultCatchBoundary (errorComponent)'
    );
  },
  component: TestErrorPage,
});

/**
 * This component never renders when loader throws; kept for clarity.
 * To test render-time errors, throw inside this component instead.
 */
function TestErrorPage() {
  return null;
}
