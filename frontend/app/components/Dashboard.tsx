"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowRight, BookOpen, Brain, Check, Flame, Layers, Plus, Search, Sparkles, Target, X } from "lucide-react";
import AppSidebar from "./AppSidebar";
import { PlanTask, StudyPlan, DashboardFlashcardStats, formatRelativeDue } from "./shared/dashboardShared";
import { api, ApiError, messageFromError, Topic, User } from "../lib/api";
import { Button, Card, EmptyState, StatCard } from "./ui";

type Streak = { currentStreak: number; longestStreak: number; lastActiveDate: string | null };
type InsightSummary = { overdueFlashcards:number; weakConcepts:{conceptName:string;topicTitle:string;masteryScore:number}[]; recentMistakes:{id:string;prompt:string;topicTitle:string}[] };

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
  const [insights, setInsights] = useState<InsightSummary | null>(null);
  const [activeHero, setActiveHero] = useState(0);

  const load = useCallback(async () => {
    try {
      const [topicResult, userResult, flashcardResult, streakResult, planResult, insightResult] = await Promise.all([
        api<{ topics: Topic[] }>("/topics"),
        api<{ user: User | null }>("/auth/me"),
        api<DashboardFlashcardStats>("/flashcards/stats-summary").catch(() => null),
        api<Streak>("/streak").catch(() => null),
        api<StudyPlan>("/coach/plan/today").catch(() => null),
        api<InsightSummary>("/study-insights").catch(() => null),
      ]);
      setTopics(topicResult.topics);
      setUser(userResult.user);
      setFlashcardStats(flashcardResult);
      setStreak(streakResult);
      setPlan(planResult);
      setInsights(insightResult);
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

  useEffect(() => {
    if (window.matchMedia("(min-width: 48rem)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActiveHero((current) => (current + 1) % 3), 4000);
    return () => window.clearInterval(timer);
  }, []);

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

  const heroSlides = [
    {
      eyebrow: "READY TO REVIEW",
      title: flashcardStats?.due_today ? `${flashcardStats.due_today} flashcards are due` : "Keep your memory fresh",
      description: flashcardStats?.due_today ? "A short review now will protect what you have already learned." : "Start a focused review whenever you are ready.",
      href: "/flashcards",
      action: flashcardStats?.due_today ? "Review now" : "Open flashcards",
      Icon: Layers,
      tone: "accent",
    },
    {
      eyebrow: "FOCUS AREA",
      title: insights?.weakConcepts[0]?.conceptName ?? "Find your next focus",
      description: insights?.weakConcepts[0] ? `${insights.weakConcepts[0].masteryScore}% mastery in ${insights.weakConcepts[0].topicTitle}. Strengthen it with a quick practice session.` : "Complete a quiz and Studia will identify the concepts that need attention.",
      href: insights?.weakConcepts[0] ? "/analytics" : "/quizzes",
      action: insights?.weakConcepts[0] ? "Practice this concept" : "Take a quiz",
      Icon: Target,
      tone: "warm",
    },
    {
      eyebrow: "STUDIA TUTOR",
      title: "Stuck on something? Ask now.",
      description: "Get a calm explanation grounded in your own topics, notes, and study documents.",
      href: "/ai-tutor",
      action: "Ask the tutor",
      Icon: Sparkles,
      tone: "dark",
    },
  ];

  return (
    <main className="dashboard-shell dashboard-home">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <AppSidebar />
      <section className="dashboard-main" id="main-content" tabIndex={-1}>
        <header className="dash-top">
          <div className="search"><span><Search size={16} strokeWidth={1.8} /></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your topics..." /></div>
          <div className="dash-tools"><span className="avatar">{initials}</span></div>
        </header>
        <div className="dash-content">
          {error && <p className="page-error" role="alert">{error}</p>}
          <div className="welcome">
            <div className="mobile-welcome"><div className="dashboard-greeting">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}</div><h1>{user?.name ?? "Learner"}</h1><p>What would you like to understand today?</p></div>
            <div className="desktop-welcome"><div className="section-kicker">YOUR STUDY SPACE</div><h1>Welcome, {user?.name ?? "learner"} <span><Sparkles size={20} /></span></h1><p>Pick up where you left off or start a new topic.</p></div>
            <button className="button button-primary" onClick={() => setShowModal(true)}><Plus size={16} strokeWidth={2.2} /> New topic</button>
          </div>
          <section className="study-hero" aria-roledescription="carousel" aria-label="Recommended study actions">
            <div className="study-hero-track" style={{ transform: `translateX(-${activeHero * 100}%)` }}>
              {heroSlides.map((slide, index) => (
                <article className={`study-hero-slide is-${slide.tone}`} aria-hidden={activeHero !== index} key={slide.eyebrow}>
                  <div className="study-hero-copy">
                    <span>{slide.eyebrow}</span>
                    <h2>{slide.title}</h2>
                    <p>{slide.description}</p>
                    <Link className="study-hero-action" href={slide.href} tabIndex={activeHero === index ? 0 : -1}>{slide.action}<ArrowRight size={16} /></Link>
                  </div>
                  <span className="study-hero-icon"><slide.Icon size={36} strokeWidth={1.6} /></span>
                </article>
              ))}
            </div>
            <div className="study-hero-dots" aria-label="Choose recommendation">
              {heroSlides.map((slide, index) => (
                <button key={slide.eyebrow} type="button" className={activeHero === index ? "active" : ""} onClick={() => setActiveHero(index)} aria-label={`Show recommendation ${index + 1}`} aria-current={activeHero === index ? "true" : undefined} />
              ))}
            </div>
          </section>
          <div className="stats overview-stats">
            <StatCard label="Study topics" value={topics.length} Icon={BookOpen} tone="accent" />
            <StatCard label="Account" value={user?.name ?? "Loading…"} Icon={Sparkles} />
            {!!streak?.currentStreak && (
              <StatCard label="Current streak" value={`${streak.currentStreak} day${streak.currentStreak === 1 ? "" : "s"}`} Icon={Flame} tone="warning" />
            )}
          </div>
          <section className="study-signals" aria-labelledby="study-signals-title">
            <div className="section-head"><div><h2 id="study-signals-title">Needs your attention</h2><p>The most useful work to do next</p></div><Link href="/weekly-report">Weekly report <ArrowRight size={13}/></Link></div>
            <div className="study-signal-grid">
              <Link href="/flashcards" className="study-signal"><span className="signal-icon warning"><Layers size={19}/></span><div><small>OVERDUE FLASHCARDS</small><strong>{insights?.overdueFlashcards ?? flashcardStats?.due_today ?? 0}</strong><p>Review due cards before learning new material.</p></div><ArrowRight size={16}/></Link>
              <Link href="/analytics" className="study-signal"><span className="signal-icon danger"><AlertCircle size={19}/></span><div><small>WEAKEST CONCEPT</small><strong>{insights?.weakConcepts[0]?.conceptName ?? "No weak concepts yet"}</strong><p>{insights?.weakConcepts[0] ? `${insights.weakConcepts[0].masteryScore}% mastery · ${insights.weakConcepts[0].topicTitle}` : "Complete a quiz to reveal weak areas."}</p></div><ArrowRight size={16}/></Link>
              <Link href="/mistakes" className="study-signal"><span className="signal-icon accent"><Brain size={19}/></span><div><small>RECENT QUIZ MISTAKES</small><strong>{insights?.recentMistakes.length ?? 0}</strong><p>{insights?.recentMistakes[0]?.prompt ?? "Incorrect answers will collect here."}</p></div><ArrowRight size={16}/></Link>
            </div>
          </section>
          <div className="dashboard-grid">
            <section className="topics-section">
              <div className="section-head"><div><h2>Your study topics</h2><p>Live from your Studia account</p></div><Link href="/topics">View all <ArrowRight size={13} /></Link></div>
              <div className="topic-list">
                {visibleTopics.slice(0, 6).map((topic) => (
                  <Link className="topic-row" href={`/topic?id=${topic.id}`} key={topic.id}>
                    <span className="topic-icon purple"><BookOpen size={18} strokeWidth={1.8} /></span>
                    <div className="topic-info"><h3>{topic.title}</h3><p>{topic.description || "No description yet."}</p><small>Updated {new Date(topic.updated_at).toLocaleDateString()}</small></div>
                    <span><ArrowRight size={15} /></span>
                  </Link>
                ))}
                {!visibleTopics.length && <EmptyState compact Icon={BookOpen} title={query ? "No matching topics" : "No topics yet"} description={query ? "Try a different search." : "Create a topic to begin organizing your study material."} />}
              </div>
            </section>
            <div className="right-column">
              <Card className="weekly-card coach-widget next-action-card">
                <div className="section-head">
                  <div><h3>Today&apos;s plan</h3><p>{plan?.narrative ?? "Your study coach"}</p></div>
                  <Link href="/coach">Open <ArrowRight size={13} /></Link>
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
                          {task.status === "completed" ? <Check size={13} strokeWidth={3} /> : ""}
                        </button>
                        <span>{task.title}</span>
                        <small>{task.estimatedMinutes} min</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState compact title="Your plan is clear" description="Try a quiz or flashcard review to give the coach a next step." />
                )}
                <Button href="/coach" variant="secondary">View full plan</Button>
              </Card>
              <Card className="weekly-card flashcard-widget next-action-card">
                <div className="section-head">
                  <div><h3>Flashcards</h3><p>Spaced-repetition review</p></div>
                  <Link href="/flashcards">Open <ArrowRight size={13} /></Link>
                </div>
                {flashcardStats ? (
                  <ul className="flashcard-widget-list">
                    <li><strong>{flashcardStats.due_today}</strong> card{flashcardStats.due_today === 1 ? "" : "s"} due today</li>
                    <li><strong>{flashcardStats.difficult}</strong> difficult card{flashcardStats.difficult === 1 ? "" : "s"} need additional practice</li>
                    <li><strong>{flashcardStats.retention_rate != null ? `${flashcardStats.retention_rate}%` : "—"}</strong> retention rate</li>
                    <li>Next review scheduled for <strong>{formatRelativeDue(flashcardStats.next_review_at).toLowerCase()}</strong></li>
                  </ul>
                ) : (
                  <EmptyState compact title="No reviews scheduled" description="Generate your first deck to start spaced-repetition practice." />
                )}
                <Button
                  variant={flashcardStats?.due_today ? "primary" : "secondary"}
                  href="/flashcards"
                >
                  {flashcardStats?.due_today ? `Review ${flashcardStats.due_today} due card${flashcardStats.due_today === 1 ? "" : "s"}` : "Go to flashcards"}
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </section>
      {showModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowModal(false)}>
          <form
            role="dialog" aria-modal="true" aria-labelledby="create-topic-title"
            className="topic-modal action-modal" onSubmit={createTopic} onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowModal(false)}><X size={22} /></button>
            <div className="modal-icon edit-icon"><Sparkles size={22} /></div>
            <div className="eyebrow">NEW LEARNING SPACE</div>
            <h2 id="create-topic-title">Create a study topic</h2>
            <label>Topic name<input name="title" required maxLength={200} autoFocus /></label>
            <label>Description<textarea name="description" maxLength={1000} rows={4} /></label>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="button button-primary" type="submit">Create topic</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
