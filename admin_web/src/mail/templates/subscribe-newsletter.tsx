import EmailLayout from '../components/email-layout';
import { Heading, Text } from '@react-email/components';
import { m } from '@/locale/paraglide/messages';

const en = { locale: 'en' as const };

export default function SubscribeNewsletter() {
  return (
    <EmailLayout>
      <Heading className="text-xl">
        {m.mail_subscribe_newsletter_title(undefined, en)}
      </Heading>
      <Text>{m.mail_subscribe_newsletter_body(undefined, en)}</Text>
    </EmailLayout>
  );
}
