import { Page } from "@playwright/test";

export const topic = {
  id: 1,
  title: "Biology",
  description: "Living systems",
  created_at: "2026-08-10T00:00:00Z",
  updated_at: "2026-08-10T00:00:00Z",
};

export async function mockApi(page: Page) {
  await page.route("http://localhost:5000/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");

    if (request.method() === "POST" && ["/auth/login", "/auth/register"].includes(path)) {
      return route.fulfill({ json: { user: { id: "1", name: "Demo Learner", email: "demo@example.com" } } });
    }
    if (request.method() === "POST" && path === "/topics/1/documents") {
      return route.fulfill({
        status: 202,
        json: {
          document: {
            id: 7,
            topic_id: 1,
            title: "lesson.txt",
            original_filename: "lesson.txt",
            content_type: "text/plain",
            status: "pending",
            error_message: null,
            created_at: "2026-08-10T00:00:00Z",
            updated_at: "2026-08-10T00:00:00Z",
          },
        },
      });
    }

    if (path === "/topics") return route.fulfill({ json: { topics: [topic] } });
    if (path === "/auth/me") return route.fulfill({ json: { user: { id: "1", name: "Demo Learner", email: "demo@example.com" } } });
    if (path === "/streak") return route.fulfill({ json: { currentStreak: 4, longestStreak: 7, lastActiveDate: "2026-08-10" } });
    if (path === "/coach/plan/today") return route.fulfill({ json: { narrative: "A focused review day", tasks: [] } });
    if (path === "/study-insights") return route.fulfill({ json: { overdueFlashcards: 3, weakConcepts: [], recentMistakes: [] } });
    if (path === "/topics/1") return route.fulfill({ json: { topic } });
    if (path.includes("/notes/")) {
      return route.fulfill({ json: { notes: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } } });
    }
    if (path === "/topics/1/documents") return route.fulfill({ json: { documents: [] } });
    if (path.endsWith("/ai/messages")) return route.fulfill({ json: { messages: [] } });
    if (path.endsWith("/mastery/weak")) return route.fulfill({ json: { concepts: [] } });
    if (path.endsWith("/quizzes")) return route.fulfill({ json: { quizzes: [] } });
    if (path.endsWith("/exams")) return route.fulfill({ json: { exams: [] } });
    if (path.includes("/flashcards")) {
      if (path === "/flashcards/stats-summary") {
        return route.fulfill({ json: { due_today: 0, difficult: 0, retention_rate: null, next_review_at: null } });
      }
      if (path.endsWith("/stats")) {
        return route.fulfill({ json: { total: 0, due_today: 0, difficult: 0, retention_rate: null } });
      }
      return route.fulfill({ json: { flashcards: [] } });
    }
    if (path === "/workspace-pages") return route.fulfill({ json: { pages: [] } });
    if (path.endsWith("/level")) return route.fulfill({ json: { totalXp: 0 } });
    if (path.includes("mind-map")) return route.fulfill({ json: { mindMap: null } });
    if (path.includes("knowledge-graph")) return route.fulfill({ json: { nodes: [], edges: [], belowMinimum: false } });

    return route.fulfill({ json: {} });
  });
}
