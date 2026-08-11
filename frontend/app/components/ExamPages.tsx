"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ClipboardCheck,
  Clock,
  FileText,
  Play,
  Sparkles,
  StickyNote,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { PageShell, useAuthFailure } from "./shared/PageChrome";
import { api, idempotencyHeader, Topic, messageFromError } from "../lib/api";
import { LoadingState } from "./ui";

export type ExamQuestionType = "multiple_choice" | "true_false" | "short_answer" | "essay" | "case_study" | "coding";
export type BloomsLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";

export type Exam = {
  id: number;
  topicId: number;
  title: string;
  timeLimitSeconds: number;
  createdAt: string;
};

type AttemptSummary = {
  id: number;
  examId: number;
  status: "in_progress" | "completed";
  startedAt: string;
  completedAt: string | null;
  score: number | null;
};

type ExamListEntry = Exam & { questionCount: number; latestAttempt: AttemptSummary | null };

type QuestionForTaking = {
  id: number;
  orderIndex: number;
  questionType: ExamQuestionType;
  bloomsLevel: BloomsLevel;
  concept: string;
  prompt: string;
  options: Record<string, unknown> | null;
};

type RubricCriterion = { criterion: string; maxPoints: number; description: string };
type CriterionScore = { criterion: string; maxPoints: number; score: number; evidence: string };

type AnswerReview = {
  questionId: number;
  questionType: ExamQuestionType;
  bloomsLevel: BloomsLevel;
  concept: string;
  prompt: string;
  options: Record<string, unknown> | null;
  correctAnswer: Record<string, unknown> | null;
  rubric: RubricCriterion[] | null;
  explanation: string;
  sourceType: "note" | "document" | null;
  sourceTitle: string | null;
  studentAnswer: Record<string, unknown> | null;
  isCorrect: boolean | null;
  criteriaScores: CriterionScore[] | null;
  pointsEarned: number | null;
  pointsPossible: number | null;
};

type BloomsBreakdown = { bloomsLevel: BloomsLevel; pointsEarned: number; pointsPossible: number; accuracy: number };

type AttemptResults = {
  id: number;
  examId: number;
  status: "in_progress" | "completed";
  startedAt: string;
  deadlineAt: string;
  completedAt: string | null;
  remainingSeconds: number | null;
  score: number | null;
  scoreBreakdown: BloomsBreakdown[] | null;
  answers: AnswerReview[];
};

type AnswerDraft = { index?: number; value?: boolean; text?: string };

const QUESTION_TYPE_LABELS: Record<ExamQuestionType, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / False",
  short_answer: "Short answer",
  essay: "Essay",
  case_study: "Case study",
  coding: "Coding (logic only)",
};
const BLOOMS_LABELS: Record<BloomsLevel, string> = {
  remember: "Remember",
  understand: "Understand",
  apply: "Apply",
  analyze: "Analyze",
  evaluate: "Evaluate",
  create: "Create",
};
const ALL_QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS) as ExamQuestionType[];
const ALL_BLOOMS_LEVELS = Object.keys(BLOOMS_LABELS) as BloomsLevel[];

function humanize(entry: { sourceType: "note" | "document" | null; sourceTitle: string | null }): string | null {
  return entry.sourceTitle;
}

function formatSeconds(totalSeconds: number | null): string {
  if (totalSeconds == null) return "—";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// --------------------------------------------------------------------------
// Exams list -- one card per topic.
// --------------------------------------------------------------------------

export function ExamsPage() {
  const handleAuthFailure = useAuthFailure();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [examCounts, setExamCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [topicsResult, countsResult] = await Promise.all([
        api<{ topics: Topic[] }>("/topics"),
        api<{ counts: Record<number, number> }>("/exams/counts-by-topic"),
      ]);
      setTopics(topicsResult.topics);
      setExamCounts(countsResult.counts);
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <PageShell className="exams-page" title="Exams" subtitle="Formal, timed, rubric-graded exams -- covering Bloom's Taxonomy, not just recall.">
      {error && <p className="page-error" role="alert">{error}</p>}
      {loading ? <LoadingState label="Loading your exams…" /> : (
        <div className="deck-grid">
          {topics.map((topic) => (
            <article className="deck-card" key={topic.id}>
              <span className="topic-icon coral"><ClipboardCheck size={18} strokeWidth={1.8} /></span>
              <h2>{topic.title}</h2>
              <p>{examCounts[topic.id] ?? 0} exam{examCounts[topic.id] === 1 ? "" : "s"}</p>
              <div className="deck-card-actions">
                <Link className="button button-primary" href={`/exams/topic?topicId=${topic.id}`}>Open exams</Link>
              </div>
            </article>
          ))}
          {!topics.length && (
            <div className="empty">
              Create a topic and add notes or documents, then generate your first exam.
              <div><Link className="button button-primary" href="/topics">Create topic</Link></div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

// --------------------------------------------------------------------------
// Exam list for one topic + generate modal.
// --------------------------------------------------------------------------

export function ExamTopicPage() {
  const params = useSearchParams();
  const router = useRouter();
  const handleAuthFailure = useAuthFailure();
  const topicId = Number(params.get("topicId"));

  const [topic, setTopic] = useState<Topic | null>(null);
  const [exams, setExams] = useState<ExamListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<ExamQuestionType[]>(["multiple_choice", "true_false", "essay"]);
  const [selectedLevels, setSelectedLevels] = useState<BloomsLevel[]>(["remember", "understand", "apply"]);
  const [saving, setSaving] = useState(false);
  const [genError, setGenError] = useState("");
  const [deletingExam, setDeletingExam] = useState<ExamListEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(topicId) || topicId < 1) {
      router.replace("/exams");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [topicResult, examsResult] = await Promise.all([
        api<{ topic: Topic }>(`/topics/${topicId}`),
        api<{ exams: ExamListEntry[] }>(`/topics/${topicId}/exams`),
      ]);
      setTopic(topicResult.topic);
      setExams(examsResult.exams);
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure, router, topicId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function toggleType(type: ExamQuestionType) {
    setSelectedTypes((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  }
  function toggleLevel(level: BloomsLevel) {
    setSelectedLevels((current) => (current.includes(level) ? current.filter((item) => item !== level) : [...current, level]));
  }

  async function generateExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTypes.length) { setGenError("Pick at least one question type."); return; }
    if (!selectedLevels.length) { setGenError("Pick at least one Bloom's level."); return; }
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setGenError("");
    try {
      const result = await api<{ exam: Exam }>(`/topics/${topicId}/exams/generate`, {
        method: "POST",
        headers: idempotencyHeader(),
        body: JSON.stringify({
          count: Number(data.get("count")) || 10,
          timeLimitMinutes: Number(data.get("timeLimitMinutes")) || 45,
          questionTypes: selectedTypes,
          bloomsLevels: selectedLevels,
        }),
      });
      setShowGenerate(false);
      router.push(`/exams/take?examId=${result.exam.id}`);
    } catch (requestError) {
      setGenError(messageFromError(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteExam() {
    if (!deletingExam) return;
    setDeleting(true);
    try {
      await api<null>(`/exams/${deletingExam.id}`, { method: "DELETE" });
      setExams((current) => current.filter((exam) => exam.id !== deletingExam.id));
      setDeletingExam(null);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PageShell
      className="exam-topic-page"
      title={topic?.title ?? "Exams"}
      subtitle="Generate a formal, timed exam, or pick up an existing one."
      action={<div className="page-actions">
        <button className="button button-primary" onClick={() => setShowGenerate(true)}><Sparkles size={15} /> Generate exam</button>
        <Link className="back-topics" href="/exams"><ArrowLeft size={13} /> All topics</Link>
      </div>}
    >
      {error && <p className="page-error" role="alert">{error}</p>}
      {loading ? <div className="empty">Loading exams…</div> : (
        <div className="notes-list quiz-list">
          {exams.map((exam) => (
            <article key={exam.id}>
              <div>
                <span><ClipboardCheck size={18} strokeWidth={1.8} /></span>
                <div>
                  <h3>{exam.title}</h3>
                  <div className="flashcard-meta">
                    <small>{exam.questionCount} question{exam.questionCount === 1 ? "" : "s"}</small>
                    <small><Clock size={11} /> {Math.round(exam.timeLimitSeconds / 60)} min</small>
                    {exam.latestAttempt && <small>Last score: {exam.latestAttempt.score}%</small>}
                  </div>
                </div>
              </div>
              <div className="note-actions">
                <Link className="note-action edit-action" href={`/exams/take?examId=${exam.id}`}>
                  <span><Play size={13} fill="currentColor" /></span>{exam.latestAttempt ? "Retake" : "Take exam"}
                </Link>
                {exam.latestAttempt && (
                  <Link className="note-action" href={`/exams/results?attemptId=${exam.latestAttempt.id}&topicId=${topicId}`}>
                    <span><BarChart3 size={13} /></span>Last results
                  </Link>
                )}
                <button className="danger-link" onClick={() => setDeletingExam(exam)}>Delete</button>
              </div>
            </article>
          ))}
          {!exams.length && <div className="empty">No exams yet. Generate one from this topic&apos;s material.</div>}
        </div>
      )}

      {showGenerate && (
        <div className="modal-backdrop" onMouseDown={() => setShowGenerate(false)}>
          <form role="dialog" aria-modal="true" className="topic-modal action-modal quiz-generate-modal" onSubmit={generateExam} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowGenerate(false)}><X size={20} /></button>
            <div className="modal-icon edit-icon"><ClipboardCheck size={18} strokeWidth={1.8} /></div>
            <div className="eyebrow">GENERATE AN EXAM</div>
            <h2>Generate exam</h2>
            {genError && <p className="form-error">{genError}</p>}

            <label>Question types
              <div className="quiz-type-checkboxes">
                {ALL_QUESTION_TYPES.map((type) => (
                  <label className="check" key={type}>
                    <input type="checkbox" checked={selectedTypes.includes(type)} onChange={() => toggleType(type)} />
                    {QUESTION_TYPE_LABELS[type]}
                  </label>
                ))}
              </div>
            </label>

            <label>Bloom&apos;s levels
              <div className="quiz-type-checkboxes">
                {ALL_BLOOMS_LEVELS.map((level) => (
                  <label className="check" key={level}>
                    <input type="checkbox" checked={selectedLevels.includes(level)} onChange={() => toggleLevel(level)} />
                    {BLOOMS_LABELS[level]}
                  </label>
                ))}
              </div>
            </label>

            <div className="quiz-generate-row">
              <label>Number of questions<input type="number" name="count" min={4} max={40} defaultValue={10} /></label>
              <label>Time limit (minutes)<input type="number" name="timeLimitMinutes" min={5} max={240} defaultValue={45} /></label>
            </div>

            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowGenerate(false)}>Cancel</button>
              <button disabled={saving} className="button button-primary" type="submit">{saving ? "Generating…" : "Generate exam"}</button>
            </div>
          </form>
        </div>
      )}

      {deletingExam && (
        <div className="modal-backdrop" onMouseDown={() => (deleting ? null : setDeletingExam(null))}>
          <div role="alertdialog" aria-modal="true" className="topic-modal action-modal delete-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label="Close" disabled={deleting} onClick={() => setDeletingExam(null)}><X size={20} /></button>
            <div className="modal-icon delete-icon"><Trash2 size={22} /></div>
            <div className="eyebrow">REMOVE THIS EXAM</div>
            <h2>Delete “{deletingExam.title}”?</h2>
            <p>This removes the exam, its questions, and every past attempt. This can&apos;t be undone.</p>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" disabled={deleting} onClick={() => setDeletingExam(null)}>Cancel</button>
              <button type="button" className="button button-danger" disabled={deleting} onClick={() => void confirmDeleteExam()}>
                {deleting ? "Deleting…" : "Delete exam"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

// --------------------------------------------------------------------------
// Per-question-type answer input.
// --------------------------------------------------------------------------

function ExamQuestionRenderer({
  question, value, onChange, disabled,
}: {
  question: QuestionForTaking;
  value: AnswerDraft;
  onChange: (value: AnswerDraft) => void;
  disabled: boolean;
}) {
  if (question.questionType === "multiple_choice") {
    const choices = (question.options?.choices as string[] | undefined) ?? [];
    return (
      <div className="quiz-choice-list">
        {choices.map((choice, index) => (
          <button
            type="button" key={index}
            className={`quiz-choice${value.index === index ? " selected" : ""}`}
            aria-pressed={value.index === index}
            disabled={disabled} onClick={() => onChange({ index })}
          >
            {choice}
          </button>
        ))}
      </div>
    );
  }
  if (question.questionType === "true_false") {
    return (
      <div className="quiz-choice-list quiz-true-false">
        {[true, false].map((option) => (
          <button
            type="button" key={String(option)}
            className={`quiz-choice${value.value === option ? " selected" : ""}`}
            aria-pressed={value.value === option}
            disabled={disabled} onClick={() => onChange({ value: option })}
          >
            {option ? "True" : "False"}
          </button>
        ))}
      </div>
    );
  }
  if (question.questionType === "short_answer") {
    return (
      <input
        className="quiz-text-input" value={value.text ?? ""}
        onChange={(event) => onChange({ text: event.target.value })}
        disabled={disabled} placeholder="Type your answer…"
      />
    );
  }
  // essay / case_study / coding
  return (
    <textarea
      className="exam-essay-input" value={value.text ?? ""}
      onChange={(event) => onChange({ text: event.target.value })}
      disabled={disabled} rows={question.questionType === "coding" ? 10 : 8}
      placeholder={question.questionType === "coding" ? "Describe your approach or algorithm -- graded on logic, not executed…" : "Write your answer…"}
    />
  );
}

// --------------------------------------------------------------------------
// Take-exam flow -- intro, one question at a time, server-tracked timer.
// --------------------------------------------------------------------------

export function ExamTakePage() {
  const params = useSearchParams();
  const router = useRouter();
  const handleAuthFailure = useAuthFailure();
  const examId = Number(params.get("examId"));

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<QuestionForTaking[]>([]);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [starting, setStarting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<number, AnswerDraft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(examId) || examId < 1) { router.replace("/exams"); return; }
    setLoading(true);
    setError("");
    try {
      const result = await api<{ exam: Exam; questions: QuestionForTaking[] }>(`/exams/${examId}`);
      setExam(result.exam);
      setQuestions(result.questions);
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure, router, examId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const finishExam = useCallback(async (id: number) => {
    setFinishing(true);
    try {
      await api(`/exams/attempts/${id}/submit`, { method: "POST" });
      router.push(`/exams/results?attemptId=${id}&topicId=${exam?.topicId}`);
    } catch (requestError) {
      setError(messageFromError(requestError));
      setFinishing(false);
    }
  }, [router, exam]);

  // Client-side ticking between server re-syncs; the server's deadline_at is
  // always the real source of truth (see backend's _expire_if_needed).
  useEffect(() => {
    if (!attemptId || remainingSeconds == null) return;
    if (remainingSeconds <= 0) {
      void finishExam(attemptId);
      return;
    }
    const timer = window.setTimeout(() => setRemainingSeconds((current) => (current == null ? null : current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [remainingSeconds, attemptId, finishExam]);

  async function startExam() {
    if (!exam) return;
    setStarting(true);
    setError("");
    try {
      const result = await api<{ attempt: { id: number }; deadlineAt: string }>(`/exams/${exam.id}/attempts`, { method: "POST" });
      setAttemptId(result.attempt.id);
      const seconds = Math.max(0, Math.round((new Date(result.deadlineAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(seconds);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setStarting(false);
    }
  }

  function goToIndex(index: number) {
    setCurrentIndex(Math.max(0, Math.min(questions.length - 1, index)));
  }

  const currentQuestion = questions[currentIndex];

  async function submitAndAdvance() {
    if (!attemptId || !currentQuestion || submitting) return;
    const draft = drafts[currentQuestion.id] ?? {};
    setSubmitting(true);
    setError("");
    try {
      const result = await api<{ expired: boolean }>(`/exams/attempts/${attemptId}/answers`, {
        method: "POST",
        body: JSON.stringify({ questionId: currentQuestion.id, answer: draft }),
      });
      if (result.expired) {
        router.push(`/exams/results?attemptId=${attemptId}&topicId=${exam?.topicId}`);
        return;
      }
      if (currentIndex + 1 < questions.length) {
        goToIndex(currentIndex + 1);
      } else {
        void finishExam(attemptId);
      }
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageShell title="Exam" subtitle="Loading…"><div className="empty">Loading your exam…</div></PageShell>;
  if (error && !exam) return <PageShell title="Exam" subtitle="Something went wrong"><p className="page-error" role="alert">{error}</p></PageShell>;
  if (!exam) return null;

  if (!attemptId) {
    return (
      <PageShell className="exam-intro-page" title={exam.title} subtitle="A formally timed sitting -- the clock starts the moment you begin." action={<Link className="back-topics" href={`/exams/topic?topicId=${exam.topicId}`}><ArrowLeft size={13} /> Back to exams</Link>}>
        {error && <p className="page-error" role="alert">{error}</p>}
        <section className="notes-panel quiz-intro-panel">
          <div className="flashcard-summary-row">
            <article className="flashcard-summary-stat">
              <span className="stat-icon violet"><StickyNote size={18} strokeWidth={1.8} /></span>
              <div><small>QUESTIONS</small><strong>{questions.length}</strong></div>
            </article>
            <article className="flashcard-summary-stat">
              <span className="stat-icon coral"><Clock size={18} strokeWidth={1.8} /></span>
              <div><small>TIME LIMIT</small><strong>{Math.round(exam.timeLimitSeconds / 60)} min</strong></div>
            </article>
          </div>
          <p className="modal-hint">The timer is server-enforced -- it keeps running even if you close this tab, and the exam auto-submits when it reaches zero.</p>
          <button className="button button-primary" disabled={starting || !questions.length} onClick={() => void startExam()}>
            {starting ? "Starting…" : <><Play size={13} fill="currentColor" /> Start exam</>}
          </button>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell
      className="exam-session-page"
      title={exam.title}
      subtitle="Answer honestly -- essays and case studies are graded on your reasoning, not exact wording."
      action={remainingSeconds != null ? <span className="quiz-timer exam-timer" role="timer" aria-live="off" aria-label={`${remainingSeconds} seconds remaining`}><Clock size={14} /> {formatSeconds(remainingSeconds)}</span> : undefined}
    >
      {error && <p className="page-error" role="alert">{error}</p>}
      {currentQuestion && (
        <div className="quiz-taking-panel">
          <div className="review-progress">
            Question {currentIndex + 1} of {questions.length} · {QUESTION_TYPE_LABELS[currentQuestion.questionType]}
            <span className="exam-blooms-badge">{BLOOMS_LABELS[currentQuestion.bloomsLevel]}</span>
          </div>
          <article className="review-card quiz-question-card">
            <div className="review-card-question">
              <span className="eyebrow">{currentQuestion.concept}</span>
              <p>{currentQuestion.prompt}</p>
            </div>
            <ExamQuestionRenderer
              question={currentQuestion}
              value={drafts[currentQuestion.id] ?? {}}
              onChange={(value) => setDrafts((current) => ({ ...current, [currentQuestion.id]: value }))}
              disabled={submitting || finishing}
            />
          </article>
          <div className="quiz-taking-actions">
            {currentIndex > 0 && (
              <button type="button" className="button button-secondary" onClick={() => goToIndex(currentIndex - 1)}><ArrowLeft size={13} /> Previous</button>
            )}
            <button type="button" className="button button-primary" disabled={submitting || finishing} onClick={() => void submitAndAdvance()}>
              {submitting || finishing ? "Saving…" : currentIndex + 1 < questions.length ? <>Next question <ArrowRight size={13} /></> : "Finish exam"}
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}

// --------------------------------------------------------------------------
// Results -- score, Bloom's-level breakdown, per-question rubric review.
// --------------------------------------------------------------------------

export function ExamResultsPage() {
  const params = useSearchParams();
  const attemptId = Number(params.get("attemptId"));
  const topicId = Number(params.get("topicId"));
  const hasTopic = Number.isInteger(topicId) && topicId > 0;
  const handleAuthFailure = useAuthFailure();

  const [results, setResults] = useState<AttemptResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!Number.isInteger(attemptId) || attemptId < 1) return;
    api<AttemptResults>(`/exams/attempts/${attemptId}/results`)
      .then(setResults)
      .catch((requestError) => {
        handleAuthFailure(requestError);
        setError(messageFromError(requestError));
      })
      .finally(() => setLoading(false));
  }, [attemptId, handleAuthFailure]);

  return (
    <PageShell
      className="exam-results-page"
      title="Exam results"
      subtitle={results ? `${results.score}% overall` : "Loading your results…"}
      action={hasTopic ? <Link className="back-topics" href={`/exams/topic?topicId=${topicId}`}><ArrowLeft size={13} /> Back to exams</Link> : undefined}
    >
      {error && <p className="page-error" role="alert">{error}</p>}
      {loading ? <div className="empty">Loading your results…</div> : results && (
        <>
          <div className="flashcard-summary-row quiz-results-summary">
            <article className="flashcard-summary-stat">
              <span className="stat-icon violet">%</span>
              <div><small>SCORE</small><strong>{results.score}%</strong></div>
            </article>
            <article className="flashcard-summary-stat">
              <span className="stat-icon mint"><StickyNote size={18} strokeWidth={1.8} /></span>
              <div><small>QUESTIONS</small><strong>{results.answers.length}</strong></div>
            </article>
          </div>

          <section className="notes-panel quiz-concept-panel">
            <div className="section-head"><div><h2>Score by Bloom&apos;s level</h2><p>How deeply, not just how much, you know this material</p></div></div>
            <div className="quiz-concept-bars">
              {(results.scoreBreakdown ?? []).map((level) => (
                <div className="quiz-concept-bar-row" key={level.bloomsLevel}>
                  <span className="quiz-concept-bar-label">{BLOOMS_LABELS[level.bloomsLevel]}</span>
                  <div className="quiz-concept-bar-track">
                    <div className={`quiz-concept-bar-fill${level.accuracy < 70 ? " weak" : ""}`} style={{ width: `${level.accuracy}%` }} />
                  </div>
                  <span className="quiz-concept-bar-value">{Math.round(level.pointsEarned * 10) / 10}/{Math.round(level.pointsPossible * 10) / 10}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="notes-panel quiz-answer-review">
            <div className="section-head"><div><h2>Answer review</h2><p>Every question, with rubric evidence where it applies</p></div></div>
            <div className="notes-list">
              {results.answers.map((answer, index) => (
                <article key={answer.questionId} className={answer.isCorrect === false ? "quiz-answer-incorrect" : answer.isCorrect === true ? "quiz-answer-correct" : "exam-answer-rubric"}>
                  <div>
                    <span>{answer.isCorrect === true ? <Check size={13} strokeWidth={2.5} /> : answer.isCorrect === false ? <XCircle size={13} /> : <ClipboardCheck size={13} />}</span>
                    <div>
                      <h3>{index + 1}. {answer.prompt}</h3>
                      <div className="flashcard-meta">
                        <span className="quiz-difficulty-badge">{answer.concept}</span>
                        <span className="exam-blooms-badge">{BLOOMS_LABELS[answer.bloomsLevel]}</span>
                        {answer.pointsEarned != null && answer.pointsPossible != null && (
                          <small>{Math.round(answer.pointsEarned * 10) / 10}/{Math.round(answer.pointsPossible * 10) / 10} points</small>
                        )}
                        {humanize(answer) && <span className="source-chip document">{answer.sourceType === "note" ? <StickyNote size={11} /> : <FileText size={11} />} {humanize(answer)}</span>}
                      </div>
                      {!answer.criteriaScores && <p>{answer.explanation}</p>}
                      {answer.criteriaScores && (
                        <div className="exam-rubric-breakdown">
                          {answer.criteriaScores.map((criterion) => (
                            <div className="exam-rubric-criterion" key={criterion.criterion}>
                              <div className="exam-rubric-criterion-head">
                                <strong>{criterion.criterion}</strong>
                                <span>{criterion.score}/{criterion.maxPoints}</span>
                              </div>
                              <p className="exam-rubric-evidence">“{criterion.evidence}”</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </PageShell>
  );
}
