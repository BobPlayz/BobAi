export type ChatImage = {
  id: string;
  url: string;
  prompt: string;
  /** Server-side image record used to restore generated images after a reload. */
  serverImageId?: string;
};

export type ChatFile = {
  id: string;
  name: string;
  type: string;
  text: string;
};

export type LiveDataSource = { title: string; url: string; snippet?: string; publishedAt?: string };

/** Where a live answer's data came from, shown as a badge so users can tell live, cached and search data apart. */
export type LiveDataInfo = {
  kind: "weather" | "cricket" | "news";
  provider: string;
  fetchedAt: string;
  cached: boolean;
  freshness: "live" | "web-search";
  sources: LiveDataSource[];
};

/** A tool call the model asked for that needs the user's explicit consent before it runs. */
export type ToolApproval = {
  tool: string;
  name: string;
  risk: string;
  arguments: Record<string, unknown>;
  workspaceId: string;
  state: "pending" | "running" | "completed" | "declined" | "failed";
  error?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: ChatImage[];
  /** Real pictures shown with the answer (visual learners), credited to their authors. */
  gallery?: Array<{ thumb: string; title: string; page: string; credit: string; license: string }>;
  /** True while the reply is still arriving. */
  streaming?: boolean;
  /** The reply stopped before it was finished (length limit or a dropped connection that couldn't be recovered). */
  incomplete?: boolean;
  /** True while Jarvis is finding or drawing a picture for this answer. */
  visualPending?: boolean;
  files?: ChatFile[];
  pinned?: boolean;
  liveData?: LiveDataInfo;
  approval?: ToolApproval;
  /** The Ollama model that actually produced this answer, when the server reported it. */
  model?: string;
  /** How many earlier messages were summarized (chat compacting) to answer this one. */
  compacted?: number;
  /** A website Jarvis saved and is serving on this computer ("…on localhost"). */
  localSite?: { url: string; name: string };
  /** Sent to the model for this turn only (e.g. extracted file text); never stored as a chat message. */
  ephemeral?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  pinned: boolean;
  /** Share-link token when the chat is shared (read-only snapshot). */
  shareToken?: string;
  messages: ChatMessage[];
};