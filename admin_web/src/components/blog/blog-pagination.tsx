import { m } from '@/locale/paraglide/messages';
import { Link } from '@tanstack/react-router';
export function BlogPagination({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const prevPage = currentPage - 1;
  const nextPage = currentPage + 1;
  return (
    <nav
      className="mt-8 flex items-center justify-center gap-2"
      aria-label={m.blog_pagination()}
    >
      {currentPage > 1 ? (
        <Link
          to="/blog"
          search={prevPage <= 1 ? { page: undefined } : { page: prevPage }}
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {m.blog_previous()}
        </Link>
      ) : (
        <span className="inline-flex cursor-not-allowed items-center rounded-lg border border-border px-4 py-2 text-muted-foreground text-sm">
          {m.blog_previous()}
        </span>
      )}
      <span className="px-2 text-muted-foreground text-sm">
        {m.blog_page()} {currentPage} {m.blog_of()} {totalPages}
      </span>
      {currentPage < totalPages ? (
        <Link
          to="/blog"
          search={{ page: nextPage }}
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {m.blog_next()}
        </Link>
      ) : (
        <span className="inline-flex cursor-not-allowed items-center rounded-lg border border-border px-4 py-2 text-muted-foreground text-sm">
          {m.blog_next()}
        </span>
      )}
    </nav>
  );
}
