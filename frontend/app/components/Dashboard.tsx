"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AppSidebar from "./AppSidebar";
import { PlanTask, StudyPlan } from "./CoachPages";
import { DashboardFlashcardStats, formatRelativeDue } from "./FlashcardPages";
import { api, ApiError, messageFromError, Topic, User } from "../lib/api";

type Streak = { currentStreak: number; longestStreak: number; lastActiveDate: string | null };

export default function Dashboard() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [flashcardStats, setFlashcardStats] = useState<DashboardFlashcardStats | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [togglingTaskId, setTogglingTaskId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [topicResult, userResult, flashcardResult, streakResult, planResult] = await Promise.all([
        api<{ topics: Topic[] }>("/topics"),
        api<{ user: User | null }>("/auth/me"),
        api<DashboardFlashcardStats>("/flashcards/stats-summary").catch(() => null),
        api<Streak>("/streak").catch(() => null),
        api<StudyPlan>("/coach/plan/today").catch(() => null),
      ]);
      setTopics(topicResult.topics);
      setUser(userResult.user);
      setFlashcardStats(flashcardResult);
      setStreak(streakResult);
      setPlan(planResult);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setError(messageFromError(requestError));
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    try {
      const result = await api<{ topic: Topic }>("/topics", {
        method: "POST",
        body: JSON.stringify({
          title: data.get("title"),
          description: data.get("description") || null,
        }),
      });
      setTopics((current) => [result.topic, ...current]);
      setShowModal(false);
    } catch (requestError) {
      setError(messageFromError(requestError));
    }
  }

  async function toggleTask(task: PlanTask) {
    if (!plan || togglingTaskId) return;
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    setTogglingTaskId(task.id);
    setPlan({ ...plan, tasks: plan.tasks.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item)) });
    try {
      await api(`/study-plan-tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
    } catch {
      setPlan(plan);
    } finally {
      setTogglingTaskId(null);
    }
  }

  const visibleTopics = topics.filter((topic) =>
    topic.title.toLowerCase().includes(query.toLowerCase()),
  );
  const initials = user?.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "ST";

  return (
    <main className="dashboard-shell">
      <AppSidebar />
      <section className="dashboard-main">
        <header className="dash-top">
          <div className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your topics..." /></div>
          <div className="dash-tools"><span className="avatar">{initials}</span></div>
        </header>
        <div className="dash-content">
          {error && <p className="page-error" role="alert">{error}</p>}
          <div className="welcome">
            <div><div className="section-kicker">YOUR STUDY SPACE</div><h1>Welcome, {user?.name ?? "learner"} <span>✦</span></h1><p>Pick up where you left off or start a new topic.</p></div>
            <button className="button button-primary" onClick={() => setShowModal(true)}>＋ New topic</button>
          </div>
          <div className="stats">
            <article><span className="stat-icon violet">▤</span><div><small>STUDY TOPICS</small><strong>{topics.length}</strong></div></article>
            <article><span className="stat-icon coral">✦</span><div><small>ACCOUNT</small><strong className="stat-label">{user?.email ?? "Loading…"}</strong></div></article>
            {!!streak?.currentStreak && (
              <article><span className="stat-icon fire">🔥</span><div><small>STREAK</small><strong>{streak.currentStreak} day{streak.currentStreak === 1 ? "" : "s"}</strong></div></article>
            )}
          </div>
          <div className="dashboard-grid">
            <section className="topics-section">
              <div className="section-head"><div><h2>Your study topics</h2><p>Live from your Studia account</p></div><Link href="/topics">View all →</Link></div>
              <div className="topic-list">
                {visibleTopics.slice(0, 6).map((topic) => (
                  <Link className="topic-row" href={`/topic?id=${topic.id}`} key={topic.id}>
                    <span className="topic-icon purple">◇</span>
                    <div className="topic-info"><h3>{topic.title}</h3><p>{topic.description || "No description yet."}</p><small>Updated {new Date(topic.updated_at).toLocaleDateString()}</small></div>
                    <span>→</span>
                  </Link>
                ))}
                {!visibleTopics.length && <div className="empty">No topics found.</div>}
              </div>
            </section>
            <div className="right-column">
              <section className="weekly-card coach-widget">
                <div className="section-head">
                  <div><h3>Today&apos;s plan</h3><p>{plan?.narrative ?? "Your study coach"}</p></div>
                  <Link href="/coach">Open →</Link>
                </div>
                {plan?.tasks.length ? (
                  <ul className="coach-widget-list">
                    {plan.tasks.slice(0, 4).map((task) => (
                      <li key={task.id} className={task.status === "completed" ? "done" : ""}>
                        <button
                          type="button"
                          className="coach-widget-check"
                          disabled={togglingTaskId === task.id}
                          onClick={() => void toggleTask(task)}
                          aria-label={task.status === "completed" ? "Mark as not done" : "Mark as done"}
                        >
                          {task.status === "completed" ? "✓" : ""}
                        </button>
                        <span>{task.title}</span>
                        <small>{task.estimatedMinutes} min</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="flashcard-widget-empty">Nothing scheduled yet -- try a quiz or flashcard review.</p>
                )}
                <Link className="button button-secondary" href="/coach">View full plan</Link>
              </section>
              <section className="weekly-card flashcard-widget">
                <div className="section-head">
                  <div><h3>Flashcards</h3><p>Spaced-repetition review</p></div>
                  <Link href="/flashcards">Open →</Link>
                </div>
                {flashcardStats ? (
                  <ul className="flashcard-widget-list">
                    <li><strong>{flashcardStats.due_today}</strong> card{flashcardStats.due_today === 1 ? "" : "s"} due today</li>
                    <li><strong>{flashcardStats.difficult}</strong> difficult card{flashcardStats.difficult === 1 ? "" : "s"} need additional practice</li>
                    <li><strong>{flashcardStats.retention_rate != null ? `${flashcardStats.retention_rate}%` : "—"}</strong> retention rate</li>
                    <li>Next review scheduled for <strong>{formatRelativeDue(flashcardStats.next_review_at).toLowerCase()}</strong></li>
                  </ul>
                ) : (
                  <p className="flashcard-widget-empty">Generate your first deck to start tracking review stats.</p>
                )}
                <Link
                  className={`button ${flashcardStats?.due_today ? "button-primary" : "button-secondary"}`}
                  href="/flashcards"
                >
                  {flashcardStats?.due_today ? `Review ${flashcardStats.due_today} due card${flashcardStats.due_today === 1 ? "" : "s"}` : "Go to flashcards"}
                </Link>
              </section>
            </div>
          </div>
        </div>
      </section>
      {showModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowModal(false)}>
          <form className="topic-modal" onSubmit={createTopic} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <div className="eyebrow"><span>✦</span> NEW LEARNING SPACE</div>
            <h2>Create a study topic</h2>
            <label>Topic name<input name="title" required maxLength={200} autoFocus /></label>
            <label>Description<textarea name="description" maxLength={1000} rows={4} /></label>
            <button className="button button-primary" type="submit">Create topic</button>
          </form>
        </div>
      )}
    </main>
  );
}
