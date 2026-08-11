"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bookmark,
  BookOpen,
  Brain,
  ClipboardCheck,
  History,
  Layers,
  ListChecks,
  NotebookPen,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  StickyNote,
  Target,
  X,
} from "lucide-react";
import { api } from "../lib/api";

type SearchResult = {
  id: number;
  title?: string;
  snippet?: string;
  status?: string;
  topicId?: number;
  topicTitle?: string;
};

type SearchResponse = {
  topics: SearchResult[];
  notes: SearchResult[];
  documents: SearchResult[];
  workspacePages: SearchResult[];
  quizzes: SearchResult[];
  exams: SearchResult[];
  flashcards: SearchResult[];
};

const EMPTY_RESULTS: SearchResponse = {
  topics: [], notes: [], documents: [], workspacePages: [], quizzes: [], exams: [], flashcards: [],
};

type PaletteItem = { key: string; label: string; hint: string; href: string; Icon: typeof Search };

const quickActions: PaletteItem[] = [
  { key: "dashboard", label: "Go to overview", hint: "Dashboard", href: "/dashboard", Icon: BarChart3 },
  { key: "topics", label: "Browse topics", hint: "My topics", href: "/topics", Icon: BookOpen },
  { key: "workspace", label: "Open workspace", hint: "Notion-style pages", href: "/workspace", Icon: NotebookPen },
  { key: "coach", label: "Open study coach", hint: "Coach", href: "/coach", Icon: Target },
  { key: "tutor", label: "Ask the AI tutor", hint: "Open tutor", href: "/ai-tutor", Icon: Sparkles },
  { key: "quizzes", label: "Create a quiz", hint: "Choose a topic", href: "/quizzes", Icon: ListChecks },
  { key: "exams", label: "Start an exam", hint: "Exams", href: "/exams", Icon: ClipboardCheck },
  { key: "flashcards", label: "Review due cards", hint: "Start review", href: "/flashcards", Icon: Layers },
  { key: "history", label: "View study history", hint: "History", href: "/study-history", Icon: History },
  { key: "mistakes", label: "Open mistake notebook", hint: "Review errors", href: "/mistakes", Icon: Brain },
  { key: "settings", label: "Open settings", hint: "Settings", href: "/settings", Icon: SettingsIcon },
];

export function CommandPalette() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const shortcutLabel = "Ctrl K";
  const [results, setResults] = useState<SearchResponse>(EMPTY_RESULTS);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && (event.code === "KeyK" || event.key.toLowerCase() === "k")) {
        event.preventDefault();
        event.stopPropagation();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(EMPTY_RESULTS);
      return;
    }
    const timer = window.setTimeout(() => {
      api<SearchResponse>(`/study-search?q=${encodeURIComponent(query)}`)
        .then(setResults).catch(() => setResults(EMPTY_RESULTS));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const items: PaletteItem[] = useMemo(() => {
    if (!query.trim()) return quickActions;
    return [
      ...results.topics.map((item) => ({
        key: `topic-${item.id}`, label: item.title ?? "Topic", hint: "Topic",
        href: `/topic?id=${item.id}`, Icon: BookOpen,
      })),
      ...results.notes.map((item) => ({
        key: `note-${item.id}`, label: item.title ?? "Note", hint: item.topicTitle ?? "Note",
        href: `/topic?id=${item.topicId}`, Icon: StickyNote,
      })),
      ...results.documents.map((item) => ({
        key: `document-${item.id}`, label: item.title ?? "Document", hint: item.topicTitle ?? "Document",
        href: `/topic?id=${item.topicId}`, Icon: Bookmark,
      })),
      ...results.workspacePages.map((item) => ({
        key: `workspace-${item.id}`, label: item.title ?? "Workspace page", hint: "Workspace",
        href: `/workspace-page?id=${item.id}`, Icon: NotebookPen,
      })),
      ...results.quizzes.map((item) => ({
        key: `quiz-${item.id}`, label: item.title ?? "Quiz", hint: item.topicTitle ?? "Quiz",
        href: `/topic?id=${item.topicId}`, Icon: ListChecks,
      })),
      ...results.exams.map((item) => ({
        key: `exam-${item.id}`, label: item.title ?? "Exam", hint: item.topicTitle ?? "Exam",
        href: `/topic?id=${item.topicId}`, Icon: ClipboardCheck,
      })),
      ...results.flashcards.map((item) => ({
        key: `flashcard-${item.id}`, label: item.snippet ?? "Flashcard", hint: item.topicTitle ?? "Flashcard",
        href: `/topic?id=${item.topicId}`, Icon: Layers,
      })),
    ];
  }, [query, results]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) go(item.href);
    }
  }

  if (!open) {
    return (
      <button
        className="command-palette-trigger" type="button" onClick={() => setOpen(true)}
        aria-label={`Open quick search (${shortcutLabel})`} title={`Open quick search (${shortcutLabel})`}
      >
        <Search size={16} /><span>Quick search</span><kbd>{shortcutLabel}</kbd>
      </button>
    );
  }

  return (
    <div className="command-backdrop" onMouseDown={() => setOpen(false)}>
      <section
        className="command-palette" role="dialog" aria-modal="true" aria-label="Quick search"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-search">
          <Search size={19} aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-activedescendant={items.length ? `command-item-${activeIndex}` : undefined}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search topics, notes, documents, quizzes, exams, or open a tool…"
          />
          <button onClick={() => setOpen(false)} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="command-label">{query ? "Search results" : "Quick actions"}</div>
        <div className="command-results" id="command-palette-results" role="listbox" ref={listRef}>
          {items.map((item, index) => (
            <button
              key={item.key}
              id={`command-item-${index}`}
              data-index={index}
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "active" : undefined}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => go(item.href)}
            >
              <span><item.Icon size={18} /></span>
              <div><strong>{item.label}</strong><small>{item.hint}</small></div>
            </button>
          ))}
          {!items.length && <p>No topics, notes, documents, or activities match “{query}”.</p>}
        </div>
        <footer><span>↑↓ Navigate</span><span>Enter Open</span><span>Esc Close</span></footer>
      </section>
    </div>
  );
}
