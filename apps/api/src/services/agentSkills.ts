export type AgentSkillId =
  | "coding"
  | "automation"
  | "web_research"
  | "file_analysis"
  | "vision"
  | "image_generation"
  | "video_generation"
  | "bobdb";

export type AgentMode = "standard" | "divesh";

export type AgentSkill = {
  id: AgentSkillId;
  name: string;
  description: string;
  kind: "execution" | "integration" | "capability";
  available: boolean;
};

const skills: AgentSkill[] = [
  { id: "coding", name: "coding", description: "Inspect, write, modify, test, and debug code in the configured coding-agent workspace.", kind: "execution", available: Boolean(process.env.BOBAI_CODING_AGENTS_DIR) },
  { id: "automation", name: "automation", description: "Plan and implement repeatable workflows using tools and integrations actually configured in BobAI.", kind: "execution", available: Boolean(process.env.BOBAI_CODING_AGENTS_DIR) },
  { id: "web_research", name: "web research", description: "Research information using BobAI's configured web-search capability.", kind: "capability", available: true },
  { id: "file_analysis", name: "file analysis", description: "Inspect supported uploaded documents and files and use their contents in a task.", kind: "capability", available: true },
  { id: "vision", name: "vision", description: "Analyze visual inputs when a vision-capable model/provider is configured.", kind: "capability", available: Boolean(process.env.BOBAI_VISION_MODEL || process.env.BOBAI_VISION_PROVIDER_URL) },
  { id: "image_generation", name: "image generation", description: "Create images through BobAI's configured image-generation capability.", kind: "integration", available: true },
  { id: "video_generation", name: "video generation", description: "Create or edit video through a configured BobAI video-generation provider.", kind: "integration", available: Boolean(process.env.BOBAI_VIDEO_PROVIDER_URL) },
  { id: "bobdb", name: "BobDB", description: "Create, inspect, or operate BobDB through the configured BobDB service API.", kind: "integration", available: Boolean(process.env.BOBDB_URL) },
];

export function listAgentSkills() {
  return skills.map((skill) => ({ ...skill }));
}

export function getAgentSkill(id: string) {
  return skills.find((skill) => skill.id === id);
}

const SKILL_PATTERNS: Array<[AgentSkillId, RegExp[]]> = [
  ["automation", [/\bautomate\b/i, /\bautomation\b/i, /\bworkflow\b/i, /\bschedule\b/i, /\brecurring\b/i]],
  ["image_generation", [/\bimage\b/i, /\bpicture\b/i, /\billustration\b/i, /\bdraw\b/i, /\bgenerate .*image/i]],
  ["video_generation", [/\bvideo\b/i, /\bmovie\b/i, /\banimation\b/i, /\bclip\b/i]],
  ["bobdb", [/\bbob\s*db\b/i, /\bbobdb\b/i, /\bdatabase\b/i, /\bdb service\b/i]],
  ["web_research", [/\bsearch the web\b/i, /\bweb search\b/i, /\bresearch\b/i, /\blook up\b/i]],
  ["file_analysis", [/\banaly[sz]e .*file\b/i, /\bpdf\b/i, /\bdocument\b/i, /\battachment\b/i]],
  ["vision", [/\banaly[sz]e .*image\b/i, /\blook at this image\b/i, /\bvision\b/i]],
  ["coding", [/\bcode\b/i, /\bbuild\b/i, /\bfix\b/i, /\bdebug\b/i, /\brefactor\b/i, /\bimplement\b/i, /\bcreate .*app\b/i]],
];

export function inferAgentSkills(text: string): AgentSkillId[] {
  const matches = SKILL_PATTERNS.filter(([, patterns]) => patterns.some((pattern) => pattern.test(text.trim()))).map(([id]) => id);
  return matches.length ? [...new Set(matches)] : ["coding"];
}

export function normalizeAgentMode(mode?: string): AgentMode {
  return mode?.toLowerCase() === "divesh" ? "divesh" : "standard";
}

export function buildSkillInstruction(skillsUsed: AgentSkillId[], mode: AgentMode) {
  const names = skillsUsed.map((id) => getAgentSkill(id)?.name || id).join(", ");
  return [
    `Execution mode: ${mode}.`,
    `Requested skills: ${names}.`,
    "Use only skills that are actually available in the BobAI runtime.",
    "Never claim that an image, video, database, integration, or external action was completed unless it was actually completed and verified.",
    mode === "divesh"
      ? "Divesh mode allows autonomous pursuit within configured permissions; it does not bypass safety, workspace, or provider boundaries."
      : "Standard mode should keep execution focused on the requested task.",
  ].join("\n");
}
