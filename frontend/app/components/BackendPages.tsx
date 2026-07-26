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

function PageShell({
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

function useAuthFailure() {
  const router = useRouter();
  return useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      router.replace("/login");
    }
  }, [router]);
}

type AiMessage = {
  id: number;
  topic_id: number;
  role: "user" | "assistant";
  message: string;
  created_at: string;
};

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

function renderInlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part,
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

  const load = useCallback(async () => {
    if (!Number.isInteger(topicId) || topicId < 1) {
      router.replace("/topics");
      return;
    }

    try {
      const [topicResult, noteResult, topicsResult] = await Promise.all([
        api<{ topic: Topic }>(`/topics/${topicId}`),
        query.trim()
          ? api<{ notes: Note[]; pagination: Pagination }>(
            `/topics/${topicId}/notes/search?search=${encodeURIComponent(query)}&page=${page}&limit=10`,
          )
          : api<{ notes: Note[]; pagination: Pagination }>(
            `/topics/${topicId}/notes/paginated?page=${page}&limit=10`,
          ),
        api<{ topics: Topic[] }>("/topics"),
      ]);
      setTopic(topicResult.topic);
      setNotes(noteResult.notes);
      setPagination(noteResult.pagination);
      setAvailableTopics(topicsResult.topics);
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    }
  }, [handleAuthFailure, page, query, router, topicId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

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
    <PageShell title={topic?.title ?? "Topic"} subtitle={topic?.description ?? "Build understanding one clear note at a time."} action={<div className="page-actions"><Link href={`/ai-tutor?topicId=${topicId}`} className="button button-primary">✦ Ask AI tutor</Link><Link href="/topics" className="back-topics">← All topics</Link></div>}>
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
  const [input, setInput] = useState("");
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");

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
        messages: {
          userMessage: AiMessage;
          assistantMessage: AiMessage;
        };
      }>(`/topics/${topicId}/ai/chat`, {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setMessages((current) => [
        ...current.filter((message) => message.id !== temporaryMessage.id),
        result.messages.userMessage,
        result.messages.assistantMessage,
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

  const selectedTopic = topics.find((topic) => topic.id === topicId);

  return (
    <PageShell title="AI tutor" subtitle="Ask questions and learn directly from your topic notes.">
      {error && <p className="page-error" role="alert">{error}</p>}
      {loadingTopics ? <div className="empty">Loading your topics…</div> : !topics.length ? (
        <div className="empty">
          Create a topic and add notes before starting with the AI tutor.
          <div><Link className="button button-primary" href="/topics">Create topic</Link></div>
        </div>
      ) : (
        <div className="tutor-layout">
          <section className="chat-panel">
            <div className="chat-heading">
              <span className="ai-spark">✦</span>
              <div><h2>Studia Tutor</h2><p><i /> Focused on {selectedTopic?.title}</p></div>
              <button type="button" disabled={clearing || !messages.length} onClick={() => void clearHistory()}>
                {clearing ? "Clearing…" : "Clear chat"}
              </button>
            </div>
            <div className="chat-messages" aria-live="polite">
              {loadingMessages ? <div className="empty">Loading conversation…</div> : (
                <>
                  {!messages.length && <div className="chat-welcome">Ask a question, request a summary, or create a practice quiz.</div>}
                  {messages.map((message) => (
                    <div className={`chat-message ${message.role}`} key={message.id}>
                      {message.role === "assistant" && <span>✦</span>}
                      {message.role === "assistant"
                        ? <AiMessageContent text={message.message} />
                        : <p>{message.message}</p>}
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
            <form className="chat-input" onSubmit={send}>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask your tutor a question…" rows={2} maxLength={2000} disabled={sending || !topicId} />
              <button disabled={sending || !input.trim()} type="submit">{sending ? "Sending…" : "Send →"}</button>
            </form>
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
            <div className="context-list">
              <span>✓ Uses the selected topic</span>
              <span>✓ References your saved notes</span>
              <span>✓ Saves conversation history</span>
            </div>
            <Link className="context-topic-link" href={`/topic?id=${topicId}`}>View topic notes</Link>
          </aside>
        </div>
      )}
    </PageShell>
  );
}

export function SettingsPage() {
  const handleAuthFailure = useAuthFailure();
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ user: User | null }>("/auth/me")
      .then((result) => setUser(result.user))
      .catch(handleAuthFailure);
  }, [handleAuthFailure]);

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
    </PageShell>
  );
}
