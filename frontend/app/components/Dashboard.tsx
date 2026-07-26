"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AppSidebar from "./AppSidebar";
import { api, ApiError, messageFromError, Topic, User } from "../lib/api";

export default function Dashboard() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [topicResult, userResult] = await Promise.all([
        api<{ topics: Topic[] }>("/topics"),
        api<{ user: User | null }>("/auth/me"),
      ]);
      setTopics(topicResult.topics);
      setUser(userResult.user);
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
          </div>
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
