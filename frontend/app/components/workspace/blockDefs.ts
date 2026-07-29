import type { LucideIcon } from "lucide-react";
import {
  Bookmark,
  CheckSquare,
  ChevronRight,
  Code2,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Image as ImageIcon,
  Lightbulb,
  List,
  ListOrdered,
  Minus,
  Quote,
  Sigma,
  Type,
  Video,
} from "lucide-react";
import type { BlockType } from "./types";

export type BlockDef = {
  type: BlockType;
  label: string;
  description: string;
  Icon: LucideIcon;
  keywords: string[];
};

export const BLOCK_DEFS: BlockDef[] = [
  { type: "text", label: "Text", description: "Plain paragraph text", Icon: Type, keywords: ["paragraph", "plain"] },
  { type: "heading_1", label: "Heading 1", description: "Large section heading", Icon: Heading1, keywords: ["h1", "title"] },
  { type: "heading_2", label: "Heading 2", description: "Medium section heading", Icon: Heading2, keywords: ["h2", "subtitle"] },
  { type: "heading_3", label: "Heading 3", description: "Small section heading", Icon: Heading3, keywords: ["h3"] },
  { type: "heading_4", label: "Heading 4", description: "Smallest section heading", Icon: Heading4, keywords: ["h4"] },
  { type: "bulleted_list_item", label: "Bulleted list", description: "A simple bulleted list", Icon: List, keywords: ["bullet", "ul", "list"] },
  { type: "numbered_list_item", label: "Numbered list", description: "A list with numbering", Icon: ListOrdered, keywords: ["ordered", "ol", "number"] },
  { type: "todo", label: "To-do list", description: "A checkbox you can tick off", Icon: CheckSquare, keywords: ["todo", "task", "checkbox", "checklist"] },
  { type: "toggle", label: "Toggle list", description: "A collapsible block that hides content", Icon: ChevronRight, keywords: ["collapse", "expand", "dropdown"] },
  { type: "quote", label: "Quote", description: "A captioned quote block", Icon: Quote, keywords: ["blockquote", "citation"] },
  { type: "callout", label: "Callout", description: "A highlighted block to call out info", Icon: Lightbulb, keywords: ["note", "info", "highlight", "tip"] },
  { type: "code", label: "Code block", description: "A block for a snippet of code", Icon: Code2, keywords: ["snippet", "monospace", "programming"] },
  { type: "divider", label: "Divider", description: "A visual line to separate content", Icon: Minus, keywords: ["separator", "line", "hr"] },
  { type: "equation", label: "Equation", description: "A block for a math expression", Icon: Sigma, keywords: ["math", "formula", "latex"] },
  { type: "image", label: "Image", description: "Embed an image by URL", Icon: ImageIcon, keywords: ["picture", "photo"] },
  { type: "video", label: "Video", description: "Embed a video, e.g. from YouTube", Icon: Video, keywords: ["youtube", "embed", "movie"] },
  { type: "bookmark", label: "Bookmark", description: "A visual link card with a preview", Icon: Bookmark, keywords: ["link", "url", "preview", "card"] },
  { type: "page", label: "Page", description: "A nested sub-page reference", Icon: FileText, keywords: ["subpage", "nested"] },
];

export const BLOCK_DEF_MAP: Record<BlockType, BlockDef> = Object.fromEntries(
  BLOCK_DEFS.map((def) => [def.type, def]),
) as Record<BlockType, BlockDef>;

export function searchBlockDefs(query: string): BlockDef[] {
  const term = query.trim().toLowerCase();
  if (!term) return BLOCK_DEFS;
  return BLOCK_DEFS.filter(
    (def) =>
      def.label.toLowerCase().includes(term) ||
      def.type.includes(term) ||
      def.keywords.some((keyword) => keyword.includes(term)),
  );
}
