import { Suspense } from "react";
import WorkspacePage from "@/views/WorkspacePage";

export default function WorkspacePagePage() {
  return (
    <Suspense fallback={null}>
      <WorkspacePage />
    </Suspense>
  );
}
