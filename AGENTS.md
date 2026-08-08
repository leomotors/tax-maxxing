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

## Privacy (personal tax / assets)

Never put real personal data in the repo — code, comments, tests, fixtures, docs, or commit messages:

- No real stock/fund symbols, dividend amounts, withheld tax, tax credits, or income figures from the user's returns
- No citizen ID / tax ID / broker account numbers (even partial)
- No paths to real Downloads files that encode IDs in the filename
- Tests and examples: synthetic labels only (`STOCKA`, `STOCKB`, round demo numbers)
- When smoke-testing a real local file, log only aggregates (counts / booleans), never dump symbols or amounts
- Keep real exports under `private/` (gitignored) or outside the repo

## Commands

```bash
pnpm dev
pnpm check
pnpm test
pnpm build
```
