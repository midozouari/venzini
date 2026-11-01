# Venzini – Product backlog

The product backlog of Venzini, built from the user stories (Requirements Elicitation, §9) and the functional requirements of the SRS (§6). It shows what the MVP delivers and what version 1 adds.

**Status**

- **Done in MVP:** the screen and the flow can be clicked through in the MVP, on fake sample data answered by the in-browser mock API (SDD ch. 7). The mock does not calculate: it returns prepared or scripted results (SDD 7.1).
- **v1:** version 1 adds the real backend (NestJS, PostgreSQL) and the real calculations (forecasting, risk, routing, cost) described in the SDD.
- **Not planned:** out of scope (SRS §20).

**Priority** comes from the linked requirements in the SRS: *Must* if any linked FR is a Must, otherwise *Should*.

## 1. User stories

| ID | User story | Priority | FR | UC | Screen | Status | What v1 adds |
| --- | --- | --- | --- | --- | --- | --- | --- |
| US-01 | As an operations manager, I want to see all stations on a map with stockout alerts, so that I know at a glance where action is needed. | Must | FR-14, FR-15 | UC-03 | UI-02 | Done in MVP | Stock levels and risk computed from live data. |
| US-02 | As an operations manager, I want to see a 7-day demand forecast for a station and fuel type, so that I can plan deliveries ahead. | Must | FR-17, FR-18 | UC-04 | UI-03 | Done in MVP | The forecasting model (ALG-01); the MVP shows generated forecasts. |
| US-03 | As an operations manager, I want to see how confident each forecast is and what influenced it, so that I know how much to trust it. | Must | FR-21, FR-22 | UC-04 | UI-03 | Done in MVP | Confidence and factors computed by the model (ALG-02). |
| US-04 | As an operations manager, I want to see which stations are most urgent and why, so that I serve the right stations first. | Must | FR-24, FR-27 | UC-05 | UI-02, UI-05 | Done in MVP | Risk and priority computed (ALG-03). |
| US-05 | As a dispatcher, I want to upload the operational resources available for the day (tankers, drivers, warehouse stock), so that the plan is based on real resources. | Must | FR-04, FR-07, FR-08, FR-09 | UC-02 | UI-04 | Done in MVP | Saved in the database instead of the browser. |
| US-06 | As an operations manager, I want to get recommended quantities and one route per available tanker, so that I don't have to build the plan by hand. | Must | FR-28, FR-35 | UC-05 | UI-05 | Done in MVP | The routing optimizer (ALG-04); the MVP returns a prepared optimal plan. |
| US-07 | As an operations manager, I want to see the fuel cost of each route, so that I can keep delivery costs low. | Must | FR-40 | — | UI-05 | Done in MVP | Route cost computed (ALG-05). |
| US-08 | As an operations manager, I want to see only station names and IDs on the map and open details on demand, so that the map stays readable. | Must | FR-45, FR-49 | — | UI-02, UI-05 | Done in MVP | Nothing: done as specified. |
| US-09 | As an operations manager, I want to drag and drop stops to reorder them or move them to another tanker, so that I can adapt the plan to what I know on the ground. | Must | FR-55, FR-56 | UC-06 | UI-05 | Done in MVP | Any edit recalculated; the MVP scripts 5 edits and gives a generic answer to others. |
| US-10 | As an operations manager, I want to see time, distance, arrival times and cost update live as I edit, so that I see the impact of my change immediately. | Must | FR-57 | UC-06 | UI-05 | Done in MVP | Live recalculation by the engine (NFR-01). |
| US-11 | As an operations manager, I want to see the risks of my edit, how serious they are and why, so that I can decide knowingly. | Must | FR-61, FR-64 | UC-06 | UI-05 | Done in MVP | Risk analysis of any edit (ALG-06); scripted in the MVP. |
| US-12 | As an operations manager, I want to reset my edits to the optimal plan, so that I can start over quickly. | Must | FR-60 ¹ | UC-06 | UI-05 | Done in MVP | Nothing: done as specified. |
| US-13 | As an operations manager, I want to approve or reject each recommendation, so that nothing happens without my decision. | Must | FR-03, FR-68, FR-69 | UC-07 | UI-06 | Done in MVP | Re-planning after a rejection (FR-82); one scripted case in the MVP. |
| US-14 | As a distributor manager, I want to see a history of all decisions, so that I can trace who decided what and when. | Must | FR-72, FR-73 | UC-07, UC-08 | UI-07 | Done in MVP | An append-only log in the database (NFR-14). |
| US-15 | As a system admin, I want to manage user accounts and roles, so that only the right people can do each action. | Must | FR-02, FR-05 | UC-01, UC-09 | UI-01, UI-08 | Done in MVP | Real accounts with hashed passwords and server sessions. |
| US-16 | As a system admin, I want to manage station records, so that the network data stays current. | Should | FR-06 | UC-11 | UI-08 | Done in MVP | The serving warehouse recomputed from road distances (BR-17). |
| US-17 | As a dispatcher, I want to see the total forecast demand per warehouse and fuel type, so that the warehouse can prepare stock without adding up station forecasts. | Must | FR-85 ¹ | UC-04 | UI-04 | Done in MVP | Totals computed from the live forecasts. |
| US-18 | As an operations manager, I want to see the maximum quantity allowed while I edit a delivery, so that I never overload a tanker or a tank. | Should | FR-75, FR-76 ¹ | UC-06 | UI-05 | Done in MVP | The limit computed for any stop (ALG-07); the logic of these Should items comes after the MVP (D-24). |
| US-19 | As a dispatcher, I want to record when each tanker leaves and returns, so that planned and actual trip times can be compared. | Must | FR-78, FR-79, FR-84 ¹ | UC-10 | UI-04 | Done in MVP | Saved in the database. |
| US-20 | As an operations manager, I want to approve or reject the whole plan in one step, so that I save time when the plan is fine. | Must | FR-80 ¹ | UC-07 | UI-06 | Done in MVP | Nothing: done as specified. |
| US-21 | As an operations manager, I want to manage station records, so that the network data stays current. | Should | FR-06 ¹ | UC-11 | UI-08 | Done in MVP | As US-16 (D-15). |

¹ The SRS links US-01 to US-16 to their requirements. US-12 and US-17 to US-21 have no use-case link in the SRS (US-12 only through FR-60), so their requirements and use cases are linked here by subject.

US-14 says "distributor manager" in the elicitation document; in Venzini this is the operations manager, and all three roles can read the history (D-10).

## 2. Functional requirements

Every FR of the SRS, with its priority and where it stands. **Engine** means the requirement is about how the real calculation works: the MVP shows prepared results that respect it, and v1 computes them.

| FR | Requirement | Priority | User stories | Status |
| --- | --- | --- | --- | --- |
| FR-01 | Login required | Must | — | Done in MVP |
| FR-02 | Three roles with defined permissions | Must | US-15 | Done in MVP |
| FR-03 | Only managers approve or reject | Must | US-13 | Done in MVP |
| FR-04 | Only dispatchers change resources | Must | US-05 | Done in MVP |
| FR-05 | Manage user accounts | Must | US-15 | Done in MVP |
| FR-06 | Manage station records | Should | US-16, US-21 | Done in MVP |
| FR-07 | Upload available tankers | Must | US-05 | Done in MVP |
| FR-08 | Upload available drivers | Must | US-05 | Done in MVP |
| FR-09 | Upload warehouse fuel stock | Must | US-05 | Done in MVP |
| FR-10 | Upload other resource data | Should | — | Not planned (SRS §20) |
| FR-11 | Update resources until the plan is decided | Must | — | Done in MVP |
| FR-12 | Plan uses the latest resources | Must | — | Engine: v1 (MVP shows prepared results) |
| FR-13 | Show last resource update | Must | — | Done in MVP |
| FR-14 | Map of all active stations | Must | US-01 | Done in MVP |
| FR-15 | Stockout-risk alerts | Must | US-01 | Done in MVP |
| FR-16 | Current tank levels | Must | — | Done in MVP |
| FR-17 | Select station and fuel type | Must | US-02 | Done in MVP |
| FR-18 | 7-day daily forecast | Must | US-02 | Done in MVP |
| FR-19 | Forecast inputs | Must | — | Engine: v1 (MVP shows prepared results) |
| FR-20 | Forecast chart | Must | — | Done in MVP |
| FR-21 | Confidence level | Must | US-03 | Done in MVP |
| FR-22 | Contributing factors | Must | US-03 | Done in MVP |
| FR-23 | Uncertain forecast flag | Must | — | Done in MVP |
| FR-24 | Station risk level | Must | US-04 | Done in MVP |
| FR-25 | Delivery priority | Must | — | Engine: v1 (MVP shows prepared results) |
| FR-26 | Yield-management allocation | Should | — | Not planned (SRS §20) |
| FR-27 | Reasons for urgency | Must | US-04 | Done in MVP |
| FR-28 | Recommended litres per station and fuel type | Must | US-06 | Done in MVP |
| FR-29 | Never above free storage | Must | — | Engine: v1 (MVP shows prepared results) |
| FR-30 | Keep stations above safety stock | Must | — | Engine: v1 (MVP shows prepared results) |
| FR-31 | Never above tanker capacity | Must | — | Engine: v1 (MVP shows prepared results) |
| FR-32 | Within delivery windows | Must | — | Engine: v1 (MVP shows prepared results) |
| FR-33 | Within warehouse stock | Must | — | Engine: v1 (MVP shows prepared results) |
| FR-34 | Closest warehouse | Must | — | Engine: v1 (MVP shows prepared results) |
| FR-35 | One route per tanker, each with a driver | Must | US-06 | Done in MVP |
| FR-36 | Routes start and end at the home warehouse | Must | — | Done in MVP |
| FR-37 | Always produce a plan | Must | — | Engine: v1 (MVP shows prepared results) |
| FR-38 | Highest priority first; list unserved | Must | — | Done in MVP |
| FR-39 | Stop when a critical resource is missing | Must | — | Done in MVP |
| FR-40 | Route fuel cost | Must | US-07 | Done in MVP |
| FR-41 | Cost in route optimization | Must | — | Engine: v1 (MVP shows prepared results) |
| FR-42 | Show route and total cost | Must | — | Done in MVP |
| FR-43 | Optimal vs. edited cost | Must | — | Done in MVP |
| FR-44 | Saving and risks shown together | Must | — | Done in MVP |
| FR-45 | Directed route paths | Must | US-08 | Done in MVP |
| FR-46 | Stop numbers | Must | — | Done in MVP |
| FR-47 | Urgency colors | Must | — | Done in MVP |
| FR-48 | Urgency not by color alone | Must | — | Done in MVP |
| FR-49 | Clean map by default | Must | US-08 | Done in MVP |
| FR-50 | Station details box | Must | — | Done in MVP |
| FR-51 | Segment labels | Must | — | Done in MVP |
| FR-52 | Route and plan totals | Must | — | Done in MVP |
| FR-53 | One line color per tanker | Must | — | Done in MVP |
| FR-54 | Tanker filter | Must | — | Done in MVP |
| FR-55 | Reorder stops by drag and drop | Must | US-09 | Done in MVP |
| FR-56 | Move a station to another tanker | Must | US-09 | Done in MVP |
| FR-57 | Live recalculation | Must | US-10 | Done in MVP |
| FR-58 | Edit delivery quantities | Should | — | Done in MVP |
| FR-59 | New optimal plan after quantity edit | Should | — | Done in MVP |
| FR-60 | Reset to optimal | Must | US-12 | Done in MVP |
| FR-61 | Compare edited vs. optimal | Must | US-11 | Done in MVP |
| FR-62 | Detect risks | Must | — | Engine: v1 (MVP shows prepared results) |
| FR-63 | Severity per risk | Must | — | Engine: v1 (MVP shows prepared results) |
| FR-64 | Reason per risk | Must | US-11 | Done in MVP |
| FR-65 | Highlight affected elements | Must | — | Done in MVP |
| FR-66 | "No risk" message | Must | — | Done in MVP |
| FR-67 | Approval allowed with warnings | Must | — | Done in MVP |
| FR-68 | List recommended actions | Must | US-13 | Done in MVP |
| FR-69 | Approve or reject each action | Must | US-13 | Done in MVP |
| FR-70 | Approve or reject an edited plan | Must | — | Done in MVP |
| FR-71 | Nothing final without approval | Must | — | Done in MVP |
| FR-72 | Record every decision | Must | US-14 | Done in MVP |
| FR-73 | View decision history | Must | US-14 | Done in MVP |
| FR-74 | Run on sample data | Must | — | Done in MVP |
| FR-75 | Show the quantity limit while editing | Should | US-18 | Done in MVP |
| FR-76 | Block save above the limit | Should | US-18 | Done in MVP |
| FR-77 | Block approval on capacity exceeded | Must | — | Done in MVP |
| FR-78 | Estimated trip times | Must | US-19 | Done in MVP |
| FR-79 | Record actual trip times | Must | US-19 | Done in MVP |
| FR-80 | Approve or reject the whole plan | Must | US-20 | Done in MVP |
| FR-81 | Adjust opens the planner | Must | — | Done in MVP |
| FR-82 | Effect of a rejected action | Must | — | Done in MVP |
| FR-83 | Manual planning flag | Must | — | Done in MVP |
| FR-84 | Estimated vs. actual trip time | Should | US-19 | Done in MVP |
| FR-85 | Network and warehouse forecast totals | Must | US-17 | Done in MVP |

## 3. Not planned (SRS §20)

Never part of Venzini: price setting or equipment control; driver accounts or screens; automatic approval or dispatch; LLMs, chatbots, agents or free-text generation; editing or deleting decision-log entries; manager editing of tankers, drivers or warehouse stock; loading at another warehouse; split deliveries; mobile apps, live tracking or real integrations; FR-10 and FR-26; plan handover to drivers.

## 4. Related documents

- MVP acceptance (AC-21): use cases per role and their tests in [e2e/AC-21.md](../e2e/AC-21.md).
- Every prompt of the build, step by step: [prompt_log.md](prompt_log.md).
- The path from the MVP to v1, slice by slice: SDD §7.4.
