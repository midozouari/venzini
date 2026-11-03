<p align="center">
  <img src="apps/web/public/logo.png" alt="Venzini" width="360">
</p>

# Venzini

**An AI-Assisted Yield Management Platform for Data-Driven Optimization in the Petroleum Industry**

## 1. What is Venzini?

Venzini is a web platform for a fuel distributor that runs a network of fuel stations, warehouses (depots) and tanker trucks. It helps the team:

- **forecast fuel demand** for each station and fuel type (Petrol 95, Diesel) for the next 7 days, with a confidence level and the reasons behind each forecast;
- **spot stations at risk** of running out of fuel (high, medium or low risk, from the hours left before the tank is empty);
- **plan deliveries**: how many litres each station gets, which tanker serves it and in what order, shown as routes on a map;
- **edit the plan** (reorder stops, move a station to another tanker, change quantities) and see at once the extra cost, delay or overload that the change causes;
- **keep people in control**: nothing is final until the operations manager approves it, and every decision is written to a history that nobody can change.

Venzini has three roles:

| Role                   | What they do                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| **Operations manager** | Watches the network, reads forecasts, generates and edits the delivery plan, approves or rejects it. |
| **Dispatcher**         | Enters each day's available tankers, drivers and warehouse stock, and records actual trip times.     |
| **System admin**       | Manages user accounts and station records.                                                           |

## 2. What this MVP is (and is not)

This repository holds the **MVP** (minimum viable product) described in chapter 7 of the design document: the real web app, running on fake data.

- **All 8 screens** (UI-01 to UI-08): login, network overview, station forecast and totals, resources and trips, delivery planner, review and approve, decision history, administration.
- **All 11 use cases** (UC-01 to UC-11) can be clicked through for each role. This is acceptance criterion AC-21; the checklist is in [e2e/AC-21.md](e2e/AC-21.md).
- **No server and no database.** A small mock API runs inside your browser ([Mock Service Worker](https://mswjs.io/)). It answers the app's real API calls with fake sample data, following the same API contracts as the future server.
- **Nothing is saved.** Reloading the page resets everything to the starting sample data and logs you out.
- **No real calculations.** Forecasts, plans and the results of edits are prepared in advance; five plan edits have scripted results (see the demo script). Version 1 adds the real server, database and calculation engines: see the design document and the [backlog](docs/backlog.md).

## 3. Install and run (Windows, macOS or Linux)

### What you need first

1. **Git**, to download the project: [git-scm.com](https://git-scm.com/). To check, open a terminal and type `git --version`.
2. **Node.js 24 or newer (the "LTS" version)**: [nodejs.org](https://nodejs.org/). Node.js runs the development tools. To check, type `node --version`.
3. **pnpm 12**, which downloads the project's libraries. After installing Node.js, run this once:

   ```bash
   npm install -g pnpm@12
   ```

   To check, type `pnpm --version`.

On Windows, "a terminal" means **PowerShell** or **Command Prompt** (search for it in the Start menu).

### Download, install, start

```bash
git clone https://github.com/midozouari/venzini.git   # downloads the project into a "venzini" folder
cd venzini                                            # goes into that folder
pnpm install                                          # downloads the libraries (a few minutes the first time)
pnpm dev                                              # starts the app
```

Then open **http://localhost:5173** in Chrome, Firefox or Edge, in a window at least **1366 px wide**.

To stop the app, go back to the terminal and press `Ctrl + C`.

## 4. Demo accounts

These accounts are fake and exist only inside the browser mock. All three use the same password. Each role lands on its own home page and sees only its own menu.

| Role               | Login     | Password       | Home page              |
| ------------------ | --------- | -------------- | ---------------------- |
| Operations manager | `sara.m`  | `venzini-demo` | Network overview       |
| Dispatcher         | `karim.b` | `venzini-demo` | Resources              |
| System admin       | `nadia.a` | `venzini-demo` | Administration (users) |

Good to know:

- **Reloading the page logs you out** and resets the data; just log in again.
- `omar.b` is a deactivated account and `rania.m` is locked for a few minutes, so you can see those login errors.
- After 28 idle minutes, a dialog asks whether you want to stay signed in; at 30 minutes you are signed out.

### The sample data

All data is invented and generated by `packages/sample-data` from a fixed seed (42), so every computer shows exactly the same data. The demo is set on **02 Nov 2026, 08:00 (Tunis time)**, and the plan to prepare is for **03 Nov 2026**.

- 3 warehouses and 20 stations in Greater Tunis, 2 fuels (Petrol 95, Diesel), 6 tankers, 6 drivers.
- On 03 Nov: 3 stations at high risk, 5 at medium risk, 11 at low risk, and 1 station (ST017) with unknown tank levels, shown with a grey "no data" marker.
- 01 Nov is a past day that is already decided, with trips to record.
- 30 past decisions in the history.

## 5. Demo script

### A tour of each role

- **Operations manager (`sara.m`):** the network map shows each station's risk. Click a high-risk alert, then **Open forecast**. Harbor Road (ST014) Diesel is an uncertain forecast (66%), and Khelidia (ST020) Petrol 95 has little sales history. Then click **Plan deliveries** → **Generate plan**, and try the five flows below.
- **Dispatcher (`karim.b`):** change a tanker's availability or a stock figure, then **Save resources**; a confirmation lists the changes. For the trips of 01 Nov, go back two days with the arrows in the top bar, then open **Trips** and record a departure and a return.
- **System admin (`nadia.a`):** create a user, log out and log in with it. Deactivate `karim.b` and try to log in with that account. In **Stations**, add a station (for example ST021 "Lac 2 Centre", 36.8421, 10.2731). It appears on the manager's network map as a grey "no data" marker, because the demo has no forecast for it.
- **Everyone:** **Decision history** lists who decided what and when. Search **ST015** and open the row: it was moved to another tanker before approval. Decisions you make in Approvals appear at the top.

### The five planner and approval flows

These flows have scripted answers in the mock API (SDD 7.2), so they always give the same result. Log in as `sara.m`, click **Plan deliveries** on the network page, then **Generate plan**. Each flow starts from the untouched recommended plan: between flows, click **Reset to optimal**, or use the developer toolbar below.

| #   | What you do                                                                                                                                                    | What you see                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Move ST012 to T-02.** Drag Westside Terminal (stop 1 of T-01) by its ⠿ handle onto the **T-02** card. Or use the ⇄ button on its row, then **Move to T-02**. | T-02 is overloaded (34,000 L on a 32,000 L tanker). The banner says approval is blocked, and **Show on map** highlights T-02. |
| 2   | **Reorder on T-03.** Open the **T-03** card and drag La Marsa Corniche (ST003) onto Borj Louzir (ST005), so it becomes stop 3.                                 | A medium risk: "This change makes ST003 arrive 90 min later than planned."                                                    |
| 3   | **Reorder on T-01.** Click ↓ on Westside Terminal (ST012).                                                                                                     | "No risk: this change keeps all deliveries on time and within limits."                                                        |
| 4   | **Quantity above the limit.** Click Westside Terminal (ST012), then **Edit quantity** next to Petrol 95, and type 7000.                                        | "This quantity exceeds the space left on tanker T-01. Enter 6,400 L or less." Save stays disabled.                            |
| 5   | **Reject ST014.** Click **Go to approvals**, then **✕ Reject** on Harbor Road (ST014), then confirm.                                                           | A new plan in which ST019 (Bardo Road) is served. ST014 is listed as not dispatched.                                          |

Then try **Approve all** (it asks for confirmation). The plan becomes decided, and **Go to trips** shows the trips to record.

### The hidden developer toolbar

The MVP build has a hidden toolbar for demos and testing (SDD 7.1). Press **Ctrl + Alt + D** on any screen (or add `?dev` to the address) to open it. It changes only the in-browser mock data:

- **Scenario:** you can choose one of four:
  - _Normal day_ (SC-01);
  - _Critical resource missing_ (SC-03): no drivers on 03 Nov, so no plan can be made;
  - _No resources uploaded_;
  - _No decisions yet_.

  The other test scenarios of the SRS (SC-02, SC-04 to SC-08) need the real calculations, so they come with version 1.

- **Forced errors:** switch on ERR-PLAN-01 (Generate plan), ERR-VAL-04 (day already decided) or ERR-SYS-01 (a plan edit fails) to see each error message. A "Dev" chip in the top bar reminds you while something is switched on.
- **Demo flows:** one **Set up** button per flow above. It signs in as `sara.m`, starts from fresh data with a newly generated plan, and opens the right screen with the station selected. Then you do the action yourself.
- **Reset demo data:** back to the starting sample data without a reload (you stay signed in). It asks for confirmation first.

The toolbar exists only in the MVP: a version 1 build (`VITE_USE_MOCKS=false`) does not contain it.

### Demo video

The MVP demo video (about 6 minutes, 1080p) is made automatically from the written script [docs/demo-script.md](docs/demo-script.md):

- **Recording:** Playwright opens the production build of the app (with the mock API) in Chromium at 1920×1080 and performs each scene's actions at a person's pace, with a visible cursor and a short title at the start of each scene. The developer toolbar is never shown.
- **Voice-over:** each scene's narration is spoken by Microsoft Edge's text-to-speech voice _en-US-AndrewNeural_ (through the `edge-tts` tool). Each scene lasts at least as long as its narration.
- **Assembly:** ffmpeg puts the picture and the voice clips together and exports an H.264 MP4.

To make it again, install `edge-tts` once (`pip install edge-tts`; it needs Python and internet access), then run:

```bash
pnpm demo:video
```

It takes about 10 minutes. The video is saved as `demo-output/venzini-demo.mp4`; that folder is not saved in Git. Details and options are in [scripts/demo-video/README.md](scripts/demo-video/README.md).

## 6. Tests and checks

| Command                                                                      | What it does                                                                                                      |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                                                  | Checks the code for mistakes and banned patterns.                                                                 |
| `pnpm format:check`                                                          | Checks that every file is formatted the same way (Prettier). `pnpm format` fixes it.                              |
| `pnpm typecheck`                                                             | Checks that the TypeScript types are consistent.                                                                  |
| `pnpm test`                                                                  | Runs the unit tests (Vitest): API contracts, sample data, the mock API, formats and screen logic.                 |
| `pnpm build`                                                                 | Builds the production version of the web app into `apps/web/dist/`.                                               |
| `pnpm size`                                                                  | After a build: checks that no page loads more than 250 kB of gzipped code (NFR-02). See below.                    |
| `pnpm --filter @venzini/e2e exec playwright install chromium firefox msedge` | One-time setup: downloads the browsers for the end-to-end tests.                                                  |
| `pnpm e2e`                                                                   | Runs the end-to-end tests (Playwright) in Chrome, Firefox and Edge at 1366×768. Builds and starts the app itself. |

The end-to-end suite clicks through every screen and use case for each role (AC-21) and checks every error state. It also runs automatic accessibility checks (axe-core, WCAG 2.1 AA) on every screen and dialog.

**Page size (NFR-02).** Each page loads only when you open it (route-based code splitting).

- `pnpm size` lists, for each page, the gzipped JavaScript and CSS the page needs before it appears. Every page is below 250 kB; the largest is the delivery planner, at about 237 kB.
- **How the budget is read:** the map library Leaflet (about 46 kB gzipped) loads _after_ the page appears, on the network overview and the delivery planner, so it is **not counted** in the 250 kB. `pnpm size` lists it separately. With Leaflet, the planner page totals about **285 kB**.
- The **MVP mock API** (Mock Service Worker plus all the sample data, about 190 kB gzipped) loads once at start. It is **not counted** in the page budget, because it is not part of version 1. `pnpm size` reports it on its own line.

The same checks run automatically on GitHub on every push ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## 7. Folder structure

```
venzini/
├─ apps/
│  └─ web/                 # the React web app (all screens)
│     ├─ public/           # static files: logo, favicon, mock service worker
│     ├─ scripts/          # size.mjs: the page size budget check
│     └─ src/
│        ├─ app/           # app shell, router, route guards
│        ├─ pages/         # one folder per screen
│        ├─ features/      # parts shared by screens (maps, route list, forecast chart, history, developer toolbar…)
│        ├─ components/ui/ # base UI components (buttons, dialogs, fields, station picker…)
│        ├─ api/           # API client and data hooks (TanStack Query)
│        ├─ stores/        # small view-state stores (Zustand)
│        ├─ mocks/         # the browser mock API (MSW handlers, scenarios, forced errors)
│        └─ lib/           # helpers: formats, Tunis time
├─ packages/
│  ├─ contracts/           # shapes of every API request and response (Zod schemas), error messages, roles
│  ├─ sample-data/         # generator of the fake sample data (seed 42) and the generated fixtures
│  └─ config/              # shared ESLint, Prettier and TypeScript settings
├─ e2e/                    # end-to-end tests (Playwright) and the AC-21 checklist
├─ scripts/demo-video/     # the automated demo video pipeline (pnpm demo:video)
├─ docs/                   # project documents, backlog, AI usage log, prompt log
├─ .github/workflows/      # continuous integration (GitHub Actions)
├─ CLAUDE.md               # working rules for the AI coding assistant
└─ README.md
```

The sample data files are in `packages/sample-data/fixtures/` and are saved in Git. They are never edited by hand: if the generator changes, rebuild them with `pnpm --filter @venzini/sample-data generate` (a test fails when they are out of date).

## 8. Documents

The project documents are in [docs/](docs/). [docs/README.md](docs/README.md) is an index of all of them. It also lists where each diagram is: UML use case, activity, class, sequence and state diagrams, ERDs and more.

- `Venzini 0 - Project Proposal FV.pdf`: the project idea, goals and scope.
- `Venzini 1 - Requirement Elicitation FV.pdf`: stakeholders, user needs, user stories and use cases.
- `Venzini 2 - SRS FV.pdf`: the Software Requirements Specification (what the system must do).
- `Venzini 3 - SDD FV.pdf`: the Software Design Document (how it is built). Chapter 7 describes this MVP.
- [backlog.md](docs/backlog.md): the product backlog (user stories and requirements, MVP or version 1).
- [ai-usage-log.md](docs/ai-usage-log.md) and [prompt_log.md](docs/prompt_log.md): how AI was used, and every prompt of the build.

Where the SRS and the SDD differ, this project follows the SDD.
