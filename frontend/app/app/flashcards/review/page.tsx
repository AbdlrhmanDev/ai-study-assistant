import { Suspense } from "react";
import FlashcardReview from "@/views/FlashcardReview";

export default function FlashcardReviewPage() {
  return (
    <Suspense fallback={null}>
      <FlashcardReview />
    </Suspense>
  );
}
