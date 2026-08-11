"use client";

import type { FormEvent, KeyboardEvent, ReactNode, TextareaHTMLAttributes } from "react";
import { useEffect, useRef } from "react";
import { ArrowRight, Bot, Lightbulb, Sparkles } from "lucide-react";

function cx(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(" "); }

export function ChatCard({ children, mode = "tutor" }: { children: ReactNode; mode?: "tutor" | "sparring" | "agent" }) {
  return <section className={cx("chat-panel", `chat-mode-${mode}`)}>{children}</section>;
}

export function TutorAvatar({ mode = "tutor" }: { mode?: "tutor" | "sparring" | "agent" }) {
  return <span className={cx("tutor-avatar", `is-${mode}`)} aria-hidden="true">{mode === "sparring" ? <Lightbulb size={17} /> : mode === "agent" ? <Bot size={17} /> : <Sparkles size={17} />}</span>;
}

export function MessageBubble({ role, variant = "normal", children }: { role: "user" | "assistant"; variant?: "normal" | "sparring" | "agent"; children: ReactNode }) {
  return <article className={cx("chat-message", role, variant !== "normal" && variant)}>
    {role === "assistant" && <TutorAvatar mode={variant === "normal" ? "tutor" : variant} />}
    <div className="chat-message-body">{variant === "sparring" && role === "assistant" && <span className="sparring-pill"><Lightbulb size={12} /> Sparring</span>}{children}</div>
  </article>;
}

export function QuickChip({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="quick-chip" type="button" onClick={onClick}>{children}</button>;
}

export function TypingIndicator({ label = "Studia Tutor is thinking", variant = "normal" }: { label?: string; variant?: "normal" | "sparring" | "agent" }) {
  return <MessageBubble role="assistant" variant={variant}><div className="typing-indicator" role="status" aria-label={label}><span /><span /><span /></div></MessageBubble>;
}

export function Composer({ value, onChange, onSubmit, disabled, sendDisabled, placeholder, onKeyDown }: { value: string; onChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; disabled?: boolean; sendDisabled?: boolean; placeholder: string; onKeyDown?: TextareaHTMLAttributes<HTMLTextAreaElement>["onKeyDown"] }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const element = textareaRef.current; if (!element) return; element.style.height = "auto"; element.style.height = `${Math.min(element.scrollHeight, 160)}px`; }, [value]);
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) { onKeyDown?.(event); if (event.defaultPrevented) return; if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }
  return <form className="chat-composer" onSubmit={onSubmit}><textarea ref={textareaRef} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={keyDown} placeholder={placeholder} rows={1} maxLength={2000} disabled={disabled} aria-label="Message Studia Tutor" /><button type="submit" disabled={disabled || sendDisabled} aria-label="Send message" title="Send message (Enter)"><span>Send</span><ArrowRight size={18} /></button></form>;
}
