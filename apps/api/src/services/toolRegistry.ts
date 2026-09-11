export type ToolRisk = "read" | "write" | "external" | "destructive";
export type ToolPermission = "read" | "write" | "external" | "destructive";
export type JsonSchema = { type: "object"; properties: Record<string, { type: string; maxLength?: number; maxItems?: number }>; required?: string[]; additionalProperties?: boolean };
export type BobTool = {
  id: string;
  name: string;
  description: string;
  risk: ToolRisk;
  requiresUserApproval: boolean;
  enabled: boolean;
  permission: ToolPermission;
  inputSchema: JsonSchema;
  timeoutMs: number;
  maxResultBytes: number;
  retryable: boolean;
};

const objectSchema = (properties: JsonSchema["properties"], required: string[] = []): JsonSchema => ({ type: "object", properties, required, additionalProperties: false });
const tools: BobTool[] = [
  { id: "research", name: "deep research", description: "research the web, compare sources, and return cited findings", risk: "external", requiresUserApproval: false, permission: "external", timeoutMs: 120_000, maxResultBytes: 10 * 1024 * 1024, retryable: true, enabled: true, inputSchema: objectSchema({ query: { type: "string", maxLength: 2_000 } }, ["query"]) },
  { id: "browser", name: "browser agent", description: "navigate permitted websites and extract information", risk: "external", requiresUserApproval: true, permission: "external", timeoutMs: 120_000, maxResultBytes: 5 * 1024 * 1024, retryable: true, enabled: true, inputSchema: objectSchema({ url: { type: "string", maxLength: 4_000 } }, ["url"]) },
  { id: "coding", name: "coding workspace", description: "inspect and modify an authorized project workspace", risk: "write", requiresUserApproval: true, permission: "write", timeoutMs: 300_000, maxResultBytes: 2 * 1024 * 1024, retryable: false, enabled: true, inputSchema: objectSchema({ task: { type: "string", maxLength: 20_000 } }, ["task"]) },
  { id: "website-test", name: "website tester", description: "test an authorized web app for functional and accessibility issues", risk: "external", requiresUserApproval: true, permission: "external", timeoutMs: 120_000, maxResultBytes: 5 * 1024 * 1024, retryable: true, enabled: true, inputSchema: objectSchema({ url: { type: "string", maxLength: 4_000 } }, ["url"]) },
  { id: "documents", name: "document intelligence", description: "extract, OCR, compare, and answer questions from documents", risk: "read", requiresUserApproval: false, permission: "read", timeoutMs: 120_000, maxResultBytes: 10 * 1024 * 1024, retryable: true, enabled: true, inputSchema: objectSchema({ query: { type: "string", maxLength: 2_000 } }, ["query"]) },
  { id: "knowledge", name: "knowledge base", description: "retrieve relevant user-owned knowledge with source references", risk: "read", requiresUserApproval: false, permission: "read", timeoutMs: 30_000, maxResultBytes: 5 * 1024 * 1024, retryable: true, enabled: true, inputSchema: objectSchema({ query: { type: "string", maxLength: 2_000 } }, ["query"]) },
  { id: "diagrams", name: "diagram generator", description: "turn structured ideas into editable diagrams", risk: "write", requiresUserApproval: true, permission: "write", timeoutMs: 120_000, maxResultBytes: 5 * 1024 * 1024, retryable: true, enabled: true, inputSchema: objectSchema({ prompt: { type: "string", maxLength: 12_000 } }, ["prompt"]) },
  { id: "data-analysis", name: "data analyst", description: "analyze user-provided structured data and create evidence-backed findings", risk: "read", requiresUserApproval: false, permission: "read", timeoutMs: 120_000, maxResultBytes: 10 * 1024 * 1024, retryable: false, enabled: true, inputSchema: objectSchema({ query: { type: "string", maxLength: 8_000 } }, ["query"]) },
  { id: "voice", name: "live voice", description: "transcribe and synthesize permitted audio", risk: "external", requiresUserApproval: true, permission: "external", timeoutMs: 120_000, maxResultBytes: 10 * 1024 * 1024, retryable: true, enabled: true, inputSchema: objectSchema({ operation: { type: "string", maxLength: 32 } }, ["operation"]) },
  { id: "automation", name: "workflow automation", description: "run user-approved multi-step workflows", risk: "write", requiresUserApproval: true, permission: "write", timeoutMs: 300_000, maxResultBytes: 10 * 1024 * 1024, retryable: false, enabled: true, inputSchema: objectSchema({ automationId: { type: "string", maxLength: 100 } }, ["automationId"]) },
  { id: "image", name: "image tools", description: "generate and transform images through configured providers", risk: "external", requiresUserApproval: true, permission: "external", timeoutMs: 300_000, maxResultBytes: 10 * 1024 * 1024, retryable: true, enabled: true, inputSchema: objectSchema({ prompt: { type: "string", maxLength: 8_000 } }, ["prompt"]) },
  { id: "video", name: "video tools", description: "generate and transform video through configured providers", risk: "external", requiresUserApproval: true, permission: "external", timeoutMs: 300_000, maxResultBytes: 10 * 1024 * 1024, retryable: true, enabled: true, inputSchema: objectSchema({ prompt: { type: "string", maxLength: 8_000 } }, ["prompt"]) },
  { id: "music", name: "music tools", description: "discover or generate music through configured providers", risk: "external", requiresUserApproval: true, permission: "external", timeoutMs: 300_000, maxResultBytes: 10 * 1024 * 1024, retryable: true, enabled: true, inputSchema: objectSchema({ prompt: { type: "string", maxLength: 8_000 } }, ["prompt"]) },
  { id: "sketch-to-ui", name: "sketch to UI", description: "turn sketches or screenshots into frontend implementation plans", risk: "write", requiresUserApproval: true, permission: "write", timeoutMs: 120_000, maxResultBytes: 5 * 1024 * 1024, retryable: false, enabled: true, inputSchema: objectSchema({ prompt: { type: "string", maxLength: 12_000 } }, ["prompt"]) },
];

export function listTools(): BobTool[] { return tools.filter((tool) => tool.enabled).map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema, properties: { ...tool.inputSchema.properties } } })); }
export function getTool(id: string): BobTool | undefined { return tools.find((tool) => tool.id === id && tool.enabled); }
export function requiresApproval(id: string): boolean { return getTool(id)?.requiresUserApproval ?? true; }
export function validateToolInput(tool: BobTool, value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "tool arguments must be an object";
  const input = value as Record<string, unknown>;
  for (const required of tool.inputSchema.required || []) if (!(required in input)) return `missing required argument: ${required}`;
  if (Object.keys(input).some((key) => !(key in tool.inputSchema.properties))) return "unknown tool argument";
  for (const [key, schema] of Object.entries(tool.inputSchema.properties)) { if (!(key in input)) continue; const item = input[key]; if (schema.type === "string" && typeof item !== "string") return `argument ${key} must be a string`; if (schema.type === "string" && typeof item === "string" && schema.maxLength && item.length > schema.maxLength) return `argument ${key} is too long`; if (schema.type === "array" && (!Array.isArray(item) || (schema.maxItems && item.length > schema.maxItems))) return `argument ${key} is invalid`; }
  return null;
}
