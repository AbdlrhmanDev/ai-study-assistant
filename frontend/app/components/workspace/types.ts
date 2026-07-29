export type BlockType =
  | "text"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "heading_4"
  | "bulleted_list_item"
  | "numbered_list_item"
  | "todo"
  | "toggle"
  | "quote"
  | "callout"
  | "code"
  | "divider"
  | "equation"
  | "image"
  | "video"
  | "bookmark"
  | "page";

export type BlockColor =
  | "default"
  | "violet"
  | "coral"
  | "mint"
  | "success"
  | "danger"
  | "warning"
  | "info";

export type BlockProperties = {
  textColor?: BlockColor | null;
  backgroundColor?: BlockColor | null;
  checked?: boolean | null;
  language?: string | null;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
  youtubeId?: string | null;
};

export type WorkspaceBlock = {
  id: string;
  type: BlockType;
  content: string;
  properties: BlockProperties;
  children: WorkspaceBlock[];
};

export type WorkspacePage = {
  id: number;
  user_id: number;
  topic_id: number | null;
  title: string;
  blocks: WorkspaceBlock[];
  created_at: string;
  updated_at: string;
};

export type LinkPreview = {
  url: string;
  kind: "youtube" | "website";
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  youtubeId: string | null;
};

export const LIST_TYPES: BlockType[] = [
  "bulleted_list_item",
  "numbered_list_item",
  "todo",
  "toggle",
];

export const TEXTUAL_TYPES: BlockType[] = [
  "text",
  "heading_1",
  "heading_2",
  "heading_3",
  "heading_4",
  "bulleted_list_item",
  "numbered_list_item",
  "todo",
  "toggle",
  "quote",
  "callout",
  "code",
  "equation",
];

export function emptyProperties(): BlockProperties {
  return {};
}

export function makeBlock(type: BlockType, id: string, overrides: Partial<WorkspaceBlock> = {}): WorkspaceBlock {
  return {
    id,
    type,
    content: "",
    properties: emptyProperties(),
    children: [],
    ...overrides,
  };
}
