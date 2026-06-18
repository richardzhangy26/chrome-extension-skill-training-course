import type { BlogPost } from '@/lib/blog';
import { Link } from '@tanstack/react-router';
import { formatDate } from '@/lib/formatter';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function BlogCard({ post }: { post: BlogPost }) {
  const { slug } = post;

  return (
    <Link to="/blog/$slug" params={{ slug }} className="h-full">
      <Card className="h-full py-0 transition-[box-shadow,ring-color] hover:shadow-md dark:hover:ring-foreground/20">
        {post.image && (
          <div className="aspect-video w-full overflow-hidden rounded-t-xl bg-muted">
            <img
              src={post.image}
              alt={post.title}
              className="size-full object-cover transition-transform hover:scale-[1.05]"
              width={1280}
              height={720}
              loading="lazy"
              decoding="async"
            />
          </div>
        )}
        <CardHeader className="flex flex-row items-center justify-between gap-2 pt-4 pb-0">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground capitalize">
            {post.category}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(new Date(post.date))}
          </span>
        </CardHeader>
        <CardContent className="pb-4">
          <CardTitle className="line-clamp-2 text-lg">
            <h2>{post.title}</h2>
          </CardTitle>
          {post.description && (
            <CardDescription className="mt-2 line-clamp-2">
              {post.description}
            </CardDescription>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
