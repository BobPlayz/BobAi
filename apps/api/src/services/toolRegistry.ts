export type ToolRisk = "read" | "write" | "external" | "destructive";

export type BobTool = {
  id: string;
  name: string;
  description: string;
  risk: ToolRisk;
  requiresUserApproval: boolean;
  enabled: boolean;
};

const tools: BobTool[] = [
  { id: "research", name: "deep research", description: "research the web, compare sources, and return cited findings", risk: "external", requiresUserApproval: false, enabled: true },
  { id: "browser", name: "browser agent", description: "navigate permitted websites and extract information", risk: "external", requiresUserApproval: true, enabled: true },
  { id: "coding", name: "coding workspace", description: "inspect and modify an authorized project workspace", risk: "write", requiresUserApproval: true, enabled: true },
  { id: "website-test", name: "website tester", description: "test an authorized web app for functional and accessibility issues", risk: "external", requiresUserApproval: true, enabled: true },
  { id: "documents", name: "document intelligence", description: "extract, OCR, compare, and answer questions from documents", risk: "read", requiresUserApproval: false, enabled: true },
  { id: "knowledge", name: "knowledge base", description: "retrieve relevant user-owned knowledge with source references", risk: "read", requiresUserApproval: false, enabled: true },
  { id: "diagrams", name: "diagram generator", description: "turn structured ideas into editable diagrams", risk: "write", requiresUserApproval: false, enabled: true },
  { id: "data-analysis", name: "data analyst", description: "analyze user-provided structured data and create evidence-backed findings", risk: "read", requiresUserApproval: false, enabled: true },
  { id: "voice", name: "live voice", description: "transcribe and synthesize permitted audio", risk: "external", requiresUserApproval: true, enabled: true },
  { id: "automation", name: "workflow automation", description: "run user-approved multi-step workflows", risk: "write", requiresUserApproval: true, enabled: true },
  { id: "image", name: "image tools", description: "generate and transform images through configured providers", risk: "external", requiresUserApproval: false, enabled: true },
  { id: "video", name: "video tools", description: "generate and transform video through configured providers", risk: "external", requiresUserApproval: true, enabled: true },
  { id: "music", name: "music tools", description: "discover or generate music through configured providers", risk: "external", requiresUserApproval: false, enabled: true },
  { id: "sketch-to-ui", name: "sketch to UI", description: "turn sketches or screenshots into frontend implementation plans", risk: "write", requiresUserApproval: false, enabled: true },
];

export function listTools(): BobTool[] { return tools.filter((tool) => tool.enabled).map((tool) => ({ ...tool })); }
export function getTool(id: string): BobTool | undefined { return tools.find((tool) => tool.id === id && tool.enabled); }
export function requiresApproval(id: string): boolean { return getTool(id)?.requiresUserApproval ?? true; }
