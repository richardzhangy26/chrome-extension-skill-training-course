import EmailButton from '../components/email-button';
import EmailLayout from '../components/email-layout';
import { Text } from '@react-email/components';
import { m } from '@/locale/paraglide/messages';

const en = { locale: 'en' as const };

interface VerifyEmailProps {
  url: string;
  name: string;
}

export default function VerifyEmail({ url, name }: VerifyEmailProps) {
  return (
    <EmailLayout>
      <Text>
        {m.mail_verify_email_greeting(undefined, en)} {name}.
      </Text>
      <Text>{m.mail_verify_email_body(undefined, en)}</Text>
      <EmailButton href={url}>
        {m.mail_verify_email_button(undefined, en)}
      </EmailButton>
    </EmailLayout>
  );
}
