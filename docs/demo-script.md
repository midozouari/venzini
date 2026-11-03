# Venzini – MVP demo video script

**Format:** about 6 minutes, 1920×1080, English AI voice-over, a visible cursor, short on-screen titles at the start of each scene.
**Data:** the MVP's fake sample data. Delivery day **Tue 03 Nov 2026**; past decided day **Sun 01 Nov 2026**.
**Pace:** calm. The robot waits until each narration line has been spoken before the next action. A short pause (about 1 s) after every click.

Each scene has an **on-screen title**, the **actions** the robot performs (in order), and the **narration** (spoken text). If an action can't be performed exactly as written, Claude Code adapts it to the real UI and reports the change.

---

## Scene 1 – Introduction
**On-screen title:** Venzini – AI-assisted fuel demand forecasting and delivery planning
**Actions:**
1. Show the login page (navy background, logo card) for 3 seconds without moving.

**Narration:**
"This is Venzini, an AI-assisted yield management platform for petroleum distributors. It forecasts fuel demand across a network of stations, and recommends how many litres to deliver, which stations come first, and the best route for every tanker. Every recommendation is explained, and nothing happens without a manager's approval. This demo shows the MVP: the real screens, running on sample data, with simulated forecasts and routes."

---

## Scene 2 – Logging in as the operations manager
**On-screen title:** Three roles, one platform
**Actions:**
1. Click the login field, type `sara.m` (human typing speed).
2. Click the password field, type `venzini-demo`.
3. Click **Log in**.

**Narration:**
"Venzini has three roles: the operations manager, who plans and approves deliveries; the dispatcher, who uploads the day's tankers, drivers and stock; and the administrator. Each role sees only its own screens. We start as Sara, the operations manager."

---

## Scene 3 – Network overview
**On-screen title:** Network overview
**Actions:**
1. Wait on the network overview for 2 seconds.
2. Move the cursor slowly over the map, then over the four key-figure cards below it.
3. Move to the "Stations at highest risk" panel on the right.
4. Click **Harbor Road · ST014** to open its details. Wait 3 seconds.
5. Press **Escape** to close.

**Narration:**
"The network overview is the manager's starting point. The map shows every station, colored by its stockout risk: red for high, orange for medium, green for low, with an icon and a word so it never relies on color alone. Below, four key figures summarize the day. On the right, the stations at highest risk, sorted by the time left before they run out. Harbor Road, ST014, has only fourteen hours of Diesel left. Its details show the tank levels, the safety stock and the reason for its risk."

---

## Scene 4 – Station forecast and its explanation
**On-screen title:** 7-day demand forecast
**Actions:**
1. Click **Forecasts** in the left menu.
2. Open the station picker, type `ST014`, select **ST014 Harbor Road**.
3. Select the fuel **Diesel**.
4. Hover slowly along the forecast line across 3 or 4 days so the tooltip appears.
5. Move to the "What drives this forecast" panel and the "Uncertain forecast" note.
6. Click **Show as table**, wait 2 seconds, then switch back to the chart.

**Narration:**
"For each station and fuel, Venzini forecasts the demand for the next seven days. The navy line is the forecast, and the shaded band is its likely range. Hovering a day shows the exact litres and the confidence. The panel on the right explains which factors drive the forecast, such as the weekday pattern, the season or the weather. Here the confidence is sixty-six percent, because weather data is missing for two days, so Venzini clearly flags the forecast as uncertain instead of hiding it. Every chart can also be shown as a table."

---

## Scene 5 – Short sales history and network totals
**On-screen title:** Honest about what it doesn't know
**Actions:**
1. Open the station picker, select **ST020**, fuel **Petrol 95**. Wait 2 seconds on the "Similar-stations baseline" note.
2. Click the **Totals** tab.
3. Switch from **Network** to **By warehouse**. Wait 2 seconds.

**Narration:**
"When a station has too little sales history, like ST020, Venzini bases its forecast on similar stations and says so, with a lower confidence. The totals view adds up the demand for the whole network, and for each warehouse, so supplies can be planned ahead."

---

## Scene 6 – Generating the delivery plan
**On-screen title:** Delivery planner
**Actions:**
1. Click **Delivery plan** in the left menu.
2. If a **Generate plan** button is shown, click it and wait for the plan to appear.
3. Move the cursor over the route map, then over two or three route cards on the left.
4. Hover one route leg on the map so its distance and time appear.
5. Scroll the route list to **Not served today** and rest the cursor on the ST019 sentence for 3 seconds.

**Narration:**
"Now the core of Venzini: the delivery planner. From the forecasts, the tank levels, the available tankers and the delivery windows, Venzini builds the plan: how many litres for each station, which tanker serves it, in which order, and the cost of each route. Each tanker has its own color on the map, with numbered stops and arrows for the direction. When resources are short, the most urgent stations come first, and any station left out is always explained. Here, ST019 can't be served today because its Diesel doesn't fit the capacity left on its warehouse's tankers. It moves up in tomorrow's plan."

---

## Scene 7 – Editing a route and seeing the risk live
**On-screen title:** The manager stays in control
**Actions:**
1. On the **T-01** route card, drag **ST012 Westside Terminal** by its handle onto the **T-02** card. If the drop target isn't visible, use the **⇄ Move to tanker…** button on ST012 and choose **T-02** instead.
2. Wait for the impact bar to update. Move the cursor to the impact bar (cost difference and the high risk).
3. Move to the "Approval is blocked" banner. Wait 3 seconds.
4. Click **Reset to optimal**, confirm in the dialog.

**Narration:**
"The manager can change the plan by dragging stops between routes. Venzini recalculates instantly and compares the edit with the optimal plan: the extra cost, distance and time, and any risk it creates. Here, moving Westside Terminal to tanker T-02 overloads it. That is a high risk, so approval is blocked until the problem is fixed. One click resets the plan to the optimal version."

---

## Scene 8 – A safe change and the quantity limit
**On-screen title:** Every change is checked
**Actions:**
1. On **T-01**, move **ST012** down one position (▼ Move down, or drag below ST014). Wait for "No risk" in the impact bar.
2. Click **ST012**, then **Edit quantity**.
3. In the Petrol 95 field, type a value above the shown maximum (for example `9000`). Wait 3 seconds on the error under the field.
4. Close the dialog with **Cancel**.
5. Click **Reset to optimal**, confirm.

**Narration:**
"A simple swap of two stops on the same route keeps every delivery on time, so Venzini confirms there is no risk. Quantities can be adjusted too, but never beyond what is physically possible: the editor shows the maximum for each stop, here set by the tanker's free space, and refuses anything above it."

---

## Scene 9 – Approving and rejecting recommendations
**On-screen title:** Human approval, always
**Actions:**
1. Click **Approvals** in the left menu (or the **Go to approvals** button).
2. Move the cursor over the list of recommended actions, grouped by tanker.
3. On the **ST014** row, click **✕ Reject**. In the dialog, type the note `Customer closed for maintenance` and confirm.
4. Wait for the re-plan summary. Rest the cursor on it for 3 seconds.
5. Click **Approve all**, then confirm in the dialog.
6. Wait for "Plan decided".

**Narration:**
"Nothing reaches the trucks without the manager's decision. Each recommendation can be approved, adjusted or rejected. When a station is rejected, Venzini builds a new plan right away: here, rejecting ST014 frees capacity, and ST019, which was left out before, is now served. Once everything is reviewed, the manager approves the plan, and the day's resources are locked."

---

## Scene 10 – Decision history
**On-screen title:** Every decision is recorded
**Actions:**
1. Click **Decision history** in the left menu.
2. Click the newest entry at the top. Wait for the side panel.
3. Move the cursor over "Original recommendation" and "Final version", then over the cost line.
4. Press **Escape**.

**Narration:**
"Every decision is written to a permanent history: who decided, when, what was recommended, and what was finally sent, with the risks and the cost difference. The history can be read, but never edited or deleted."

---

## Scene 11 – The dispatcher's day
**On-screen title:** The dispatcher
**Actions:**
1. Click **Log out**.
2. Log in as `karim.b` / `venzini-demo`.
3. On **Resources**, turn on the availability switch of **T-06**. Rest the cursor on the open-trip warning for 2 seconds.
4. Click **Save resources**, wait on the confirmation dialog (list of changes), then **Cancel**.
5. Click the **‹** arrow next to the date twice to reach **Sun 01 Nov 2026**.
6. Click the **Trips** tab.
7. On a planned trip, click **Record departure**, keep the proposed time, confirm.

**Narration:**
"The dispatcher keeps the plan grounded in reality. Each day, he sets which tankers and drivers are available and how much fuel each warehouse holds. Venzini warns him before any mistake: here, tanker T-06 hasn't come back from its last trip. Every save is confirmed with the list of changes. He also records when each trip actually leaves and returns, so planned and real times can be compared."

---

## Scene 12 – Administration
**On-screen title:** Administration
**Actions:**
1. Click **Log out**, log in as `nadia.a` / `venzini-demo`.
2. Show the **Users** tab for 2 seconds.
3. Click the **Stations** tab for 2 seconds.

**Narration:**
"Finally, the administrator manages user accounts, roles and the stations of the network."

---

## Scene 13 – Closing
**On-screen title:** Venzini – MVP
**Actions:**
1. Log out. Show the login page for 3 seconds.

**Narration:**
"That was the Venzini MVP: every screen and flow, for every role, working on sample data. In version one, the simulated forecasts and routes will be replaced by real forecasting and route optimization, behind the same screens. Venzini: fewer stockouts, less excess stock, and fewer unnecessary trips, with the manager always in control."
