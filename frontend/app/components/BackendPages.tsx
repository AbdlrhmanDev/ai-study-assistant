"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import AppSidebar from "./AppSidebar";
import {
  api,
  ApiError,
  messageFromError,
  Note,
  Pagination,
  Topic,
  User,
} from "../lib/api";

export function PageShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <main className="dashboard-shell">
      <AppSidebar />
      <section className="dashboard-main">
        <header className="dash-top">
          <div className="page-breadcrumb"><span>Studia</span> / {title}</div>
        </header>
        <div className="subpage-content">
          <div className="subpage-title">
            <div><div className="section-kicker">YOUR LEARNING SPACE</div><h1>{title}</h1><p>{subtitle}</p></div>
            {action}
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

export type XpAward = { xpEarned: number; leveledUp: boolean; newLevelName: string | null };

export function XpToast({ award, onDismiss }: { award: XpAward; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 3400);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  if (award.xpEarned <= 0) return null;

  return (
    <div className={`xp-toast${award.leveledUp ? " level-up" : ""}`} role="status">
      {award.leveledUp ? (
        <>
          <span className="xp-toast-icon">🎉</span>
          <div><strong>Level up!</strong><p>Now {award.newLevelName}</p></div>
        </>
      ) : (
        <>
          <span className="xp-toast-icon">✦</span>
          <div><strong>+{award.xpEarned} XP</strong></div>
        </>
      )}
    </div>
  );
}

export function useAuthFailure() {
  const router = useRouter();
  return useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      router.replace("/login");
    }
  }, [router]);
}

type Source = {
  sourceType: "note" | "document";
  sourceId: number;
  sourceTitle: string;
  excerpt: string;
  score: number;
  similarity: number | null;
};

type AiMessage = {
  id: number;
  topic_id: number;
  role: "user" | "assistant";
  message: string;
  mode?: "tutor" | "sparring";
  created_at: string;
  sources?: Source[];
  usedMemory?: boolean;
};

type SparVerdict = "open" | "continue" | "concede";

type AgentMessage = {
  id: number;
  role: "user" | "assistant";
  message: string;
  sessionId?: number;
  agentLabel?: string;
};

type AgentTraceStep = {
  stepIndex: number;
  agentType: string;
  agentLabel: string;
  toolUsed: string | null;
  input: string;
  output: string;
  createdAt: string;
};

export type StudentMemory = {
  id: number;
  memoryType: "strength" | "weakness" | "preference" | "fact";
  key: string;
  value: string;
  confidence: number;
  reinforcementCount: number;
  lastReinforcedAt: string;
};

export type TopicLevel = {
  levelName: string;
  totalXp: number;
  nextLevelName: string | null;
  xpIntoLevel: number;
  xpForNextLevel: number | null;
};

export type WeakConcept = {
  conceptId: number;
  conceptName: string;
  masteryScore: number;
  rawMasteryScore: number;
  confidenceScore: number;
  eventCount: number;
  lastAssessedAt: string | null;
};

export type DocumentStatus = "pending" | "processing" | "completed" | "failed";

export type StudyDocument = {
  id: number;
  topic_id: number;
  title: string;
  original_filename: string;
  content_type: string;
  status: DocumentStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: "Pending",
  processing: "Processing…",
  completed: "Ready",
  failed: "Failed",
};

export function documentTypeBadge(contentType: string): string {
  if (contentType === "application/pdf") return "PDF";
  if (contentType === "text/plain") return "TXT";
  return "FILE";
}

type StudyActivity = {
  id: number;
  topic_id: number | null;
  topic_title: string | null;
  activity_type:
    | "topic_created"
    | "topic_updated"
    | "note_created"
    | "note_updated"
    | "note_moved"
    | "ai_chat";
  description: string;
  created_at: string;
};

type StudyStats = {
  total_activities: number;
  activities_this_week: number;
  ai_interactions: number;
  topics_studied: number;
};

const INLINE_FILENAME_PATTERN = /["“]?\b([\w][\w.\-]*\.(?:pdf|txt))\b["”]?/gi;

export function humanizeFilename(filename: string): { label: string; ext: string } {
  const dot = filename.lastIndexOf(".");
  const base = dot > -1 ? filename.slice(0, dot) : filename;
  const ext = dot > -1 ? filename.slice(dot + 1).toUpperCase() : "";
  return { label: base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(), ext };
}

function InlineFileChip({ filename }: { filename: string }) {
  const { label, ext } = humanizeFilename(filename);
  return (
    <span className="inline-doc-chip">
      <span aria-hidden="true" className="inline-doc-chip-icon">📄</span>
      {label}
      {ext && <b>{ext}</b>}
    </span>
  );
}

function renderFilenameChips(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let count = 0;
  INLINE_FILENAME_PATTERN.lastIndex = 0;
  while ((match = INLINE_FILENAME_PATTERN.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    nodes.push(<InlineFileChip filename={match[1]} key={`${keyPrefix}-file-${count++}`} />);
    lastIndex = INLINE_FILENAME_PATTERN.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length ? nodes : [text];
}

function renderInlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).flatMap((part, index): ReactNode[] =>
    part.startsWith("**") && part.endsWith("**")
      ? [<strong key={index}>{part.slice(2, -2)}</strong>]
      : renderFilenameChips(part, `${index}`),
  );
}

function AiMessageContent({ text }: { text: string }) {
  const formatted = text
    .replace(/\s+(?=\d+\.\s+\*\*)/g, "\n")
    .replace(/\s+(?=[-*]\s+\*\*)/g, "\n");
  const lines = formatted.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  return (
    <div className="ai-message-content">
      {lines.map((line, index) => {
        const numbered = line.match(/^(\d+)\.\s*(.*)$/);
        const bullet = line.match(/^[-*]\s+(.*)$/);

        if (numbered) {
          return (
            <div className="ai-message-point" key={`${index}-${line}`}>
              <span>{numbered[1]}</span>
              <p>{renderInlineMarkdown(numbered[2])}</p>
            </div>
          );
        }

        if (bullet) {
          return (
            <div className="ai-message-bullet" key={`${index}-${line}`}>
              <span>•</span>
              <p>{renderInlineMarkdown(bullet[1])}</p>
            </div>
          );
        }

        return <p key={`${index}-${line}`}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

export function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const handleAuthFailure = useAuthFailure();

  const loadTopics = useCallback(async () => {
    try {
      const result = await api<{ topics: Topic[] }>("/topics");
      setTopics(result.topics);
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTopics(), 0);
    return () => window.clearTimeout(timer);
  }, [loadTopics]);

  async function createTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
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
    } finally {
      setSaving(false);
    }
  }

  async function editTopic(topic: Topic) {
    const title = window.prompt("Topic title", topic.title)?.trim();
    if (!title || title === topic.title) return;

    try {
      const result = await api<{ topic: Topic }>(`/topics/${topic.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      setTopics((current) => current.map((item) => item.id === topic.id ? result.topic : item));
    } catch (requestError) {
      setError(messageFromError(requestError));
    }
  }

  async function deleteTopic(topic: Topic) {
    if (!window.confirm(`Delete “${topic.title}” and all of its notes?`)) return;

    try {
      await api<null>(`/topics/${topic.id}`, { method: "DELETE" });
      setTopics((current) => current.filter((item) => item.id !== topic.id));
    } catch (requestError) {
      setError(messageFromError(requestError));
    }
  }

  const visible = topics.filter((topic) =>
    topic.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <PageShell
      title="My topics"
      subtitle="Everything you are learning, organized in one calm place."
      action={<button className="button button-primary" onClick={() => setShowModal(true)}>＋ New topic</button>}
    >
      {error && <p className="page-error" role="alert">{error}</p>}
      <div className="topics-toolbar">
        <div className="search wide"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all topics..." /></div>
      </div>
      {loading ? <div className="empty">Loading your topics…</div> : (
        <div className="all-topics-grid">
          {visible.map((topic) => (
            <article className="full-topic-card" key={topic.id}>
              <div className="topic-card-top">
                <span className="topic-icon purple">◇</span>
                <div className="card-actions">
                  <button onClick={() => void editTopic(topic)}>Edit</button>
                  <button className="danger-link" onClick={() => void deleteTopic(topic)}>Delete</button>
                </div>
              </div>
              <span className="topic-category">Study topic</span>
              <h2>{topic.title}</h2>
              <p>{topic.description || "No description yet."}</p>
              <div className="topic-meta"><span>Updated {new Date(topic.updated_at).toLocaleDateString()}</span></div>
              <Link className="open-topic" href={`/topic?id=${topic.id}`}>Open topic <span>→</span></Link>
            </article>
          ))}
          {!visible.length && <div className="empty">No topics found.</div>}
        </div>
      )}
      {showModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowModal(false)}>
          <form className="topic-modal" onSubmit={createTopic} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <div className="eyebrow"><span>✦</span> NEW LEARNING SPACE</div>
            <h2>Create a study topic</h2>
            <label>Topic name<input name="title" required maxLength={200} autoFocus /></label>
            <label>Description<textarea name="description" maxLength={1000} rows={4} /></label>
            <button disabled={saving} className="button button-primary" type="submit">{saving ? "Creating…" : "Create topic"}</button>
          </form>
        </div>
      )}
    </PageShell>
  );
}

export function TopicDetailPage() {
  const params = useSearchParams();
  const topicId = Number(params.get("id"));
  const router = useRouter();
  const handleAuthFailure = useAuthFailure();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [movingNote, setMovingNote] = useState<Note | null>(null);
  const [savingAction, setSavingAction] = useState(false);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deletingDocument, setDeletingDocument] = useState<StudyDocument | null>(null);
  const [deletingDocumentBusy, setDeletingDocumentBusy] = useState(false);
  const [deleteDocumentError, setDeleteDocumentError] = useState("");
  const [weakConcepts, setWeakConcepts] = useState<WeakConcept[]>([]);
  const [levelProgress, setLevelProgress] = useState<TopicLevel | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(topicId) || topicId < 1) {
      router.replace("/topics");
      return;
    }

    try {
      const [topicResult, noteResult, topicsResult, documentsResult] = await Promise.all([
        api<{ topic: Topic }>(`/topics/${topicId}`),
        query.trim()
          ? api<{ notes: Note[]; pagination: Pagination }>(
            `/topics/${topicId}/notes/search?search=${encodeURIComponent(query)}&page=${page}&limit=10`,
          )
          : api<{ notes: Note[]; pagination: Pagination }>(
            `/topics/${topicId}/notes/paginated?page=${page}&limit=10`,
          ),
        api<{ topics: Topic[] }>("/topics"),
        api<{ documents: StudyDocument[] }>(`/topics/${topicId}/documents`),
      ]);
      setTopic(topicResult.topic);
      setNotes(noteResult.notes);
      setPagination(noteResult.pagination);
      setAvailableTopics(topicsResult.topics);
      setDocuments(documentsResult.documents);
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    }
  }, [handleAuthFailure, page, query, router, topicId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!Number.isInteger(topicId) || topicId < 1) return;
    api<{ concepts: WeakConcept[] }>(`/topics/${topicId}/mastery/weak?limit=6`)
      .then((result) => setWeakConcepts(result.concepts))
      .catch(() => setWeakConcepts([]));
    api<TopicLevel>(`/topics/${topicId}/level`)
      .then((result) => setLevelProgress(result))
      .catch(() => setLevelProgress(null));
  }, [topicId]);

  // While any document is still being processed in the background, poll for
  // its status until it settles (completed/failed).
  useEffect(() => {
    const hasPendingDocument = documents.some(
      (document) => document.status === "pending" || document.status === "processing",
    );
    if (!hasPendingDocument || !Number.isInteger(topicId) || topicId < 1) return;

    const timer = window.setInterval(async () => {
      try {
        const result = await api<{ documents: StudyDocument[] }>(`/topics/${topicId}/documents`);
        setDocuments(result.documents);
      } catch {
        // transient polling error -- next tick will retry
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [documents, topicId]);

  async function uploadDocument(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !Number.isInteger(topicId) || topicId < 1) return;

    setUploadError("");
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await api<{ document: StudyDocument }>(
        `/topics/${topicId}/documents`,
        { method: "POST", body: formData },
      );
      setDocuments((current) => [result.document, ...current]);
    } catch (requestError) {
      setUploadError(messageFromError(requestError));
    } finally {
      setUploading(false);
    }
  }

  function requestDeleteDocument(document: StudyDocument) {
    setDeleteDocumentError("");
    setDeletingDocument(document);
  }

  async function confirmDeleteDocument() {
    if (!deletingDocument) return;
    setDeletingDocumentBusy(true);
    setDeleteDocumentError("");
    try {
      await api<null>(`/documents/${deletingDocument.id}`, { method: "DELETE" });
      setDocuments((current) => current.filter((item) => item.id !== deletingDocument.id));
      setDeletingDocument(null);
    } catch (requestError) {
      setDeleteDocumentError(messageFromError(requestError));
    } finally {
      setDeletingDocumentBusy(false);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    try {
      await api<{ note: Note }>(`/topics/${topicId}/notes`, {
        method: "POST",
        body: JSON.stringify({
          title: data.get("title"),
          content: data.get("content"),
        }),
      });
      setShowNote(false);
      setPage(1);
      await load();
    } catch (requestError) {
      setError(messageFromError(requestError));
    }
  }

  async function updateNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingNote) return;
    const data = new FormData(event.currentTarget);
    setSavingAction(true);

    try {
      await api(`/notes/${editingNote.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: data.get("title"),
          content: data.get("content"),
        }),
      });
      setEditingNote(null);
      await load();
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setSavingAction(false);
    }
  }

  async function deleteNote(note: Note) {
    if (!window.confirm(`Delete “${note.title}”?`)) return;
    try {
      await api<null>(`/notes/${note.id}`, { method: "DELETE" });
      await load();
    } catch (requestError) {
      setError(messageFromError(requestError));
    }
  }

  async function moveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!movingNote) return;
    const data = new FormData(event.currentTarget);
    const targetTopicId = Number(data.get("targetTopicId"));
    setSavingAction(true);

    try {
      await api(`/notes/${movingNote.id}/move`, {
        method: "PATCH",
        body: JSON.stringify({ targetTopicId }),
      });
      setMovingNote(null);
      await load();
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setSavingAction(false);
    }
  }

  return (
    <PageShell title={topic?.title ?? "Topic"} subtitle={topic?.description ?? "Build understanding one clear note at a time."} action={<div className="page-actions"><Link href={`/knowledge-graph?topicId=${topicId}`} className="button button-secondary">◈ Knowledge graph</Link><Link href={`/mind-map?topicId=${topicId}`} className="button button-secondary">✺ Mind map</Link><Link href={`/ai-tutor?topicId=${topicId}`} className="button button-primary">✦ Ask AI tutor</Link><Link href="/topics" className="back-topics">← All topics</Link></div>}>
      {error && <p className="page-error" role="alert">{error}</p>}
      <section className="notes-panel">
        <div className="section-head">
          <div><h2>Your notes</h2><p>{pagination?.total ?? 0} notes in this topic</p></div>
          <button className="add-note-button" onClick={() => setShowNote(true)}>＋ Add note</button>
        </div>
        <div className="search wide notes-search"><span>⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search notes..." /></div>
        <div className="notes-list">
          {notes.map((note) => (
            <article key={note.id}>
              <div><span>▤</span><div><h3>{note.title}</h3><p>{note.content}</p><small>Updated {new Date(note.updated_at).toLocaleDateString()}</small></div></div>
              <div className="note-actions">
                <button className="note-action edit-action" onClick={() => setEditingNote(note)}><span>✎</span>Edit</button>
                <button className="note-action move-action" onClick={() => setMovingNote(note)}><span>↗</span>Move</button>
                <button className="danger-link" onClick={() => void deleteNote(note)}>Delete</button>
              </div>
            </article>
          ))}
          {!notes.length && <div className="empty">No notes found.</div>}
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span>Page {page} of {pagination.totalPages}</span>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        )}
      </section>
      <section className="notes-panel documents-panel">
        <div className="section-head">
          <div>
            <h2>Study documents</h2>
            <p>{documents.length} uploaded file{documents.length === 1 ? "" : "s"} · used by the AI tutor</p>
          </div>
          <label className={`add-note-button upload-button${uploading ? " disabled" : ""}`}>
            {uploading ? "Uploading…" : "＋ Upload document"}
            <input
              type="file"
              accept=".txt,.pdf,text/plain,application/pdf"
              hidden
              disabled={uploading}
              onChange={(event) => void uploadDocument(event)}
            />
          </label>
        </div>
        {uploadError && <p className="page-error" role="alert">{uploadError}</p>}
        <div className="notes-list">
          {documents.map((document) => (
            <article key={document.id}>
              <div>
                <span>📄</span>
                <div>
                  <h3>{humanizeFilename(document.title).label} <span className="doc-type-badge">{documentTypeBadge(document.content_type)}</span></h3>
                  <p>{document.original_filename}</p>
                  {document.status === "failed" && document.error_message && (
                    <p className="document-error">{document.error_message}</p>
                  )}
                  <small>Uploaded {new Date(document.created_at).toLocaleDateString()}</small>
                </div>
              </div>
              <div className="note-actions">
                <span className={`document-status ${document.status}`}>
                  {DOCUMENT_STATUS_LABELS[document.status]}
                </span>
                <button className="danger-link" onClick={() => requestDeleteDocument(document)}>Delete</button>
              </div>
            </article>
          ))}
          {!documents.length && (
            <div className="empty">
              No documents uploaded yet. Upload a PDF or text file to add it to the AI tutor&apos;s knowledge base.
            </div>
          )}
        </div>
      </section>
      {levelProgress && levelProgress.totalXp > 0 && (
        <section className="notes-panel topic-level-panel">
          <div className="section-head">
            <div>
              <h2>{levelProgress.levelName}</h2>
              <p>{levelProgress.totalXp} XP earned in this topic</p>
            </div>
          </div>
          {levelProgress.nextLevelName && levelProgress.xpForNextLevel != null && (
            <>
              <div className="topic-level-bar-track">
                <div
                  className="topic-level-bar-fill"
                  style={{ width: `${Math.round((levelProgress.xpIntoLevel / levelProgress.xpForNextLevel) * 100)}%` }}
                />
              </div>
              <p className="topic-level-next">
                {levelProgress.xpForNextLevel - levelProgress.xpIntoLevel} XP to {levelProgress.nextLevelName}
              </p>
            </>
          )}
        </section>
      )}
      {!!weakConcepts.length && (
        <section className="notes-panel weak-concepts-panel">
          <div className="section-head">
            <div>
              <h2>Weak concepts</h2>
              <p>Built from your quiz answers and flashcard reviews in this topic</p>
            </div>
          </div>
          <div className="weak-concept-list">
            {weakConcepts.map((concept) => (
              <div className="weak-concept-row" key={concept.conceptId}>
                <span className="weak-concept-name" title={concept.eventCount === 1 ? "1 signal" : `${concept.eventCount} signals`}>
                  {concept.conceptName}
                </span>
                <div className="weak-concept-bar-track">
                  <div
                    className={`weak-concept-bar-fill${concept.masteryScore < 0.5 ? " weak" : ""}`}
                    style={{ width: `${Math.round(concept.masteryScore * 100)}%`, opacity: 0.4 + concept.confidenceScore * 0.6 }}
                  />
                </div>
                <span className="weak-concept-value">{Math.round(concept.masteryScore * 100)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {showNote && (
        <div className="modal-backdrop" onMouseDown={() => setShowNote(false)}>
          <form role="dialog" aria-modal="true" aria-labelledby="add-note-title" className="topic-modal note-modal" onSubmit={addNote} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShowNote(false)}>×</button>
            <div className="eyebrow"><span>✦</span> CAPTURE AN IDEA</div>
            <h2 id="add-note-title">Add a new note</h2>
            <label>Note title<input name="title" required maxLength={200} autoFocus /></label>
            <label>Note content<textarea name="content" required rows={6} /></label>
            <button className="button button-primary" type="submit">Save note</button>
          </form>
        </div>
      )}
      {editingNote && (
        <div className="modal-backdrop" onMouseDown={() => setEditingNote(null)}>
          <form role="dialog" aria-modal="true" aria-labelledby="edit-note-title" className="topic-modal note-modal action-modal" onSubmit={updateNote} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setEditingNote(null)}>×</button>
            <div className="modal-icon edit-icon">✎</div>
            <div className="eyebrow">REFINE YOUR NOTE</div>
            <h2 id="edit-note-title">Update note</h2>
            <p>Keep the idea clear, concise, and useful for your next review.</p>
            <label>Note title<input name="title" required maxLength={200} defaultValue={editingNote.title} autoFocus /></label>
            <label>Note content<textarea name="content" required rows={7} defaultValue={editingNote.content} /></label>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setEditingNote(null)}>Cancel</button>
              <button disabled={savingAction} className="button button-primary" type="submit">{savingAction ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </div>
      )}
      {movingNote && (
        <div className="modal-backdrop" onMouseDown={() => setMovingNote(null)}>
          <form role="dialog" aria-modal="true" aria-labelledby="move-note-title" className="topic-modal action-modal move-modal" onSubmit={moveNote} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setMovingNote(null)}>×</button>
            <div className="modal-icon move-icon">↗</div>
            <div className="eyebrow">REORGANIZE YOUR LEARNING</div>
            <h2 id="move-note-title">Move “{movingNote.title}”</h2>
            <p>Choose another topic. The note content and update history will stay intact.</p>
            <label>Destination topic
              <select name="targetTopicId" required defaultValue="">
                <option value="" disabled>Select a topic</option>
                {availableTopics.filter((item) => item.id !== topicId).map((item) => (
                  <option value={item.id} key={item.id}>{item.title}</option>
                ))}
              </select>
            </label>
            {availableTopics.filter((item) => item.id !== topicId).length === 0 && (
              <p className="modal-hint">Create another topic before moving this note.</p>
            )}
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setMovingNote(null)}>Cancel</button>
              <button disabled={savingAction || availableTopics.length < 2} className="button button-primary" type="submit">{savingAction ? "Moving…" : "Move note"}</button>
            </div>
          </form>
        </div>
      )}
      {deletingDocument && (
        <div className="modal-backdrop" onMouseDown={() => (deletingDocumentBusy ? null : setDeletingDocument(null))}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-document-title" className="topic-modal action-modal delete-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" disabled={deletingDocumentBusy} onClick={() => setDeletingDocument(null)}>×</button>
            <div className="modal-icon delete-icon">🗑</div>
            <div className="eyebrow">REMOVE FROM KNOWLEDGE BASE</div>
            <h2 id="delete-document-title">Delete “{humanizeFilename(deletingDocument.title).label}”?</h2>
            <p>
              This removes <code className="doc-filename-chip">{deletingDocument.original_filename}</code> and
              everything the AI tutor learned from it. Past chat answers already given won&apos;t change,
              but this file can no longer be cited or searched. This can&apos;t be undone.
            </p>
            {deleteDocumentError && <p className="form-error">{deleteDocumentError}</p>}
            <div className="modal-actions">
              <button type="button" className="button button-secondary" disabled={deletingDocumentBusy} onClick={() => setDeletingDocument(null)}>Cancel</button>
              <button type="button" className="button button-danger" disabled={deletingDocumentBusy} onClick={() => void confirmDeleteDocument()}>
                {deletingDocumentBusy ? "Deleting…" : "Delete document"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export function HistoryPage() {
  const handleAuthFailure = useAuthFailure();
  const [activities, setActivities] = useState<StudyActivity[]>([]);
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const typeQuery = type ? `&type=${type}` : "";

    try {
      const [historyResult, statsResult] = await Promise.all([
        api<{ activities: StudyActivity[]; pagination: Pagination }>(
          `/study-history?page=${page}&limit=20${typeQuery}`,
        ),
        api<{ stats: StudyStats }>("/study-history/stats"),
      ]);
      setActivities(historyResult.activities);
      setPagination(historyResult.pagination);
      setStats(statsResult.stats);
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure, page, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const groupedActivities = activities.reduce<Record<string, StudyActivity[]>>(
    (groups, activity) => {
      const date = new Date(activity.created_at);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      let label = date.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: date.getFullYear() !== today.getFullYear()
          ? "numeric"
          : undefined,
      });

      if (date.toDateString() === today.toDateString()) label = "Today";
      if (date.toDateString() === yesterday.toDateString()) label = "Yesterday";
      (groups[label] ??= []).push(activity);
      return groups;
    },
    {},
  );

  const icons: Record<StudyActivity["activity_type"], string> = {
    topic_created: "◇",
    topic_updated: "✎",
    note_created: "▤",
    note_updated: "✓",
    note_moved: "↗",
    ai_chat: "✦",
  };

  return (
    <PageShell title="Study history" subtitle="A real record of your learning activity.">
      {error && <p className="page-error" role="alert">{error}</p>}
      <div className="history-stats">
        <article><small>THIS WEEK</small><strong>{stats?.activities_this_week ?? 0}</strong><span>learning activities</span></article>
        <article><small>ALL ACTIVITY</small><strong>{stats?.total_activities ?? 0}</strong><span>recorded actions</span></article>
        <article><small>TOPICS STUDIED</small><strong>{stats?.topics_studied ?? 0}</strong><span>{stats?.ai_interactions ?? 0} AI interactions</span></article>
      </div>
      <div className="history-filters filter-pills">
        {[
          ["", "All activity"],
          ["ai_chat", "AI tutor"],
          ["note_created", "New notes"],
          ["note_updated", "Updated notes"],
          ["topic_created", "Topics"],
        ].map(([value, label]) => (
          <button
            className={type === value ? "active" : ""}
            onClick={() => { setType(value); setPage(1); }}
            key={value}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="history-timeline">
        {loading ? <div className="empty">Loading your study history…</div> : (
          <>
            {Object.entries(groupedActivities).map(([day, dayActivities]) => (
              <div className="history-day" key={day}>
                <h2>{day}</h2>
                {dayActivities.map((activity) => (
                  <article key={activity.id}>
                    <span className={`history-icon ${activity.activity_type === "ai_chat" ? "history-ai-icon" : ""}`}>
                      {icons[activity.activity_type]}
                    </span>
                    <div>
                      <h3>{activity.topic_title || "Deleted topic"}</h3>
                      <p>{activity.description}</p>
                    </div>
                    <b>{new Date(activity.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b>
                  </article>
                ))}
              </div>
            ))}
            {!activities.length && <div className="empty">Your activity will appear here as you study.</div>}
          </>
        )}
        {pagination && pagination.totalPages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
            <span>Page {page} of {pagination.totalPages}</span>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        )}
      </section>
    </PageShell>
  );
}

export function TutorPage() {
  const params = useSearchParams();
  const router = useRouter();
  const handleAuthFailure = useAuthFailure();
  const requestedTopicId = Number(params.get("topicId"));
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState<number | null>(
    Number.isInteger(requestedTopicId) && requestedTopicId > 0
      ? requestedTopicId
      : null,
  );
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const requestedConcept = params.get("concept");
  const [input, setInput] = useState(requestedConcept ? `Tell me more about ${requestedConcept}.` : "");
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<StudyDocument[]>([]);
  const [knowledgeNotesTotal, setKnowledgeNotesTotal] = useState<number | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);

  const [sparMode, setSparMode] = useState(false);
  const [sparConcept, setSparConcept] = useState("");
  const [sparConceptInput, setSparConceptInput] = useState("");
  const [sparMessages, setSparMessages] = useState<AiMessage[]>([]);
  const [sparVerdict, setSparVerdict] = useState<SparVerdict | null>(null);
  const [sparStarting, setSparStarting] = useState(false);
  const [xpToast, setXpToast] = useState<XpAward | null>(null);

  const [agentMode, setAgentMode] = useState(false);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [agentSending, setAgentSending] = useState(false);
  const [expandedTraceFor, setExpandedTraceFor] = useState<number | null>(null);
  const [traces, setTraces] = useState<Record<number, AgentTraceStep[]>>({});
  const [loadingTraceFor, setLoadingTraceFor] = useState<number | null>(null);

  useEffect(() => {
    api<{ topics: Topic[] }>("/topics")
      .then((result) => {
        setTopics(result.topics);
        setTopicId((current) => {
          if (current && result.topics.some((topic) => topic.id === current)) {
            return current;
          }
          return result.topics[0]?.id ?? null;
        });
      })
      .catch((requestError) => {
        handleAuthFailure(requestError);
        setError(messageFromError(requestError));
      })
      .finally(() => setLoadingTopics(false));
  }, [handleAuthFailure]);

  const loadMessages = useCallback(async () => {
    if (!topicId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    setError("");
    try {
      const result = await api<{ messages: AiMessage[] }>(
        `/topics/${topicId}/ai/messages?limit=50`,
      );
      setMessages(result.messages);
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    } finally {
      setLoadingMessages(false);
    }
  }, [handleAuthFailure, topicId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMessages(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMessages]);

  const loadKnowledgeBase = useCallback(async () => {
    if (!topicId) {
      setKnowledgeDocuments([]);
      setKnowledgeNotesTotal(null);
      return;
    }
    try {
      const [documentsResult, notesResult] = await Promise.all([
        api<{ documents: StudyDocument[] }>(`/topics/${topicId}/documents`),
        api<{ notes: Note[]; pagination: Pagination }>(`/topics/${topicId}/notes/paginated?page=1&limit=1`),
      ]);
      setKnowledgeDocuments(documentsResult.documents);
      setKnowledgeNotesTotal(notesResult.pagination.total);
    } catch {
      // supplementary context panel -- a failure here shouldn't block chatting
    }
  }, [topicId]);

  useEffect(() => {
    void loadKnowledgeBase();
  }, [loadKnowledgeBase]);

  useEffect(() => {
    const hasPendingDocument = knowledgeDocuments.some(
      (document) => document.status === "pending" || document.status === "processing",
    );
    if (!hasPendingDocument) return;

    const timer = window.setInterval(() => void loadKnowledgeBase(), 3000);
    return () => window.clearInterval(timer);
  }, [knowledgeDocuments, loadKnowledgeBase]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question || !topicId || sending) return;

    setInput("");
    setSending(true);
    setError("");
    const temporaryMessage: AiMessage = {
      id: -Date.now(),
      topic_id: topicId,
      role: "user",
      message: question,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, temporaryMessage]);

    try {
      const result = await api<{
        answer: string;
        provider: string;
        model: string;
        usedMemory: boolean;
        messages: {
          userMessage: AiMessage;
          assistantMessage: AiMessage;
        };
        sources: Source[];
      }>(`/topics/${topicId}/ai/chat`, {
        method: "POST",
        body: JSON.stringify({
          question,
          ...(selectedDocumentId ? { documentId: selectedDocumentId } : {}),
        }),
      });
      setMessages((current) => [
        ...current.filter((message) => message.id !== temporaryMessage.id),
        result.messages.userMessage,
        { ...result.messages.assistantMessage, sources: result.sources, usedMemory: result.usedMemory },
      ]);
    } catch (requestError) {
      setMessages((current) =>
        current.filter((message) => message.id !== temporaryMessage.id),
      );
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
      setInput(question);
    } finally {
      setSending(false);
    }
  }

  async function clearHistory() {
    if (!topicId || clearing || !messages.length) return;
    if (!window.confirm("Clear this topic's AI conversation?")) return;

    setClearing(true);
    setError("");
    try {
      await api<{ deletedCount: number }>(
        `/topics/${topicId}/ai/messages`,
        { method: "DELETE" },
      );
      setMessages([]);
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => {
    setSelectedDocumentId(null);
    setSparMode(false);
    setAgentMode(false);
  }, [topicId]);

  function endSpar() {
    setSparMode(false);
    setSparConcept("");
    setSparConceptInput("");
    setSparMessages([]);
    setSparVerdict(null);
  }

  function newSpar() {
    setSparConcept("");
    setSparConceptInput("");
    setSparMessages([]);
    setSparVerdict(null);
  }

  function toggleAgentMode() {
    setAgentMode((current) => !current);
    setSparMode(false);
    setInput("");
  }

  function endAgentMode() {
    setAgentMode(false);
    setAgentMessages([]);
    setExpandedTraceFor(null);
    setTraces({});
  }

  async function sendAgentMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || !topicId || agentSending) return;

    setInput("");
    setAgentSending(true);
    setError("");
    const temporaryMessage: AgentMessage = { id: -Date.now(), role: "user", message };
    setAgentMessages((current) => [...current, temporaryMessage]);

    try {
      const result = await api<{ sessionId: number; agent: string; agentLabel: string; answer: string }>(
        "/agents/dispatch",
        { method: "POST", body: JSON.stringify({ message, topicId }) },
      );
      setAgentMessages((current) => [
        ...current,
        { id: result.sessionId, role: "assistant", message: result.answer, sessionId: result.sessionId, agentLabel: result.agentLabel },
      ]);
    } catch (requestError) {
      setAgentMessages((current) => current.filter((item) => item.id !== temporaryMessage.id));
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
      setInput(message);
    } finally {
      setAgentSending(false);
    }
  }

  async function toggleTrace(sessionId: number) {
    if (expandedTraceFor === sessionId) {
      setExpandedTraceFor(null);
      return;
    }
    setExpandedTraceFor(sessionId);
    if (traces[sessionId] || loadingTraceFor === sessionId) return;
    setLoadingTraceFor(sessionId);
    try {
      const result = await api<{ steps: AgentTraceStep[] }>(`/agents/sessions/${sessionId}/trace`);
      setTraces((current) => ({ ...current, [sessionId]: result.steps }));
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setLoadingTraceFor(null);
    }
  }

  async function startSpar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const concept = sparConceptInput.trim();
    if (!concept || !topicId || sparStarting) return;

    setSparStarting(true);
    setError("");
    try {
      const result = await api<{
        answer: string;
        verdict: SparVerdict;
        concept: string;
        usedMemory: boolean;
        messages: { userMessage: AiMessage; assistantMessage: AiMessage };
      }>(`/topics/${topicId}/ai/chat`, {
        method: "POST",
        body: JSON.stringify({ question: concept, mode: "sparring", concept, sparStart: true }),
      });
      setSparConcept(result.concept);
      setSparMessages([{ ...result.messages.assistantMessage, usedMemory: result.usedMemory }]);
      setSparVerdict(result.verdict);
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    } finally {
      setSparStarting(false);
    }
  }

  async function sendSparTurn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rebuttal = input.trim();
    if (!rebuttal || !topicId || sending || sparVerdict === "concede") return;

    setInput("");
    setSending(true);
    setError("");
    const temporaryMessage: AiMessage = {
      id: -Date.now(),
      topic_id: topicId,
      role: "user",
      message: rebuttal,
      mode: "sparring",
      created_at: new Date().toISOString(),
    };
    setSparMessages((current) => [...current, temporaryMessage]);

    try {
      const result = await api<{
        answer: string;
        verdict: SparVerdict;
        concept: string;
        usedMemory: boolean;
        xpEarned: number;
        leveledUp: boolean;
        newLevelName: string | null;
        messages: { userMessage: AiMessage; assistantMessage: AiMessage };
      }>(`/topics/${topicId}/ai/chat`, {
        method: "POST",
        body: JSON.stringify({ question: rebuttal, mode: "sparring", concept: sparConcept, sparStart: false }),
      });
      setSparMessages((current) => [
        ...current.filter((message) => message.id !== temporaryMessage.id),
        result.messages.userMessage,
        { ...result.messages.assistantMessage, usedMemory: result.usedMemory },
      ]);
      setSparVerdict(result.verdict);
      if (result.xpEarned > 0) {
        setXpToast({ xpEarned: result.xpEarned, leveledUp: result.leveledUp, newLevelName: result.newLevelName });
      }
    } catch (requestError) {
      setSparMessages((current) => current.filter((message) => message.id !== temporaryMessage.id));
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
      setInput(rebuttal);
    } finally {
      setSending(false);
    }
  }

  const selectedTopic = topics.find((topic) => topic.id === topicId);
  const readyDocuments = knowledgeDocuments.filter((document) => document.status === "completed");
  const scopedDocument = knowledgeDocuments.find((document) => document.id === selectedDocumentId) ?? null;
  const slashMatch = input.match(/^\/([^\n]*)$/);
  const showDocumentPicker = !!slashMatch;
  const filteredDocuments = slashMatch
    ? readyDocuments.filter((document) =>
      humanizeFilename(document.title).label.toLowerCase().includes(slashMatch[1].trim().toLowerCase()),
    )
    : [];

  function selectDocumentForQuestion(document: StudyDocument) {
    setSelectedDocumentId(document.id);
    setInput("");
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && showDocumentPicker) {
      event.preventDefault();
      setInput("");
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && showDocumentPicker && filteredDocuments.length) {
      event.preventDefault();
      selectDocumentForQuestion(filteredDocuments[0]);
    }
  }

  return (
    <PageShell title="AI tutor" subtitle="Ask questions and learn directly from your topic notes.">
      {xpToast && <XpToast award={xpToast} onDismiss={() => setXpToast(null)} />}
      {error && <p className="page-error" role="alert">{error}</p>}
      {loadingTopics ? <div className="empty">Loading your topics…</div> : !topics.length ? (
        <div className="empty">
          Create a topic and add notes before starting with the AI tutor.
          <div><Link className="button button-primary" href="/topics">Create topic</Link></div>
        </div>
      ) : (
        <div className="tutor-layout">
          <section className={`chat-panel${sparMode ? " sparring-skin" : ""}${agentMode ? " agent-skin" : ""}`}>
            <div className="chat-heading">
              <span className="ai-spark">{sparMode ? "⚔" : agentMode ? "🤖" : "✦"}</span>
              <div>
                <h2>{sparMode ? "Sparring Mode" : agentMode ? "Study Agents" : "Studia Tutor"}</h2>
                <p><i /> {sparMode ? (sparConcept ? `Defending: ${sparConcept}` : "Pick a concept to spar about") : agentMode ? "Ask for anything -- a quiz, an exam, flashcards, a study plan, or a question" : `Focused on ${selectedTopic?.title}`}</p>
              </div>
              {sparMode ? (
                <button type="button" onClick={endSpar}>Back to tutor</button>
              ) : agentMode ? (
                <button type="button" onClick={endAgentMode}>Back to tutor</button>
              ) : (
                <div className="chat-heading-actions">
                  <button type="button" className="spar-toggle" onClick={() => { setSparMode(true); setAgentMode(false); }}>⚔ Spar with me</button>
                  <button type="button" className="agent-toggle" onClick={toggleAgentMode}>🤖 Ask my agents</button>
                  <button type="button" disabled={clearing || !messages.length} onClick={() => void clearHistory()}>
                    {clearing ? "Clearing…" : "Clear chat"}
                  </button>
                </div>
              )}
            </div>
            {sparMode ? (
              <>
                <div className="chat-messages" aria-live="polite">
                  {!sparConcept && (
                    <div className="chat-welcome">
                      The AI will confidently argue a wrong claim about a concept you pick -- find the flaw, correct it, and win the round.
                    </div>
                  )}
                  {sparMessages.map((message) => (
                    <div className={`chat-message ${message.role} sparring`} key={message.id}>
                      {message.role === "assistant" && <span>⚔</span>}
                      <div className="chat-message-body">
                        {message.role === "assistant"
                          ? <AiMessageContent text={message.message} />
                          : <p>{message.message}</p>}
                        {message.role === "assistant" && message.usedMemory && (
                          <span className="memory-used-badge" title="Shaped by what Studia remembers about you">🧠 remembered</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {(sending || sparStarting) && <div className="chat-message assistant sparring"><span>⚔</span><p>Thinking…</p></div>}
                  {sparVerdict === "concede" && (
                    <div className="spar-verdict-card">
                      <span className="spar-verdict-icon">🏆</span>
                      <div>
                        <strong>You won this round.</strong>
                        <p>Your correction held up -- that&apos;s a stronger signal than just reading the answer.</p>
                      </div>
                      <button type="button" className="button button-primary" onClick={newSpar}>Spar again →</button>
                    </div>
                  )}
                </div>
                <div className="chat-input-wrap">
                  {!sparConcept ? (
                    <form className="chat-input spar-concept-form" onSubmit={startSpar}>
                      <textarea
                        value={sparConceptInput}
                        onChange={(event) => setSparConceptInput(event.target.value)}
                        placeholder="Type a concept to spar about, e.g. Krebs cycle…"
                        rows={2}
                        maxLength={300}
                        disabled={sparStarting}
                      />
                      <button disabled={sparStarting || !sparConceptInput.trim()} type="submit">
                        {sparStarting ? "Starting…" : "Start spar →"}
                      </button>
                    </form>
                  ) : sparVerdict !== "concede" && (
                    <form className="chat-input" onSubmit={sendSparTurn}>
                      <textarea
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="Explain what's wrong with that claim…"
                        rows={2}
                        maxLength={2000}
                        disabled={sending}
                      />
                      <button disabled={sending || !input.trim()} type="submit">{sending ? "Sending…" : "Rebut →"}</button>
                    </form>
                  )}
                </div>
              </>
            ) : agentMode ? (
              <>
                <div className="chat-messages" aria-live="polite">
                  {!agentMessages.length && (
                    <div className="chat-welcome">
                      Try: "Quiz me on this topic", "Make me flashcards", "What should I study today?", or "Give me an exam."
                    </div>
                  )}
                  {agentMessages.map((message) => (
                    <div className={`chat-message ${message.role} agent`} key={message.id}>
                      {message.role === "assistant" && <span>🤖</span>}
                      <div className="chat-message-body">
                        {message.role === "assistant" ? <AiMessageContent text={message.message} /> : <p>{message.message}</p>}
                        {message.role === "assistant" && message.sessionId != null && (
                          <div className="agent-trace-toggle-row">
                            {message.agentLabel && <span className="agent-label-badge">{message.agentLabel}</span>}
                            <button type="button" className="agent-trace-toggle" onClick={() => void toggleTrace(message.sessionId!)}>
                              {expandedTraceFor === message.sessionId ? "Hide agent trace ▴" : "How I did this ▾"}
                            </button>
                          </div>
                        )}
                        {expandedTraceFor === message.sessionId && (
                          <div className="agent-trace-panel">
                            {loadingTraceFor === message.sessionId ? (
                              <p className="agent-trace-loading">Loading trace…</p>
                            ) : (
                              (traces[message.sessionId!] ?? []).map((step) => (
                                <div className="agent-trace-step" key={step.stepIndex}>
                                  <span className="agent-trace-step-label">{step.agentLabel}</span>
                                  <p>{step.output}</p>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {agentSending && <div className="chat-message assistant agent"><span>🤖</span><p>Routing to the right agent…</p></div>}
                </div>
                <div className="chat-input-wrap">
                  <form className="chat-input" onSubmit={sendAgentMessage}>
                    <textarea
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder="Ask for a quiz, an exam, flashcards, a study plan, or a question…"
                      rows={2}
                      maxLength={2000}
                      disabled={agentSending}
                    />
                    <button disabled={agentSending || !input.trim()} type="submit">{agentSending ? "Sending…" : "Send →"}</button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <div className="chat-messages" aria-live="polite">
                  {loadingMessages ? <div className="empty">Loading conversation…</div> : (
                    <>
                      {!messages.length && <div className="chat-welcome">Ask a question, request a summary, or create a practice quiz.</div>}
                      {messages.map((message) => (
                        <div className={`chat-message ${message.role}`} key={message.id}>
                          {message.role === "assistant" && <span>✦</span>}
                          <div className="chat-message-body">
                            {message.role === "assistant"
                              ? <AiMessageContent text={message.message} />
                              : <p>{message.message}</p>}
                            {message.role === "assistant" && !!message.sources?.length && (
                              <div className="message-sources">
                                <span className="message-sources-label">Sources</span>
                                {message.sources.map((source, index) => (
                                  <span
                                    className={`source-chip ${source.sourceType}`}
                                    key={`${source.sourceType}-${source.sourceId}-${index}`}
                                    title={source.excerpt}
                                  >
                                    {source.sourceType === "note" ? "▤" : "📄"}{" "}
                                    {source.sourceType === "document"
                                      ? humanizeFilename(source.sourceTitle).label
                                      : source.sourceTitle}
                                  </span>
                                ))}
                              </div>
                            )}
                            {message.role === "assistant" && message.usedMemory && (
                              <span className="memory-used-badge" title="Shaped by what Studia remembers about you">🧠 remembered</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {sending && <div className="chat-message assistant"><span>✦</span><p>Thinking…</p></div>}
                    </>
                  )}
                </div>
                <div className="quick-prompts">
                  {["Summarize my notes", "Explain this topic simply", "Create a 5 question quiz"].map((prompt) => (
                    <button type="button" onClick={() => setInput(prompt)} key={prompt}>{prompt}</button>
                  ))}
                </div>
                <div className="chat-input-wrap">
                  {scopedDocument && !showDocumentPicker && (
                    <div className="scoped-doc-row">
                      <span className="scoped-doc-chip">
                        📄 Asking about {humanizeFilename(scopedDocument.title).label}
                        <button type="button" aria-label="Stop focusing on this document" onClick={() => setSelectedDocumentId(null)}>×</button>
                      </span>
                    </div>
                  )}
                  {showDocumentPicker && (
                    <div className="slash-doc-picker" role="listbox" aria-label="Select a document to focus your question on">
                      <div className="slash-doc-picker-label">Ask about a specific document</div>
                      {filteredDocuments.length ? filteredDocuments.map((document) => (
                        <button type="button" className="slash-doc-option" key={document.id} onClick={() => selectDocumentForQuestion(document)}>
                          <span aria-hidden="true">📄</span>
                          <span className="slash-doc-option-title">{humanizeFilename(document.title).label}</span>
                          <em className="doc-type-badge">{documentTypeBadge(document.content_type)}</em>
                        </button>
                      )) : (
                        <div className="slash-doc-empty">
                          {readyDocuments.length ? "No documents match." : "No documents are ready yet -- upload one from the topic page."}
                        </div>
                      )}
                    </div>
                  )}
                  <form className="chat-input" onSubmit={send}>
                    <textarea
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={handleInputKeyDown}
                      placeholder={scopedDocument ? "Ask about this document…" : "Ask your tutor a question, or type / to focus on a document…"}
                      rows={2}
                      maxLength={2000}
                      disabled={sending || !topicId}
                    />
                    <button disabled={sending || showDocumentPicker || !input.trim()} type="submit">{sending ? "Sending…" : "Send →"}</button>
                  </form>
                </div>
              </>
            )}
          </section>
          <aside className="tutor-context">
            <div className="section-kicker">CURRENT CONTEXT</div>
            <span className="topic-icon purple">◇</span>
            <h3>{selectedTopic?.title}</h3>
            <p>{selectedTopic?.description || "Your notes provide the context for AI answers."}</p>
            <label className="tutor-topic-select">
              Change topic
              <select
                value={topicId ?? ""}
                onChange={(event) => {
                  const nextTopicId = Number(event.target.value);
                  setTopicId(nextTopicId);
                  router.replace(`/ai-tutor?topicId=${nextTopicId}`);
                }}
              >
                {topics.map((topic) => <option value={topic.id} key={topic.id}>{topic.title}</option>)}
              </select>
            </label>
            <div className="context-list knowledge-base">
              <div className="kb-row">
                <span className="kb-icon notes">▤</span>
                <div>
                  <b>{knowledgeNotesTotal ?? 0} note{knowledgeNotesTotal === 1 ? "" : "s"}</b>
                  <small>Saved notes the tutor can reference</small>
                </div>
              </div>
              <div className="kb-row">
                <span className="kb-icon docs">📄</span>
                <div>
                  <b>{knowledgeDocuments.length} document{knowledgeDocuments.length === 1 ? "" : "s"}</b>
                  <small>Uploaded files indexed for this topic</small>
                </div>
              </div>
            </div>
            {!!knowledgeDocuments.length && (
              <div className="kb-documents">
                {knowledgeDocuments.slice(0, 4).map((document) => (
                  <button
                    type="button"
                    className={`kb-document${document.id === selectedDocumentId ? " active" : ""}`}
                    key={document.id}
                    disabled={document.status !== "completed"}
                    title={document.status === "completed" ? "Focus the tutor on this document" : "Not ready yet"}
                    onClick={() => setSelectedDocumentId((current) => (current === document.id ? null : document.id))}
                  >
                    <span aria-hidden="true">📄</span>
                    <div>
                      <b title={document.title}>{humanizeFilename(document.title).label}</b>
                      <span className={`document-status ${document.status}`}>
                        {DOCUMENT_STATUS_LABELS[document.status]}
                      </span>
                    </div>
                    <em className="doc-type-badge">{documentTypeBadge(document.content_type)}</em>
                  </button>
                ))}
                {knowledgeDocuments.length > 4 && (
                  <small className="kb-more">+{knowledgeDocuments.length - 4} more document{knowledgeDocuments.length - 4 === 1 ? "" : "s"}</small>
                )}
              </div>
            )}
            {!knowledgeDocuments.length && !knowledgeNotesTotal && (
              <p className="modal-hint">Add notes or upload a document from the topic page to give the tutor something to work with.</p>
            )}
            <Link className="context-topic-link" href={`/topic?id=${topicId}`}>Manage notes &amp; documents</Link>
          </aside>
        </div>
      )}
    </PageShell>
  );
}

export type LearningStyleWeights = {
  visual: number;
  reading: number;
  practice: number;
  flashcards: number;
  examples: number;
  conversation: number;
};

export type LearningStyleProfile = {
  weights: LearningStyleWeights;
  dominantAxes: string[];
  eventCount: number;
  overridden: boolean;
  rationale: string | null;
  computedAt: string | null;
};

const LEARNING_STYLE_AXES: { key: keyof LearningStyleWeights; label: string }[] = [
  { key: "visual", label: "Visual" },
  { key: "reading", label: "Reading" },
  { key: "practice", label: "Practice" },
  { key: "flashcards", label: "Flashcards" },
  { key: "examples", label: "Examples" },
  { key: "conversation", label: "Conversation" },
];

const RADAR_SIZE = 240;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 92;

function radarAxisPoint(index: number, fraction: number) {
  const angle = (Math.PI * 2 * index) / LEARNING_STYLE_AXES.length - Math.PI / 2;
  const r = fraction * RADAR_RADIUS;
  return { x: RADAR_CENTER + r * Math.cos(angle), y: RADAR_CENTER + r * Math.sin(angle) };
}

function radarPolygon(weights: LearningStyleWeights): string {
  return LEARNING_STYLE_AXES.map((axis, i) => {
    const scaled = Math.min(Math.sqrt(weights[axis.key]), 1);
    const { x, y } = radarAxisPoint(i, scaled);
    return `${x},${y}`;
  }).join(" ");
}

function LearningStyleRadar({ weights }: { weights: LearningStyleWeights }) {
  const rings = [0.33, 0.66, 1];
  return (
    <svg viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="radar-chart" role="img" aria-label="Learning style radar chart">
      {rings.map((fraction) => (
        <polygon
          key={fraction}
          className="radar-grid-ring"
          points={LEARNING_STYLE_AXES.map((_, i) => {
            const { x, y } = radarAxisPoint(i, fraction);
            return `${x},${y}`;
          }).join(" ")}
        />
      ))}
      {LEARNING_STYLE_AXES.map((axis, i) => {
        const { x, y } = radarAxisPoint(i, 1);
        const label = radarAxisPoint(i, 1.24);
        return (
          <g key={axis.key}>
            <line className="radar-axis-line" x1={RADAR_CENTER} y1={RADAR_CENTER} x2={x} y2={y} />
            <text className="radar-axis-label" x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
              {axis.label}
            </text>
          </g>
        );
      })}
      <polygon className="radar-data-shape" points={radarPolygon(weights)} />
      {LEARNING_STYLE_AXES.map((axis, i) => {
        const scaled = Math.min(Math.sqrt(weights[axis.key]), 1);
        const { x, y } = radarAxisPoint(i, scaled);
        return <circle key={axis.key} className="radar-data-point" cx={x} cy={y} r={3.5} />;
      })}
    </svg>
  );
}

function LearningStylePanel() {
  const [profile, setProfile] = useState<LearningStyleProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LearningStyleWeights | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<LearningStyleProfile>("/learning-style");
      setProfile(result);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEditing() {
    if (!profile) return;
    setDraft({ ...profile.weights });
    setEditing(true);
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const result = await api<LearningStyleProfile>("/learning-style", {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      setProfile(result);
      setEditing(false);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function resetToAuto() {
    setSaving(true);
    setError("");
    try {
      const result = await api<LearningStyleProfile>("/learning-style/reset", { method: "POST" });
      setProfile(result);
      setEditing(false);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-panel">
      <div className="settings-section learning-style-section">
        <div>
          <h2>How you learn</h2>
          <p>Inferred from how you actually study — no survey, just your engagement patterns.</p>
        </div>
        {error && <p className="page-error" role="alert">{error}</p>}
        {loading || !profile ? (
          <div className="empty">Loading your learning style…</div>
        ) : (
          <div className="learning-style-layout">
            <LearningStyleRadar weights={editing && draft ? draft : profile.weights} />
            <div className="learning-style-detail">
              {profile.overridden && <span className="learning-style-badge">Manually set</span>}
              <p className="learning-style-rationale">
                {profile.rationale ?? "Not enough activity yet to detect a preference."}
              </p>
              {!editing ? (
                <div className="learning-style-actions">
                  <button type="button" className="button button-secondary" onClick={startEditing}>
                    Adjust manually
                  </button>
                  {profile.overridden && (
                    <button type="button" className="button button-secondary" disabled={saving} onClick={() => void resetToAuto()}>
                      {saving ? "Resetting…" : "Reset to auto-detected"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="learning-style-editor">
                  {LEARNING_STYLE_AXES.map((axis) => (
                    <label key={axis.key} className="learning-style-slider">
                      <span>{axis.label}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((draft?.[axis.key] ?? 0) * 100)}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, [axis.key]: Number(event.target.value) / 100 } : current
                          )
                        }
                      />
                    </label>
                  ))}
                  <div className="learning-style-actions">
                    <button type="button" className="button button-secondary" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                    <button type="button" className="button button-primary" disabled={saving} onClick={() => void saveDraft()}>
                      {saving ? "Saving…" : "Save weights"}
                    </button>
                  </div>
                </div>
              )}
              <small className="learning-style-meta">
                Based on {profile.eventCount} tracked {profile.eventCount === 1 ? "activity" : "activities"}
              </small>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function SettingsPage() {
  const handleAuthFailure = useAuthFailure();
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [memories, setMemories] = useState<StudentMemory[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [memoryError, setMemoryError] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState<number | null>(null);
  const [busyMemoryId, setBusyMemoryId] = useState<number | null>(null);

  useEffect(() => {
    api<{ user: User | null }>("/auth/me")
      .then((result) => setUser(result.user))
      .catch(handleAuthFailure);
  }, [handleAuthFailure]);

  const loadMemories = useCallback(async () => {
    setMemoriesLoading(true);
    try {
      const result = await api<{ memories: StudentMemory[] }>("/memory");
      setMemories(result.memories);
    } catch (requestError) {
      setMemoryError(messageFromError(requestError));
    } finally {
      setMemoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMemories();
  }, [loadMemories]);

  async function saveMemory(event: FormEvent<HTMLFormElement>, memoryId: number) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusyMemoryId(memoryId);
    setMemoryError("");
    try {
      const result = await api<{ memory: StudentMemory }>(`/memory/${memoryId}`, {
        method: "PATCH",
        body: JSON.stringify({ value: data.get("value") }),
      });
      setMemories((current) => current.map((memory) => (memory.id === memoryId ? result.memory : memory)));
      setEditingMemoryId(null);
    } catch (requestError) {
      setMemoryError(messageFromError(requestError));
    } finally {
      setBusyMemoryId(null);
    }
  }

  async function deleteMemory(memoryId: number) {
    setBusyMemoryId(memoryId);
    setMemoryError("");
    try {
      await api<null>(`/memory/${memoryId}`, { method: "DELETE" });
      setMemories((current) => current.filter((memory) => memory.id !== memoryId));
    } catch (requestError) {
      setMemoryError(messageFromError(requestError));
    } finally {
      setBusyMemoryId(null);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");

    try {
      const result = await api<{ user: User }>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
        }),
      });
      setUser(result.user);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (requestError) {
      setError(messageFromError(requestError));
    }
  }

  return (
    <PageShell title="Settings" subtitle="Manage your profile information.">
      {saved && <div className="save-toast">✓ Your profile has been saved.</div>}
      {error && <p className="page-error" role="alert">{error}</p>}
      <section className="settings-panel">
        <div className="settings-section">
          <div><h2>Profile information</h2><p>Update the details shown in your Studia account.</p></div>
          {user ? (
            <form className="settings-form" onSubmit={save}>
              <label>Full name<input name="name" minLength={2} maxLength={100} defaultValue={user.name} /></label>
              <label>Email address<input name="email" type="email" maxLength={255} defaultValue={user.email} /></label>
              <div className="settings-actions full"><button className="button button-primary" type="submit">Save changes</button></div>
            </form>
          ) : <div className="empty">Loading your profile…</div>}
        </div>
      </section>
      <LearningStylePanel />
      <section className="settings-panel memory-panel">
        <div className="settings-section">
          <div><h2>What Studia knows about you</h2><p>The AI tutor uses these to personalize its answers. Edit or remove anything that&apos;s wrong.</p></div>
          {memoryError && <p className="page-error" role="alert">{memoryError}</p>}
          {memoriesLoading ? <div className="empty">Loading…</div> : (
            <div className="memory-list">
              {memories.map((memory) => (
                <div className="memory-card" key={memory.id}>
                  {editingMemoryId === memory.id ? (
                    <form onSubmit={(event) => void saveMemory(event, memory.id)}>
                      <textarea name="value" defaultValue={memory.value} rows={2} required maxLength={2000} autoFocus />
                      <div className="memory-card-actions">
                        <button type="button" className="button button-secondary" onClick={() => setEditingMemoryId(null)}>Cancel</button>
                        <button type="submit" className="button button-primary" disabled={busyMemoryId === memory.id}>
                          {busyMemoryId === memory.id ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <span className={`memory-type-badge ${memory.memoryType}`}>{memory.memoryType}</span>
                      <p>{memory.value}</p>
                      <div className="memory-card-actions">
                        <button type="button" onClick={() => setEditingMemoryId(memory.id)}>Edit</button>
                        <button
                          type="button"
                          className="danger-link"
                          disabled={busyMemoryId === memory.id}
                          onClick={() => void deleteMemory(memory.id)}
                        >
                          {busyMemoryId === memory.id ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {!memories.length && (
                <div className="empty">Nothing learned yet — keep chatting with the AI tutor and this will fill in over time.</div>
              )}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
