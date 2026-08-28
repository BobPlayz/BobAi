export type AgentSkillId =
  | "coding" | "automation" | "web_research" | "file_analysis" | "vision"
  | "image_generation" | "image_upscale" | "background_removal" | "object_removal" | "image_editing"
  | "video_generation" | "image_to_video" | "talking_image" | "talking_avatar" | "face_swap" | "short_clip_finder"
  | "voice_synthesis" | "speech_to_text" | "meeting_transcription"
  | "music_generation" | "music_discovery" | "diagram_generation" | "sketch_to_ui"
  | "developer_research" | "web_search" | "writing" | "app_builder" | "website_builder" | "ai_code_editor" | "build_and_deploy"
  | "bobdb";

export type AgentMode = "standard" | "divesh";
export type AgentSkill = { id: AgentSkillId; name: string; description: string; kind: "execution" | "integration" | "capability"; available: boolean };

const env = (name: string) => Boolean(process.env[name]?.trim());

const skills: AgentSkill[] = [
  { id: "coding", name: "coding", description: "Inspect, write, modify, test, and debug code in the configured coding-agent workspace.", kind: "execution", available: env("BOBAI_CODING_AGENTS_DIR") },
  { id: "automation", name: "automation", description: "Plan and implement repeatable workflows using configured tools and integrations.", kind: "execution", available: env("BOBAI_CODING_AGENTS_DIR") },
  { id: "web_research", name: "web research", description: "Research information using BobAI's configured web-search capability.", kind: "capability", available: env("BOBAI_RESEARCH_PROVIDER_URL") },
  { id: "developer_research", name: "developer research", description: "Search and solve developer-focused questions with source-backed research.", kind: "capability", available: env("BOBAI_RESEARCH_PROVIDER_URL") },
  { id: "web_search", name: "web search", description: "Search the web and return source metadata and citations.", kind: "capability", available: env("BOBAI_RESEARCH_PROVIDER_URL") },
  { id: "file_analysis", name: "file analysis", description: "Inspect supported uploaded documents and files.", kind: "capability", available: true },
  { id: "vision", name: "vision", description: "Analyze visual inputs with a configured vision model/provider.", kind: "capability", available: env("BOBAI_VISION_MODEL") || env("BOBAI_VISION_PROVIDER_URL") },
  { id: "image_generation", name: "image generation", description: "Create images through BobAI's image pipeline.", kind: "integration", available: true },
  { id: "image_upscale", name: "image upscaling", description: "Upscale and enhance low-resolution images.", kind: "integration", available: env("BOBAI_IMAGE_UPSCALE_PROVIDER_URL") },
  { id: "background_removal", name: "background removal", description: "Remove image backgrounds.", kind: "integration", available: env("BOBAI_IMAGE_EDIT_PROVIDER_URL") },
  { id: "object_removal", name: "object removal", description: "Remove unwanted image objects.", kind: "integration", available: env("BOBAI_IMAGE_EDIT_PROVIDER_URL") },
  { id: "image_editing", name: "image editing", description: "Edit images with prompts and source media.", kind: "integration", available: env("BOBAI_IMAGE_EDIT_PROVIDER_URL") },
  { id: "video_generation", name: "video generation", description: "Create videos from prompts and images.", kind: "integration", available: env("BOBAI_VIDEO_PROVIDER_URL") },
  { id: "image_to_video", name: "image to video", description: "Animate a still image into video.", kind: "integration", available: env("BOBAI_VIDEO_PROVIDER_URL") },
  { id: "talking_image", name: "talking image", description: "Turn a still image into a talking video.", kind: "integration", available: env("BOBAI_TALKING_AVATAR_PROVIDER_URL") },
  { id: "talking_avatar", name: "talking avatar", description: "Create a talking avatar from a photo.", kind: "integration", available: env("BOBAI_TALKING_AVATAR_PROVIDER_URL") },
  { id: "face_swap", name: "face swap", description: "Perform consent-based face replacement in supported media.", kind: "integration", available: env("BOBAI_FACE_SWAP_PROVIDER_URL") },
  { id: "short_clip_finder", name: "short-form clip finder", description: "Find candidate short clips and moments from long-form video.", kind: "integration", available: env("BOBAI_VIDEO_EDIT_PROVIDER_URL") },
  { id: "voice_synthesis", name: "voice synthesis", description: "Generate natural speech from text.", kind: "integration", available: env("BOBAI_VOICE_PROVIDER_URL") },
  { id: "speech_to_text", name: "speech to text", description: "Transcribe audio into text.", kind: "integration", available: env("BOBAI_VOICE_PROVIDER_URL") },
  { id: "meeting_transcription", name: "meeting transcription", description: "Transcribe meetings and return structured timestamps when supported.", kind: "integration", available: env("BOBAI_VOICE_PROVIDER_URL") },
  { id: "music_generation", name: "music generation", description: "Create or edit music through a configured provider.", kind: "integration", available: env("BOBAI_MUSIC_PROVIDER_URL") },
  { id: "music_discovery", name: "music discovery", description: "Discover, classify, tag, and organize music.", kind: "integration", available: env("BOBAI_MUSIC_PROVIDER_URL") },
  { id: "diagram_generation", name: "diagram generation", description: "Turn ideas into diagrams and visual specifications.", kind: "capability", available: env("BOBAI_DESIGN_PROVIDER_URL") },
  { id: "sketch_to_ui", name: "sketch to UI", description: "Turn sketches or screenshots into frontend UI plans and code tasks.", kind: "capability", available: env("BOBAI_DESIGN_PROVIDER_URL") },
  { id: "writing", name: "writing", description: "Create, rewrite, summarize, and transform content using the active language model.", kind: "capability", available: true },
  { id: "app_builder", name: "app builder", description: "Turn prompts into application plans and coding-agent tasks.", kind: "execution", available: env("BOBAI_CODING_AGENTS_DIR") },
  { id: "website_builder", name: "website builder", description: "Turn prompts into websites and frontend implementation tasks.", kind: "execution", available: env("BOBAI_CODING_AGENTS_DIR") },
  { id: "ai_code_editor", name: "AI code editor", description: "Plan, edit, test, and review code through the coding-agent workspace.", kind: "execution", available: env("BOBAI_CODING_AGENTS_DIR") },
  { id: "build_and_deploy", name: "build and deploy", description: "Build projects and prepare verified deployment jobs through configured agents.", kind: "execution", available: env("BOBAI_CODING_AGENTS_DIR") },
  { id: "bobdb", name: "BobDB", description: "Operate BobDB through its configured service API.", kind: "integration", available: env("BOBDB_URL") },
];

export function listAgentSkills() { return skills.map((skill) => ({ ...skill })); }
export function getAgentSkill(id: string) { return skills.find((skill) => skill.id === id); }

const SKILL_PATTERNS: Array<[AgentSkillId, RegExp[]]> = [
  ["automation", [/\bautomate\b/i, /\bautomation\b/i, /\bworkflow\b/i, /\bschedule\b/i, /\brecurring\b/i]],
  ["image_upscale", [/\bupscale\b/i, /\benhance .*image\b/i]],
  ["background_removal", [/\bremove .*background\b/i, /\bbackground removal\b/i]],
  ["object_removal", [/\bremove .*object\b/i, /\berase .*object\b/i]],
  ["image_editing", [/\bedit .*image\b/i, /\binpaint\b/i]],
  ["talking_avatar", [/\btalking avatar\b/i, /\bavatar from .*photo\b/i]],
  ["talking_image", [/\btalking image\b/i, /\bimage .*talking video\b/i]],
  ["image_to_video", [/\bimage to video\b/i, /\banimate .*image\b/i]],
  ["face_swap", [/\bface swap\b/i, /\bface swapping\b/i]],
  ["short_clip_finder", [/\bshort.?form clip\b/i, /\bclips? from .*video\b/i]],
  ["video_generation", [/\bvideo\b/i, /\bmovie\b/i, /\banimation\b/i]],
  ["voice_synthesis", [/\bai voice\b/i, /\btext to speech\b/i, /\bsynthesize .*voice\b/i]],
  ["speech_to_text", [/\bspeech to text\b/i, /\btranscri(be|ption)\b/i]],
  ["meeting_transcription", [/\bmeeting\b.*\btranscri/i, /\breal.?time transcription\b/i]],
  ["music_discovery", [/\bdiscover .*music\b/i, /\borganize .*music\b/i]],
  ["music_generation", [/\bmusic\b/i, /\bsong\b/i, /\btrack\b/i, /\binstrumental\b/i, /\bbeat\b/i]],
  ["diagram_generation", [/\bdiagram\b/i, /\bflowchart\b/i, /\bvisualize .*idea\b/i]],
  ["sketch_to_ui", [/\bsketch.*ui\b/i, /\bsketch.*design\b/i]],
  ["developer_research", [/\bdeveloper\b.*\bsearch\b/i, /\bsolve .*developer\b/i]],
  ["web_search", [/\bsearch the web\b/i, /\bweb search\b/i, /\blook up\b/i]],
  ["writing", [/\bwrite\b/i, /\brewrite\b/i, /\bsummarize\b/i, /\bcontent\b/i]],
  ["app_builder", [/\bbuild .*app\b/i, /\bcreate .*app\b/i]],
  ["website_builder", [/\bbuild .*website\b/i, /\bcreate .*website\b/i, /\bfrontend\b/i]],
  ["ai_code_editor", [/\bcode editor\b/i, /\bedit .*code\b/i]],
  ["build_and_deploy", [/\bdeploy\b/i, /\bbuild and deploy\b/i]],
  ["image_generation", [/\bimage\b/i, /\bpicture\b/i, /\billustration\b/i, /\bdraw\b/i]],
  ["bobdb", [/\bbob\s*db\b/i, /\bbobdb\b/i, /\bdatabase\b/i]],
  ["file_analysis", [/\banaly[sz]e .*file\b/i, /\bpdf\b/i, /\bdocument\b/i, /\battachment\b/i]],
  ["vision", [/\banaly[sz]e .*image\b/i, /\blook at this image\b/i, /\bvision\b/i]],
  ["coding", [/\bcode\b/i, /\bfix\b/i, /\bdebug\b/i, /\brefactor\b/i, /\bimplement\b/i]],
  ["web_research", [/\bresearch\b/i]],
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
