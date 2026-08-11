"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { NotebookPen, Plus, Sparkles, Trash2, X } from "lucide-react";
import { PageShell, useAuthFailure } from "./shared/PageChrome";
import { api, messageFromError, Topic } from "../lib/api";
import { WorkspaceBlock, WorkspacePage } from "./workspace/types";
import { Badge, Button, EmptyState, LoadingState } from "./ui";

function blockPreview(blocks: WorkspaceBlock[]): string {
  for (const block of blocks) {
    if (block.content.trim()) return block.content.trim();
    if (block.type === "bookmark" && block.properties.title) return `Link: ${block.properties.title}`;
    if (block.children.length) {
      const nested = blockPreview(block.children);
      if (nested !== "Empty page -- click to start adding blocks.") return nested;
    }
  }
  return "Empty page -- click to start adding blocks.";
}

export function WorkspaceListPage() {
  const router = useRouter();
  const handleAuthFailure = useAuthFailure();
  const [pages, setPages] = useState<WorkspacePage[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingPage, setDeletingPage] = useState<WorkspacePage | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    try {
      const [pagesResult, topicsResult] = await Promise.all([
        api<{ pages: WorkspacePage[] }>("/workspace-pages"),
        api<{ topics: Topic[] }>("/topics"),
      ]);
      setPages(pagesResult.pages);
      setTopics(topicsResult.topics);
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

  async function createPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const topicId = data.get("topic_id");

    try {
      const result = await api<{ page: WorkspacePage }>("/workspace-pages", {
        method: "POST",
        body: JSON.stringify({
          title: data.get("title"),
          topic_id: topicId ? Number(topicId) : null,
        }),
      });
      router.push(`/workspace-page?id=${result.page.id}`);
    } catch (requestError) {
      setError(messageFromError(requestError));
      setCreating(false);
    }
  }

  async function confirmDelete() {
    if (!deletingPage) return;
    setDeleteBusy(true);
    setDeleteError("");

    try {
      await api<null>(`/workspace-pages/${deletingPage.id}`, { method: "DELETE" });
      setPages((current) => current.filter((item) => item.id !== deletingPage.id));
      setDeletingPage(null);
    } catch (requestError) {
      setDeleteError(messageFromError(requestError));
    } finally {
      setDeleteBusy(false);
    }
  }

  const topicTitle = (topicId: number | null) =>
    topicId ? topics.find((topic) => topic.id === topicId)?.title ?? null : null;

  return (
    <PageShell
      className="workspace-list-page"
      title="Workspace"
      subtitle="Freeform pages for notes, checklists, and saved resources -- your way of organizing things."
      action={<Button variant="primary" onClick={() => setShowModal(true)}><Plus size={16} strokeWidth={2.2} /> New page</Button>}
    >
      {error && <p className="page-error" role="alert">{error}</p>}
      {loading ? (
        <LoadingState label="Loading your pages…" />
      ) : (
        <div className="workspace-grid">
          {pages.map((page) => {
            const linkedTitle = topicTitle(page.topic_id);
            return (
              <article className="workspace-card" key={page.id}>
                <div className="workspace-card-top">
                  <span className="topic-icon purple"><NotebookPen size={18} strokeWidth={1.8} /></span>
                  <button
                    type="button"
                    className="danger-link"
                    aria-label={`Delete ${page.title}`}
                    onClick={() => {
                      setDeleteError("");
                      setDeletingPage(page);
                    }}
                  >
                    <Trash2 size={17} aria-hidden="true" /><span>Delete</span>
                  </button>
                </div>
                <Link className="workspace-card-link" href={`/workspace-page?id=${page.id}`}>
                  <Badge tone={linkedTitle ? "accent" : "neutral"}>{linkedTitle ?? "Personal page"}</Badge>
                  <h2 dir="auto">{page.title}</h2>
                  <p className="workspace-card-preview" dir="auto">{blockPreview(page.blocks)}</p>
                  <div className="workspace-card-meta">Updated {new Date(page.updated_at).toLocaleDateString()}</div>
                  <span className="workspace-open-page" aria-hidden="true">Open page <span>→</span></span>
                </Link>
              </article>
            );
          })}
          {!pages.length && <EmptyState Icon={NotebookPen} title="Your workspace is ready" description="Create a page to collect notes, checklists, and useful links in one place." action={<Button variant="primary" onClick={() => setShowModal(true)}><Plus size={16} /> Create page</Button>} />}
        </div>
      )}
      {showModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowModal(false)}>
          <form
            role="dialog" aria-modal="true" aria-labelledby="create-workspace-page-title"
            className="topic-modal action-modal" onSubmit={createPage} onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowModal(false)}><X size={22} /></button>
            <div className="modal-icon edit-icon"><Sparkles size={22} /></div>
            <div className="eyebrow">NEW WORKSPACE PAGE</div>
            <h2 id="create-workspace-page-title">Create a page</h2>
            <label>Page title<input name="title" required maxLength={200} autoFocus /></label>
            <label>Link to a topic (optional)
              <select name="topic_id" defaultValue="">
                <option value="">Not linked to a topic</option>
                {topics.map((topic) => <option value={topic.id} key={topic.id}>{topic.title}</option>)}
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button disabled={creating} className="button button-primary" type="submit">{creating ? "Creating…" : "Create page"}</button>
            </div>
          </form>
        </div>
      )}
      {deletingPage && (
        <div className="modal-backdrop" onMouseDown={() => (deleteBusy ? null : setDeletingPage(null))}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-page-title" className="topic-modal action-modal delete-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label="Close" disabled={deleteBusy} onClick={() => setDeletingPage(null)}><X size={22} /></button>
            <div className="modal-icon delete-icon"><Trash2 size={22} /></div>
            <div className="eyebrow">REMOVE THIS PAGE</div>
            <h2 id="delete-page-title">Delete “{deletingPage.title}”?</h2>
            <p>This permanently removes the page and everything on it. This can&apos;t be undone.</p>
            {deleteError && <p className="form-error">{deleteError}</p>}
            <div className="modal-actions">
              <button type="button" className="button button-secondary" disabled={deleteBusy} onClick={() => setDeletingPage(null)}>Cancel</button>
              <button type="button" className="button button-danger" disabled={deleteBusy} onClick={() => void confirmDelete()}>
                {deleteBusy ? "Deleting…" : "Delete page"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
