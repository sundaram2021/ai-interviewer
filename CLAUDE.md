@AGENTS.md

# Project Snapshot

**AI Voice Interviewer** is a Next.js 16 voice interview app. The candidate enters a target role plus a GitHub username or URL; the server verifies the account, builds a Claude-generated profile, and the browser runs a spoken interview using Sarvam STT/TTS, Exa, and browser `sessionStorage`.

Read `AGENTS.md` for commands, architecture, invariants, and gotchas. Keep secrets in `.env.local` or `.env`, run `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build` before committing, and do not add server-side session storage.
