import { createFileRoute, notFound, rootRouteId } from '@tanstack/react-router';

export const Route = createFileRoute('/(tests)/test-404')({
  loader: () => {
    throw notFound({ routeId: rootRouteId });
  },
  component: Test404Page,
});

/**
 * This component never renders when loader throws notFound(); kept for route definition.
 * To test 404 errors, throw inside this component instead.
 */
function Test404Page() {
  return null;
}
