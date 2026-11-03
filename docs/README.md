# Venzini – Project documents

Every document of the Venzini project, in reading order, and where to find each diagram.

## Documents

| Document | What it is |
| --- | --- |
| [Venzini 0 - Project Proposal FV.pdf](Venzini%200%20-%20Project%20Proposal%20FV.pdf) | The project idea: overview, objectives, scope, users and roles, deliverables, assumptions, constraints, future versions and success criteria. |
| [Venzini 1 - Requirement Elicitation FV.pdf](Venzini%201%20-%20Requirement%20Elicitation%20FV.pdf) | Stakeholders, user needs (UN), user stories (US-01 to US-21, §9) and use cases (UC-01 to UC-11, §10). |
| [Venzini 2 - SRS FV.pdf](Venzini%202%20-%20SRS%20FV.pdf) | Software Requirements Specification: what the system must do. Functional requirements FR-01 to FR-85 (§6), business rules, data, screens UI-01 to UI-08 (§13), tests (§16) and acceptance criteria (§17). |
| [Venzini 3 - SDD FV.pdf](Venzini%203%20-%20SDD%20FV.pdf) | Software Design Document: how it is built. Architecture and views (§5), security (§6), the MVP (§7), testing (§8), design rationale (§9) and the repository structure (Appendix B). |
| [backlog.md](backlog.md) | Product backlog: every user story and requirement, with its priority and its status (done in the MVP, v1, not planned). |
| [ai-usage-log.md](ai-usage-log.md) | How AI tools were used in the project, and the rules followed. |
| [prompt_log.md](prompt_log.md) | Every prompt sent to Claude Code while building the MVP, what came back, what was decided and how it was checked. |
| [demo-script.md](demo-script.md) | The MVP demo video script: 13 scenes, each with its on-screen title, actions and narration. `pnpm demo:video` makes the video from it. |
| [../e2e/AC-21.md](../e2e/AC-21.md) | MVP acceptance checklist (AC-21): every use case and screen per role, with its tests. |

Where the SRS and the SDD differ, the project follows the SDD.

## Diagram finder

### Requirements Elicitation

| Figure | Diagram | Section |
| --- | --- | --- |
| 1 | System context diagram | §3 User and system context |
| 2 | AI inputs and outputs | §8.2 Inputs and outputs |
| 3 | Use case diagram (UML) | §10 Use cases |
| 4 | Main planning flow (UML activity diagram) | §10 Use cases |

### SRS

| Figure | Diagram | Section |
| --- | --- | --- |
| 1 | System context, version 1 | §5 System context |
| 2 | AI inputs and outputs | §5.6 AI services |
| 3 | Use case diagram, version 1 (UML) | §6 Functional specification |
| 4 | Main planning flow (UML activity diagram) | §6 Functional specification |
| 5 | Logical data model (ERD) | §8.2 Relationships |
| 6 | Status diagrams for plan, action and trip (UML state machines) | §8.5 Data lifecycle |
| 7, 8 | Preliminary designs (inspiration only, not requirements) | §13.9 Preliminary designs |

### SDD

| Figure | Diagram | Section |
| --- | --- | --- |
| 1 | System context | §5.1 Context view |
| 2 | System architecture | §5.2 Composition view |
| 3 | Data flow diagram, level 1 | §5.2 Composition view |
| 4 | Tech stack | §5.2 Composition view |
| 5 | Container diagram | §5.2.1 Containers |
| 6 | Backend modules | §5.2.2 Backend modules |
| 7 | Frontend structure | §5.2.3 Frontend structure |
| 8 | Class diagram, planning modules (UML) | §5.3 Logical view |
| 9 | Class diagram, platform and foundation modules (UML) | §5.3 Logical view |
| 10 | Domain model (UML) | §5.3 Logical view |
| 11 | Module dependency graph | §5.4 Dependency view |
| 12–15 | Entity-relationship diagrams (parts 1 to 3, and the full ERD) | §5.5.2 Entity-relationship diagrams |
| 16–23 | Sequence diagrams SEQ-01 to SEQ-08 (UML): login, generate plan, reorder or move, quantity edit, approve or reject one action, approve all or reject all, upload resources, record trip times | §5.7 Interaction view |
| 24–27 | State machines SM-01 to SM-04 (UML): plan, recommended action, trip, user account | §5.8 State-dynamics view |
| 28–36 | Algorithm figures ALG-01 to ALG-09: forecast, confidence band, risk and allocation, routing optimizer, cost model, risk severity, maximum quantity, distance matrix | §5.9 Algorithms |
| 37–39 | Complexity and asymptotic analysis | §5.9.10, §5.9.11 |
| 40 | Local deployment with Docker Compose (UML deployment view) | §5.11 Deployment view |
| 41 | Screen navigation map per role | §5.12.3 Navigation |
| 42 | Design system | §5.12.4 Design system |
| 43 | Preliminary designs (visual reference only) | §5.12.7 Preliminary designs |
| 44 | MVP versus v1 | §7 MVP design |
