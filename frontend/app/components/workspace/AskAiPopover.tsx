"use client";

import { FormEvent, useState } from "react";
import { CornerDownLeft, Sparkles } from "lucide-react";
import { messageFromError } from "../../lib/api";
import { usePopoverPosition } from "./usePopoverPosition";
import { useClickOutside } from "./useClickOutside";
import { WorkspaceEditorApi } from "./workspaceContext";

type Props = {
  blockId: string | null;
  anchorRect: DOMRect | null;
  open: boolean;
  editor: WorkspaceEditorApi;
  onClose: () => void;
};

export default function AskAiPopover({ blockId, anchorRect, open, editor, onClose }: Props) {
  const { popoverRef, style } = usePopoverPosition(anchorRect, open);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);

  useClickOutside(popoverRef, onClose, open);

  // Reset local state when the popover closes -- computed during render
  // (React's recommended "adjusting state when a prop changes" pattern)
  // rather than in an effect, so it can't cascade an extra render.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setInstruction("");
      setAnswer(null);
      setError("");
      setLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!blockId || !instruction.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await editor.askAiOnBlock(blockId, instruction.trim());
      setAnswer(result.result.answer);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }

  function insertBelow() {
    if (!blockId || !answer) return;
    editor.addBlockAfter(blockId, "text", answer);
    onClose();
  }

  function replace() {
    if (!blockId || !answer) return;
    editor.updateBlockContent(blockId, answer);
    onClose();
  }

  if (!open || !blockId) return null;

  return (
    <div ref={popoverRef} style={style} className="workspace-ask-ai-popover" role="dialog" aria-label="Ask AI about this block">
      <div className="workspace-ask-ai-header"><Sparkles size={14} /> Ask AI</div>
      {!answer ? (
        <form onSubmit={submit}>
          <input
            autoFocus
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="e.g. Explain this simply, or fix the grammar…"
            disabled={loading}
          />
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="button button-primary" disabled={loading || !instruction.trim()}>
            {loading ? "Thinking…" : <>Ask <CornerDownLeft size={13} /></>}
          </button>
        </form>
      ) : (
        <div className="workspace-ask-ai-answer">
          <p>{answer}</p>
          <div className="workspace-ask-ai-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>Discard</button>
            <button type="button" className="button button-secondary" onClick={insertBelow}>Insert below</button>
            <button type="button" className="button button-primary" onClick={replace}>Replace</button>
          </div>
        </div>
      )}
    </div>
  );
}
