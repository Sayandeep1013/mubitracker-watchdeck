'use client';

import { useParams, useRouter } from 'next/navigation';
import { ReviewEditor } from '@/components/ReviewEditor';

export default function WriteReviewPage() {
  const { id: mediaId } = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <ReviewEditor mode="create" mediaId={mediaId} onSaved={() => router.push('/review-later')} />
  );
}
