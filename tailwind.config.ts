import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0e14",
        panel: "#141925",
        panel2: "#1c2333",
        border: "#27304a",
        ink: "#e6e9f0",
        muted: "#8b95ad",
        accent: "#4f8cff",
        ok: "#2fbf71",
        bad: "#ff5d5d",
        warn: "#f4b740",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
