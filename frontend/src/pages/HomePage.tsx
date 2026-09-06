import { CtaBand } from '../components/landing/CtaBand';
import { EventShowcase } from '../components/landing/EventShowcase';
import { FeatureHighlights } from '../components/landing/FeatureHighlights';
import { Hero } from '../components/landing/Hero';
import { ProblemSolution } from '../components/landing/ProblemSolution';

export function HomePage({
  onCreateProfile,
  signedOut,
}: {
  onCreateProfile: () => void;
  signedOut: boolean;
}) {
  return (
    <>
      <Hero signedOut={signedOut} />
      <ProblemSolution />
      <EventShowcase />
      <FeatureHighlights />
      <CtaBand onCreateProfile={onCreateProfile} />
    </>
  );
}
