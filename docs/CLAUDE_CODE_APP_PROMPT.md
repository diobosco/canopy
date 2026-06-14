# Build Prompt — "AeroLab": Interactive UAV Aerodynamic Design, Simulation & Optimization Web App

> **How to use this file:** This is a self-contained specification to be handed to **Claude Code**. Build the application described below end-to-end. Treat every numbered acceptance criterion as a hard requirement. The companion document `aircraft-aerodynamic-analysis.md` (same folder) contains the reference physics and validated numbers — use it as the source of truth for the model and for validation tests.

---

## 1. Mission of the app

Build **AeroLab**, a single-page, client-only **JavaScript/TypeScript web application** that lets a user **model, simulate, optimize, and *learn about*** the flight dynamics of a small single-engine (gasoline) fixed-wing UAV — the class of aircraft analysed in `aircraft-aerodynamic-analysis.md`.

The app must do three things well:

1. **Simulate** — given a full aircraft definition (geometry, airfoil, weight, engine, propeller, atmosphere), compute the complete aerodynamic & performance picture in real time as the user drags sliders.
2. **Optimize** — find the parameter set that best meets a user-chosen goal (or weighted combination of goals) subject to constraints, and show the trade-offs (Pareto fronts, sensitivity).
3. **Teach** — every chart and number is accompanied by plain-language explanations and the governing equations, so a non-specialist understands *why* the dynamics behave as they do.

It must run as a **static site** (no backend, no server-side compute) so it can be hosted on GitHub Pages / Netlify and run fully offline.

---

## 2. Tech stack & project setup

- **Language:** TypeScript (strict mode).
- **Framework:** React 18 + **Vite**.
- **Charts:** **Plotly.js** (`react-plotly.js`) for scientific/interactive plots (zoom, hover, export PNG). Use **KaTeX** for equations.
- **State:** lightweight store (Zustand) for the aircraft definition + UI state; URL-encode the full state so a configuration is shareable via link.
- **Styling:** Tailwind CSS. Clean, technical, light/dark theme.
- **Math/optim:** implement the optimizers in-repo (see §7). You may use `ml-levenberg-marquardt`/`fmin` only for helpers; the core physics must be your own typed code.
- **Testing:** **Vitest** for the physics core. **Playwright** for one smoke E2E.
- **Quality:** ESLint + Prettier; `npm run build`, `npm run test`, `npm run lint` must all pass. No `any` in the physics core.
- **Repo layout:**
  ```
  /src
    /physics      atmosphere.ts, geometry.ts, aero.ts, airfoil.ts,
                  propeller.ts, engine.ts, fuel.ts, performance.ts, envelope.ts, types.ts
    /optimize     objectives.ts, constraints.ts, optimizers.ts, pareto.ts, sensitivity.ts
    /components   panels, charts, learn cards…
    /state        store.ts, presets.ts, urlState.ts
    /content      explanations.ts (educational text + equations)
    main.tsx, App.tsx
  /tests
  ```
- Provide a thorough `README.md`: what it is, how to run (`npm i && npm run dev`), the model's assumptions & limitations (copy the caveats from the analysis doc), and a "Validation" section showing the app reproduces the reference numbers.

---

## 3. The physics model (implement exactly; SI internally, display units configurable)

All formulas and the validated reference numbers are in `aircraft-aerodynamic-analysis.md`. Implement these modules as **pure, unit-tested functions** (no React imports).

### 3.1 `atmosphere.ts` — ISA
- `isa(altitude_m) → { T, p, rho, mu, a }` using the troposphere ISA model: `T = 288.15 − 0.0065·h`, `p = p0·(T/T0)^(g/(R·L))`, `rho = p/(R·T)`, Sutherland viscosity `mu = 1.458e-6·T^1.5/(T+110.4)`, `a = √(1.4·R·T)`. Constants: g=9.80665, R=287.05.
- Acceptance: ρ(500 m)=1.167, ρ(4000 m)=0.819 (±0.5 %).

### 3.2 `geometry.ts`
- From span `b`, area `S` (or chord `c`): `AR = b²/S`, mean chord, wing loading. Support rectangular wing (root=tip). Allow span **or** area **or** chord as the driven variable (user picks two).

### 3.3 `airfoil.ts`
- Section model with parameters: `Cl_max`, `Cl_alpha (per rad)`, `alpha_0 (deg)`, `Cd_min`, `Cl_at_Cdmin`, `k_profile` (so `Cd = Cd_min + k_profile·(Cl−Cl_at_Cdmin)²`), `Cm_ac`, `t_c`.
- Ship a **library of presets** with the values from the analysis doc (XFOIL/NeuralFoil-derived): **NACA 2412, 2415, 4412, 4415, 23015, 4418**, plus a generic "custom" editable section. Include each section's `Cl_max`, `Cd_min`, `alpha_0`, `Cm_ac`, `t_c` at Re ≈ 1.4e6 from §11 of the analysis doc.
- Provide a function to **render the airfoil shape** from NACA 4-digit digits (camber line + thickness distribution) for the geometry diagram.

### 3.4 `aero.ts` — wing + whole-aircraft aerodynamics
- 3-D lift slope `CL_alpha = a0/(1 + a0/(π·e·AR))`, a0=2π.
- **Oswald efficiency** `e` from Raymer straight-wing estimate `e = 1.78(1−0.045·AR^0.68) − 0.64`, with a user override; `k = 1/(π·e·AR)`.
- **Parasite drag build-up** (component method, Hoerner/Raymer form factors, turbulent flat-plate Cf): wing, fuselage pod, tail boom, horizontal & vertical tail, plus lumped allowances for engine cooling, landing gear, and a misc/leakage %. Reference everything to wing area S. Reproduce the §2.2 table (C_D0 ≈ 0.029 for the baseline).
- Use the **drag-area (f = C_D0·S) bookkeeping** so that changing wing area correctly keeps fixed-hardware drag constant (critical — see §12/§13 of the analysis).
- 3-D `C_Lmax = 0.9·Cl_max_section` (configurable factor), with optional **flap increment** ΔC_Lmax (plain/split/slotted presets).
- Output the drag polar `C_D(C_L) = C_D0 + k·C_L²` and `(L/D)max = 0.5/√(k·C_D0)` at `C_L = √(C_D0/k)`.

### 3.5 `propeller.ts` — blade-element + momentum (from §14)
- Inputs: diameter, blade count, representative blade chord, pitch (in or P/D), section polar.
- **Momentum induced efficiency** `η_i = 2/(1+√(1+T/(½ρAV²)))`.
- **Blade element at 0.75 R**: `φ = atan(V/(Ωr))`, `W = V/sinφ`, required `Cl` from thrust, `Cd` from blade polar, `γ = atan(Cd/Cl)`, `η_blade = tanφ/tan(φ+γ)`, `η_p = η_i·η_blade`. Compute advance ratio `J = V/(nD)`, blade angle, geometric pitch.
- Provide the **pitch-speed limit** check (`V_pitch = pitch·rpm`) and flag when a prop "runs out of pitch" (the 28×10 → 107 km/h result must reproduce).
- Provide an **η_p(J) curve** for a given pitch (sweep rpm) for the propeller-efficiency-map chart.

### 3.6 `engine.ts` + `fuel.ts`
- Engine: max shaft power, RPM range, **power lapse with density** `P ∝ σ`, and a **BSFC bowl** vs rpm (minimum near a tunable rpm). Defaults for a DLE-120 class engine (~8.8 kW, ~6500 rpm peak).
- Fuel: `fuel_flow = P_shaft · BSFC`, with the option to **anchor overall efficiency** to a known cruise point (the manufacturer 3.6 L/h @ 150 km/h calibration, η_overall ≈ 0.09). Gasoline 31.25 MJ/L, ρ=0.72 kg/L.

### 3.7 `performance.ts` — the solver
For a given altitude and weight, over a speed sweep V_min→V_ne, compute per speed: `q, C_L, C_D, L/D, Drag, AoA, P_required, Thrust_available, fuel L/h, fuel L/km`. Then derive:
- **Stall speed** `V_s = √(W/(½ρ·S·C_Lmax))` (clean & flapped), at any altitude.
- **Max level speed** (power-limited: P_required = P_available) and flag if **V_ne** (structural) is the binding limit instead.
- **Best-range speed** ((L/D)max) and **best-endurance speed** (min power).
- **Range** (15 L, with selectable reserve %) and **endurance**; **payload–range** trade.
- **Rate of climb** vs altitude → **service/absolute ceiling**.
- **Max MTOW** analysis: climb/stall/structural-load-factor limits vs gross weight.
- **V–n (maneuver/gust) envelope** for the load-factor limits.

### 3.8 Validation (acceptance — wire these into Vitest)
The app must reproduce, within ±3 %, the reference results from the analysis doc, including:
- Baseline (2 m², AR 8): C_D0≈0.029, (L/D)max≈13.1, stall 65 km/h @500 m, ferry ~600 km at 150 km/h.
- AR 4 (1 m², 2 m span): (L/D)max≈7.3, stall ≈88 km/h @500 m / 105 km/h @4000 m, power-limited V_max≈205 km/h.
- 28×10 pitch-speed limit ≈107 km/h @7000 rpm; 160 km/h prop optimum ≈28×24 @ ~5000 rpm, η_p≈0.88, ~3.4 L/h, ~700 km.

---

## 4. Optimization (the heart of the app)

### 4.1 Design variables (user selects which are free vs fixed, each with min/max)
Wing span, wing area/chord, airfoil choice + flap type, MTOW/payload/fuel, cruise altitude, cruise speed target, propeller diameter & **pitch**, engine **rpm**, engine size/power, Oswald `e` override.

### 4.2 Objectives (selectable; single or weighted multi-objective)
- Maximize **range** · Maximize **endurance** · Maximize **(L/D)max** · Maximize **cruise/top speed** · Minimize **stall speed** · Minimize **fuel for a target mission distance** · Maximize **propeller efficiency at a target speed** · Minimize a **structural-cost proxy** (e.g. spar mass index ∝ wing-loading × span / (t/c) — reward thick, short, lightly-loaded wings) · Minimize **takeoff/landing field length**.

### 4.3 Constraints
Stall ≤ limit, V_min margin (≥1.3·V_s), positive climb at target altitude, top speed ≤ V_ne, structural load factor ≥ +n/−n, MTOW ≤ cap, propeller P/D ≤ ~1.0, pitch-speed feasibility, engine power available ≥ required, geometry bounds.

### 4.4 Optimizers (implement all three; let user pick)
1. **Grid / parameter sweep** (1-D and 2-D) — also powers the heat-map and contour charts.
2. **Gradient-free local** — Nelder–Mead (downhill simplex) for refining from a point.
3. **Global / multi-objective** — a small **NSGA-II-style genetic algorithm** producing a **Pareto front** for any two chosen objectives.
All optimizers run in a **Web Worker** so the UI never blocks; show progress and allow cancel. Penalize constraint violations (death penalty or large additive penalty) and report which constraints bind at the optimum.

### 4.5 Sensitivity & explainability
- **Tornado chart**: ±10 % perturbation of each free variable → effect on the active objective.
- **"Why" panel** at every optimum: list the binding constraints and the dominant drivers.

---

## 5. Required diagrams / visualizations (all interactive, all with a "Learn" tooltip)

Implement **every** chart below. Each updates live on input change, supports hover-readout and PNG export, and can overlay **two altitudes (e.g. 500 m vs 4000 m)** and **compare scenarios** (A vs B).

1. **Drag polar** — C_L vs C_D, with (L/D)max point marked.
2. **Drag vs airspeed** (parasite/induced/total breakdown stacked).
3. **Power required vs power available vs airspeed** — intersection = V_max; mark V_stall, V_ne.
4. **Fuel economy (L/km) vs airspeed** — minimum = best range.
5. **Fuel flow (L/h) vs airspeed** — minimum = best endurance.
6. **Angle of attack vs airspeed** (with stall-AoA line).
7. **L/D vs airspeed**.
8. **Airfoil section polars** — C_l–α, C_l–C_d, C_l/C_d, C_m–α (use the airfoil presets; allow comparing two sections, e.g. 2415 vs 4415).
9. **Airfoil geometry** — overlaid shapes from the NACA generator.
10. **Propeller efficiency map** — η_p vs advance ratio J for several pitch settings; mark the operating point and the pitch-speed limit.
11. **Rate of climb vs altitude** → ceiling.
12. **Payload–range diagram**.
13. **V–n flight envelope** (maneuver + gust).
14. **Pareto front** (multi-objective optimization output), interactive — click a point to load that design.
15. **Sensitivity tornado**.
16. **2-D optimization heat-map / contour** for any objective over any two design variables, with constraint regions shaded and the optimum marked.

---

## 6. UX / app structure

- **Left panel — Inputs:** grouped, collapsible sliders + numeric fields (Geometry, Airfoil/Flaps, Weights, Engine, Propeller, Atmosphere/Mission), each with a tooltip and live value. "Free variable" toggles for optimization with min/max.
- **Center — Charts grid:** the diagrams in §5, in a responsive, rearrangeable grid; click any chart to expand.
- **Right panel — Results & Optimize:** live key metrics (stall, V_max, (L/D)max, range, endurance, ceiling, prop η_p, fuel/h, fuel/km, max MTOW); the Optimizer (pick objective(s)+weights, constraints, optimizer, Run/Cancel/Apply-result).
- **Top bar:** unit toggle (metric/imperial, km·h⁻¹↔m·s⁻¹), light/dark, **Presets** dropdown, **Share link** (URL-encoded state), **Export** (CSV of all tables, PNG of charts, JSON of the full design).
- **Presets** (from the analysis doc, ready to load): *Baseline 2 m² / AR 8*, *Airfoil study: 2415 vs 4415*, *Half-wing AR 16*, *Short wing 2 m / AR 4 (V_ne 240)*, *160 km/h prop-optimized*.
- **Learn mode:** a toggle that surfaces, beside each chart and result, a short explanation + the governing equation (KaTeX) and the intuition (e.g. "why best range is at (L/D)max", "why low aspect ratio kills efficiency", "why a coarse prop is fast but a poor climber"). Include a short **guided tour** that walks a newcomer through one full design+optimize loop.

---

## 7. Engineering quality & acceptance criteria

- [ ] `npm run dev` launches; `npm run build` produces a static bundle; app works offline.
- [ ] Physics core fully typed, pure, and covered by Vitest; all §3.8 validation tests pass within tolerance.
- [ ] All 16 charts in §5 implemented, live-updating, exportable, with Learn tooltips.
- [ ] All optimizers in §4.4 implemented, running in a Web Worker, returning constraint-aware results; Pareto front interactive.
- [ ] All five presets load and reproduce the report's headline numbers (show them in the README "Validation" table).
- [ ] State is URL-shareable; CSV/PNG/JSON export works.
- [ ] Units toggle works everywhere; light/dark theme; responsive down to a laptop screen.
- [ ] README documents model, assumptions, **limitations/caveats** (first-order; not CFD/flight-test), and validation.
- [ ] Code organized per §2 layout; ESLint/Prettier clean; no `any` in `/src/physics`.

## 8. Stretch goals (only after the above is complete & green)
- Constant-speed (variable-pitch) propeller mode (let the optimizer choose pitch per speed).
- Wing taper & basic twist/washout; simple lifting-line spanwise load.
- Mission profile builder (climb-cruise-loiter-descent) integrating fuel/time over segments.
- Monte-Carlo robustness (parameter uncertainty bands on outputs).
- Save/compare a library of named designs.

---

### Build philosophy
Correctness and clarity first: the numbers must match the reference analysis, the equations must be visible, and a curious non-engineer should be able to learn the dynamics by playing. Keep it dependency-light, fully client-side, and fast (every slider drag re-solves in <16 ms for the core sweep; heavy optimization off-thread).
