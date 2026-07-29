"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Clock,
  FileText,
  ListChecks,
  Play,
  Sparkles,
  StickyNote,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  PageShell,
  StudyDocument,
  XpAward,
  XpToast,
  documentTypeBadge,
  humanizeFilename,
  useAuthFailure,
} from "./BackendPages";
import { api, Note, Pagination, Topic, messageFromError } from "../lib/api";

export type QuestionType = "multiple_choice" | "true_false" | "short_answer" | "fill_blank" | "matching" | "scenario";
export type Difficulty = "easy" | "medium" | "hard" | "mixed";
export type QuizSource = "topic" | "note" | "document" | "concept" | "weak_areas";

export type Quiz = {
  id: number;
  topic_id: number;
  title: string;
  source_type: QuizSource;
  note_id: number | null;
  document_id: number | null;
  concept: string | null;
  difficulty: Difficulty;
  adaptive: boolean;
  timed: boolean;
  time_limit_seconds: number | null;
  created_at: string;
};

type AbilityTraceEntry = { questionId: number; difficulty: number; isCorrect: boolean; ability: number };

export type AttemptSummary = {
  id: number;
  quizId: number;
  status: "in_progress" | "completed";
  immediateFeedback: boolean;
  startedAt: string;
  completedAt: string | null;
  timeSpentSeconds: number | null;
  score: number | null;
  correctCount: number | null;
  totalCount: number | null;
  abilityEstimate: number | null;
  abilityTrace: AbilityTraceEntry[];
};

type QuizListEntry = Quiz & { questionCount: number; latestAttempt: AttemptSummary | null };

type QuestionForTaking = {
  id: number;
  orderIndex: number;
  questionType: QuestionType;
  concept: string;
  prompt: string;
  options: Record<string, unknown> | null;
  difficultyScore: number;
};

type ConceptPerformance = { concept: string; correct: number; total: number; accuracy: number };

type AnswerResult = {
  questionId: number;
  questionType: QuestionType;
  concept: string;
  prompt: string;
  options: Record<string, unknown> | null;
  correctAnswer: Record<string, unknown>;
  explanation: string;
  sourceType: "note" | "document" | null;
  sourceTitle: string | null;
  studentAnswer: Record<string, unknown> | null;
  isCorrect: boolean;
};

type AttemptResults = AttemptSummary & {
  answers: AnswerResult[];
  performanceByConcept: ConceptPerformance[];
  conceptsToReview: string[];
};

type AnswerGrade = {
  questionId: number;
  isCorrect: boolean;
  correctAnswer: Record<string, unknown>;
  explanation: string;
  sourceType: "note" | "document" | null;
  sourceTitle: string | null;
  abilityEstimate: number | null;
  xpEarned: number;
  leveledUp: boolean;
  newLevelName: string | null;
};

type QuestionDraft = { index?: number; value?: boolean; text?: string; pairs?: { left: string; right: string }[] };

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / False",
  short_answer: "Short answer",
  fill_blank: "Fill in the blank",
  matching: "Matching",
  scenario: "Scenario",
};

const ALL_QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];
const DEFAULT_ABILITY = 0.5;

function sourceLabel(entry: { sourceType: "note" | "document" | null; sourceTitle: string | null }): string | null {
  if (!entry.sourceTitle) return null;
  return entry.sourceType === "document" ? humanizeFilename(entry.sourceTitle).label : entry.sourceTitle;
}

function difficultyLabel(score: number): string {
  if (score < 0.34) return "Easier";
  if (score < 0.67) return "Medium";
  return "Harder";
}

function formatSeconds(totalSeconds: number | null): string {
  if (totalSeconds == null) return "—";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

// --------------------------------------------------------------------------
// Quiz list -- one card per topic (mirrors FlashcardsPage's deck grid).
// --------------------------------------------------------------------------

export function QuizzesPage() {
  const handleAuthFailure = useAuthFailure();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [quizCounts, setQuizCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const topicsResult = await api<{ topics: Topic[] }>("/topics");
      setTopics(topicsResult.topics);
      const counts = await Promise.all(
        topicsResult.topics.map((topic) =>
          api<{ quizzes: QuizListEntry[] }>(`/topics/${topic.id}/quizzes`).then((result) => result.quizzes.length).catch(() => 0),
        ),
      );
      const countsMap: Record<number, number> = {};
      topicsResult.topics.forEach((topic, index) => { countsMap[topic.id] = counts[index]; });
      setQuizCounts(countsMap);
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
    <PageShell title="Quizzes" subtitle="Turn your notes and documents into structured, gradeable assessments.">
      {error && <p className="page-error" role="alert">{error}</p>}
      {loading ? <div className="empty">Loading your topics…</div> : (
        <div className="deck-grid">
          {topics.map((topic) => (
            <article className="deck-card" key={topic.id}>
              <span className="topic-icon peach"><ListChecks size={20} strokeWidth={1.8} /></span>
              <h2>{topic.title}</h2>
              <p>{quizCounts[topic.id] ?? 0} quiz{quizCounts[topic.id] === 1 ? "" : "zes"}</p>
              <div className="deck-card-actions">
                <Link className="button button-primary" href={`/quizzes/topic?topicId=${topic.id}`}>Open quizzes</Link>
              </div>
            </article>
          ))}
          {!topics.length && (
            <div className="empty">
              Create a topic and add notes or documents, then generate your first quiz.
              <div><Link className="button button-primary" href="/topics">Create topic</Link></div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

// --------------------------------------------------------------------------
// Quiz list for one topic + the generate modal.
// --------------------------------------------------------------------------

export function QuizTopicPage() {
  const params = useSearchParams();
  const router = useRouter();
  const handleAuthFailure = useAuthFailure();
  const topicId = Number(params.get("topicId"));

  const [topic, setTopic] = useState<Topic | null>(null);
  const [quizzes, setQuizzes] = useState<QuizListEntry[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showGenerate, setShowGenerate] = useState(false);
  const [source, setSource] = useState<QuizSource>("topic");
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(ALL_QUESTION_TYPES);
  const [timed, setTimed] = useState(false);
  const [adaptive, setAdaptive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [genError, setGenError] = useState("");
  const [deletingQuiz, setDeletingQuiz] = useState<QuizListEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(topicId) || topicId < 1) {
      router.replace("/quizzes");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [topicResult, quizzesResult, notesResult, documentsResult] = await Promise.all([
        api<{ topic: Topic }>(`/topics/${topicId}`),
        api<{ quizzes: QuizListEntry[] }>(`/topics/${topicId}/quizzes`),
        api<{ notes: Note[]; pagination: Pagination }>(`/topics/${topicId}/notes/paginated?page=1&limit=100`),
        api<{ documents: StudyDocument[] }>(`/topics/${topicId}/documents`),
      ]);
      setTopic(topicResult.topic);
      setQuizzes(quizzesResult.quizzes);
      setNotes(notesResult.notes);
      setDocuments(documentsResult.documents);
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

  const readyDocuments = documents.filter((document) => document.status === "completed");

  function toggleType(type: QuestionType) {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  async function generateQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTypes.length) {
      setGenError("Pick at least one question type.");
      return;
    }
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setGenError("");
    try {
      const result = await api<{ quiz: Quiz }>(`/topics/${topicId}/quizzes/generate`, {
        method: "POST",
        body: JSON.stringify({
          source,
          count: Number(data.get("count")) || 10,
          difficulty: data.get("difficulty"),
          questionTypes: selectedTypes,
          timed,
          adaptive,
          ...(timed ? { timeLimitSeconds: Number(data.get("timeLimitSeconds")) || 600 } : {}),
          ...(source === "note" ? { noteId: Number(data.get("noteId")) } : {}),
          ...(source === "document" ? { documentId: Number(data.get("documentId")) } : {}),
          ...(source === "concept" ? { concept: data.get("concept") } : {}),
        }),
      });
      setShowGenerate(false);
      router.push(`/quizzes/take?quizId=${result.quiz.id}`);
    } catch (requestError) {
      setGenError(messageFromError(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteQuiz() {
    if (!deletingQuiz) return;
    setDeleting(true);
    try {
      await api<null>(`/quizzes/${deletingQuiz.id}`, { method: "DELETE" });
      setQuizzes((current) => current.filter((quiz) => quiz.id !== deletingQuiz.id));
      setDeletingQuiz(null);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PageShell
      title={topic?.title ?? "Quizzes"}
      subtitle="Generate a new quiz, or pick up an existing one."
      action={<div className="page-actions">
        <button className="button button-primary" onClick={() => setShowGenerate(true)}><Sparkles size={15} /> Generate quiz</button>
        <Link className="back-topics" href="/quizzes"><ArrowLeft size={13} /> All topics</Link>
      </div>}
    >
      {error && <p className="page-error" role="alert">{error}</p>}
      {loading ? <div className="empty">Loading quizzes…</div> : (
        <div className="notes-list quiz-list">
          {quizzes.map((quiz) => (
            <article key={quiz.id}>
              <div>
                <span><ListChecks size={16} strokeWidth={1.8} /></span>
                <div>
                  <h3>{quiz.title}</h3>
                  <div className="flashcard-meta">
                    <span className="quiz-difficulty-badge">{quiz.difficulty}</span>
                    {quiz.adaptive && <span className="quiz-adaptive-badge"><Zap size={11} /> Adaptive</span>}
                    <small>{quiz.questionCount} question{quiz.questionCount === 1 ? "" : "s"}</small>
                    {quiz.timed && <small><Clock size={11} /> {Math.round((quiz.time_limit_seconds ?? 0) / 60)} min</small>}
                    {quiz.latestAttempt && (
                      <small>Last score: {quiz.latestAttempt.score}%</small>
                    )}
                  </div>
                </div>
              </div>
              <div className="note-actions">
                <Link className="note-action edit-action" href={`/quizzes/take?quizId=${quiz.id}`}>
                  <span><Play size={12} fill="currentColor" /></span>{quiz.latestAttempt ? "Retake" : "Take quiz"}
                </Link>
                {quiz.latestAttempt && (
                  <Link className="note-action" href={`/quizzes/results?attemptId=${quiz.latestAttempt.id}&topicId=${topicId}`}>
                    <span><BarChart3 size={13} /></span>Last results
                  </Link>
                )}
                <button className="danger-link" onClick={() => setDeletingQuiz(quiz)}>Delete</button>
              </div>
            </article>
          ))}
          {!quizzes.length && (
            <div className="empty">No quizzes yet. Generate one from your notes, documents, or the whole topic.</div>
          )}
        </div>
      )}

      {showGenerate && (
        <div className="modal-backdrop" onMouseDown={() => setShowGenerate(false)}>
          <form role="dialog" aria-modal="true" className="topic-modal action-modal quiz-generate-modal" onSubmit={generateQuiz} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShowGenerate(false)}><X size={20} /></button>
            <div className="modal-icon edit-icon"><ListChecks size={22} /></div>
            <div className="eyebrow">GENERATE A QUIZ</div>
            <h2>Generate quiz</h2>
            {genError && <p className="form-error">{genError}</p>}

            <div className="generate-source-options">
              <label className="check">
                <input type="radio" checked={source === "topic"} onChange={() => setSource("topic")} /> Whole topic
              </label>
              <label className="check">
                <input type="radio" checked={source === "note"} onChange={() => setSource("note")} disabled={!notes.length} /> A specific note
              </label>
              <label className="check">
                <input type="radio" checked={source === "document"} onChange={() => setSource("document")} disabled={!readyDocuments.length} /> A specific document
              </label>
              <label className="check">
                <input type="radio" checked={source === "concept"} onChange={() => setSource("concept")} /> A particular chapter or concept
              </label>
              <label className="check">
                <input type="radio" checked={source === "weak_areas"} onChange={() => setSource("weak_areas")} /> My previously incorrect questions
              </label>
            </div>
            {source === "note" && (
              <label>Note
                <select name="noteId" required defaultValue="">
                  <option value="" disabled>Select a note</option>
                  {notes.map((note) => <option value={note.id} key={note.id}>{note.title}</option>)}
                </select>
              </label>
            )}
            {source === "document" && (
              <label>Document
                <select name="documentId" required defaultValue="">
                  <option value="" disabled>Select a document</option>
                  {readyDocuments.map((document) => (
                    <option value={document.id} key={document.id}>
                      {humanizeFilename(document.title).label} ({documentTypeBadge(document.content_type)})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {source === "concept" && (
              <label>Chapter or concept<input name="concept" required maxLength={300} placeholder="e.g. Krebs cycle" /></label>
            )}

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

            <div className="quiz-generate-row">
              <label>Number of questions<input type="number" name="count" min={1} max={30} defaultValue={10} /></label>
              <label>Difficulty
                <select name="difficulty" defaultValue="medium">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>
            </div>

            <label className="check">
              <input type="checkbox" checked={timed} onChange={(event) => setTimed(event.target.checked)} /> Timed quiz
            </label>
            {timed && (
              <label>Time limit (seconds)<input type="number" name="timeLimitSeconds" min={30} max={7200} defaultValue={600} /></label>
            )}
            <label className="check">
              <input type="checkbox" checked={adaptive} onChange={(event) => setAdaptive(event.target.checked)} /> Adaptive difficulty
              <span className="modal-hint quiz-adaptive-hint">Questions get harder or easier as you answer, based on how you're doing.</span>
            </label>

            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowGenerate(false)}>Cancel</button>
              <button disabled={saving} className="button button-primary" type="submit">{saving ? "Generating…" : "Generate quiz"}</button>
            </div>
          </form>
        </div>
      )}

      {deletingQuiz && (
        <div className="modal-backdrop" onMouseDown={() => (deleting ? null : setDeletingQuiz(null))}>
          <div role="alertdialog" aria-modal="true" className="topic-modal action-modal delete-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" disabled={deleting} onClick={() => setDeletingQuiz(null)}><X size={20} /></button>
            <div className="modal-icon delete-icon"><Trash2 size={22} /></div>
            <div className="eyebrow">REMOVE THIS QUIZ</div>
            <h2>Delete “{deletingQuiz.title}”?</h2>
            <p>This removes the quiz, its questions, and every past attempt. This can&apos;t be undone.</p>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" disabled={deleting} onClick={() => setDeletingQuiz(null)}>Cancel</button>
              <button type="button" className="button button-danger" disabled={deleting} onClick={() => void confirmDeleteQuiz()}>
                {deleting ? "Deleting…" : "Delete quiz"}
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

function QuestionRenderer({
  question, value, onChange, disabled,
}: {
  question: QuestionForTaking;
  value: QuestionDraft;
  onChange: (value: QuestionDraft) => void;
  disabled: boolean;
}) {
  if (question.questionType === "multiple_choice" || question.questionType === "scenario") {
    const choices = (question.options?.choices as string[] | undefined) ?? [];
    return (
      <div className="quiz-choice-list">
        {choices.map((choice, index) => (
          <button
            type="button"
            key={index}
            className={`quiz-choice${value.index === index ? " selected" : ""}`}
            disabled={disabled}
            onClick={() => onChange({ index })}
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
            type="button"
            key={String(option)}
            className={`quiz-choice${value.value === option ? " selected" : ""}`}
            disabled={disabled}
            onClick={() => onChange({ value: option })}
          >
            {option ? "True" : "False"}
          </button>
        ))}
      </div>
    );
  }

  if (question.questionType === "short_answer" || question.questionType === "fill_blank") {
    return (
      <input
        className="quiz-text-input"
        value={value.text ?? ""}
        onChange={(event) => onChange({ text: event.target.value })}
        disabled={disabled}
        placeholder="Type your answer…"
      />
    );
  }

  // matching
  const left = (question.options?.left as string[] | undefined) ?? [];
  const right = (question.options?.right as string[] | undefined) ?? [];
  const pairs = value.pairs ?? [];
  const rightFor = (leftItem: string) => pairs.find((pair) => pair.left === leftItem)?.right ?? "";

  function setRight(leftItem: string, rightItem: string) {
    const next = left.map((item) => ({ left: item, right: item === leftItem ? rightItem : rightFor(item) }));
    onChange({ pairs: next.filter((pair) => pair.right) });
  }

  return (
    <div className="quiz-matching-list">
      {left.map((leftItem) => (
        <div className="quiz-matching-row" key={leftItem}>
          <span>{leftItem}</span>
          <select value={rightFor(leftItem)} disabled={disabled} onChange={(event) => setRight(leftItem, event.target.value)}>
            <option value="">Select a match…</option>
            {right.map((rightItem) => <option value={rightItem} key={rightItem}>{rightItem}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------
// Take-quiz flow -- intro screen, then one question at a time, with an
// optional countdown timer and immediate-or-deferred feedback.
// --------------------------------------------------------------------------

export function QuizTakePage() {
  const params = useSearchParams();
  const router = useRouter();
  const handleAuthFailure = useAuthFailure();
  const quizId = Number(params.get("quizId"));

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuestionForTaking[]>([]);
  const [attempt, setAttempt] = useState<AttemptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [immediateFeedback, setImmediateFeedback] = useState(true);
  const [starting, setStarting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<number, QuestionDraft>>({});
  const [feedback, setFeedback] = useState<Record<number, AnswerGrade>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [xpToast, setXpToast] = useState<XpAward | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(quizId) || quizId < 1) {
      router.replace("/quizzes");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api<{ quiz: Quiz; questions: QuestionForTaking[] }>(`/quizzes/${quizId}`);
      setQuiz(result.quiz);
      setQuestions(result.questions);
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure, router, quizId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const currentQuestion = questions[currentIndex];

  const finishQuiz = useCallback(async (attemptId: number, topicId: number) => {
    setCompleting(true);
    try {
      await api(`/quizzes/attempts/${attemptId}/complete`, { method: "POST" });
      router.push(`/quizzes/results?attemptId=${attemptId}&topicId=${topicId}`);
    } catch (requestError) {
      setError(messageFromError(requestError));
      setCompleting(false);
    }
  }, [router]);

  useEffect(() => {
    if (!attempt || !quiz?.timed || timeRemaining == null) return;
    if (timeRemaining <= 0) {
      void finishQuiz(attempt.id, quiz.topic_id);
      return;
    }
    const timer = window.setTimeout(() => setTimeRemaining((current) => (current == null ? null : current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [timeRemaining, attempt, quiz, finishQuiz]);

  async function startQuiz() {
    if (!quiz) return;
    setStarting(true);
    setError("");
    try {
      const result = await api<{ attempt: AttemptSummary }>(`/quizzes/${quiz.id}/attempts`, {
        method: "POST",
        body: JSON.stringify({ immediateFeedback }),
      });
      setAttempt(result.attempt);
      if (quiz.timed && quiz.time_limit_seconds) setTimeRemaining(quiz.time_limit_seconds);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setStarting(false);
    }
  }

  function goToIndex(index: number) {
    setCurrentIndex(Math.max(0, Math.min(questions.length - 1, index)));
  }

  async function submitCurrent() {
    if (!attempt || !currentQuestion || submitting) return;
    const draft = drafts[currentQuestion.id] ?? {};
    setSubmitting(true);
    setError("");
    try {
      const grade = await api<AnswerGrade>(`/quizzes/attempts/${attempt.id}/answers`, {
        method: "POST",
        body: JSON.stringify({ questionId: currentQuestion.id, answer: draft }),
      });
      if (quiz?.adaptive && grade.abilityEstimate != null) {
        const ability = grade.abilityEstimate;
        setQuestions((current) => {
          const answeredThrough = current.findIndex((question) => question.id === currentQuestion.id) + 1;
          const prefix = current.slice(0, answeredThrough);
          const tail = current.slice(answeredThrough);
          const sortedTail = [...tail].sort(
            (a, b) => Math.abs(a.difficultyScore - ability) - Math.abs(b.difficultyScore - ability),
          );
          return [...prefix, ...sortedTail];
        });
      }
      if (grade.xpEarned > 0) {
        setXpToast({ xpEarned: grade.xpEarned, leveledUp: grade.leveledUp, newLevelName: grade.newLevelName });
      }
      if (immediateFeedback) {
        setFeedback((current) => ({ ...current, [currentQuestion.id]: grade }));
      } else {
        advance();
      }
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  function advance() {
    if (!attempt || !quiz) return;
    if (currentIndex + 1 < questions.length) {
      goToIndex(currentIndex + 1);
    } else {
      void finishQuiz(attempt.id, quiz.topic_id);
    }
  }

  if (loading) {
    return <PageShell title="Quiz" subtitle="Loading…"><div className="empty">Loading your quiz…</div></PageShell>;
  }
  if (error && !quiz) {
    return <PageShell title="Quiz" subtitle="Something went wrong"><p className="page-error" role="alert">{error}</p></PageShell>;
  }
  if (!quiz) return null;

  if (!attempt) {
    return (
      <PageShell title={quiz.title} subtitle="Review the setup, then start when you're ready." action={<Link className="back-topics" href={`/quizzes/topic?topicId=${quiz.topic_id}`}><ArrowLeft size={13} /> Back to quizzes</Link>}>
        {error && <p className="page-error" role="alert">{error}</p>}
        <section className="notes-panel quiz-intro-panel">
          <div className="flashcard-summary-row">
            <article className="flashcard-summary-stat">
              <span className="stat-icon violet"><ListChecks size={18} strokeWidth={1.8} /></span>
              <div><small>QUESTIONS</small><strong>{questions.length}</strong></div>
            </article>
            <article className="flashcard-summary-stat">
              <span className="stat-icon coral"><BookOpen size={18} strokeWidth={1.8} /></span>
              <div><small>DIFFICULTY</small><strong>{quiz.difficulty}</strong></div>
            </article>
            <article className="flashcard-summary-stat">
              <span className="stat-icon mint"><Clock size={18} strokeWidth={1.8} /></span>
              <div><small>TIME LIMIT</small><strong>{quiz.timed ? `${Math.round((quiz.time_limit_seconds ?? 0) / 60)} min` : "None"}</strong></div>
            </article>
          </div>
          <label className="check quiz-feedback-toggle">
            <input type="checkbox" checked={immediateFeedback} onChange={(event) => setImmediateFeedback(event.target.checked)} />
            Show feedback after each question (otherwise, see it all at the end)
          </label>
          <button className="button button-primary" disabled={starting || !questions.length} onClick={() => void startQuiz()}>
            {starting ? "Starting…" : <><Play size={13} fill="currentColor" /> Start quiz</>}
          </button>
        </section>
      </PageShell>
    );
  }

  const currentFeedback = currentQuestion ? feedback[currentQuestion.id] : undefined;
  const hasAnsweredCurrent = !!currentFeedback;

  return (
    <PageShell
      title={quiz.title}
      subtitle="Rate your certainty, answer honestly, and move on."
      action={quiz.timed && timeRemaining != null ? <span className="quiz-timer"><Clock size={14} /> {formatSeconds(timeRemaining)}</span> : undefined}
    >
      {xpToast && <XpToast award={xpToast} onDismiss={() => setXpToast(null)} />}
      {error && <p className="page-error" role="alert">{error}</p>}
      {currentQuestion && (
        <div className="quiz-taking-panel">
          <div className="review-progress">
            Question {currentIndex + 1} of {questions.length} · {QUESTION_TYPE_LABELS[currentQuestion.questionType]}
            {quiz.adaptive && <span className="quiz-adaptive-badge"><Zap size={11} /> {difficultyLabel(currentQuestion.difficultyScore)}</span>}
          </div>
          <article className="review-card quiz-question-card">
            <div className="review-card-question">
              <span className="eyebrow">{currentQuestion.concept}</span>
              <p>{currentQuestion.prompt}</p>
            </div>
            <QuestionRenderer
              question={currentQuestion}
              value={drafts[currentQuestion.id] ?? {}}
              onChange={(value) => setDrafts((current) => ({ ...current, [currentQuestion.id]: value }))}
              disabled={submitting || (immediateFeedback && hasAnsweredCurrent)}
            />
            {immediateFeedback && currentFeedback && (
              <div className={`quiz-feedback${currentFeedback.isCorrect ? " correct" : " incorrect"}`}>
                <strong>{currentFeedback.isCorrect ? "Correct!" : "Not quite."}</strong>
                <p>{currentFeedback.explanation}</p>
                {sourceLabel(currentFeedback) && (
                  <Link className="source-chip document" href={`/topic?id=${quiz.topic_id}`}>
                    {currentFeedback.sourceType === "note" ? <StickyNote size={12} /> : <FileText size={12} />} {sourceLabel(currentFeedback)}
                  </Link>
                )}
              </div>
            )}
          </article>
          <div className="quiz-taking-actions">
            {currentIndex > 0 && (
              <button type="button" className="button button-secondary" onClick={() => goToIndex(currentIndex - 1)}><ArrowLeft size={13} /> Previous</button>
            )}
            {immediateFeedback && !hasAnsweredCurrent && (
              <button type="button" className="button button-primary" disabled={submitting} onClick={() => void submitCurrent()}>
                {submitting ? "Checking…" : "Submit answer"}
              </button>
            )}
            {immediateFeedback && hasAnsweredCurrent && (
              <button type="button" className="button button-primary" disabled={completing} onClick={advance}>
                {currentIndex + 1 < questions.length ? <>Next question <ArrowRight size={13} /></> : (completing ? "Finishing…" : "Finish quiz")}
              </button>
            )}
            {!immediateFeedback && (
              <button type="button" className="button button-primary" disabled={submitting || completing} onClick={() => void submitCurrent()}>
                {submitting || completing
                  ? "Saving…"
                  : currentIndex + 1 < questions.length ? <>Next question <ArrowRight size={13} /></> : "Finish quiz"}
              </button>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}

// --------------------------------------------------------------------------
// Results -- score, per-concept performance, review recommendations, and a
// full answer-by-answer breakdown with explanations and sources.
// --------------------------------------------------------------------------

function AbilitySparkline({ trace }: { trace: AbilityTraceEntry[] }) {
  const width = 320;
  const height = 72;
  const padding = 6;
  const points = trace.map((entry, index) => {
    const x = trace.length > 1 ? padding + (index / (trace.length - 1)) * (width - padding * 2) : width / 2;
    const y = padding + (1 - entry.ability) * (height - padding * 2);
    return { x, y, entry };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <div className="quiz-ability-sparkline">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Ability estimate over the course of the quiz">
        <path d={path} fill="none" stroke="var(--violet)" strokeWidth={2} />
        {points.map((point) => (
          <circle
            key={point.entry.questionId}
            cx={point.x}
            cy={point.y}
            r={3.5}
            className={point.entry.isCorrect ? "quiz-ability-point correct" : "quiz-ability-point incorrect"}
          />
        ))}
        {last && <circle cx={last.x} cy={last.y} r={5} className="quiz-ability-point-final" />}
      </svg>
      <div className="quiz-ability-sparkline-footer">
        <span>Started at {Math.round(DEFAULT_ABILITY * 100)}%</span>
        <span>Ended at {Math.round((last?.entry.ability ?? DEFAULT_ABILITY) * 100)}%</span>
      </div>
    </div>
  );
}

export function QuizResultsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const handleAuthFailure = useAuthFailure();
  const attemptId = Number(params.get("attemptId"));
  const topicId = Number(params.get("topicId"));
  const hasTopic = Number.isInteger(topicId) && topicId > 0;

  const [results, setResults] = useState<AttemptResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false);
  const [diagnoses, setDiagnoses] = useState<Record<number, { mistakeType: string; diagnosis: string }>>({});
  const [loadingDiagnosisFor, setLoadingDiagnosisFor] = useState<number | null>(null);
  const [drillingFor, setDrillingFor] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(attemptId) || attemptId < 1) {
      router.replace("/quizzes");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setResults(await api<AttemptResults>(`/quizzes/attempts/${attemptId}`));
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, [attemptId, handleAuthFailure, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function generateFollowUp() {
    if (!hasTopic) return;
    setGeneratingFollowUp(true);
    setError("");
    try {
      const result = await api<{ quiz: Quiz }>(`/topics/${topicId}/quizzes/generate`, {
        method: "POST",
        body: JSON.stringify({
          source: "weak_areas", count: 8, difficulty: "medium", questionTypes: ALL_QUESTION_TYPES,
        }),
      });
      router.push(`/quizzes/take?quizId=${result.quiz.id}`);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setGeneratingFollowUp(false);
    }
  }

  async function loadDiagnosis(questionId: number) {
    if (diagnoses[questionId] || loadingDiagnosisFor === questionId) return;
    setLoadingDiagnosisFor(questionId);
    setError("");
    try {
      const result = await api<{ questionId: number; mistakeType: string; diagnosis: string }>(
        `/quizzes/attempts/${attemptId}/questions/${questionId}/diagnosis`,
      );
      setDiagnoses((current) => ({ ...current, [questionId]: result }));
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setLoadingDiagnosisFor(null);
    }
  }

  async function drillQuestion(questionId: number) {
    setDrillingFor(questionId);
    setError("");
    try {
      const result = await api<{ quiz: Quiz }>(
        `/quizzes/attempts/${attemptId}/questions/${questionId}/drill`,
        { method: "POST" },
      );
      router.push(`/quizzes/take?quizId=${result.quiz.id}`);
    } catch (requestError) {
      setError(messageFromError(requestError));
      setDrillingFor(null);
    }
  }

  return (
    <PageShell
      title="Quiz results"
      subtitle={results ? `${results.correctCount} of ${results.totalCount} correct` : "Loading your results…"}
      action={hasTopic ? <Link className="back-topics" href={`/quizzes/topic?topicId=${topicId}`}><ArrowLeft size={13} /> Back to quizzes</Link> : undefined}
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
              <span className="stat-icon mint"><Check size={18} strokeWidth={2.2} /></span>
              <div><small>CORRECT</small><strong>{results.correctCount} / {results.totalCount}</strong></div>
            </article>
            <article className="flashcard-summary-stat">
              <span className="stat-icon coral"><Clock size={18} strokeWidth={1.8} /></span>
              <div><small>TIME SPENT</small><strong>{formatSeconds(results.timeSpentSeconds)}</strong></div>
            </article>
          </div>

          {!!results.abilityTrace.length && (
            <section className="notes-panel quiz-ability-panel">
              <div className="section-head">
                <div>
                  <h2>Adaptive difficulty</h2>
                  <p>How the estimate of your ability moved as you answered</p>
                </div>
              </div>
              <AbilitySparkline trace={results.abilityTrace} />
            </section>
          )}

          <section className="notes-panel quiz-concept-panel">
            <div className="section-head"><div><h2>Performance by concept</h2><p>How you did on each concept tested</p></div></div>
            <div className="quiz-concept-bars">
              {results.performanceByConcept.map((concept) => (
                <div className="quiz-concept-bar-row" key={concept.concept}>
                  <span className="quiz-concept-bar-label">{concept.concept}</span>
                  <div className="quiz-concept-bar-track">
                    <div className={`quiz-concept-bar-fill${concept.accuracy < 70 ? " weak" : ""}`} style={{ width: `${concept.accuracy}%` }} />
                  </div>
                  <span className="quiz-concept-bar-value">{concept.correct}/{concept.total}</span>
                </div>
              ))}
              {!results.performanceByConcept.length && <div className="empty">No concept data for this attempt.</div>}
            </div>
            {!!results.conceptsToReview.length && (
              <p className="modal-hint quiz-review-hint">Recommended to review: {results.conceptsToReview.join(", ")}</p>
            )}
            {!!results.conceptsToReview.length && hasTopic && (
              <button className="button button-primary quiz-follow-up-button" disabled={generatingFollowUp} onClick={() => void generateFollowUp()}>
                {generatingFollowUp ? "Generating…" : <><Sparkles size={14} /> Generate follow-up quiz on weak areas</>}
              </button>
            )}
          </section>

          <section className="notes-panel quiz-answer-review">
            <div className="section-head"><div><h2>Answer review</h2><p>Every question, with explanations and sources</p></div></div>
            <div className="notes-list">
              {results.answers.map((answer, index) => (
                <article key={answer.questionId} className={answer.isCorrect ? "quiz-answer-correct" : "quiz-answer-incorrect"}>
                  <div>
                    <span>{answer.isCorrect ? <Check size={13} strokeWidth={2.5} /> : <XCircle size={13} />}</span>
                    <div>
                      <h3>{index + 1}. {answer.prompt}</h3>
                      <p>{answer.explanation}</p>
                      <div className="flashcard-meta">
                        <span className="quiz-difficulty-badge">{answer.concept}</span>
                        {sourceLabel(answer) && (
                          <Link className="source-chip document" href={hasTopic ? `/topic?id=${topicId}` : "/topics"}>
                            {answer.sourceType === "note" ? <StickyNote size={12} /> : <FileText size={12} />} {sourceLabel(answer)}
                          </Link>
                        )}
                      </div>
                      {!answer.isCorrect && (
                        <div className="quiz-mistake-panel">
                          {diagnoses[answer.questionId] ? (
                            <p className="quiz-mistake-diagnosis">
                              <span className={`quiz-mistake-badge ${diagnoses[answer.questionId].mistakeType}`}>
                                {diagnoses[answer.questionId].mistakeType}
                              </span>
                              {diagnoses[answer.questionId].diagnosis}
                            </p>
                          ) : (
                            <button
                              type="button"
                              className="quiz-mistake-link"
                              disabled={loadingDiagnosisFor === answer.questionId}
                              onClick={() => void loadDiagnosis(answer.questionId)}
                            >
                              {loadingDiagnosisFor === answer.questionId ? "Thinking…" : "Why did I get this wrong?"}
                            </button>
                          )}
                          <button
                            type="button"
                            className="quiz-mistake-link"
                            disabled={drillingFor === answer.questionId}
                            onClick={() => void drillQuestion(answer.questionId)}
                          >
                            {drillingFor === answer.questionId ? "Generating…" : <>Drill this <ArrowRight size={13} /></>}
                          </button>
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
