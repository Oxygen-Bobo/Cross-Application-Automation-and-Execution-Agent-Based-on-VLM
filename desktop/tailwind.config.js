/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/**/*.{html,tsx,ts}"],
  theme: {
    extend: {
      colors: {
        surface: {
          0: "#0a0a0b",
          1: "#111113",
          2: "#18181b",
          3: "#1f1f23",
          4: "#27272d",
          5: "#303037",
        },
        accent: {
          DEFAULT: "#8b5cf6",
          hover: "#7c3aed",
          muted: "rgba(139,92,246,0.15)",
        },
        danger: "#f87171",
        success: "#4ade80",
        warning: "#fbbf24",
        muted: "#71717a",
        fg: "#e4e4e7",
      },
      fontFamily: {
        sans: [
          '"Inter"',
          '"Segoe UI"',
          '"Microsoft YaHei"',
          '"PingFang SC"',
          '"Noto Sans SC"',
          '"Hiragino Sans GB"',
          '"WenQuanYi Micro Hei"',
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"Cascadia Code"',
          '"Fira Code"',
          '"JetBrains Mono"',
          '"Source Code Pro"',
          "Consolas",
          "monospace",
        ],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
        "pulse-dot": "pulseDot 1.4s infinite ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 80%, 100%": { opacity: "0" },
          "40%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
