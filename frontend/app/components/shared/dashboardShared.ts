// Small types/helpers Dashboard.tsx needs from the coach and flashcard
// features. Kept here (rather than imported straight from CoachPages.tsx /
// FlashcardPages.tsx) so the dashboard route doesn't pull in those two large
// page modules just for one type and one formatter each.

export type PlanTaskStatus = "pending" | "completed" | "skipped";

export type PlanTask = {
  id: number;
  topicId: number;
  conceptId: number | null;
  title: string;
  estimatedMinutes: number;
  orderIndex: number;
  status: PlanTaskStatus;
};

export type StudyPlan = {
  id: number;
  planDate: string;
  narrative: string;
  tasks: PlanTask[];
};

export type DashboardFlashcardStats = {
  due_today: number;
  difficult: number;
  retention_rate: number | null;
  next_review_at: string | null;
};

export function formatRelativeDue(dueAt: string | null): string {
  if (!dueAt) return "No cards yet";
  const diffDays = Math.round((new Date(dueAt).getTime() - Date.now()) / 86400000);
  if (diffDays <= 0) return "Due now";
  if (diffDays === 1) return "Tomorrow";
  return `In ${diffDays} days`;
}
