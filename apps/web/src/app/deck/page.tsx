import { Suspense } from 'react';
import { DeckView } from '@/components/DeckView';

export default function DeckPage() {
  return (
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
