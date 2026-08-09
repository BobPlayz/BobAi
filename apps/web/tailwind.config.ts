import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/hooks/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#050B14",
        panel: "#0B1220",
        panel2: "#111827",
        sidebar: "#08101C",
        border: "#1E3A5F",
        text: "#E6F3FF",
        muted: "#94A3B8",
        sky: {
          300: "#7DD3FC",
          400: "#38BDF8",
          500: "#0EA5E9",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        glow: "0 0 40px rgba(56,189,248,0.18)",
        panel: "0 12px 40px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;