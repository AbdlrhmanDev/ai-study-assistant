"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  PageShell,
  StudyDocument,
  XpAward,
  XpToast,
  documentTypeBadge,
  humanizeFilename,
  useAuthFailure,
} from "./BackendPages";
import { api, downloadFile, Note, Pagination, Topic, messageFromError } from "../lib/api";

export type FlashcardRating = "easy" | "medium" | "hard" | "forgot";
export type FlashcardOrigin = "manual" | "ai";
export type FlashcardStatus = "active" | "archived";

export type Flashcard = {
  id: number;
  topic_id: number;
  note_id: number | null;
  document_id: number | null;
  question: string;
  answer: string;
  explanation: string | null;
  origin: FlashcardOrigin;
  status: FlashcardStatus;
  repetitions: number;
  ease_factor: number;
  interval_days: number;
  due_at: string;
  last_reviewed_at: string | null;
  last_rating: FlashcardRating | null;
  created_at: string;
  updated_at: string;
  sourceType: "note" | "document" | null;
  sourceTitle: string | null;
};

type DeckStats = {
  topic_id: number;
  total: number;
  due_today: number;
  difficult: number;
  retention_rate: number | null;
  next_review_at: string | null;
};

export type DashboardFlashcardStats = {
  due_today: number;
  difficult: number;
  retention_rate: number | null;
  next_review_at: string | null;
};

const RATING_OPTIONS: { value: FlashcardRating; label: string; className: string }[] = [
  { value: "forgot", label: "I forgot", className: "rating-forgot" },
  { value: "hard", label: "Hard", className: "rating-hard" },
  { value: "medium", label: "Medium", className: "rating-medium" },
  { value: "easy", label: "Easy", className: "rating-easy" },
];

export function formatRelativeDue(dueAt: string | null): string {
  if (!dueAt) return "No cards yet";
  const diffDays = Math.round((new Date(dueAt).getTime() - Date.now()) / 86400000);
  if (diffDays <= 0) return "Due now";
  if (diffDays === 1) return "Tomorrow";
  return `In ${diffDays} days`;
}

function sourceLabel(card: Pick<Flashcard, "sourceType" | "sourceTitle">): string | null {
  if (!card.sourceTitle) return null;
  return card.sourceType === "document" ? humanizeFilename(card.sourceTitle).label : card.sourceTitle;
}

// --------------------------------------------------------------------------
// Deck list -- one card per topic, with headline stats and a dashboard-style
// summary row across every deck.
// --------------------------------------------------------------------------

export function FlashcardsPage() {
  const handleAuthFailure = useAuthFailure();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [deckStats, setDeckStats] = useState<Record<number, DeckStats>>({});
  const [summary, setSummary] = useState<DashboardFlashcardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const topicsResult = await api<{ topics: Topic[] }>("/topics");
      setTopics(topicsResult.topics);
      const [summaryResult, statsResults] = await Promise.all([
        api<DashboardFlashcardStats>("/flashcards/stats-summary"),
        Promise.all(
          topicsResult.topics.map((topic) =>
            api<DeckStats>(`/topics/${topic.id}/flashcards/stats`).catch(() => null),
          ),
        ),
      ]);
      setSummary(summaryResult);
      const statsMap: Record<number, DeckStats> = {};
      topicsResult.topics.forEach((topic, index) => {
        const stats = statsResults[index];
        if (stats) statsMap[topic.id] = stats;
      });
      setDeckStats(statsMap);
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
    <PageShell
      title="Flashcards"
      subtitle="Spaced-repetition review, generated from your notes and documents or written by hand."
    >
      {error && <p className="page-error" role="alert">{error}</p>}
      {summary && (
        <div className="flashcard-summary-row">
          <article className="flashcard-summary-stat">
            <span className="stat-icon violet">▤</span>
            <div><small>DUE TODAY</small><strong>{summary.due_today}</strong></div>
          </article>
          <article className="flashcard-summary-stat">
            <span className="stat-icon coral">!</span>
            <div><small>NEED PRACTICE</small><strong>{summary.difficult}</strong></div>
          </article>
          <article className="flashcard-summary-stat">
            <span className="stat-icon mint">%</span>
            <div><small>RETENTION</small><strong>{summary.retention_rate != null ? `${summary.retention_rate}%` : "—"}</strong></div>
          </article>
          <article className="flashcard-summary-stat">
            <span className="stat-icon violet">◷</span>
            <div><small>NEXT REVIEW</small><strong>{formatRelativeDue(summary.next_review_at)}</strong></div>
          </article>
        </div>
      )}
      {loading ? <div className="empty">Loading your decks…</div> : (
        <div className="deck-grid">
          {topics.map((topic) => {
            const stats = deckStats[topic.id];
            return (
              <article className="deck-card" key={topic.id}>
                <span className="topic-icon purple">◇</span>
                <h2>{topic.title}</h2>
                <p>{stats ? `${stats.total} card${stats.total === 1 ? "" : "s"}` : "Loading…"}</p>
                {stats && (
                  <div className="deck-card-stats">
                    <span className={`deck-stat-pill${stats.due_today ? " due" : ""}`}>{stats.due_today} due</span>
                    {stats.difficult > 0 && <span className="deck-stat-pill difficult">{stats.difficult} tough</span>}
                    {stats.retention_rate != null && <span className="deck-stat-pill">{stats.retention_rate}% retention</span>}
                  </div>
                )}
                <div className="deck-card-actions">
                  <Link className="button button-secondary" href={`/flashcards/deck?topicId=${topic.id}`}>Manage</Link>
                  <Link
                    className={`button ${stats?.due_today ? "button-primary" : "button-secondary"}`}
                    href={`/flashcards/review?topicId=${topic.id}`}
                  >
                    Review{stats?.due_today ? ` (${stats.due_today})` : ""}
                  </Link>
                </div>
              </article>
            );
          })}
          {!topics.length && (
            <div className="empty">
              Create a topic and add notes or documents, then generate your first flashcards.
              <div><Link className="button button-primary" href="/topics">Create topic</Link></div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

// --------------------------------------------------------------------------
// Deck management -- card list (active/archived), manual add, AI generation,
// edit, archive, regenerate, delete.
// --------------------------------------------------------------------------

export function FlashcardsDeckPage() {
  const params = useSearchParams();
  const router = useRouter();
  const handleAuthFailure = useAuthFailure();
  const topicId = Number(params.get("topicId"));

  const [topic, setTopic] = useState<Topic | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [stats, setStats] = useState<DeckStats | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [statusFilter, setStatusFilter] = useState<FlashcardStatus>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateSource, setGenerateSource] = useState<"topic" | "note" | "document">("topic");
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [deletingCard, setDeletingCard] = useState<Flashcard | null>(null);
  const [savingAction, setSavingAction] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busyCardId, setBusyCardId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(topicId) || topicId < 1) {
      router.replace("/flashcards");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [topicResult, cardsResult, statsResult, notesResult, documentsResult] = await Promise.all([
        api<{ topic: Topic }>(`/topics/${topicId}`),
        api<{ flashcards: Flashcard[] }>(`/topics/${topicId}/flashcards?status=${statusFilter}`),
        api<DeckStats>(`/topics/${topicId}/flashcards/stats`),
        api<{ notes: Note[]; pagination: Pagination }>(`/topics/${topicId}/notes/paginated?page=1&limit=100`),
        api<{ documents: StudyDocument[] }>(`/topics/${topicId}/documents`),
      ]);
      setTopic(topicResult.topic);
      setCards(cardsResult.flashcards);
      setStats(statsResult);
      setNotes(notesResult.notes);
      setDocuments(documentsResult.documents);
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure, router, topicId, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const readyDocuments = documents.filter((document) => document.status === "completed");

  async function refreshStats() {
    try {
      setStats(await api<DeckStats>(`/topics/${topicId}/flashcards/stats`));
    } catch {
      // stats are supplementary -- the card list itself is already up to date
    }
  }

  async function createCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const [sourceType, sourceId] = String(data.get("sourceRef") || "").split(":");
    setSavingAction(true);
    setActionError("");
    try {
      const result = await api<{ flashcard: Flashcard }>(`/topics/${topicId}/flashcards`, {
        method: "POST",
        body: JSON.stringify({
          question: data.get("question"),
          answer: data.get("answer"),
          explanation: data.get("explanation") || null,
          ...(sourceType === "note" ? { noteId: Number(sourceId) } : {}),
          ...(sourceType === "document" ? { documentId: Number(sourceId) } : {}),
        }),
      });
      setCards((current) => [result.flashcard, ...current]);
      void refreshStats();
      setShowAdd(false);
    } catch (requestError) {
      setActionError(messageFromError(requestError));
    } finally {
      setSavingAction(false);
    }
  }

  async function generateCards(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSavingAction(true);
    setActionError("");
    try {
      const result = await api<{ flashcards: Flashcard[] }>(`/topics/${topicId}/flashcards/generate`, {
        method: "POST",
        body: JSON.stringify({
          source: generateSource,
          count: Number(data.get("count")) || 8,
          ...(generateSource === "note" ? { noteId: Number(data.get("noteId")) } : {}),
          ...(generateSource === "document" ? { documentId: Number(data.get("documentId")) } : {}),
        }),
      });
      setCards((current) => [...result.flashcards, ...current]);
      void refreshStats();
      setShowGenerate(false);
      setGenerateSource("topic");
    } catch (requestError) {
      setActionError(messageFromError(requestError));
    } finally {
      setSavingAction(false);
    }
  }

  async function updateCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCard) return;
    const data = new FormData(event.currentTarget);
    setSavingAction(true);
    setActionError("");
    try {
      const result = await api<{ flashcard: Flashcard }>(`/flashcards/${editingCard.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          question: data.get("question"),
          answer: data.get("answer"),
          explanation: data.get("explanation") || null,
        }),
      });
      setCards((current) => current.map((card) => (card.id === result.flashcard.id ? result.flashcard : card)));
      setEditingCard(null);
    } catch (requestError) {
      setActionError(messageFromError(requestError));
    } finally {
      setSavingAction(false);
    }
  }

  async function toggleArchive(card: Flashcard) {
    setBusyCardId(card.id);
    setError("");
    try {
      await api(`/flashcards/${card.id}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ archived: card.status !== "archived" }),
      });
      setCards((current) => current.filter((item) => item.id !== card.id));
      void refreshStats();
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setBusyCardId(null);
    }
  }

  async function regenerateCard(card: Flashcard) {
    setBusyCardId(card.id);
    setError("");
    try {
      const result = await api<{ flashcard: Flashcard }>(`/flashcards/${card.id}/regenerate`, {
        method: "POST",
      });
      setCards((current) => current.map((item) => (item.id === result.flashcard.id ? result.flashcard : item)));
      void refreshStats();
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setBusyCardId(null);
    }
  }

  async function confirmDelete() {
    if (!deletingCard) return;
    setSavingAction(true);
    setActionError("");
    try {
      await api<null>(`/flashcards/${deletingCard.id}`, { method: "DELETE" });
      setCards((current) => current.filter((item) => item.id !== deletingCard.id));
      void refreshStats();
      setDeletingCard(null);
    } catch (requestError) {
      setActionError(messageFromError(requestError));
    } finally {
      setSavingAction(false);
    }
  }

  async function exportFlashcards() {
    try {
      await downloadFile(`/topics/${topicId}/flashcards/export?format=csv`, "flashcards.csv");
    } catch (requestError) {
      setActionError(messageFromError(requestError));
    }
  }

  return (
    <PageShell
      title={topic?.title ?? "Flashcards"}
      subtitle="Manage this deck's cards, or start a review session."
      action={<div className="page-actions">
        <button className="button button-secondary" onClick={() => void exportFlashcards()}>⇩ Export CSV</button>
        <Link className="button button-primary" href={`/flashcards/review?topicId=${topicId}`}>▶ Start review</Link>
        <Link className="back-topics" href="/flashcards">← All decks</Link>
      </div>}
    >
      {error && <p className="page-error" role="alert">{error}</p>}
      {stats && (
        <div className="flashcard-summary-row">
          <article className="flashcard-summary-stat">
            <span className="stat-icon violet">▤</span>
            <div><small>TOTAL CARDS</small><strong>{stats.total}</strong></div>
          </article>
          <article className="flashcard-summary-stat">
            <span className="stat-icon coral">◷</span>
            <div><small>DUE TODAY</small><strong>{stats.due_today}</strong></div>
          </article>
          <article className="flashcard-summary-stat">
            <span className="stat-icon coral">!</span>
            <div><small>NEED PRACTICE</small><strong>{stats.difficult}</strong></div>
          </article>
          <article className="flashcard-summary-stat">
            <span className="stat-icon mint">%</span>
            <div><small>RETENTION</small><strong>{stats.retention_rate != null ? `${stats.retention_rate}%` : "—"}</strong></div>
          </article>
        </div>
      )}
      <section className="notes-panel flashcards-panel">
        <div className="section-head">
          <div className="filter-pills">
            <button className={statusFilter === "active" ? "active" : ""} onClick={() => setStatusFilter("active")}>Active</button>
            <button className={statusFilter === "archived" ? "active" : ""} onClick={() => setStatusFilter("archived")}>Archived</button>
          </div>
          <div className="page-actions">
            <button className="add-note-button" onClick={() => setShowAdd(true)}>＋ Add card</button>
            <button className="add-note-button" onClick={() => setShowGenerate(true)}>✦ Generate with AI</button>
          </div>
        </div>
        {loading ? <div className="empty">Loading cards…</div> : (
          <div className="notes-list flashcard-list">
            {cards.map((card) => (
              <article key={card.id}>
                <div>
                  <span>{card.origin === "ai" ? "✦" : "▤"}</span>
                  <div>
                    <h3>{card.question}</h3>
                    <p>{card.answer}</p>
                    <div className="flashcard-meta">
                      <span className={`flashcard-origin-badge ${card.origin}`}>
                        {card.origin === "ai" ? "AI generated" : "Manual"}
                      </span>
                      {sourceLabel(card) && (
                        <Link className="source-chip document" href={`/topic?id=${topicId}`}>
                          {card.sourceType === "note" ? "▤" : "📄"} {sourceLabel(card)}
                        </Link>
                      )}
                      {card.last_rating && <small>Last: {card.last_rating}</small>}
                    </div>
                  </div>
                </div>
                <div className="note-actions">
                  <button className="note-action edit-action" onClick={() => setEditingCard(card)}><span>✎</span>Edit</button>
                  {card.sourceType && (
                    <button
                      className="note-action"
                      disabled={busyCardId === card.id}
                      onClick={() => void regenerateCard(card)}
                    >
                      <span>↻</span>{busyCardId === card.id ? "…" : "Regenerate"}
                    </button>
                  )}
                  <button
                    className="note-action move-action"
                    disabled={busyCardId === card.id}
                    onClick={() => void toggleArchive(card)}
                  >
                    <span>{card.status === "archived" ? "↥" : "▾"}</span>
                    {card.status === "archived" ? "Restore" : "Archive"}
                  </button>
                  <button className="danger-link" onClick={() => setDeletingCard(card)}>Delete</button>
                </div>
              </article>
            ))}
            {!cards.length && (
              <div className="empty">
                {statusFilter === "active"
                  ? "No flashcards yet. Add one manually or generate a set with AI."
                  : "No archived cards."}
              </div>
            )}
          </div>
        )}
      </section>

      {showAdd && (
        <div className="modal-backdrop" onMouseDown={() => setShowAdd(false)}>
          <form role="dialog" aria-modal="true" className="topic-modal note-modal action-modal" onSubmit={createCard} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShowAdd(false)}>×</button>
            <div className="modal-icon edit-icon">＋</div>
            <div className="eyebrow">ADD A FLASHCARD</div>
            <h2>New flashcard</h2>
            {actionError && <p className="form-error">{actionError}</p>}
            <label>Question<textarea name="question" required rows={2} maxLength={2000} autoFocus /></label>
            <label>Answer<textarea name="answer" required rows={2} maxLength={4000} /></label>
            <label>Explanation (optional)<textarea name="explanation" rows={2} maxLength={4000} /></label>
            <label>Link to a source (optional)
              <select name="sourceRef" defaultValue="">
                <option value="">No source</option>
                {notes.length > 0 && (
                  <optgroup label="Notes">
                    {notes.map((note) => <option value={`note:${note.id}`} key={`note-${note.id}`}>{note.title}</option>)}
                  </optgroup>
                )}
                {documents.length > 0 && (
                  <optgroup label="Documents">
                    {documents.map((document) => (
                      <option value={`document:${document.id}`} key={`document-${document.id}`}>
                        {humanizeFilename(document.title).label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button disabled={savingAction} className="button button-primary" type="submit">{savingAction ? "Saving…" : "Add card"}</button>
            </div>
          </form>
        </div>
      )}

      {showGenerate && (
        <div className="modal-backdrop" onMouseDown={() => setShowGenerate(false)}>
          <form role="dialog" aria-modal="true" className="topic-modal action-modal" onSubmit={generateCards} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShowGenerate(false)}>×</button>
            <div className="modal-icon edit-icon">✦</div>
            <div className="eyebrow">GENERATE WITH AI</div>
            <h2>Generate flashcards</h2>
            <p>The tutor will read the selected material and draft question/answer/explanation cards.</p>
            {actionError && <p className="form-error">{actionError}</p>}
            <div className="generate-source-options">
              <label className="check">
                <input type="radio" name="sourceScope" checked={generateSource === "topic"} onChange={() => setGenerateSource("topic")} />
                Whole topic (all notes &amp; documents)
              </label>
              <label className="check">
                <input type="radio" name="sourceScope" checked={generateSource === "note"} onChange={() => setGenerateSource("note")} disabled={!notes.length} />
                A specific note
              </label>
              <label className="check">
                <input type="radio" name="sourceScope" checked={generateSource === "document"} onChange={() => setGenerateSource("document")} disabled={!readyDocuments.length} />
                A specific document
              </label>
            </div>
            {generateSource === "note" && (
              <label>Note
                <select name="noteId" required defaultValue="">
                  <option value="" disabled>Select a note</option>
                  {notes.map((note) => <option value={note.id} key={note.id}>{note.title}</option>)}
                </select>
              </label>
            )}
            {generateSource === "document" && (
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
            <label>Number of cards<input type="number" name="count" min={1} max={20} defaultValue={8} /></label>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowGenerate(false)}>Cancel</button>
              <button disabled={savingAction} className="button button-primary" type="submit">{savingAction ? "Generating…" : "Generate flashcards"}</button>
            </div>
          </form>
        </div>
      )}

      {editingCard && (
        <div className="modal-backdrop" onMouseDown={() => setEditingCard(null)}>
          <form role="dialog" aria-modal="true" className="topic-modal note-modal action-modal" onSubmit={updateCard} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setEditingCard(null)}>×</button>
            <div className="modal-icon edit-icon">✎</div>
            <div className="eyebrow">REFINE THIS CARD</div>
            <h2>Edit flashcard</h2>
            {actionError && <p className="form-error">{actionError}</p>}
            <label>Question<textarea name="question" required rows={2} maxLength={2000} defaultValue={editingCard.question} autoFocus /></label>
            <label>Answer<textarea name="answer" required rows={2} maxLength={4000} defaultValue={editingCard.answer} /></label>
            <label>Explanation (optional)<textarea name="explanation" rows={2} maxLength={4000} defaultValue={editingCard.explanation ?? ""} /></label>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setEditingCard(null)}>Cancel</button>
              <button disabled={savingAction} className="button button-primary" type="submit">{savingAction ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </div>
      )}

      {deletingCard && (
        <div className="modal-backdrop" onMouseDown={() => (savingAction ? null : setDeletingCard(null))}>
          <div role="alertdialog" aria-modal="true" className="topic-modal action-modal delete-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" disabled={savingAction} onClick={() => setDeletingCard(null)}>×</button>
            <div className="modal-icon delete-icon">🗑</div>
            <div className="eyebrow">REMOVE THIS CARD</div>
            <h2>Delete this flashcard?</h2>
            <p>“{deletingCard.question}” will be removed along with its review history. This can&apos;t be undone.</p>
            {actionError && <p className="form-error">{actionError}</p>}
            <div className="modal-actions">
              <button type="button" className="button button-secondary" disabled={savingAction} onClick={() => setDeletingCard(null)}>Cancel</button>
              <button type="button" className="button button-danger" disabled={savingAction} onClick={() => void confirmDelete()}>
                {savingAction ? "Deleting…" : "Delete flashcard"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

// --------------------------------------------------------------------------
// Review session -- flip-card flow through today's due queue.
// --------------------------------------------------------------------------

export function FlashcardsReviewPage() {
  const params = useSearchParams();
  const router = useRouter();
  const handleAuthFailure = useAuthFailure();
  const topicId = Number(params.get("topicId"));

  const [topic, setTopic] = useState<Topic | null>(null);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [xpToast, setXpToast] = useState<XpAward | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(topicId) || topicId < 1) {
      router.replace("/flashcards");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [topicResult, dueResult] = await Promise.all([
        api<{ topic: Topic }>(`/topics/${topicId}`),
        api<{ flashcards: Flashcard[] }>(`/topics/${topicId}/flashcards/due?limit=100`),
      ]);
      setTopic(topicResult.topic);
      setQueue(dueResult.flashcards);
      setIndex(0);
      setRevealed(false);
      setReviewedCount(0);
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

  const currentCard = queue[index];

  async function rate(rating: FlashcardRating) {
    if (!currentCard || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await api<XpAward>(`/flashcards/${currentCard.id}/review`, {
        method: "POST",
        body: JSON.stringify({ rating }),
      });
      if (result.xpEarned > 0) {
        setXpToast({ xpEarned: result.xpEarned, leveledUp: result.leveledUp, newLevelName: result.newLevelName });
      }
      setReviewedCount((count) => count + 1);
      setRevealed(false);
      setIndex((current) => current + 1);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      title={topic ? `Review: ${topic.title}` : "Review"}
      subtitle="Rate each card honestly — it decides when you'll see it again."
      action={<Link className="back-topics" href="/flashcards">← All decks</Link>}
    >
      {xpToast && <XpToast award={xpToast} onDismiss={() => setXpToast(null)} />}
      {error && <p className="page-error" role="alert">{error}</p>}
      {loading ? <div className="empty">Loading your due cards…</div> : !queue.length ? (
        <div className="empty">
          Nothing due right now. Great work!
          <div><Link className="button button-primary" href={`/flashcards/deck?topicId=${topicId}`}>Back to deck</Link></div>
        </div>
      ) : currentCard ? (
        <div className="review-session">
          <div className="review-progress">Card {index + 1} of {queue.length}</div>
          <article className="review-card">
            <div className="review-card-question">
              <span className="eyebrow">QUESTION</span>
              <p>{currentCard.question}</p>
            </div>
            {revealed && (
              <div className="review-card-answer">
                <span className="eyebrow">ANSWER</span>
                <p>{currentCard.answer}</p>
                {currentCard.explanation && <p className="review-card-explanation">{currentCard.explanation}</p>}
                {sourceLabel(currentCard) && (
                  <Link className="source-chip document" href={`/topic?id=${topicId}`}>
                    {currentCard.sourceType === "note" ? "▤" : "📄"} {sourceLabel(currentCard)}
                  </Link>
                )}
              </div>
            )}
          </article>
          {!revealed ? (
            <button className="button button-primary review-reveal" type="button" onClick={() => setRevealed(true)}>Show answer</button>
          ) : (
            <div className="review-ratings">
              {RATING_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`review-rating-button ${option.className}`}
                  disabled={submitting}
                  onClick={() => void rate(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="empty">
          Session complete — you reviewed {reviewedCount} card{reviewedCount === 1 ? "" : "s"}.
          <div><Link className="button button-primary" href={`/flashcards/deck?topicId=${topicId}`}>Back to deck</Link></div>
        </div>
      )}
    </PageShell>
  );
}
