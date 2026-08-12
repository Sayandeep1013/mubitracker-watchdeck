import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { DeckView } from '@/components/DeckView';

// @types/react models Suspense's children/fallback slot against ReactPortal
// (which requires `children`), which no ReactElement structurally satisfies —
// an upstream typing gap, not a real runtime issue. Whether it actually
// surfaces as a build error depends on unrelated cache/resolution state
// (confirmed inconsistent across otherwise-identical builds), so a plain
// `@ts-expect-error` is too fragile — it fails the build either way,
// depending on whether the error happens to fire. A cast sidesteps the
// structural check entirely and is stable regardless.
const SuspenseBoundary = Suspense as unknown as (props: {
  fallback?: ReactNode;
  children?: ReactNode;
}) => JSX.Element;

export default function DeckPage() {
  return (
    <SuspenseBoundary
      fallback={
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-600">
          Loading deck...
        </div>
      }
    >
      <DeckView />
    </SuspenseBoundary>
  );
}
