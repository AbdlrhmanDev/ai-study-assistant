"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  Download,
  FileText,
  FolderInput,
  GitBranch,
  Layers,
  ListChecks,
  Network,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import {
  api,
  downloadFile,
  messageFromError,
  Note,
  Pagination,
  Topic,
  uploadWithProgress,
} from "../../lib/api";
import {
  DOCUMENT_STATUS_LABELS,
  documentTypeBadge,
  humanizeFilename,
  PageShell,
  StudyDocument,
  useAuthFailure,
} from "../shared/PageChrome";
import { ActionTile, Badge, Card, EmptyState, ListRow, MasteryBar, ProgressBar } from "../ui";

function humanUploadError(status: number, fallback: string): string {
  if (status === 415) return "That file type isn't supported. Upload a PDF or text file.";
  if (status === 413) return "That file is too large to upload.";
  if (status === 422) return "That upload was rejected by security scanning.";
  return fallback;
}

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

type TopicTool = "notes" | "tutor" | "quizzes" | "flashcards" | "exams" | "mind-map" | "knowledge-graph";

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
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);
  const [deletingNoteBusy, setDeletingNoteBusy] = useState(false);
  const [deleteNoteError, setDeleteNoteError] = useState("");
  const [savingAction, setSavingAction] = useState(false);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [retryingDocumentId, setRetryingDocumentId] = useState<number | null>(null);
  const [deletingDocument, setDeletingDocument] = useState<StudyDocument | null>(null);
  const [deletingDocumentBusy, setDeletingDocumentBusy] = useState(false);
  const [deleteDocumentError, setDeleteDocumentError] = useState("");
  const [weakConcepts, setWeakConcepts] = useState<WeakConcept[]>([]);
  const [levelProgress, setLevelProgress] = useState<TopicLevel | null>(null);
  const [activeTool, setActiveTool] = useState<TopicTool>("notes");
  const [tutorConcept, setTutorConcept] = useState<string | null>(null);
  const [loadedTools, setLoadedTools] = useState<Set<TopicTool>>(() => new Set());
  const [loadingTools, setLoadingTools] = useState<Set<TopicTool>>(() => new Set());
  const loadedToolsRef = useRef<Set<TopicTool>>(new Set());
  const [documentStatusAnnouncement, setDocumentStatusAnnouncement] = useState("");
  const priorDocumentStatusesRef = useRef<Map<number, StudyDocument["status"]>>(new Map());

  const toolUrl = useCallback((tool: TopicTool) => tool === "tutor" ? `/ai-tutor?topicId=${topicId}&embedded=1${tutorConcept ? `&concept=${encodeURIComponent(tutorConcept)}` : ""}`
    : tool === "quizzes" ? `/quizzes/topic?topicId=${topicId}&embedded=1`
    : tool === "flashcards" ? `/flashcards/deck?topicId=${topicId}&embedded=1`
    : tool === "exams" ? `/exams/topic?topicId=${topicId}&embedded=1`
    : tool === "mind-map" ? `/mind-map?topicId=${topicId}&embedded=1`
    : tool === "knowledge-graph" ? `/knowledge-graph?topicId=${topicId}&embedded=1`
    : null, [topicId, tutorConcept]);

  const prepareTool = useCallback((tool: TopicTool) => {
    const url = toolUrl(tool);
    if (url) router.prefetch(url);
  }, [router, toolUrl]);

  const activateTool = useCallback((tool: TopicTool) => {
    if (tool !== "notes" && !loadedToolsRef.current.has(tool)) {
      loadedToolsRef.current = new Set(loadedToolsRef.current).add(tool);
      setLoadedTools(loadedToolsRef.current);
      setLoadingTools((current) => new Set(current).add(tool));
    }
    setActiveTool(tool);
  }, []);

  useEffect(() => {
    function handleEmbeddedToolMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const message = event.data as { type?: string; tool?: string; concept?: unknown };
      if (message.type !== "studia:set-topic-tool" || message.tool !== "tutor") return;
      setTutorConcept(typeof message.concept === "string" ? message.concept : null);
      activateTool("tutor");
    }
    window.addEventListener("message", handleEmbeddedToolMessage);
    return () => window.removeEventListener("message", handleEmbeddedToolMessage);
  }, [activateTool]);

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
  const hasPendingDocument = useMemo(
    () => documents.some(
      (document) => document.status === "pending" || document.status === "processing",
    ),
    [documents],
  );

  useEffect(() => {
    if (!hasPendingDocument || !Number.isInteger(topicId) || topicId < 1) return;

    // Depending on the boolean (not `documents` itself) means each poll tick's
    // setDocuments() call doesn't tear down and recreate this interval --
    // otherwise the interval was rebuilt from scratch every 2s, which could
    // drift the actual polling cadence if anything else touched `documents`
    // mid-cycle.
    const timer = window.setInterval(async () => {
      try {
        const result = await api<{ documents: StudyDocument[] }>(`/topics/${topicId}/documents`);
        setDocuments(result.documents);
      } catch {
        // transient polling error -- next tick will retry
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [hasPendingDocument, topicId]);

  // Announce document processing outcomes for screen-reader users, since the
  // only other signal is a status badge color/label change no one narrates.
  useEffect(() => {
    const prior = priorDocumentStatusesRef.current;
    for (const document of documents) {
      const previousStatus = prior.get(document.id);
      const wasInFlight = previousStatus === "pending" || previousStatus === "processing";
      if (wasInFlight && document.status === "completed") {
        setDocumentStatusAnnouncement(`${document.original_filename} finished processing.`);
      } else if (wasInFlight && document.status === "failed") {
        setDocumentStatusAnnouncement(`${document.original_filename} failed to process.`);
      }
    }
    priorDocumentStatusesRef.current = new Map(documents.map((document) => [document.id, document.status]));
  }, [documents]);

  async function uploadDocument(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !Number.isInteger(topicId) || topicId < 1) return;

    setUploadError("");
    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await uploadWithProgress<{ document: StudyDocument }>(
        `/topics/${topicId}/documents`,
        formData,
        (percent) => setUploadProgress(percent),
      );
      setDocuments((current) => [result.document, ...current]);
    } catch (requestError) {
      const status = requestError instanceof Error && "status" in requestError
        ? (requestError as { status: number }).status
        : 0;
      setUploadError(humanUploadError(status, messageFromError(requestError)));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function retryDocument(document: StudyDocument) {
    setUploadError("");
    setRetryingDocumentId(document.id);
    try {
      const result = await api<{ document: StudyDocument }>(
        `/documents/${document.id}/retry`,
        { method: "POST" },
      );
      setDocuments((current) =>
        current.map((item) => (item.id === document.id ? result.document : item)),
      );
    } catch (requestError) {
      setUploadError(messageFromError(requestError));
    } finally {
      setRetryingDocumentId(null);
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

  async function confirmDeleteNote() {
    if (!deletingNote) return;
    setDeletingNoteBusy(true);
    setDeleteNoteError("");
    try {
      await api<null>(`/notes/${deletingNote.id}`, { method: "DELETE" });
      setDeletingNote(null);
      await load();
    } catch (requestError) {
      setDeleteNoteError(messageFromError(requestError));
    } finally {
      setDeletingNoteBusy(false);
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

  async function exportNotes(format: "csv" | "md") {
    try {
      await downloadFile(
        `/topics/${topicId}/notes/export?format=${format}`,
        `notes.${format}`,
      );
    } catch (requestError) {
      setError(messageFromError(requestError));
    }
  }

  return (
    <PageShell className="topic-detail-page" title={topic?.title ?? "Topic"} subtitle={topic?.description ?? "Build understanding one clear note at a time."} action={<Link href="/topics" className="back-topics"><ArrowLeft size={16} /> All topics</Link>}>
      {error && <p className="page-error" role="alert">{error}</p>}
      <nav className="topic-tool-grid" aria-label={`${topic?.title ?? "Topic"} study tools`} role="tablist">
        <ActionTile Icon={Sparkles} title="AI tutor" description="Ask questions using this topic's notes and documents." selected={activeTool === "tutor"} onIntent={() => prepareTool("tutor")} onClick={() => { setTutorConcept(null); activateTool("tutor"); }} />
        <ActionTile Icon={ListChecks} title="Quizzes" description="Create, take, and review quizzes for this topic." selected={activeTool === "quizzes"} onIntent={() => prepareTool("quizzes")} onClick={() => activateTool("quizzes")} />
        <ActionTile Icon={Layers} title="Flashcards" description="Manage cards and start a focused review session." selected={activeTool === "flashcards"} onIntent={() => prepareTool("flashcards")} onClick={() => activateTool("flashcards")} />
        <ActionTile Icon={ClipboardCheck} title="Exams" description="Generate and take a longer practice exam." selected={activeTool === "exams"} onIntent={() => prepareTool("exams")} onClick={() => activateTool("exams")} />
        <ActionTile Icon={GitBranch} title="Mind map" description="See the topic as a visual learning outline." selected={activeTool === "mind-map"} onIntent={() => prepareTool("mind-map")} onClick={() => activateTool("mind-map")} />
        <ActionTile Icon={Network} title="Knowledge graph" description="Explore connections between concepts." selected={activeTool === "knowledge-graph"} onIntent={() => prepareTool("knowledge-graph")} onClick={() => activateTool("knowledge-graph")} />
        <ActionTile Icon={BookOpen} title="Notes & documents" description="Manage the source material for this topic." selected={activeTool === "notes"} onClick={() => activateTool("notes")} />
      </nav>
      {Array.from(loadedTools).map((tool) => {
        const url = toolUrl(tool);
        if (!url) return null;
        const visible = activeTool === tool;
        return <section key={tool} className={`topic-embedded-panel${visible ? "" : " hidden"}`} role="tabpanel" aria-hidden={!visible}>
          {visible && loadingTools.has(tool) && <div className="topic-tool-loading" role="status"><span aria-hidden="true" />Loading {tool.replace("-", " ")}…</div>}
          <iframe src={url} title={`${topic?.title ?? "Topic"} ${tool}`} loading="lazy" onLoad={() => setLoadingTools((current) => { const next = new Set(current); next.delete(tool); return next; })} />
        </section>;
      })}
      <div className={`topic-native-stack${activeTool === "notes" ? "" : " hidden"}`}>
      <section className="notes-panel" id="topic-notes">
        <div className="section-head">
          <div><h2>Your notes</h2><p>{pagination?.total ?? 0} notes in this topic</p></div>
          <div className="page-actions">
            <button className="button button-secondary" onClick={() => void exportNotes("md")}><Download size={14} /> Export Markdown</button>
            <button className="button button-secondary" onClick={() => void exportNotes("csv")}><Download size={14} /> Export CSV</button>
            <button className="add-note-button" onClick={() => setShowNote(true)}><Plus size={14} strokeWidth={2.2} /> Add note</button>
          </div>
        </div>
        <div className="search wide notes-search"><span><Search size={15} /></span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search notes..." /></div>
        <div className="notes-list">
          {notes.map((note) => (
            <ListRow
              key={note.id}
              leading={<StickyNote size={18} strokeWidth={1.8} />}
              title={note.title}
              description={<span dir="auto">{note.content}</span>}
              meta={`Updated ${new Date(note.updated_at).toLocaleDateString()}`}
              actions={<>
                <button type="button" className="ui-icon-action" aria-label={`Edit ${note.title}`} title="Edit" onClick={() => setEditingNote(note)}><Pencil size={17} /></button>
                <button type="button" className="ui-icon-action" aria-label={`Move ${note.title}`} title="Move" onClick={() => setMovingNote(note)}><FolderInput size={17} /></button>
                <button type="button" className="ui-icon-action danger" aria-label={`Delete ${note.title}`} title="Delete" onClick={() => { setDeleteNoteError(""); setDeletingNote(note); }}><Trash2 size={17} /></button>
              </>}
            />
          ))}
          {!notes.length && <EmptyState compact Icon={StickyNote} title={query ? "No matching notes" : "No notes yet"} description={query ? "Try a different search term." : "Add your first note to give the tutor useful context."} />}
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span>Page {page} of {pagination.totalPages}</span>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        )}
      </section>
      <section className="notes-panel documents-panel topic-documents-card">
        <div className="section-head">
          <div className="documents-heading-copy">
            <h2>Study documents</h2>
            <p>{documents.length} uploaded file{documents.length === 1 ? "" : "s"} · used by the AI tutor</p>
          </div>
          <label className={`add-note-button upload-button document-upload-button${uploading ? " disabled" : ""}`}>
            {uploading ? `Uploading… ${uploadProgress ?? 0}%` : <><Plus size={14} strokeWidth={2.2} /> Upload document</>}
            <input
              type="file"
              accept=".txt,.pdf,text/plain,application/pdf"
              hidden
              disabled={uploading}
              onChange={(event) => void uploadDocument(event)}
            />
          </label>
        </div>
        {uploading && (
          <div className="document-upload-progress">
            <ProgressBar value={uploadProgress ?? 0} label="Uploading document" />
          </div>
        )}
        {uploadError && <p className="page-error" role="alert">{uploadError}</p>}
        <p className="sr-only" aria-live="polite">
          {uploading ? `Uploading document, ${uploadProgress ?? 0}% complete.` : documentStatusAnnouncement}
        </p>
        <div className="notes-list">
          {documents.map((document) => (
            <ListRow
              key={document.id}
              className={`document-list-row status-${document.status}`}
              leading={<FileText size={18} strokeWidth={1.8} />}
              title={<span className="document-display-title"><span className="document-name-text" dir="auto">{humanizeFilename(document.title).label}</span><Badge className="document-type-badge">{documentTypeBadge(document.content_type)}</Badge></span>}
              description={document.status === "failed" && document.error_message ? <span className="document-error" dir="auto">{document.error_message}</span> : <span className="document-original-name" dir="auto">{document.original_filename}</span>}
              meta={`Uploaded ${new Date(document.created_at).toLocaleDateString()}`}
              actions={<>
                <Badge className="document-state-badge" tone={document.status === "completed" ? "success" : document.status === "failed" ? "danger" : "warning"}><span className="document-state-dot" aria-hidden="true" />{DOCUMENT_STATUS_LABELS[document.status]}</Badge>
                {document.status === "failed" && (
                  <button
                    type="button"
                    className="ui-icon-action"
                    aria-label={`Retry indexing ${humanizeFilename(document.title).label}`}
                    title="Retry"
                    disabled={retryingDocumentId === document.id}
                    onClick={() => void retryDocument(document)}
                  >
                    <RotateCw size={17} className={retryingDocumentId === document.id ? "retry-icon-spinning" : undefined} />
                  </button>
                )}
                <button type="button" className="ui-icon-action danger" aria-label={`Delete ${humanizeFilename(document.title).label}`} title="Delete" onClick={() => requestDeleteDocument(document)}><Trash2 size={17} /></button>
              </>}
            />
          ))}
          {!documents.length && (
            <EmptyState compact Icon={FileText} title="No study documents yet" description="Upload a PDF or text file to add it to the AI tutor's knowledge base." />
          )}
        </div>
      </section>
      {levelProgress && levelProgress.totalXp > 0 && (
        <Card className="topic-level-panel">
          <div className="section-head">
            <div>
              <span className="ui-label">Topic level</span>
              <h2>{levelProgress.levelName}</h2>
              <p><strong>{levelProgress.totalXp} XP</strong> earned in this topic</p>
            </div>
          </div>
          {levelProgress.nextLevelName && levelProgress.xpForNextLevel != null && (
            <ProgressBar
              value={Math.round((levelProgress.xpIntoLevel / levelProgress.xpForNextLevel) * 100)}
              label={`${levelProgress.xpIntoLevel} of ${levelProgress.xpForNextLevel} XP`}
              detail={`${levelProgress.xpForNextLevel - levelProgress.xpIntoLevel} XP to ${levelProgress.nextLevelName}`}
            />
          )}
        </Card>
      )}
      {!!weakConcepts.length && (
        <Card className="weak-concepts-panel">
          <div className="section-head">
            <div>
              <h2>Weak concepts</h2>
              <p>Built from your quiz answers and flashcard reviews in this topic</p>
              <p className="weak-concepts-hint">Focus on these first for the biggest improvement.</p>
            </div>
          </div>
          <div className="weak-concept-list">
            {weakConcepts.map((concept) => (
              <MasteryBar key={concept.conceptId} label={concept.conceptName} value={concept.masteryScore * 100} />
            ))}
          </div>
        </Card>
      )}
      </div>
      {showNote && (
        <div className="modal-backdrop" onMouseDown={() => setShowNote(false)}>
          <form role="dialog" aria-modal="true" aria-labelledby="add-note-title" className="topic-modal note-modal action-modal" onSubmit={addNote} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowNote(false)}><X size={22} /></button>
            <div className="modal-icon edit-icon"><Sparkles size={22} /></div>
            <div className="eyebrow">CAPTURE AN IDEA</div>
            <h2 id="add-note-title">Add a new note</h2>
            <label>Note title<input name="title" required maxLength={200} autoFocus /></label>
            <label>Note content<textarea name="content" required rows={6} /></label>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowNote(false)}>Cancel</button>
              <button className="button button-primary" type="submit">Save note</button>
            </div>
          </form>
        </div>
      )}
      {editingNote && (
        <div className="modal-backdrop" onMouseDown={() => setEditingNote(null)}>
          <form role="dialog" aria-modal="true" aria-labelledby="edit-note-title" className="topic-modal note-modal action-modal" onSubmit={updateNote} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label="Close" onClick={() => setEditingNote(null)}><X size={22} /></button>
            <div className="modal-icon edit-icon"><Pencil size={22} /></div>
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
            <button type="button" className="modal-close" aria-label="Close" onClick={() => setMovingNote(null)}><X size={22} /></button>
            <div className="modal-icon move-icon"><FolderInput size={22} /></div>
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
      {deletingNote && (
        <div className="modal-backdrop" onMouseDown={() => (deletingNoteBusy ? null : setDeletingNote(null))}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-note-title" className="topic-modal action-modal delete-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label="Close" disabled={deletingNoteBusy} onClick={() => setDeletingNote(null)}><X size={22} /></button>
            <div className="modal-icon delete-icon"><Trash2 size={22} /></div>
            <div className="eyebrow">REMOVE THIS NOTE</div>
            <h2 id="delete-note-title">Delete “{deletingNote.title}”?</h2>
            <p>This note and its content will be permanently removed. This can&apos;t be undone.</p>
            {deleteNoteError && <p className="form-error">{deleteNoteError}</p>}
            <div className="modal-actions">
              <button type="button" className="button button-secondary" disabled={deletingNoteBusy} onClick={() => setDeletingNote(null)}>Cancel</button>
              <button type="button" className="button button-danger" disabled={deletingNoteBusy} onClick={() => void confirmDeleteNote()}>
                {deletingNoteBusy ? "Deleting…" : "Delete note"}
              </button>
            </div>
          </div>
        </div>
      )}
      {deletingDocument && (
        <div className="modal-backdrop" onMouseDown={() => (deletingDocumentBusy ? null : setDeletingDocument(null))}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-document-title" className="topic-modal action-modal delete-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label="Close" disabled={deletingDocumentBusy} onClick={() => setDeletingDocument(null)}><X size={22} /></button>
            <div className="modal-icon delete-icon"><Trash2 size={22} /></div>
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
