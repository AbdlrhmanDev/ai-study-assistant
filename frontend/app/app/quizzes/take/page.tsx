import { Suspense } from "react";
import QuizTake from "@/views/QuizTake";

export default function QuizTakePage() {
  return (
    <Suspense fallback={null}>
      <QuizTake />
    </Suspense>
  );
}
