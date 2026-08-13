'use client';

import { useParams, useRouter } from 'next/navigation';
import { ReviewEditor } from '@/components/ReviewEditor';

export default function EditReviewPage() {
  const { id: reviewId } = useParams<{ id: string }>();
  const router = useRouter();

  return <ReviewEditor mode="edit" reviewId={reviewId} onSaved={() => router.push('/reviews')} />;
}
