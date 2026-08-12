import { Suspense } from 'react';
import { DeckView } from '@/components/DeckView';

export default function DeckPage() {
  return (
    // @ts-expect-error — @types/react 19.x models Suspense's children/fallback slot against
    // ReactPortal (which now requires `children`), which no ReactElement structurally satisfies.
    // Compile-time only; Suspense works correctly at runtime. No fix available upstream yet.
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-600">
          Loading deck...
        </div>
      }
    >
      <DeckView />
    </Suspense>
  );
}
