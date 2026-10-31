# Venzini – Prompt log

Records, in order, every prompt I sent to Claude Code while building Venzini, what came back, what I decided and how I verified it.

Entry 1 – Project brief and Step 0

* Prompt (exact):

  ```text
  FIRST TASK, before anything else:
  I placed Logo.png and three PDF documents loose at the root of this repo:
  "Venzini 1 - Requirement Elicitation FV.pdf", "Venzini 2 - SRS FV.pdf", "Venzini 3 - SDD FV.pdf".
  - Move Logo.png to apps/web/public/logo.png (create the folders; move the file as it is, do not modify it).
  - Move the three PDFs into docs/ (create the folder; keep their names).
  The repo is already linked to GitHub (origin = https://github.com/midozouari/venzini.git, branch main) but has no commit yet.
  Then continue with the instructions below.

  You are building the MVP of Venzini, a fuel demand forecasting and delivery planning web platform.

  SCOPE: MVP ONLY.
  The MVP is defined in chapter 7 of the SDD: the real frontend running against a mock API inside the browser (Mock Service Worker), filled with fake sample data. There is NO backend, NO database and NO Docker in this phase. Do not build anything from the NestJS/Prisma parts of the SDD.

  SOURCE DOCUMENTS (read both fully before doing anything):
  - docs/Venzini 3 - SDD FV.pdf → the design. Most relevant for the MVP: chapter 7 (MVP design, fixtures, screens and flows), 5.6 (API contracts the mocks must follow), 5.12 (UI design view and design system), 6.1.1 (role permissions), 8.4 (AC-21 acceptance) and Appendix B (repository structure).
  - docs/Venzini 2 - SRS FV.pdf → the requirements (UI-01 to UI-08, UC-01 to UC-11, AC-21).
  The SDD contains the latest approved decisions; if it conflicts with the SRS, follow the SDD and tell me. Never invent features that are in neither document; if something is unclear, ask me first.

  LOGO (strict):
  - The only logo is apps/web/public/logo.png. Use that exact file wherever the logo appears (login page, app header, favicon).
  - Never draw, generate, recreate, trace, recolor, crop or replace it, and never make an SVG or text version. You may only make resized copies of the same file (e.g. for the favicon), keeping the aspect ratio. Alt text: "Venzini".

  STACK AND STRUCTURE (MVP subset of SDD Appendix B):
  - pnpm monorepo with: apps/web (React 19 + Vite + Tailwind + shadcn/ui, TanStack Query, Zustand, MSW), packages/contracts (Zod schemas), packages/sample-data (deterministic generator, seed 42, producing the fixtures of SDD 7.2), packages/config (shared ESLint, Prettier, tsconfig), e2e (Playwright), docs.
  - Root files: README.md, .gitignore, pnpm-workspace.yaml, package.json, .github/workflows/ci.yml (lint, type-check, tests, build).
  - .gitignore: .env, node_modules/, dist/, build/, coverage/, playwright-report/, test-results/, *.log, private-data/, *.dump, .DS_Store, .vscode/, .idea/
  - Colors from the SDD design system only (navy #021C45; risk colors #C62828, #E07B00, #2E7D32 used only for risk).
  - Fake sample data only. Never real data.

  README.md must explain, for someone who has never seen the project:
  what Venzini is (subtitle: "An AI-Assisted Yield Management Platform for Data-Driven Optimization in the Petroleum Industry"), what the MVP covers, prerequisites (Node.js LTS, pnpm), how to install and run it (pnpm install, pnpm dev, the URL to open), the demo accounts and their passwords for each role (manager, dispatcher, admin), how to run the tests, the folder structure, and where the documents are (docs/).

  ORDER OF WORK:
  Step 0: move the files (FIRST TASK), scaffold the monorepo, configs, CI workflow, README (first version), .gitignore, and a CLAUDE.md that summarizes all the rules above.
  Step 1: contracts, sample-data generator and fixtures, MSW handlers with role checks and in-memory session state (SDD 7.1, 7.2).
  Step 2: the screens of SDD 7.3, in this order: (a) app shell, login, network overview; (b) forecast and totals, resources and trips; (c) planner and approvals, with the scripted edit outcomes; (d) history and administration.
  Step 3: the hidden developer toolbar (scenarios and forced errors), the Playwright MVP test suite (every screen and flow per role, AC-21), and the final README.

  WAY OF WORKING:
  - One step at a time. Before each step, show me a short plan and wait for my OK.
  - After each step: run lint, type-check, tests and build; fix failures; give me a short summary of what was built, which SDD/SRS IDs it covers, and how to try it.
  - Git: after each step passes, commit with a conventional commit message (feat:, fix:, docs:, chore:) and push to main. Never force-push. Never commit secrets.
  - I am not experienced with these tools: explain any command I need to run myself in simple words.

  Start now: read both documents, then show me the plan for Step 0 only.
  ```

* What Claude Code gave back (1–2 lines): Read the SRS and SDD, asked two questions (which document wins; demo logins), then a Step 0 plan; after approval, moved the logo and PDFs, scaffolded the pnpm monorepo, configs, CI, README and CLAUDE.md (commit 5da3ed6).
* What I accepted / rejected / changed: Answered "SDD wins (Recommended)" and "SDD names + one password (Recommended)" (sara.m, karim.b, nadia.a / venzini-demo). Approved the Step 0 plan with one change: no Co-Authored-By line or any AI attribution in commits, in any step, written into CLAUDE.md.
* How I verified it (tests, manual trace, diff): Lint, type-check, unit tests, build and a Playwright smoke test in Chrome, Firefox and Edge; the logo's git hash checked identical to the original file; GitHub CI green.


Entry 2 – Step 1 plan and SDD answers

* Prompt (exact):

  ```text
  Ready for the Step 1 plan. Answers to the two SDD inconsistencies:
  - Distances: follow ALG-09 (Floyd–Warshall on the road network, 50 km/h for roads up to 12 km, 70 km/h above). Ignore the straight line × 1.3 at 45 km/h in 5.11.3; it is outdated.
  - Forecast version: use fc-sim-1.1.0 everywhere.
  Show me the Step 1 plan.
  ```

* What Claude Code gave back (1–2 lines): The Step 1 plan (contracts, seed-42 generator and fixtures, mock API with role checks, tests), the demo clock choice, and two SDD conflicts to decide: station ST032 does not exist, and the station counts add up to 21.
* What I accepted / rejected / changed: Approved the plan in the next prompt (Entry 3): ST012 "Westside Terminal" replaces ST032; 20 stations = 3 high, 5 medium, 11 low + 1 without data; demo clock accepted; asked to add .qodo/ to .gitignore.
* How I verified it (tests, manual trace, diff): Plan only (no code yet); checked against SDD 7.2 and my answers before approving.


Entry 3 – Build Step 1

* Prompt (exact):

  ```text
  OK, build Step 1. Answers:
  1. Keep ST001–ST020. Give the scripted move to ST012, named "Westside Terminal". Note: the SDD's ALG-07 example also mentions ST021, which doesn't exist either; if you use that example anywhere, map it to an existing station and tell me which.
  2. 20 stations: 3 high, 5 medium, 11 low, plus 1 with data unavailable.
  The demo clock (02 Nov 2026 08:00 Tunis time, delivery day 03 Nov 2026) and the other choices are fine.
  Also add .qodo/ to .gitignore in this step.
  ```

* What Claude Code gave back (1–2 lines): Zod contracts for every endpoint, the seed-42 generator writing the SDD 7.2 fixtures (Floyd–Warshall distances, fc-sim-1.1.0 forecasts, scripted plan outcomes) and the browser mock API with session, role and CSRF checks (commit 1b70b63).
* What I accepted / rejected / changed: Accepted. In the next prompt (Entry 4) asked to confirm .qodo/ (missing from the summary) and required a clear reason for every unserved station, such as ST019.
* How I verified it (tests, manual trace, diff): 62 unit tests: role matrix on every endpoint, every scripted flow, fixture invariants (counts, costs to the cent, byte-equal re-generation); mock API checked in three real browsers; GitHub CI green.


Entry 4 – Step 2a plan and visual direction

* Prompt (exact):

  ```text
  Ready for the Step 2a plan. Three things:

  1. Confirm that .qodo/ was added to .gitignore in Step 1 (it isn't in your summary). If not, add it in this step.

  2. On the screens, any unserved station must show its reason clearly (for example ST019: "Diesel does not fit the remaining tanker compartments"), so it is clear why a high-risk station was not served.

  3. Visual direction: the app must feel premium, luxurious and above all CALM, never overwhelming (think Stripe, Linear, Apple Maps, a high-end private bank).
  - Palette: warm cream base canvas #F7F3EC instead of white, warm off-white floating panels #FFFDF9, warm light grey borders #E7E0D4, navy #021C45 for text, headings and primary buttons. Navy stays the only brand color; risk colors only for risk. Keep WCAG contrast (NFR-10). Update the design tokens accordingly and tell me which SDD 5.12.4 values changed.
  - Calm: show the essentials first and reveal details on demand (expand, drawers, tooltips); generous spacing; one main action per screen; few, large, clear numbers rather than dense tables.
  - Floating, layered UI: full-bleed base canvas (the map on map screens, the cream background elsewhere), with detached floating panels on top (navigation, filters, stop lists, detail cards). Clear layer hierarchy: base → floating panels → dialogs, each with a slightly stronger soft shadow, rounded corners and thin borders.
  - Blur only for focus: when a dialog or edit panel opens (e.g. quantity edit, approve/reject, confirmations), blur and slightly dim everything behind it, so the rest of the app feels paused until the user finishes. Floating panels themselves are solid (no blur) with soft shadows, so text stays readable and the map stays fast.
  - Motion: very smooth, short transitions (150–300 ms, ease-out; fade, slide, gentle scale) for panels, dialogs, hovers and map interactions. No bouncy or slow effects. Respect prefers-reduced-motion.
  - Interactive states on every button and clickable item: on hover a slight tone shift, a 1 px lift and a slightly bigger shadow; on press a gentle scale to 98%; a clear focus ring for keyboard users. Approve is the primary button (solid navy); Reject is a secondary button (off-white, thin border, ✕ icon, light navy tint on hover). Never use the risk colors (red, orange, green) for buttons (BR-10). Destructive actions like "Reject all" open a confirmation dialog.
  - Refined Inter typography and polished empty and loading states. The login page is the "wow" moment (deep navy with the logo).
  Describe this visual direction in the plan before building.
  ```

* What Claude Code gave back (1–2 lines): Confirmed .qodo/ was committed in Step 1; a plan to compute true reasons for unserved stations; the full visual-direction description with WCAG contrast checks; found the logo is navy on transparent (login card and light navigation panel); the list of SDD 5.12 values that change.
* What I accepted / rejected / changed: Approved in the next prompt (Entry 5) with one change: use my own square favicon.png instead of a resized logo.
* How I verified it (tests, manual trace, diff): Contrast ratios computed for every color pair; the logo's transparency checked pixel by pixel; git check-ignore confirmed .qodo/ is ignored.


Entry 5 – Build Step 2a with my favicon

* Prompt (exact):

  ```text
  OK, build Step 2a. One change about the favicon:
  - I added my own square favicon at apps/web/public/favicon.png (the "VE" mark on a white background, 1:1). Use it as the favicon instead of a resized logo.
  - Use it exactly as it is: you may only make resized copies of it (16, 32, 180 px apple-touch, etc.). Never redraw, recolor, crop, pad or change its background.
  - logo.png stays exactly as it is everywhere else.
  - Update the logo/favicon rules in CLAUDE.md accordingly.
  ```

* What Claude Code gave back (1–2 lines): Design tokens, login page, app shell with role menus and guards, network overview, resized favicon copies (16, 32, 180 px), and computed unserved reasons (ST019: total capacity, not compartments; ST006: compartments). The session stopped before the commit.
* What I accepted / rejected / changed: Accepted the work so far; the session ended mid-step, so I asked to continue (Entry 6).
* How I verified it (tests, manual trace, diff): Unit tests and Chromium e2e; screenshots reviewed at 1366×768, which revealed and fixed an invisible "Log in" label, the map covering the panels and a hidden KPI card; favicon.png size checked unchanged.


Entry 6 – Finish Step 2a

* Prompt (exact):

  ```text
  Continue Step 2a from where you stopped. First check what is already done, then finish the remaining parts, run all checks (lint, typecheck, tests, build, e2e), and commit and push when everything passes.
  ```

* What Claude Code gave back (1–2 lines): Finished the docs (CLAUDE.md, AGENTS.md, README, AI usage log), fixed two lint errors, and moved the e2e suite to the production preview build after a cold-start failure (commit 0203148).
* What I accepted / rejected / changed: Accepted. In the next prompt (Entry 7) asked for a design revision: navy canvas everywhere and the map in its own card.
* How I verified it (tests, manual trace, diff): Lint, format, type-check, 76 unit tests, build, 60 e2e tests in three browsers; 120/120 repeated runs; GitHub CI green.


Entry 7 – Design revision: navy canvas and map card

* Prompt (exact):

  ```text
  Before Step 2b, a design revision of Step 2a. It must apply to the whole app: the login page, the app shell and every screen, including the ones built later (put it in the shared layout and design tokens, and in CLAUDE.md as a rule).

  1. Canvas: a navy gradient background instead of cream, everywhere.
     Use exactly this as the app background (body/shell, and the login page):
     background:
       radial-gradient(ellipse 55% 55% at 50% 0%, rgba(30,70,160,.85) 0%, rgba(11,46,107,.5) 40%, rgba(2,28,69,0) 75%),
       radial-gradient(ellipse 45% 50% at 0% 100%, rgba(30,70,160,.75) 0%, rgba(11,46,107,.4) 45%, rgba(2,28,69,0) 80%),
       radial-gradient(ellipse 45% 50% at 100% 100%, rgba(30,70,160,.75) 0%, rgba(11,46,107,.4) 45%, rgba(2,28,69,0) 80%),
       #021C45;
     It is fixed (does not scroll with the content) and fills the whole window.
     All panels and cards stay cream/off-white (#FFFDF9) floating on it, with the same soft shadows (slightly stronger on navy), rounded corners and 20 px gaps between them. Any text placed directly on the navy canvas must be cream (#F7F3EC) and keep WCAG contrast.

  2. Network overview layout: the map is no longer full-screen.
     - Left: the navigation panel (unchanged). Top: the top bar (unchanged).
     - Middle column: the row of 4 KPI cards, and below it the map inside its own rounded card (same radius and shadow as the other cards), filling the remaining height. Nothing overlaps the map anymore except its own legend and zoom controls inside the card.
     - Right: the "Stations at highest risk" panel, full height.

  3. Map style: keep exactly the current map tiles and look (same tiles, same warm filter, same markers). Only its placement changes (point 2).

  4. Update the design tokens and CLAUDE.md, adjust the tests and screenshots (including the axe-core contrast checks), run all checks (lint, typecheck, tests, build, e2e), then commit and push. In your summary, list the SDD 5.12 values that changed again.
  ```

* What Claude Code gave back (1–2 lines): The fixed navy gradient canvas as a shared token (login included), 20 px gaps, stronger shadows, the network overview in three columns with the map in its own card, the stock list in a dialog, no page scroll, and the table of SDD 5.12 values changed again (commit 4ceca99).
* What I accepted / rejected / changed: Accepted. In the next prompt (Entry 8) asked to put the map above the KPI row and reported an error in the risk panel.
* How I verified it (tests, manual trace, diff): Cream-on-navy contrast computed (at least 8.7:1); layout and dialog tests; axe-core checks on the navy canvas and the dialog; screenshots reviewed; 144/144 e2e runs; GitHub CI green.


Entry 8 – Map above the KPI row and the loading-error bug

* Prompt (exact):

  ```text
  Two things before Step 2b:

  1. Layout change on the network overview: swap the map and the 4 KPI cards. The map card goes on top (it is the main element of this screen and should sit more centered on the screen), and the row of 4 KPI cards goes below it, at the bottom of the middle column. Everything else stays the same (navigation left, risk panel right, same gaps, same map look). Make sure the cards and "Plan deliveries" stay visible without scrolling at 1366×768.

  2. Bug: the "Stations at highest risk" panel showed an error: "The network could not be loaded — The change couldn't be calculated and was undone. Please try again." (I was logged in as sara.m on 03 Nov.) Find the cause and fix it, and also fix the message: a loading error must not use the wording meant for failed plan edits. Add a test so it doesn't come back.

  Run all checks, then commit and push.
  ```

* What Claude Code gave back (1–2 lines): Swapped the map and the KPI row; found the bug's cause (the browser stops an idle service worker, the restarted mock worker forgets the page, requests hit the web server and the client showed the ERR-SYS-01 plan-edit message); added reconnect-and-retry and a separate "could not be reached" message (commit 367d9f2).
* What I accepted / rejected / changed: Accepted both. Next, asked to set up this prompt log before Step 2b.
* How I verified it (tests, manual trace, diff): Bug reproduced by stopping the worker in Chromium (requests answered 404 outside the worker), kept as a regression test; 4 API client unit tests; layout test at 1366×768; 148 e2e runs; GitHub CI green.
