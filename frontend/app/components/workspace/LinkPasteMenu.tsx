"use client";

import { useEffect, useState } from "react";
import { AtSign, Bookmark, Link2, Video } from "lucide-react";
import { api, messageFromError } from "../../lib/api";
import { usePopoverPosition } from "./usePopoverPosition";
import { useClickOutside } from "./useClickOutside";
import { LinkPreview } from "./types";

type Props = {
  url: string | null;
  anchorRect: DOMRect | null;
  open: boolean;
  onClose: () => void;
  onChoose: (choice: "mention" | "embed" | "bookmark" | "url", preview: LinkPreview | null) => void;
};

export default function LinkPasteMenu({ url, anchorRect, open, onClose, onChoose }: Props) {
  const { popoverRef, style } = usePopoverPosition(anchorRect, open);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useClickOutside(popoverRef, onClose, open);

  // Genuinely fetches from an external API when `url` changes; there's no
  // render-time equivalent for starting an async request.
  useEffect(() => {
    if (!open || !url) return;
    setPreview(null);
    setError("");
    setLoading(true);
    api<{ preview: LinkPreview }>(`/link-preview?url=${encodeURIComponent(url)}`)
      .then((result) => setPreview(result.preview))
      .catch((requestError) => setError(messageFromError(requestError)))
      .finally(() => setLoading(false));
  }, [open, url]);

  if (!open || !url) return null;

  const isYoutube = preview?.kind === "youtube";

  return (
    <div ref={popoverRef} style={style} className="workspace-link-paste-menu" role="menu" aria-label="Paste link as">
      <div className="workspace-link-paste-label">PASTE AS</div>
      <button type="button" className="workspace-context-item" role="menuitem" onClick={() => onChoose("mention", preview)}>
        <span><AtSign size={15} /></span>
        <span className="workspace-context-item-label">Mention<small>{loading ? "Loading…" : preview?.title || url}</small></span>
      </button>
      <button
        type="button"
        className={`workspace-context-item ${isYoutube ? "recommended" : ""}`}
        role="menuitem"
        onClick={() => onChoose("embed", preview)}
      >
        <span><Video size={15} /></span>
        <span className="workspace-context-item-label">Embed video{isYoutube && <small>Detected: YouTube</small>}</span>
      </button>
      <button type="button" className="workspace-context-item" role="menuitem" onClick={() => onChoose("bookmark", preview)}>
        <span><Bookmark size={15} /></span>
        <span className="workspace-context-item-label">Bookmark<small>{loading ? "Loading preview…" : preview?.title ? "Preview found" : "Basic card"}</small></span>
      </button>
      <button type="button" className="workspace-context-item" role="menuitem" onClick={() => onChoose("url", preview)}>
        <span><Link2 size={15} /></span>
        <span className="workspace-context-item-label">URL<small>Paste as plain link text</small></span>
      </button>
      {error && <div className="workspace-link-paste-error">Preview unavailable -- using a basic card instead.</div>}
    </div>
  );
}
