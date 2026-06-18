import EmailButton from '../components/email-button';
import EmailLayout from '../components/email-layout';
import { Text } from '@react-email/components';
import { m } from '@/locale/paraglide/messages';

const en = { locale: 'en' as const };

interface ForgotPasswordProps {
  url: string;
  name: string;
}

export default function ForgotPassword({ url, name }: ForgotPasswordProps) {
  return (
    <EmailLayout>
      <Text>
        {m.mail_forgot_password_greeting(undefined, en)} {name}.
      </Text>
      <Text>{m.mail_forgot_password_body(undefined, en)}</Text>
      <EmailButton href={url}>
        {m.mail_forgot_password_button(undefined, en)}
      </EmailButton>
    </EmailLayout>
  );
}
