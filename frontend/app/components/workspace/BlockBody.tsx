"use client";

import { KeyboardEvent as ReactKeyboardEvent, ReactNode, useState } from "react";
import { AtSign, Bookmark, ExternalLink, Image as ImageIcon, Video as VideoIcon, X } from "lucide-react";
import EditableText from "./EditableText";
import { BLOCK_DEF_MAP } from "./blockDefs";
import { getPlainText } from "./caret";
import { BlockProperties, WorkspaceBlock } from "./types";
import { useWorkspaceContext } from "./workspaceContext";

const URL_ONLY_PATTERN = /^https?:\/\/\S+$/i;

type Props = {
  block: WorkspaceBlock;
  onChange: (text: string, el: HTMLDivElement) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  elementId: string;
};

function extractYoutubeId(url: string): string | null {
  const match = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/.exec(url);
  return match ? match[1] : null;
}

export default function BlockBody({ block, onChange, onKeyDown, elementId }: Props) {
  const { menus } = useWorkspaceContext();
  const def = BLOCK_DEF_MAP[block.type];

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const text = event.clipboardData.getData("text/plain").trim();
    if (URL_ONLY_PATTERN.test(text) && !getPlainText(event.currentTarget).trim()) {
      event.preventDefault();
      menus.openLinkPasteMenu(block.id, text, event.currentTarget.getBoundingClientRect());
    }
  }

  function editable(className: string, placeholder = "Type '/' for commands…") {
    return (
      <EditableText
        id={elementId}
        value={block.content}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onPaste={handlePaste}
        className={className}
        placeholder={placeholder}
      />
    );
  }

  switch (block.type) {
    case "text":
      if (block.properties.url && !block.content.trim()) {
        return <MentionChip block={block} />;
      }
      return editable("workspace-text-block");
    case "heading_1":
      return editable("workspace-heading-block level-1", "Heading 1");
    case "heading_2":
      return editable("workspace-heading-block level-2", "Heading 2");
    case "heading_3":
      return editable("workspace-heading-block level-3", "Heading 3");
    case "heading_4":
      return editable("workspace-heading-block level-4", "Heading 4");
    case "bulleted_list_item":
      return (
        <div className="workspace-list-row">
          <span className="workspace-list-bullet">•</span>
          {editable("workspace-text-block", "List item")}
        </div>
      );
    case "numbered_list_item":
      return (
        <div className="workspace-list-row">
          <span className="workspace-list-number">#</span>
          {editable("workspace-text-block", "List item")}
        </div>
      );
    case "todo":
      return <TodoRow block={block} elementId={elementId} onChange={onChange} onKeyDown={onKeyDown} handlePaste={handlePaste} />;
    case "toggle":
      return editable("workspace-text-block workspace-toggle-summary", "Toggle");
    case "quote":
      return editable("workspace-quote-block", "Quote");
    case "callout":
      return (
        <div className={`workspace-callout ${block.properties.backgroundColor ? `bg-${block.properties.backgroundColor}` : "bg-warning"}`}>
          <span className="workspace-callout-icon"><def.Icon size={16} /></span>
          {editable("workspace-text-block", "Write something to call out…")}
        </div>
      );
    case "code":
      return <CodeBlockView block={block} elementId={elementId} onChange={onChange} onKeyDown={onKeyDown} />;
    case "equation":
      return (
        <div className="workspace-equation-block">
          <span className="workspace-equation-icon">Σ</span>
          {editable("workspace-equation-area", "e.g. E = mc^2")}
        </div>
      );
    case "divider":
      return <hr className="workspace-divider" />;
    case "image":
      return <MediaUrlBlock block={block} icon={<ImageIcon size={16} />} kind="image" />;
    case "video":
      return <MediaUrlBlock block={block} icon={<VideoIcon size={16} />} kind="video" />;
    case "bookmark":
      return <MediaUrlBlock block={block} icon={<Bookmark size={16} />} kind="bookmark" />;
    case "page":
      return editable("workspace-page-block", "Untitled page");
    default:
      return editable("workspace-text-block");
  }
}

/** A "Mention"/"URL" paste result: a compact, non-editable clickable link
 * chip rather than free text -- there's no inline rich-text model in this
 * editor, so a link can't be embedded inside otherwise-editable text; this
 * is the closest equivalent. The X detaches the link and returns the block
 * to a normal empty, editable text block. */
function MentionChip({ block }: { block: WorkspaceBlock }) {
  const { editor } = useWorkspaceContext();
  const label = block.properties.title || block.properties.url || "";
  const isRawUrl = label === block.properties.url;

  return (
    <span className="workspace-mention-chip">
      <a href={block.properties.url ?? "#"} target="_blank" rel="noreferrer">
        <span>{isRawUrl ? <ExternalLink size={12} /> : <AtSign size={12} />}</span>
        {label}
      </a>
      <button
        type="button"
        aria-label="Remove link, keep as text"
        onClick={() => editor.updateBlockProperties(block.id, { url: null, title: null })}
      >
        <X size={11} />
      </button>
    </span>
  );
}

function TodoRow({
  block,
  elementId,
  onChange,
  onKeyDown,
  handlePaste,
}: {
  block: WorkspaceBlock;
  elementId: string;
  onChange: (text: string, el: HTMLDivElement) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  handlePaste: (event: React.ClipboardEvent<HTMLDivElement>) => void;
}) {
  const { editor } = useWorkspaceContext();
  return (
    <div className={`workspace-todo-row ${block.properties.checked ? "checked" : ""}`}>
      <input
        type="checkbox"
        checked={!!block.properties.checked}
        onChange={(event) => editor.updateBlockProperties(block.id, { checked: event.target.checked })}
        aria-label="Mark to-do as done"
      />
      <EditableText
        id={elementId}
        value={block.content}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onPaste={handlePaste}
        className="workspace-text-block"
        placeholder="To-do"
      />
    </div>
  );
}

function CodeBlockView({
  block,
  elementId,
  onChange,
  onKeyDown,
}: {
  block: WorkspaceBlock;
  elementId: string;
  onChange: (text: string, el: HTMLDivElement) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
}) {
  const { editor } = useWorkspaceContext();
  return (
    <div className="workspace-code-block">
      <input
        className="workspace-code-language"
        value={block.properties.language ?? ""}
        placeholder="plaintext"
        onChange={(event) => editor.updateBlockProperties(block.id, { language: event.target.value })}
      />
      <EditableText
        id={elementId}
        value={block.content}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className="workspace-code-area"
        placeholder="Code"
      />
    </div>
  );
}

function MediaUrlBlock({
  block,
  icon,
  kind,
}: {
  block: WorkspaceBlock;
  icon: ReactNode;
  kind: "image" | "video" | "bookmark";
}) {
  const { editor } = useWorkspaceContext();
  const [draft, setDraft] = useState("");
  const hasContent = kind === "video" ? !!(block.properties.youtubeId || block.properties.url) : !!block.properties.url;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const url = draft.trim();
    if (!url) return;
    const patch: Partial<BlockProperties> = { url, title: block.properties.title || url };
    if (kind === "video") {
      const youtubeId = extractYoutubeId(url);
      if (youtubeId) patch.youtubeId = youtubeId;
    }
    editor.updateBlockProperties(block.id, patch);
    setDraft("");
  }

  if (!hasContent) {
    return (
      <form className="workspace-media-prompt" onSubmit={submit}>
        <span className="workspace-media-prompt-icon">{icon}</span>
        <input
          type="url"
          placeholder={kind === "image" ? "Paste an image URL…" : kind === "video" ? "Paste a video URL (e.g. YouTube)…" : "Paste a link URL…"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="button button-secondary">Embed</button>
      </form>
    );
  }

  if (kind === "image") {
    return (
      <figure className="workspace-image-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={block.properties.url ?? ""} alt={block.properties.title ?? "Embedded image"} loading="lazy" />
      </figure>
    );
  }

  if (kind === "video" && block.properties.youtubeId) {
    return (
      <div className="workspace-video-block">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${block.properties.youtubeId}`}
          title={block.properties.title ?? "Embedded video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <a className="workspace-link-preview" href={block.properties.url ?? "#"} target="_blank" rel="noreferrer">
      {block.properties.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="workspace-link-preview-image" src={block.properties.imageUrl} alt="" />
      ) : (
        <span><ExternalLink size={15} /></span>
      )}
      <div>
        <b>{block.properties.title || block.properties.url}</b>
        {block.properties.description && <small>{block.properties.description}</small>}
        <small className="workspace-link-preview-url">{block.properties.siteName || block.properties.url}</small>
      </div>
    </a>
  );
}
