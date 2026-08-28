export type SkillKind = "image" | "video" | "audio" | "research" | "coding" | "design" | "writing" | "music";

export type SkillDefinition = {
  id: string;
  name: string;
  kind: SkillKind;
  description: string;
  providerEnv?: string;
  status: "ready" | "provider_required" | "local";
};

const definitions: SkillDefinition[] = [
  { id: "image_generation", name: "image generation", kind: "image", description: "Generate images from prompts.", status: "local" },
  { id: "image_upscale", name: "image upscaling", kind: "image", description: "Upscale and enhance low-resolution images.", providerEnv: "BOBAI_IMAGE_UPSCALE_PROVIDER_URL", status: "provider_required" },
  { id: "background_removal", name: "background removal", kind: "image", description: "Remove an image background.", providerEnv: "BOBAI_IMAGE_EDIT_PROVIDER_URL", status: "provider_required" },
  { id: "object_removal", name: "object removal", kind: "image", description: "Remove unwanted objects from images.", providerEnv: "BOBAI_IMAGE_EDIT_PROVIDER_URL", status: "provider_required" },
  { id: "image_editing", name: "image editing", kind: "image", description: "Edit images using prompts and optional source images.", providerEnv: "BOBAI_IMAGE_EDIT_PROVIDER_URL", status: "provider_required" },
  { id: "sketch_to_ui", name: "sketch to UI", kind: "design", description: "Turn sketches or screenshots into frontend UI specifications/code.", providerEnv: "BOBAI_DESIGN_PROVIDER_URL", status: "provider_required" },
  { id: "diagram_generation", name: "diagram generation", kind: "design", description: "Turn ideas into diagrams and visual specifications.", providerEnv: "BOBAI_DESIGN_PROVIDER_URL", status: "provider_required" },
  { id: "video_generation", name: "video generation", kind: "video", description: "Create videos from prompts and images.", providerEnv: "BOBAI_VIDEO_PROVIDER_URL", status: "provider_required" },
  { id: "image_to_video", name: "image to video", kind: "video", description: "Animate a still image into a video.", providerEnv: "BOBAI_VIDEO_PROVIDER_URL", status: "provider_required" },
  { id: "talking_image", name: "talking image", kind: "video", description: "Turn a still image into a talking video.", providerEnv: "BOBAI_TALKING_AVATAR_PROVIDER_URL", status: "provider_required" },
  { id: "talking_avatar", name: "talking avatar", kind: "video", description: "Create a talking avatar from a photo.", providerEnv: "BOBAI_TALKING_AVATAR_PROVIDER_URL", status: "provider_required" },
  { id: "face_swap", name: "face swap", kind: "video", description: "Perform consent-based face replacement in supported media.", providerEnv: "BOBAI_FACE_SWAP_PROVIDER_URL", status: "provider_required" },
  { id: "voice_synthesis", name: "voice synthesis", kind: "audio", description: "Generate natural speech from text.", providerEnv: "BOBAI_VOICE_PROVIDER_URL", status: "provider_required" },
  { id: "speech_to_text", name: "speech to text", kind: "audio", description: "Transcribe audio into text.", providerEnv: "BOBAI_VOICE_PROVIDER_URL", status: "provider_required" },
  { id: "meeting_transcription", name: "meeting transcription", kind: "audio", description: "Transcribe meetings and return timestamped text when supported.", providerEnv: "BOBAI_VOICE_PROVIDER_URL", status: "provider_required" },
  { id: "music_discovery", name: "music discovery", kind: "music", description: "Search, classify, tag, and organize music using configured services.", providerEnv: "BOBAI_MUSIC_PROVIDER_URL", status: "provider_required" },
  { id: "writing", name: "writing", kind: "writing", description: "Create, rewrite, summarize, and transform content using the active chat model.", status: "local" },
  { id: "developer_research", name: "developer research", kind: "research", description: "Search and solve developer-focused questions with source-backed research.", providerEnv: "BOBAI_RESEARCH_PROVIDER_URL", status: "provider_required" },
  { id: "web_search", name: "web search", kind: "research", description: "Search the web and return source metadata and citations.", providerEnv: "BOBAI_RESEARCH_PROVIDER_URL", status: "provider_required" },
  { id: "app_builder", name: "app builder", kind: "coding", description: "Turn prompts into application plans and coding-agent tasks.", status: "local" },
  { id: "website_builder", name: "website builder", kind: "coding", description: "Turn prompts into websites and frontend implementation tasks.", status: "local" },
  { id: "ai_code_editor", name: "AI code editor", kind: "coding", description: "Plan, edit, test, and review code through the coding-agent workspace.", status: "local" },
  { id: "build_and_deploy", name: "build and deploy", kind: "coding", description: "Build projects and prepare verified deployment jobs through configured agents/providers.", status: "local" },
  { id: "short_clip_finder", name: "short-form clip finder", kind: "video", description: "Find candidate short clips and moments from long-form video.", providerEnv: "BOBAI_VIDEO_EDIT_PROVIDER_URL", status: "provider_required" },
];

export function listSkills(): SkillDefinition[] {
  return definitions.map((skill) => ({
    ...skill,
    status: skill.status === "provider_required" && process.env[skill.providerEnv ?? ""] ? "ready" : skill.status,
  }));
}

export function getSkill(id: string) {
  return listSkills().find((skill) => skill.id === id);
}

function assertProviderUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("skill provider must use HTTP or HTTPS");
  return url;
}

export async function executeSkill(id: string, payload: Record<string, unknown>) {
  const skill = getSkill(id);
  if (!skill) throw new Error("unknown skill");

  if (skill.status === "local") {
    return {
      skill: skill.id,
      status: "accepted",
      mode: "local",
      message: "skill is available through BobAI's local execution pipeline",
      payload,
    };
  }

  const configured = skill.providerEnv ? process.env[skill.providerEnv]?.trim() : "";
  if (!configured) throw new Error(`${skill.name} provider is not configured; set ${skill.providerEnv}`);

  const url = assertProviderUrl(configured);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ skill: skill.id, ...payload }),
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* provider returned plain text */ }
    if (!response.ok) throw new Error(`skill provider returned ${response.status}`);
    return { skill: skill.id, status: "completed", mode: "provider", result: body };
  } finally {
    clearTimeout(timer);
  }
}
