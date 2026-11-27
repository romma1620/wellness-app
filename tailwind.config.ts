import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          light: "var(--primary-light)",
        },
        bg: "var(--bg)",
        surface: "var(--surface)",
        field: "var(--field)",
        line: "var(--line)",
        ink: "var(--text)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "on-accent": "var(--on-accent)",
        pos: "var(--pos)",
        warn: "var(--warn)",
        neg: "var(--neg)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Картки редизайну пласкі — тінь лишається лише в плаваючого таб-бара
        // та панелей, що висять над контентом.
        card: "none",
        cta: "none",
        soft: "none",
        up: "0 18px 40px -18px var(--shadow-up)",
      },
      borderRadius: {
        xl2: "20px",
      },
      maxWidth: {
        app: "480px",
      },
    },
  },
  plugins: [],
};

export default config;
