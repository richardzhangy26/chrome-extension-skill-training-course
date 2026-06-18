import HeroSection from '@/components/blocks/hero';
import LogoCloudSection from '@/components/blocks/logo-cloud';
import FeaturesSection from '@/components/blocks/features';
import Features2Section from '@/components/blocks/features2';
import CallToActionSection from '@/components/blocks/calltoaction';
import StatsSection from '@/components/blocks/stats';
import IntegrationSection from '@/components/blocks/integration';
import Integration2Section from '@/components/blocks/integration2';
import PricingSection from '@/components/blocks/pricing';
import FaqSection from '@/components/blocks/faqs';
import TestimonialsSection from '@/components/blocks/testimonials';
import NewsletterCard from '@/components/blocks/newsletter-card';

export function HomePage() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <LogoCloudSection />
      <FeaturesSection />
      <Features2Section />
      <CallToActionSection />
      <StatsSection />
      <IntegrationSection />
      <Integration2Section />
      <PricingSection />
      <FaqSection />
      <TestimonialsSection />
      <NewsletterCard />
    </div>
  );
}
