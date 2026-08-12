"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  FileText,
  Sparkles,
  StickyNote,
  Swords,
  Trash2,
  Trophy,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import {
  api,
  messageFromError,
  Note,
  Pagination,
  Topic,
} from "../../lib/api";
import {
  documentTypeBadge,
  DOCUMENT_STATUS_LABELS,
  humanizeFilename,
  PageShell,
  StudyDocument,
  useAuthFailure,
  XpAward,
  XpToast,
} from "../shared/PageChrome";
import { Button, EmptyState, LoadingState } from "../ui";
import { ChatCard, Composer, MessageBubble, QuickChip, TypingIndicator, TutorAvatar } from "../chat/ChatUI";

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

function AnswerRating({ messageId }: { messageId: number }) {
  const [rating, setRating] = useState<-1 | 1 | null>(null);
  const [saving, setSaving] = useState(false);

  async function rate(next: -1 | 1) {
    if (saving) return;
    setSaving(true);
    try {
      await api(`/ai/messages/${messageId}/feedback`, {
        method: "PUT",
        body: JSON.stringify({ rating: next, reason: next === 1 ? "helpful" : "unclear" }),
      });
      setRating(next);
    } catch {
      // Keep the conversation usable if feedback telemetry is temporarily
      // unavailable (for example while an older backend is restarting).
    } finally {
      setSaving(false);
    }
  }

  return <div className="answer-rating" aria-label="Rate this answer">
    <span>{rating ? "Thanks for your feedback" : "Was this helpful?"}</span>
    <button className={rating === 1 ? "selected" : ""} type="button" disabled={saving} onClick={() => void rate(1)} aria-label="Helpful answer"><ThumbsUp size={14} /></button>
    <button className={rating === -1 ? "selected" : ""} type="button" disabled={saving} onClick={() => void rate(-1)} aria-label="Unhelpful answer"><ThumbsDown size={14} /></button>
  </div>;
}

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

const INLINE_FILENAME_PATTERN = /["“]?\b([\w][\w.\-]*\.(?:pdf|txt))\b["”]?/gi;

function InlineFileChip({ filename }: { filename: string }) {
  const { label, ext } = humanizeFilename(filename);
  return (
    <span className="inline-doc-chip">
      <span aria-hidden="true" className="inline-doc-chip-icon"><FileText size={12} /></span>
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

function messageEmoji(text: string): string | null {
  const value = text.toLowerCase();
  if (/well done|great job|excellent|you got it|correct/.test(value)) return "🎉";
  if (/warning|be careful|important|watch out|common mistake/.test(value)) return "⚠️";
  if (/remember|memorize|keep in mind|key point/.test(value)) return "🧠";
  if (/break it down|in simple terms|explain|means that|for example/.test(value)) return "💡";
  if (/what do you think|why do you think|can you explain|your turn|consider this/.test(value)) return "🤔";
  if (/next step|try this|practice|challenge/.test(value)) return "🎯";
  return null;
}

export function LegacyAiMessageContent({ text }: { text: string }) {
  const formatted = text
    .replace(/\s+(?=\d+\.\s+\*\*)/g, "\n")
    .replace(/\s+(?=[-*]\s+\*\*)/g, "\n");
  const lines = formatted.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const emoji = messageEmoji(text);

  return (
    <div className="ai-message-content">
      {emoji && <span className="message-emoji" aria-hidden="true">{emoji}</span>}
      <div className="ai-message-copy">{lines.map((line, index) => {
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
      })}</div>
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return <div className="ai-code-block" dir="ltr">
    <div className="ai-code-heading"><span>{language || "Code"}</span><button type="button" onClick={() => void copyCode()} aria-label="Copy code">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button></div>
    <pre><code>{code}</code></pre>
  </div>;
}

function ProseBlock({ text, blockIndex }: { text: string; blockIndex: number }) {
  const formatted = text.replace(/\s+(?=\d+\.\s+\*\*)/g, "\n").replace(/\s+(?=[-*]\s+\*\*)/g, "\n");
  const lines = formatted.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return <>{lines.map((line, index) => {
    const numbered = line.match(/^(\d+)\.\s*(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (numbered) return <div className="ai-message-point" key={`${blockIndex}-${index}`}><span>{numbered[1]}</span><p>{renderInlineMarkdown(numbered[2])}</p></div>;
    if (bullet) return <div className="ai-message-bullet" key={`${blockIndex}-${index}`}><span>•</span><p>{renderInlineMarkdown(bullet[1])}</p></div>;
    return <p key={`${blockIndex}-${index}`}>{renderInlineMarkdown(line)}</p>;
  })}</>;
}

function AiMessageContent({ text }: { text: string }) {
  const blocks = text.split(/(```[\s\S]*?```)/g).filter(Boolean);
  return <div className="ai-message-content"><div className="ai-message-copy">{blocks.map((block, index) => {
    if (!block.startsWith("```")) return <ProseBlock text={block} blockIndex={index} key={index} />;
    const raw = block.slice(3, -3).replace(/^\n/, "").replace(/\n$/, "");
    const newline = raw.indexOf("\n");
    const firstLine = newline >= 0 ? raw.slice(0, newline).trim() : "";
    const hasLanguage = /^[a-zA-Z0-9_+#.-]+$/.test(firstLine);
    return <CodeBlock language={hasLanguage ? firstLine : "Code"} code={hasLanguage ? raw.slice(newline + 1) : raw} key={index} />;
  })}</div></div>;
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
  const requestedQuestion = params.get("question");
  const [input, setInput] = useState(requestedQuestion || (requestedConcept ? `Tell me more about ${requestedConcept}.` : ""));
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
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
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const container = chatMessagesRef.current;
      if (!container) return;
      container.scrollTo({ top: container.scrollHeight, behavior: loadingMessages ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, sparMessages, agentMessages, sending, sparStarting, agentSending, loadingMessages, sparMode, agentMode]);

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
    await sendQuestion(input);
  }

  async function sendQuestion(value: string) {
    const question = value.trim();
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
    setConfirmingClear(false);

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
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !showDocumentPicker) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <PageShell className="tutor-page" title="AI tutor" subtitle="Ask questions and learn directly from your topic notes.">
      {xpToast && <XpToast award={xpToast} onDismiss={() => setXpToast(null)} />}
      {error && <p className="page-error" role="alert">{error}</p>}
      {loadingTopics ? <LoadingState label="Loading your topics…" /> : !topics.length ? (
        <EmptyState Icon={Sparkles} title="Give your tutor something to study" description="Create a topic and add notes before starting a conversation." action={<Button variant="primary" href="/topics">Create topic</Button>} />
      ) : (
        <div className="tutor-layout">
          <ChatCard mode={sparMode ? "sparring" : agentMode ? "agent" : "tutor"}>
            <div className="chat-heading">
              <TutorAvatar mode={sparMode ? "sparring" : agentMode ? "agent" : "tutor"} />
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
                  <button type="button" className="spar-toggle" onClick={() => { setSparMode(true); setAgentMode(false); }}><Swords size={13} /> Spar with me</button>
                  <button type="button" className="agent-toggle" onClick={toggleAgentMode}><Bot size={13} /> Ask my agents</button>
                  {!!messages.length && <button type="button" className="clear-chat-action" disabled={clearing} onClick={() => setConfirmingClear(true)}>
                    {clearing ? "Clearing…" : "Clear chat"}
                  </button>}
                </div>
              )}
            </div>
            {sparMode ? (
              <>
                <div className="chat-messages" ref={chatMessagesRef} aria-live="polite">
                  {!sparConcept && (
                    <div className="chat-welcome">
                      The AI will confidently argue a wrong claim about a concept you pick -- find the flaw, correct it, and win the round.
                    </div>
                  )}
                  {sparMessages.map((message) => (
                    <MessageBubble role={message.role} variant="sparring" key={message.id}>
                        {message.role === "assistant"
                          ? <AiMessageContent text={message.message} />
                          : <p>{message.message}</p>}
                        {message.role === "assistant" && message.usedMemory && (
                          <span className="memory-used-badge" title="Shaped by what Studia remembers about you"><Brain size={11} /> remembered</span>
                        )}
                    </MessageBubble>
                  ))}
                  {(sending || sparStarting) && <TypingIndicator variant="sparring" label="Sparring reply is being prepared" />}
                  {sparVerdict === "concede" && (
                    <div className="spar-verdict-card">
                      <span className="spar-verdict-icon"><Trophy size={20} /></span>
                      <div>
                        <strong>You won this round.</strong>
                        <p>Your correction held up -- that&apos;s a stronger signal than just reading the answer.</p>
                      </div>
                      <button type="button" className="button button-primary" onClick={newSpar}>Spar again <ArrowRight size={13} /></button>
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
                        {sparStarting ? "Starting…" : <>Start spar <ArrowRight size={13} /></>}
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
                      <button disabled={sending || !input.trim()} type="submit">{sending ? "Sending…" : <>Rebut <ArrowRight size={13} /></>}</button>
                    </form>
                  )}
                </div>
              </>
            ) : agentMode ? (
              <>
                <div className="chat-messages" ref={chatMessagesRef} aria-live="polite">
                  {!agentMessages.length && (
                    <div className="chat-welcome">
                      Try: &quot;Quiz me on this topic&quot;, &quot;Make me flashcards&quot;, &quot;What should I study today?&quot;, or &quot;Give me an exam.&quot;
                    </div>
                  )}
                  {agentMessages.map((message) => (
                    <MessageBubble role={message.role} variant="agent" key={message.id}>
                        {message.role === "assistant" ? <AiMessageContent text={message.message} /> : <p>{message.message}</p>}
                        {message.role === "assistant" && message.sessionId != null && (
                          <div className="agent-trace-toggle-row">
                            {message.agentLabel && <span className="agent-label-badge">{message.agentLabel}</span>}
                            <button type="button" className="agent-trace-toggle" onClick={() => void toggleTrace(message.sessionId!)}>
                              {expandedTraceFor === message.sessionId ? <>Hide agent trace <ChevronUp size={12} /></> : <>How I did this <ChevronDown size={12} /></>}
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
                    </MessageBubble>
                  ))}
                  {agentSending && <TypingIndicator variant="agent" label="Routing to the right study agent" />}
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
                    <button disabled={agentSending || !input.trim()} type="submit">{agentSending ? "Sending…" : <>Send <ArrowRight size={13} /></>}</button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <div className="chat-messages" ref={chatMessagesRef} aria-live="polite">
                  {loadingMessages ? <LoadingState label="Loading conversation…" /> : (
                    <>
                      {!messages.length && (
                        <div className="chat-welcome">
                          <span aria-hidden="true"><Sparkles size={22} /></span>
                          <strong>What would you like to learn?</strong>
                          <p>Ask about {selectedTopic?.title}, summarize your notes, or create a practice quiz.</p>
                        </div>
                      )}
                      {messages.map((message) => (
                        <MessageBubble role={message.role} key={message.id}>
                            {message.role === "assistant"
                              ? <AiMessageContent text={message.message} />
                              : <p>{message.message}</p>}
                            {message.role === "assistant" && !!message.sources?.length && (
                              <div className="message-sources">
                                <span className="message-sources-label">Sources</span>
                                {message.sources.map((source, index) => (
                                  <button
                                    type="button"
                                    className={`source-chip ${source.sourceType}`}
                                    key={`${source.sourceType}-${source.sourceId}-${index}`}
                                    title={source.excerpt}
                                    onClick={() => {
                                      void api(`/ai/messages/${message.id}/sources/click`, {
                                        method: "POST",
                                        body: JSON.stringify({
                                          sourceType: source.sourceType,
                                          sourceId: source.sourceId,
                                          score: source.score,
                                        }),
                                      }).catch(() => {
                                        // click telemetry is best-effort
                                      });
                                    }}
                                  >
                                    {source.sourceType === "note" ? <StickyNote size={11} /> : <FileText size={11} />}{" "}
                                    {source.sourceType === "document"
                                      ? humanizeFilename(source.sourceTitle).label
                                      : source.sourceTitle}
                                  </button>
                                ))}
                              </div>
                            )}
                            {message.role === "assistant" && message.usedMemory && (
                              <span className="memory-used-badge" title="Shaped by what Studia remembers about you"><Brain size={11} /> remembered</span>
                            )}
                            {message.role === "assistant" && message.id > 0 && <AnswerRating messageId={message.id} />}
                        </MessageBubble>
                      ))}
                      {sending && <TypingIndicator />}
                    </>
                  )}
                </div>
                <div className="quick-prompts">
                  {[
                    { label: "Summarize", prompt: "Summarize my notes" },
                    { label: "Explain simply", prompt: "Explain this topic simply" },
                    { label: "Create quiz", prompt: "Create a 5 question quiz" },
                  ].map(({ label, prompt }) => (
                    <QuickChip onClick={() => void sendQuestion(prompt)} key={prompt}>{label}</QuickChip>
                  ))}
                </div>
                <div className="chat-input-wrap">
                  {scopedDocument && !showDocumentPicker && (
                    <div className="scoped-doc-row">
                      <span className="scoped-doc-chip">
                        <FileText size={13} /> Asking about {humanizeFilename(scopedDocument.title).label}
                        <button type="button" aria-label="Stop focusing on this document" onClick={() => setSelectedDocumentId(null)}><X size={14} /></button>
                      </span>
                    </div>
                  )}
                  {showDocumentPicker && (
                    <div className="slash-doc-picker" role="listbox" aria-label="Select a document to focus your question on">
                      <div className="slash-doc-picker-label">Ask about a specific document</div>
                      {filteredDocuments.length ? filteredDocuments.map((document) => (
                        <button type="button" className="slash-doc-option" key={document.id} onClick={() => selectDocumentForQuestion(document)}>
                          <span aria-hidden="true"><FileText size={14} /></span>
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
                  <Composer value={input} onChange={setInput} onSubmit={send} onKeyDown={handleInputKeyDown} placeholder={scopedDocument ? "Ask about this document…" : "Ask your tutor a question, or type / to focus on a document…"} disabled={sending || !topicId} sendDisabled={showDocumentPicker || !input.trim()} />
                </div>
              </>
            )}
          </ChatCard>
          <aside className="tutor-context">
            <div className="section-kicker">CURRENT CONTEXT</div>
            <span className="topic-icon purple"><BookOpen size={20} strokeWidth={1.8} /></span>
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
                <span className="kb-icon notes"><StickyNote size={16} strokeWidth={1.8} /></span>
                <div>
                  <b>{knowledgeNotesTotal ?? 0} note{knowledgeNotesTotal === 1 ? "" : "s"}</b>
                  <small>Saved notes the tutor can reference</small>
                </div>
              </div>
              <div className="kb-row">
                <span className="kb-icon docs"><FileText size={16} strokeWidth={1.8} /></span>
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
                    <span aria-hidden="true"><FileText size={14} /></span>
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
      {confirmingClear && (
        <div className="modal-backdrop" onMouseDown={() => setConfirmingClear(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="clear-chat-title" className="topic-modal action-modal delete-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label="Close" onClick={() => setConfirmingClear(false)}><X size={22} /></button>
            <div className="modal-icon delete-icon"><Trash2 size={22} /></div>
            <div className="eyebrow">CLEAR CONVERSATION</div>
            <h2 id="clear-chat-title">Clear this conversation?</h2>
            <p>This removes every message in this topic&apos;s AI tutor chat. This can&apos;t be undone.</p>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setConfirmingClear(false)}>Cancel</button>
              <button type="button" className="button button-danger" onClick={() => void clearHistory()}>Clear chat</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
