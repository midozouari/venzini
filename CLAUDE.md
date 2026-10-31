# CLAUDE.md: working rules for Venzini

Venzini is a fuel demand forecasting and delivery planning web platform. This repo currently builds **the MVP only**.

## Source documents (read before each step)

- `docs/Venzini 3 - SDD FV.pdf`: the design. For the MVP, the key parts are ch. 7 (MVP: mock layer, fixtures, screens and flows), 5.6 (API contracts the mocks must follow), 5.12 (UI design view, design system), 6.1.1 (RBAC matrix), 8.4 (AC-21) and Appendix B (repo structure).
- `docs/Venzini 2 - SRS FV.pdf`: the requirements (UI-01–UI-08, FR, BR, AC-21; UC-01–UC-11 are cited there).
- `docs/Venzini 1 - Requirement Elicitation FV.pdf`: defines UC-01–UC-11.
- **Precedence: the SDD wins** over the SRS (the user's decision, which overrides the SDD's own "SRS applies" line). Always tell the user when they differ.
- Never invent features that are in neither document. If something is unclear, **ask first**.

## Scope: MVP only (SDD ch. 7, AC-21, D-26)

- Build the real frontend, answered by **Mock Service Worker** in the browser with fake fixtures. Nothing is saved; reload resets the state.
- **Do not build:** a backend, NestJS, Prisma, a database, Docker, or nginx.
- The mock handlers do no real calculations: they return scripted outcomes (SDD 7.1, 7.2).
- Never implement (SRS §20): price setting or equipment control; driver accounts or screens; automatic approval or dispatch; LLMs, chatbots, agents or free-text generation; editing or deleting decision-log entries; manager editing of tankers, drivers or stock; loading at another warehouse; split deliveries; mobile, live tracking or real integrations; FR-10, FR-26; plan handover to drivers.

## Data

- **Fake sample data only. Never real data.** Fixtures come from `packages/sample-data` (deterministic, seed 42).

## Logo (strict)

- The only logo is `apps/web/public/logo.png`. Use that exact file everywhere the logo appears (login page, app header, favicon). Alt text: `Venzini`.
- Never draw, generate, recreate, trace, recolor, crop or replace it, and never make an SVG or text version. The only thing allowed is **resized copies of the same file** (e.g. a favicon) that keep the aspect ratio.

## Design system (SDD 5.12.4, Figure 42)

- Use only the tokens defined as CSS variables in `apps/web/src/index.css` and mapped in `apps/web/tailwind.config.ts`. Components never use raw hex values.
- Navy `#021C45` is the only brand color.
- Risk colors `#C62828` (high), `#E07B00` (medium) and `#2E7D32` (low) are **used only for risk**. They are never used for routes or buttons, and they always come with an icon or a word.
- Route lines use the 8 route tokens only (never red, orange or green).
- Inter typeface. Litres "34,000 L", times 24 h, dates "05 Nov 2026", money "$412.35". Minimum width 1366 px. Keyboard path for every action. Visible 2 px focus ring.

## Stack and structure (MVP subset of SDD Appendix B)

- A pnpm monorepo (pnpm 12, Node LTS ≥ 24, TypeScript 6.0, ESLint 9):
  - `apps/web`: React 19, Vite, Tailwind v4, shadcn/ui, TanStack Query (server data), Zustand (view state), React Router, MSW. Handlers live in `src/mocks/handlers/`.
  - `packages/contracts`: Zod schemas for every endpoint. Handlers parse requests and return responses with these schemas.
  - `packages/sample-data`: the generator.
  - `packages/config`: ESLint, Prettier, tsconfig.
  - `e2e`: Playwright, with Chrome, Firefox and Edge at 1366×768.
  - `docs`.
- The browser never computes a business value. `dangerouslySetInnerHTML` is banned (lint rule).
- Demo accounts (fake, mock only): `sara.m` (manager), `karim.b` (dispatcher), `nadia.a` (admin). Password: `venzini-demo`.

## Way of working

1. **One step at a time.** Before each step, show a short plan and **wait for the user's OK**.
2. After each step, run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm e2e`, then fix failures. Give a short summary: what was built, which SDD/SRS IDs it covers, and how to try it.
3. **Git:** when a step passes, commit with a conventional message (`feat:`, `fix:`, `docs:`, `chore:`) and push to `main`.
   - **Never force-push.**
   - **Never commit secrets.**
   - **Commit messages never contain a `Co-Authored-By` line or any Claude/AI attribution.**
4. The user is not experienced with these tools: explain any command they need to run themselves in simple words.

## Steps

- Step 0: move files, scaffold, configs, CI, README, CLAUDE.md. ✅
- Step 1: contracts, sample-data generator and fixtures, MSW handlers with role checks and in-memory session state (SDD 7.1, 7.2).
- Step 2: screens of SDD 7.3: (a) app shell, login, network; (b) forecast and totals, resources and trips; (c) planner and approvals with the scripted edit outcomes; (d) history and administration.
- Step 3: hidden developer toolbar (scenarios, forced errors), the Playwright MVP suite (every screen and flow per role, AC-21), the final README.
