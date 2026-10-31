# Venzini – AI Usage Log

**Author:** Mohamed Zouari
**Project:** Venzini – An AI-Assisted Yield Management Platform for Data-Driven Optimization in the Petroleum Industry

## 1. Tools used

| Tool | Where | Used for |
|---|---|---|
| **Claude** (Anthropic) | claude.ai, inside a dedicated "Venzini" Project holding all the project documents | Drafting and reviewing the documents (proposal, requirements elicitation, SRS, SDD), producing diagrams and figures, the algorithm mathematics, document formatting, and guidance for the coding setup |
| **Claude Code** (Anthropic) | VS Code extension, working in the `venzini` repository | Building the MVP (see Phase 2) |
| **Stitch** (Google) | Web app | Generating the preliminary UI/UX screen designs |
| **ChatGPT** (OpenAI) | Web app | Generating the Venzini logo |

## 2. How AI was used (working rules)

- **I own the decisions.** The AI tools proposed content, designs and options. I chose, corrected or rejected them, and nothing went into a document without my approval.
- **Point by point.** I reviewed requirements, figures and algorithms one item at a time and approved each change before it was applied.
- **Labels for AI suggestions.** While drafting, every design choice that came from the AI rather than from my requirements was marked *Proposed*. It stayed marked until I approved, changed or removed it. Open questions stayed open until I answered them.
- **Verification.** I reviewed every figure and section myself and asked for corrections whenever something was wrong, unclear or inconsistent. Generated files were also checked automatically (Word file validation, page numbers, equation rendering).
- **Code.** Claude Code works in plan mode: it shows me a plan for each step and waits for my approval. It runs lint, type checks, tests and a build before each commit. By my choice, commits carry no AI co-author line; this log is where AI use is declared.

## 3. Phase 1 – Documents and design

| # | Task | Tool | What the AI produced | What I decided or changed | How it was checked |
|---|---|---|---|---|---|
| 1 | **Logo** | ChatGPT | Logo designs | Selected the final logo; set navy #021C45 as the brand color | My review |
| 2 | **Project proposal (scope)** | Claude | Draft structure and wording from my project idea | The idea, the goals, the three roles (operations manager, dispatcher, admin), the in-scope and out-of-scope items, and the MVP / version 1 split | My review |
| 3 | **Requirements elicitation** | Claude | Drafts of the stakeholders, user needs, functional, non-functional and AI requirements, user stories, use cases, and the use case and activity diagrams | Requirements discussed and validated point by point; priorities (Must/Should); roles and permissions; what drivers and station managers can and cannot do | Point-by-point review |
| 4 | **Preliminary screen designs** | Stitch | UI/UX screen mock-ups ("FuelFlow", "Venzini") | Used as visual inspiration only, and marked as such in the SRS (Figures 7–8) | – |
| 5 | **SRS** | Claude | Turned the elicitation document into a testable specification: IDs, business rules, APIs, data, acceptance criteria and traceability | Decisions D-01 to D-28 (Appendix A) | My review |
| 6 | **SDD first draft (IEEE 1016)** | Claude | Architecture, modules, database, interfaces, sequence and state diagrams, deployment, and the MVP and testing design | The technology stack and the main design choices | My review |
| 7 | **SDD figure review** | Claude | Plain-language explanations of each diagram; redrawn diagrams | Corrections to each diagram (see section 4) | Figure-by-figure review; every change approved before it was applied |
| 8 | **Algorithm review** | Claude | The mathematics of ALG-01 to ALG-07, a new ALG-09 (Floyd–Warshall), charts and worked examples | Routing decisions: a second trip per tanker, warehouse fallback, a fallback forecast for short history, carry-over of unserved stations; which content to include and illustrate | Equations checked by re-rendering them; my review |
| 9 | **Proposed items and open questions** | Claude | A list of every AI-proposed item and open question, with its impact | Approved the proposed items; answered all open questions | My review |
| 10 | **Complexity and asymptotic analysis** | Claude | Sections 5.9.10–5.9.11, the Big O / Ω / Θ analysis, Figures 37–39 | Asked for these sections; chose the figure layouts, the curve style and the colors | My review |
| 11 | **Repository structure (Appendix B)** | Claude | The folder tree, `.gitignore`, `.dockerignore` and `README.md` | Required the ignore files and the README; decided that real data never goes in the repository | My review |
| 12 | **Final formatting** | Claude | Lists of figures and equations, covers, tables of contents, "FV" naming | The cover layout, the file naming, and dropping the redundant scope document from the main set | Word file validation; page numbers checked |
| 13 | **Self-assessment** | Claude | A mock grading of the SDD as a professor would mark it, with weaknesses | Which fixes to make | – |

## 4. Mistakes I found and corrected

While reviewing the AI's output, I found and corrected these problems:

- **Station permissions.** The AI described the operations manager's access to stations as read-only. I pointed out that the SRS gives the manager create, read and update rights (D-15), and it was corrected.
- **Routing flowchart.** The AI flagged the "unserved → step 8" arrow as an error. I checked it against the algorithm: unserved stations are retried during the local search, so the arrow was right and stayed.
- **Leftover open-question references.** After I answered the open questions, the AI's proposed rewrite still contained "OQ-15" and "OQ-16" references. I asked for every OQ reference and every "open question" wording to be removed completely.
- **Display of equations.** The sum signs and fractions in the equations were rendered small and inline. I asked for all 42 equations to be shown in proper display style, with the limits above and below the Σ.
- **Missing repository files.** The repository structure had no `.gitignore`, which my professor required. I then also asked for the `.dockerignore` and the `README.md`, which were missing too.
- **Sensitive data.** I raised whether real distributor data could end up in the repository, which led to excluding real data and database dumps from it.
- **Redundant document.** I noticed that the project scope repeated content from the other documents, and decided to drop it from the main set.
- **Inconsistencies in the SDD found during coding.** While building the MVP, Claude Code reported inconsistencies in the SDD: a non-existent station (ST032), station counts adding up to 21 instead of 20, two different distance models, and two forecast version names. I decided how each one should be resolved (ST012, 3/5/11 + 1 unavailable, ALG-09, `fc-sim-1.1.0`). They are scheduled for correction in the next document update.
- **Complexity estimate.** An early complexity estimate placed ALG-07 at O(1). Checked against the algorithm's steps, the warehouse limit sums over all stops, so it is O(n); the analysis and Figure 37 were corrected.

## 5. Phase 2 – MVP (Claude Code)

The coding phase is documented prompt by prompt in [prompt_log.md](prompt_log.md): each prompt, what Claude Code gave back, what I decided and how it was verified.
