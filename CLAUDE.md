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

## Logo and favicon (strict)

- **Logo:** the only logo is `apps/web/public/logo.png` (navy artwork on a transparent background). Use that exact file wherever the logo appears (login page, navigation panel). Alt text: `Venzini`.
  - Never draw, generate, recreate, trace, recolor, crop or replace it, and never make an SVG or text version. Only **resized copies of the same file**, keeping the aspect ratio, are allowed.
  - Because it is navy on transparent, always place it on a light surface (panel `#FFFDF9`), never directly on navy.
- **Favicon:** the user's own square mark `apps/web/public/favicon.png` (the "VE" mark, 1:1). Use it exactly as it is.
  - Only **resized copies** are allowed (`favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png` 180 px, …). Never redraw, recolor, crop, pad or change its background (it is transparent).
  - The favicon is never made from `logo.png`.

## Design system (SDD 5.12.4, Figure 42, with the user's approved visual direction)

- **Tokens only:** use the CSS variables in `apps/web/src/index.css`, mapped in `apps/web/tailwind.config.ts`. Components never use raw hex values. When merging classes, `cn()` knows the custom text sizes (`text-title`, `text-section`, `text-body`, `text-caption`, `text-kpi`).
- **Canvas (whole app, login included):** the fixed navy gradient `--vz-canvas` on the `body`. It fills the window and never scrolls with the content. Screens never paint their own page background; they place panels on this canvas.
  - The exact value is radial gradients `rgba(30,70,160,…)` / `rgba(11,46,107,…)` at the top centre and both bottom corners, over `#021C45`; see `index.css`.
  - **Text placed directly on the canvas is cream `#F7F3EC`** (`text-on-navy`), at least 8.7:1 even at the brightest glow. Navy text never sits on the canvas.
- **Panels, cards and dialogs** are warm off-white `#FFFDF9` with borders `#E7E0D4`; `#F7F3EC` (`cream`) is used for quiet surfaces inside panels. Form-field borders are `#8C8270` (WCAG 1.4.11).
- **Text inside panels:** navy `#021C45` for text, headings, primary buttons and focus (the only brand color); warm grey `#6B6358` for secondary text.
- **Risk colors** `#C62828` (high), `#E07B00` (medium) and `#2E7D32` (low) are **used only for risk**, always with an icon and a word. Medium-risk label text uses `#8A4B00` for contrast. Never on buttons or routes (BR-09, BR-10).
- **Route lines:** the 8 route tokens only.
- **Feeling:** calm, premium, never overwhelming:
  - essentials first, details on demand (expand, drawers, tooltips);
  - generous spacing; one main action per screen;
  - few large numbers rather than dense tables.
- **Layout and layers:**
  1. the navy canvas;
  2. solid floating panels (16 px radius, thin border, soft shadow, slightly stronger on navy, **no blur**) with **20 px gaps** between panels and from the window edges (`--vz-gap`): the 240 px navigation panel on the left, the 64 px top bar on top, then each screen's own panels in the remaining area (`ContentArea`, or the screen's own grid using `--vz-safe-left`, `--vz-safe-top`, `--vz-gap`);
  3. dialogs and edit panels (20 px radius, strongest shadow). **Only** behind them is the app blurred (6 px) and dimmed with navy.
- **Maps sit inside their own rounded card**, never full-screen. Nothing overlaps a map except its own legend and controls inside the card. Details that would push the layout (such as the stock list) open in a dialog. The map tiles and their warm filter stay as they are.
- **Motion:** 150–300 ms, ease-out; fade, slide, gentle scale; never bouncy or slow; respect `prefers-reduced-motion`.
- **Interactive states on everything clickable:**
  - hover: tone shift, 1 px lift, bigger shadow;
  - press: scale 98%;
  - keyboard: 2 px focus ring.
- **Buttons:** primary = solid navy (Approve); secondary = off-white with a thin border and an icon (Reject = ✕). Destructive actions ("Reject all"…) always open a confirmation dialog.
- **Login:** the same navy canvas, with the logo on a floating off-white card.
- **Formats and layout:** Inter, tabular digits. Litres "34,000 L", 24 h times, dates "05 Nov 2026", money "$412.35". Minimum width 1366 px. A keyboard path for every action.
- **Unserved stations:** always show their reason in full (FR-38), using TPL-UNS-01 wording, never hidden behind a click.
- **Mock worker reconnection:** browsers stop an idle service worker; the restarted worker forgets the page and lets `/api/v1` requests through to the web server. The API client treats any answer without `X-Correlation-Id` as "not from the API": in the MVP it reconnects the mock worker once and retries (`setApiRecovery` in `main.tsx`). Such failures show the client message "Venzini could not be reached. Please try again.", never the plan-edit wording of ERR-SYS-01.
- **Test hook:** e2e tests set map tiles through `window.__VENZINI_TEST__.tileUrl`, because the MSW worker fetches every request itself and Playwright cannot stub it.

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
5. **Prompt log (until the end of the project):** after every new prompt from the user, add the next entry to `docs/prompt_log.md` and commit it together with the work of that step. Use exactly this template, number entries in order ("Entry N – <short title>"), and separate entries with 2 empty lines:

   ```text
   Entry N – <short title>

   * Prompt (exact):
   * What Claude Code gave back (1–2 lines):
   * What I accepted / rejected / changed:
   * How I verified it (tests, manual trace, diff):
   ```

   - The prompt is copied word for word (from the session transcript under `~/.claude/projects/`), never from memory.
   - "Accepted / rejected / changed" records what the user actually answered after the reply (options picked, corrections asked for); fill it in when the next prompt arrives.

## Sample data decisions (approved by the user)

- Stations are ST001–ST020. The SDD's ST032 is **ST012 "Westside Terminal"**. Any SDD example with ST021 must map to an existing station; tell the user which.
- Risk mix on 03 Nov 2026: 3 high, 5 medium, 11 low, plus 1 station with data unavailable (ST017).
- Distances follow ALG-09 (Floyd–Warshall, 50 km/h ≤ 12 km, 70 km/h above); ignore the straight line × 1.3 rule in SDD 5.11.3. Forecast model version: `fc-sim-1.1.0`.
- Demo clock: 02 Nov 2026 08:00 Tunis time (it runs on from there); delivery day 03 Nov 2026; 01 Nov is a decided past day.
- Fixtures are generated (`pnpm --filter @venzini/sample-data generate`) and committed; a test fails when they are out of date. Never edit them by hand.

## Steps

- Step 0: move files, scaffold, configs, CI, README, CLAUDE.md. ✅
- Step 1: contracts, sample-data generator and fixtures, MSW handlers with role checks and in-memory session state (SDD 7.1, 7.2). ✅
- Step 2: screens of SDD 7.3: (a) app shell, login, network ✅; (b) forecast and totals, resources and trips ✅; (c) planner and approvals with the scripted edit outcomes ✅; (d) history and administration.
- Step 3: hidden developer toolbar (scenarios, forced errors, and quick scenario buttons for the 5 demo flows of the README "Demo script" plus a reset), the Playwright MVP suite (every screen and flow per role, AC-21), the final README.
