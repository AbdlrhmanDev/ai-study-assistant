"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  api,
  messageFromError,
  Topic,
} from "../../lib/api";
import { PageShell, useAuthFailure } from "../shared/PageChrome";
import { Button, Card, EmptyState, LoadingState } from "../ui";

export function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [deletingTopic, setDeletingTopic] = useState<Topic | null>(null);
  const [topicActionBusy, setTopicActionBusy] = useState(false);
  const [topicActionError, setTopicActionError] = useState("");
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

  async function updateTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTopic) return;
    setTopicActionBusy(true);
    setTopicActionError("");
    const data = new FormData(event.currentTarget);

    try {
      const result = await api<{ topic: Topic }>(`/topics/${editingTopic.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: data.get("title"),
          description: data.get("description") || null,
        }),
      });
      setTopics((current) => current.map((item) => item.id === editingTopic.id ? result.topic : item));
      setEditingTopic(null);
    } catch (requestError) {
      setTopicActionError(messageFromError(requestError));
    } finally {
      setTopicActionBusy(false);
    }
  }

  async function confirmDeleteTopic() {
    if (!deletingTopic) return;
    setTopicActionBusy(true);
    setTopicActionError("");

    try {
      await api<null>(`/topics/${deletingTopic.id}`, { method: "DELETE" });
      setTopics((current) => current.filter((item) => item.id !== deletingTopic.id));
      setDeletingTopic(null);
    } catch (requestError) {
      setTopicActionError(messageFromError(requestError));
    } finally {
      setTopicActionBusy(false);
    }
  }

  const visible = topics.filter((topic) =>
    topic.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <PageShell
      className="topics-page"
      title="My topics"
      subtitle="Everything you are learning, organized in one calm place."
      action={<Button variant="primary" onClick={() => setShowModal(true)}><Plus size={16} strokeWidth={2.2} /> New topic</Button>}
    >
      {error && <p className="page-error" role="alert">{error}</p>}
      <div className="topics-toolbar">
        <div className="search wide"><span><Search size={15} /></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all topics..." /></div>
      </div>
      {loading ? <LoadingState label="Loading your topics…" /> : (
        <div className="all-topics-grid">
          {visible.map((topic) => (
            <Card className="full-topic-card collection-card" interactive key={topic.id}>
              <Link className="topic-card-hit-area" href={`/topic?id=${topic.id}`} aria-label={`Open ${topic.title}`} />
              <div className="topic-card-top">
                <span className="topic-icon purple"><BookOpen size={18} strokeWidth={1.8} /></span>
                <div className="card-actions">
                  <button onClick={() => { setTopicActionError(""); setEditingTopic(topic); }}>Edit</button>
                  <button className="danger-link" onClick={() => { setTopicActionError(""); setDeletingTopic(topic); }}>Delete</button>
                </div>
              </div>
              <span className="topic-category">Study topic</span>
              <h2>{topic.title}</h2>
              <p>{topic.description || "No description yet."}</p>
              <div className="topic-meta"><span>Updated {new Date(topic.updated_at).toLocaleDateString()}</span></div>
              <Link className="open-topic" href={`/topic?id=${topic.id}`}>Open topic <span><ArrowRight size={13} /></span></Link>
            </Card>
          ))}
          {!visible.length && <EmptyState Icon={BookOpen} title={query ? "No matching topics" : "No topics yet"} description={query ? "Try another search term." : "Create your first topic to collect notes, documents, quizzes, and flashcards."} action={!query ? <Button variant="primary" onClick={() => setShowModal(true)}><Plus size={16} /> Create topic</Button> : undefined} />}
        </div>
      )}
      {showModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowModal(false)}>
          <form
            role="dialog" aria-modal="true" aria-labelledby="topics-create-topic-title"
            className="topic-modal action-modal" onSubmit={createTopic} onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowModal(false)}><X size={22} /></button>
            <div className="modal-icon edit-icon"><Sparkles size={22} /></div>
            <div className="eyebrow">NEW LEARNING SPACE</div>
            <h2 id="topics-create-topic-title">Create a study topic</h2>
            <label>Topic name<input name="title" required maxLength={200} autoFocus /></label>
            <label>Description<textarea name="description" maxLength={1000} rows={4} /></label>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button disabled={saving} className="button button-primary" type="submit">{saving ? "Creating…" : "Create topic"}</button>
            </div>
          </form>
        </div>
      )}
      {editingTopic && (
        <div className="modal-backdrop" onMouseDown={() => setEditingTopic(null)}>
          <form role="dialog" aria-modal="true" aria-labelledby="edit-topic-title" className="topic-modal action-modal" onSubmit={updateTopic} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label="Close" onClick={() => setEditingTopic(null)}><X size={22} /></button>
            <div className="modal-icon edit-icon"><Pencil size={22} /></div>
            <div className="eyebrow">REFINE YOUR TOPIC</div>
            <h2 id="edit-topic-title">Update topic</h2>
            {topicActionError && <p className="form-error">{topicActionError}</p>}
            <label>Topic name<input name="title" required maxLength={200} defaultValue={editingTopic.title} autoFocus /></label>
            <label>Description<textarea name="description" maxLength={1000} rows={4} defaultValue={editingTopic.description ?? ""} /></label>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setEditingTopic(null)}>Cancel</button>
              <button disabled={topicActionBusy} className="button button-primary" type="submit">{topicActionBusy ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </div>
      )}
      {deletingTopic && (
        <div className="modal-backdrop" onMouseDown={() => (topicActionBusy ? null : setDeletingTopic(null))}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-topic-title" className="topic-modal action-modal delete-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label="Close" disabled={topicActionBusy} onClick={() => setDeletingTopic(null)}><X size={22} /></button>
            <div className="modal-icon delete-icon"><Trash2 size={22} /></div>
            <div className="eyebrow">REMOVE THIS TOPIC</div>
            <h2 id="delete-topic-title">Delete “{deletingTopic.title}”?</h2>
            <p>This permanently removes the topic and all of its notes, documents, quizzes, and flashcards. This can&apos;t be undone.</p>
            {topicActionError && <p className="form-error">{topicActionError}</p>}
            <div className="modal-actions">
              <button type="button" className="button button-secondary" disabled={topicActionBusy} onClick={() => setDeletingTopic(null)}>Cancel</button>
              <button type="button" className="button button-danger" disabled={topicActionBusy} onClick={() => void confirmDeleteTopic()}>
                {topicActionBusy ? "Deleting…" : "Delete topic"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
