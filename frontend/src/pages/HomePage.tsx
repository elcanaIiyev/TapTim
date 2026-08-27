import { CtaBand } from '../components/landing/CtaBand';
import { EventShowcase } from '../components/landing/EventShowcase';
import { FeatureHighlights } from '../components/landing/FeatureHighlights';
import { Hero } from '../components/landing/Hero';
import { ProblemSolution } from '../components/landing/ProblemSolution';

export function HomePage({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <>
      <Hero onGetStarted={onGetStarted} />
      <ProblemSolution />
      <EventShowcase />
      <FeatureHighlights />
      <CtaBand onGetStarted={onGetStarted} />
    </>
  );
}
