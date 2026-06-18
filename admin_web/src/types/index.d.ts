import type { ComponentType } from 'react';
import type { PricePlan } from '@/payment/types';

/** Website config */
export interface WebsiteConfig {
  ui?: UiConfig;
  metadata?: MetadataConfig;
  social?: SocialConfig;
  auth?: AuthConfig;
  blog?: BlogConfig;
  mail?: MailConfig;
  newsletter?: NewsletterConfig;
  notification?: NotificationConfig;
  storage?: StorageConfig;
  payment?: PaymentConfig;
}

/** UI configuration */
export interface UiConfig {
  mode?: {
    defaultMode?: 'light' | 'dark' | 'system';  // The default mode of the website
    enableSwitch?: boolean;                     // Whether to enable the mode switch
  };
}

/** Website metadata */
export interface MetadataConfig {
  name?: string;         // The name of the website, e.g. 'TanStarter'
  title?: string;        // The title of the website, e.g. 'TanStarter - The Ultimate SaaS Template'
  description?: string;  // The description of the website, e.g. 'TanStarter is the ultimate SaaS template for building your next SaaS application.'
  images?: ImagesConfig; // The images of the website
}

/** Website metadata */
export interface ImagesConfig {
  ogImage?: string;     // The Open Graph image
  logoLight?: string;   // The logo image in light mode
  logoDark?: string;    // The logo image in dark mode
}

/** Social media configuration */
export interface SocialConfig {
  github?: string;
  twitter?: string;
  blueSky?: string;
  discord?: string;
  mastodon?: string;
  linkedin?: string;
  youtube?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  telegram?: string;
}

/** Auth configuration */
export interface AuthConfig {
  enable: boolean;                 // Whether to enable the auth (hide auth pages and features)
  enableGoogleLogin?: boolean;     // Whether to enable google login
  enableCredentialLogin?: boolean; // Whether to enable email/password login
  enableDeleteAccount?: boolean;   // Whether to enable account deletion
}

/** Blog configuration */
export interface BlogConfig {
  enable: boolean;           // Whether to enable the blog
  paginationSize?: number;   // Number of posts per page
}

/** Mail configuration */
export interface MailConfig {
  enable: boolean;                      // Whether to enable the mail
  provider?: 'resend' | 'cloudflare';   // The email provider, supports resend and cloudflare
  fromEmail?: string;                   // The email address to send notification emails from
  supportEmail?: string;                // The email address to send support or contact emails to
}

/** Newsletter configuration */
export interface NewsletterConfig {
  enable: boolean;                        // Whether to enable the newsletter
  provider?: 'resend' | 'beehiiv';        // The newsletter provider
  autoSubscribeAfterSignUp?: boolean;     // Whether to automatically subscribe users after sign up
}

/** Notification configuration */
export interface NotificationConfig {
  enable: boolean;                    // Whether to enable the notification
  provider?: 'discord' | 'feishu';    // The notification provider
}

/** Storage configuration */
export interface StorageConfig {
  enable: boolean;                   // Whether to enable the storage
  provider?: 'r2';                   // The storage provider (e.g. R2)
  maxFileSize?: number;              // Max file size in bytes (default 4MB)
  allowedTypes?: string[];           // Allowed file extensions or MIME types. e.g. ['.jpg', '.png', 'image/webp']. Empty = all allowed.
  userFilesFolder?: string;          // The folder to store user files (default 'userfiles')
}

/** Payment configuration */
export interface PaymentConfig {
  enable?: boolean;                           // Whether to enable payment; when false, no checkout/billing
  provider?: 'stripe' | 'creem' | '';         // The payment provider, empty means disabled
  price?: PriceConfig;                        // The price plans configuration
}

/** Price configuration */
export interface PriceConfig {
  plans: Record<string, PricePlan>;
}

/** Menu item for navbar links, sidebar links, footer links. */
export interface MenuItemConfig {
  title: string;                                    // The text to display
  description?: string;                             // The description of the item
  href?: string;                                    // The url to link to
  icon?: ComponentType<{ className?: string }>;     // The icon to display
  external?: boolean;                               // Whether the link is external
  authorizeOnly?: string[];                         // The roles that are authorized to see the item
  items?: MenuItemConfig[];                         // Nested items for dropdown/group
}
