import { m } from '@/locale/paraglide/messages';
import Container from '@/components/layout/container';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import { websiteConfig } from '@/config/website';
import { seo } from '@/lib/seo';
import { getMailtoUrl } from '@/lib/urls';
import { cn } from '@/lib/utils';
import { IconBrandXFilled, IconMailFilled } from '@tabler/icons-react';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(pages)/about')({
  head: () =>
    seo('/about', {
      title: `${m.about_title()} | ${websiteConfig.metadata?.name}`,
      description: m.about_description(),
    }),
  component: AboutPage,
});

function AboutPage() {
  const twitter = websiteConfig.social?.twitter;
  const supportEmail = getMailtoUrl(websiteConfig.mail?.supportEmail);
  return (
    <Container className="py-16 px-4">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="relative mx-auto mb-24 mt-8 max-w-[--breakpoint-md] md:mt-16">
          <div className="mx-auto flex flex-col justify-between">
            <div className="grid gap-8 sm:grid-cols-2">
              {/* Avatar and name */}
              <div className="flex items-center gap-8">
                <Avatar className="size-32 p-0.5">
                  <AvatarImage
                    className="rounded-full border-border"
                    src="/logo.png"
                    alt={m.about_avatar()}
                  />
                  <AvatarFallback className="absolute inset-0">
                    <div className="size-32 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    {websiteConfig.metadata?.name}
                  </h1>
                  <p className="mt-2 text-base text-muted-foreground">
                    {m.about_bio()}
                  </p>
                </div>
              </div>

              {/* Introduction and social */}
              <div>
                <p className="mb-8 text-base text-muted-foreground">
                  {m.about_introduction()}
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  {twitter && (
                    <a
                      href={twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: 'outline' }),
                        'rounded-lg'
                      )}
                    >
                      <IconBrandXFilled className="mr-1 size-4" />
                      {m.about_follow_us()}
                    </a>
                  )}
                  {supportEmail && (
                    <a
                      href={supportEmail}
                      className={cn(
                        buttonVariants(),
                        'rounded-lg inline-flex items-center'
                      )}
                    >
                      <IconMailFilled className="mr-1 size-4" />
                      {m.about_contact_us()}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
