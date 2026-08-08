# AGENTS

Tax-Maxxing is a static Next.js app (Thai UI) for personal income tax estimation.

## Stack

- Next.js App Router, `output: "export"`
- Tailwind CSS v4, light theme only
- Client-side state in `localStorage` + JSON download/upload
- Tax engine in `src/lib/tax/`

## Conventions

- UI copy is Thai
- Changelog follows portfolio-tracking style (`CHANGELOG.md` with `[minor]` bucket)
- Prefer extending the tax engine before adding UI-only special cases
- Do not add a backend or auth unless explicitly requested

## Commands

```bash
pnpm dev
pnpm check
pnpm test
pnpm build
```
