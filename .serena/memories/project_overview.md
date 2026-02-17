# Project Overview
- Name: `hhu`
- Purpose: Starter web app scaffolded with Create Next App, using Next.js App Router.
- Runtime: Node.js (npm scripts), browser frontend.
- Platform: Darwin (macOS) development environment.

## Tech Stack
- Framework: Next.js `16.1.6`
- UI: React `19.2.3`, React DOM `19.2.3`
- Language: TypeScript (`strict: true`)
- Styling: Tailwind CSS v4 via `@import "tailwindcss"` and global CSS variables
- Linting: ESLint v9 with `eslint-config-next` (`core-web-vitals` + TypeScript config)

## Codebase Structure
- `app/layout.tsx`: Root layout, font setup (`Geist`, `Geist_Mono`), global metadata
- `app/page.tsx`: Main home page component (default starter UI)
- `app/globals.css`: Global styles + theme variables + Tailwind import
- `public/`: Static assets (including `images/`)
- Config files at root: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`

## Entry Points
- Dev entry: `next dev` via `npm run dev`
- Production build: `next build`
- Production server: `next start`