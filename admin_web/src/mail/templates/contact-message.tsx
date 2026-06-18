import EmailLayout from '../components/email-layout';
import { Text } from '@react-email/components';
import { m } from '@/locale/paraglide/messages';

const en = { locale: 'en' as const };

interface ContactMessageProps {
  name: string;
  email: string;
  message: string;
}

export default function ContactMessage({
  name,
  email,
  message,
}: ContactMessageProps) {
  return (
    <EmailLayout>
      <Text>
        {m.mail_contact_message_name(undefined, en)} {name}
      </Text>
      <Text>
        {m.mail_contact_message_email(undefined, en)} {email}
      </Text>
      <Text>
        {m.mail_contact_message_message(undefined, en)} {message}
      </Text>
    </EmailLayout>
  );
}
