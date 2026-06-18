import {
  Container,
  Font,
  Head,
  Hr,
  Html,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import { m } from '@/locale/paraglide/messages';

const en = { locale: 'en' as const };

interface EmailLayoutProps {
  children: React.ReactNode;
}

/**
 * Shared email layout (same structure as MkSaaS).
 */
export default function EmailLayout({ children }: EmailLayoutProps) {
  const year = new Date().getFullYear();
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Tailwind>
        <Section className="bg-background p-4">
          <Container className="rounded-lg bg-card p-6 text-card-foreground">
            {children}
            <Hr className="my-8" />
            <Text className="mt-4">
              {m.site_name(undefined, en)} {m.mail_layout_team(undefined, en)}
            </Text>
            <Text>
              ©️ {year} {m.mail_layout_copyright(undefined, en)}
            </Text>
          </Container>
        </Section>
      </Tailwind>
    </Html>
  );
}
