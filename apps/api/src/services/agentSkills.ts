export type AgentSkillId =
  | "coding" | "automation" | "web_research" | "file_analysis" | "vision"
  | "image_generation" | "video_generation" | "music_generation" | "bobdb";

export type AgentMode = "standard" | "divesh";
export type AgentSkill = { id: AgentSkillId; name: string; description: string; kind: "execution" | "integration" | "capability"; available: boolean };

const skills: AgentSkill[] = [
  { id: "coding", name: "coding", description: "Inspect, write, modify, test, and debug code in the configured coding-agent workspace.", kind: "execution", available: Boolean(process.env.BOBAI_CODING_AGENTS_DIR) },
  { id: "automation", name: "automation", description: "Plan and implement repeatable workflows using configured tools and integrations.", kind: "execution", available: Boolean(process.env.BOBAI_CODING_AGENTS_DIR) },
  { id: "web_research", name: "web research", description: "Research information using BobAI's configured web-search capability.", kind: "capability", available: true },
  { id: "file_analysis", name: "file analysis", description: "Inspect supported uploaded documents and files.", kind: "capability", available: true },
  { id: "vision", name: "vision", description: "Analyze visual inputs with a configured vision model/provider.", kind: "capability", available: Boolean(process.env.BOBAI_VISION_MODEL || process.env.BOBAI_VISION_PROVIDER_URL) },
  { id: "image_generation", name: "image generation", description: "Create images through the configured image provider.", kind: "integration", available: true },
  { id: "video_generation", name: "video generation", description: "Create or edit video through a configured video provider.", kind: "integration", available: Boolean(process.env.BOBAI_VIDEO_PROVIDER_URL) },
  { id: "music_generation", name: "music generation", description: "Create, edit, or analyze music through a configured audio provider.", kind: "integration", available: Boolean(process.env.BOBAI_MUSIC_PROVIDER_URL) },
  { id: "bobdb", name: "BobDB", description: "Operate BobDB through its configured service API.", kind: "integration", available: Boolean(process.env.BOBDB_URL) },
];

export function listAgentSkills() { return skills.map((skill) => ({ ...skill })); }
export function getAgentSkill(id: string) { return skills.find((skill) => skill.id === id); }

const SKILL_PATTERNS: Array<[AgentSkillId, RegExp[]]> = [
  ["automation", [/\bautomate\b/i, /\bautomation\b/i, /\bworkflow\b/i, /\bschedule\b/i, /\brecurring\b/i]],
  ["image_generation", [/\bimage\b/i, /\bpicture\b/i, /\billustration\b/i, /\bdraw\b/i, /\bgenerate .*image/i]],
  ["video_generation", [/\bvideo\b/i, /\bmovie\b/i, /\banimation\b/i, /\bclip\b/i]],
  ["music_generation", [/\bmusic\b/i, /\bsong\b/i, /\btrack\b/i, /\binstrumental\b/i, /\bbeat\b/i, /\baudio\b/i]],
  ["bobdb", [/\bbob\s*db\b/i, /\bbobdb\b/i, /\bdatabase\b/i]],
  ["web_research", [/\bsearch the web\b/i, /\bweb search\b/i, /\bresearch\b/i, /\blook up\b/i]],
  ["file_analysis", [/\banaly[sz]e .*file\b/i, /\bpdf\b/i, /\bdocument\b/i, /\battachment\b/i]],
  ["vision", [/\banaly[sz]e .*image\b/i, /\blook at this image\b/i, /\bvision\b/i]],
  ["coding", [/\bcode\b/i, /\bbuild\b/i, /\bfix\b/i, /\bdebug\b/i, /\brefactor\b/i, /\bimplement\b/i, /\bcreate .*app\b/i]],
];

export function inferAgentSkills(text: string): AgentSkillId[] {
  const matches = SKILL_PATTERNS.filter(([, patterns]) => patterns.some((pattern) => pattern.test(text.trim()))).map(([id]) => id);
  return matches.length ? [...new Set(matches)] : ["coding"];
}

export function normalizeAgentMode(mode?: string): AgentMode { return mode?.toLowerCase() === "divesh" ? "divesh" : "standard"; }
export function buildSkillInstruction(skillsUsed: AgentSkillId[], mode: AgentMode) {
  const names = skillsUsed.map((id) => getAgentSkill(id)?.name || id).join(", ");
  return [`Execution mode: ${mode}.`, `Requested skills: ${names}.`, "Use only skills actually available in the runtime.", "Never claim an external action was completed unless it was verified.", mode === "divesh" ? "Use only configured permissions and provider boundaries." : "Keep execution focused on the requested task."].join("\n");
}
