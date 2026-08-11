import { Navbar } from '@/components/landing/navbar';
import { Hero, Problem, Solution, Audience } from '@/components/landing/sections-top';
import { Features, Pricing, Faq, FinalCta, Footer } from '@/components/landing/features';
import { InteractiveDemo } from '@/components/landing/demo';

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Audience />
        <Problem />
        <Solution />
        <Features />
        <InteractiveDemo />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
