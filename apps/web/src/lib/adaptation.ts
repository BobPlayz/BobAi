export type UserStyle = {
  lowercase: number;
  punctuation: number;
  slang: number;
  averageLength: number;
};

const KEY = "bobai_style";

const SLANG = [
  "bro",
  "yoo",
  "yo",
  "wsp",
  "nah",
  "bet",
  "lmao",
  "fr",
  "ngl",
  "mf",
];

export function getStyle(): UserStyle {
  const raw = localStorage.getItem(KEY);

  if (!raw) {
    return {
      lowercase: 1,
      punctuation: 0,
      slang: 0,
      averageLength: 20,
    };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {
      lowercase: 1,
      punctuation: 0,
      slang: 0,
      averageLength: 20,
    };
  }
}

export function updateStyle(message: string) {
  const current = getStyle();

  const letters = message.replace(/[^a-zA-Z]/g, "");
  const lower =
    letters.length === 0
      ? 1
      : letters === letters.toLowerCase()
      ? 1
      : 0;

  const punctuation = /[.!?,;:]/.test(message) ? 1 : 0;

  const slang =
    SLANG.some((s) => message.toLowerCase().includes(s)) ? 1 : 0;

  const next: UserStyle = {
    lowercase: current.lowercase * 0.8 + lower * 0.2,
    punctuation: current.punctuation * 0.8 + punctuation * 0.2,
    slang: current.slang * 0.8 + slang * 0.2,
    averageLength:
      current.averageLength * 0.8 + message.length * 0.2,
  };

  localStorage.setItem(KEY, JSON.stringify(next));
}

export function buildSystemPrompt(): string {
  const style = getStyle();

  const lowercase = style.lowercase > 0.6;
  const lowPunctuation = style.punctuation < 0.4;
  const highSlang = style.slang > 0.3;
  const shortReplies = style.averageLength < 40;

  return `
you are bobai.

talk like a real friend.
${lowercase ? "use lowercase most of the time." : "normal capitalization is fine."}
${lowPunctuation ? "keep punctuation minimal." : "use punctuation naturally."}
${highSlang ? "use gen z slang naturally and casually." : "use light casual language."}
${shortReplies ? "keep replies short unless asked for detail." : "medium-length replies are fine."}

never sound like customer support.
never say things like "how can i assist you today".
match the user's energy.
`;
}