# AGENTS.md

## Build

- `npm run dev` — Vite dev server at `127.0.0.1` (not `localhost`)
- `npm run build` — runs `tsc -b && vite build` (typecheck first, build only if types pass)
- `npm run preview` — preview built `dist/`

TypeScript config has `noEmit: true` so `tsc` only typechecks; Vite handles the actual build.

## Architecture

Single-page React 19 + Vite landing page, no router. `src/App.tsx` composes section components from `src/components/`. All styling lives in one file: `src/styles.css` (~1500 lines, no CSS modules, no Tailwind).

JSX transform is `react-jsx` — no need to `import React` for JSX.

## Images

Images live in `public/assets/`. The `SmartImage` component (`src/components/SmartImage.tsx`) shows a fallback UI if an image fails to load — so missing images won't break the page, they'll display a placeholder instead.

## Dependencies

- **React 19** + `react-dom`
- **lucide-react** for icons
- **@vitejs/plugin-react** for Vite React support
- **TypeScript ~5.7**

No linter, formatter, CI, or test framework configured.
