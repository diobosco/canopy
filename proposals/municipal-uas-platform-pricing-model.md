# Municipal UAS Platform — Pricing & Calculation Model
## Formula Framework (Structure, Not Numbers)

**Purpose:** Define the *underlying formulas* used to price a shared municipal drone platform and
to quantify its value. All quantities are expressed as variables so the model can be populated
with real figures during a costing exercise. No indicative prices are stated.

---

## Table of Contents

1. [Modeling Principles](#1-modeling-principles)
2. [Notation & Variable Glossary](#2-notation--variable-glossary)
3. [Cost Model (TCO)](#3-cost-model-tco)
4. [Capacity & Utilization Model](#4-capacity--utilization-model)
5. [Cost Allocation Across Departments](#5-cost-allocation-across-departments)
6. [Pricing Models](#6-pricing-models)
7. [Value, Cost-Avoidance & ROI Model](#7-value-cost-avoidance--roi-model)
8. [Risk, Contingency & Sensitivity](#8-risk-contingency--sensitivity)
9. [Worked Formula Walkthrough](#9-worked-formula-walkthrough)
10. [Inputs Checklist](#10-inputs-checklist)

---

## 1. Modeling Principles

- **Shared asset, allocated cost.** The platform is one cost pool; departments are charged in
  proportion to their use (Section 5).
- **Cost floor, value ceiling.** Pricing must recover Total Cost of Ownership (TCO) and a margin;
  the *justification* to the client is value/cost-avoidance (Section 7).
- **Per-unit transparency.** Everything resolves to a defensible **cost per flight hour** and
  **cost per mission**, which procurement can audit.
- **Time-phased.** Capital is amortized; operating costs recur. All multi-year figures are
  discounted to present value.

---

## 2. Notation & Variable Glossary

| Symbol | Meaning | Unit |
|---|---|---|
| `C_cap` | Total capital expenditure (airframes, payloads, ground stations) | currency |
| `C_soft` | Software & licensing cost (annual) | currency/yr |
| `C_pilot` | Crew/labour cost (annual, loaded) | currency/yr |
| `C_train` | Training & certification cost (annual) | currency/yr |
| `C_maint` | Maintenance, spares & repairs (annual) | currency/yr |
| `C_insure` | Insurance & liability cover (annual) | currency/yr |
| `C_reg` | Regulatory, compliance & airspace fees (annual) | currency/yr |
| `C_data` | Data storage, processing & connectivity (annual) | currency/yr |
| `C_gov` | Governance, audit & privacy program (annual) | currency/yr |
| `C_over` | General overhead & admin (annual) | currency/yr |
| `N` | Asset useful life | years |
| `r` | Discount rate | fraction/yr |
| `R` | Residual / salvage value at end of life | currency |
| `H` | Total available flight hours per year (capacity) | hours/yr |
| `U` | Utilization rate (billable ÷ available) | fraction |
| `H_b` | Billable flight hours per year = `H · U` | hours/yr |
| `m` | Margin / contribution rate | fraction |
| `d` | Department index | — |
| `w_d` | Department d's share of usage | fraction |
| `V` | Quantified value / benefit | currency |

---

## 3. Cost Model (TCO)

### 3.1 Amortized capital (annualized capex)

Using a capital recovery (annuity) factor so capex is spread over the asset life:

```
CRF = [ r · (1 + r)^N ] / [ (1 + r)^N − 1 ]

C_cap_annual = (C_cap − R / (1 + r)^N) · CRF
```

### 3.2 Annual operating cost

```
C_op = C_soft + C_pilot + C_train + C_maint + C_insure + C_reg + C_data + C_gov + C_over
```

### 3.3 Total annual cost of ownership

```
TCO_annual = C_cap_annual + C_op
```

### 3.4 Multi-year present value (optional)

```
TCO_PV = Σ (t = 1 … N)  TCO_annual(t) / (1 + r)^t
```

---

## 4. Capacity & Utilization Model

### 4.1 Available flight hours per year

```
H = D_op · F · h_f · A
```

Where:
- `D_op` = operational days per year
- `F` = flights per operational day
- `h_f` = average billable hours per flight
- `A` = fleet availability factor (uptime after maintenance/weather), `0 < A ≤ 1`

### 4.2 Billable hours

```
H_b = H · U
```

### 4.3 Unit cost per flight hour (the keystone metric)

```
Cost_per_hour = TCO_annual / H_b
```

> Note the lever: as utilization `U` rises (more departments sharing the asset),
> `Cost_per_hour` falls. This is the core economic argument of the shared platform.

### 4.4 Cost per mission

```
Cost_per_mission = Cost_per_hour · h_mission + C_consumables + C_payload_specific
```

---

## 5. Cost Allocation Across Departments

Each department `d` carries a usage weight `w_d` (e.g., share of billable hours), with `Σ w_d = 1`.

### 5.1 Usage weight

```
w_d = H_b,d / H_b          (where H_b,d = billable hours consumed by department d)
```

### 5.2 Allocated cost to a department

```
C_d = TCO_annual · w_d
```

### 5.3 Optional two-part allocation (fixed base + variable use)

To reflect that some cost is fixed regardless of use:

```
C_d = (TCO_fixed / n_departments) + (TCO_variable · w_d)
```

Where `TCO_fixed` covers governance, base licensing, and minimum crew, and `TCO_variable`
scales with flight hours (fuel/battery, wear, mission-specific data processing).

---

## 6. Pricing Models

Pricing = cost recovery + margin. Choose the model (or blend) that fits the client's procurement
preference.

### 6.1 Cost-plus per flight hour

```
Price_per_hour = Cost_per_hour · (1 + m)
```

### 6.2 Per-mission / fixed-fee

```
Price_mission = Cost_per_mission · (1 + m)
```

### 6.3 Subscription / availability fee (Drone-as-a-Service)

A recurring fee guaranteeing capacity, plus a usage charge above an included allowance:

```
Price_subscription_annual = TCO_annual · (1 + m)

Overage_charge = max(0, (H_used − H_included)) · Price_per_hour
```

### 6.4 Tiered subscription

```
Price_tier(k) = Base_k + Per_hour_k · max(0, H_used − Included_k)
```

Where tier `k` bundles an included-hours allowance `Included_k` with a base fee `Base_k` and a
reduced marginal `Per_hour_k`.

### 6.5 Outcome / SLA-linked component (optional)

Adjust price by performance against a service-level target (e.g., response-time or
availability KPI):

```
Price_effective = Price_base · (1 + α · (KPI_actual − KPI_target) / KPI_target)
```

Where `α` is the agreed sensitivity (bonus/penalty band), bounded by a cap and floor.

---

## 7. Value, Cost-Avoidance & ROI Model

This is the **justification** layer presented to the client — it does not set price but proves worth.

### 7.1 Cost avoidance vs. legacy methods

```
V_avoid = Σ (legacy_method_cost − uas_method_cost)
```

Examples of legacy methods replaced: manned-helicopter hours, scaffolding/cherry-picker
inspections, road-closure costs, external survey contractors.

### 7.2 Time-savings value

```
V_time = Σ (Δt_i · rate_i)
```

Where `Δt_i` is time saved on activity `i` (e.g., faster road clearance, faster inspection)
and `rate_i` is the value of that time (labour, congestion cost, downtime cost).

### 7.3 Risk / safety value (expected-loss reduction)

```
V_safety = Σ (P_before − P_after) · L
```

Where `P` is incident probability and `L` is the expected loss per incident (harm to
personnel or public avoided by keeping crews out of hazard).

### 7.4 Recovery & revenue value

```
V_recovery = improved_claim_value + reduced_downtime_value + enforcement_recovery
```

### 7.5 Total quantified value

```
V_total = V_avoid + V_time + V_safety + V_recovery
```

### 7.6 Return on Investment

```
ROI = (V_total − TCO_annual) / TCO_annual
```

### 7.7 Payback period

```
Payback = C_cap / (V_total_annual − C_op)
```

### 7.8 Benefit–cost ratio

```
BCR = V_total_PV / TCO_PV
```

Where both numerator and denominator are discounted to present value over the asset life.

---

## 8. Risk, Contingency & Sensitivity

### 8.1 Contingency-loaded cost

```
TCO_loaded = TCO_annual · (1 + c)
```

Where `c` is a contingency rate for weather downtime, attrition, and regulatory change.

### 8.2 Break-even utilization

The utilization at which price exactly recovers cost:

```
U_breakeven = TCO_annual / (H · Price_per_hour / (1 + m))
```

### 8.3 Sensitivity

Test how `Cost_per_hour`, `ROI`, and `Payback` move when each driver flexes ±x%:
`U`, `A`, `H`, `C_cap`, `C_pilot`, and `r`. Report the variables to which the model is most
sensitive (typically `U` and `C_pilot`).

---

## 9. Worked Formula Walkthrough

Order of computation (plug real inputs in this sequence):

1. `CRF` → annualize capital → `C_cap_annual`  *(3.1)*
2. Sum operating lines → `C_op`  *(3.2)*
3. `TCO_annual = C_cap_annual + C_op`  *(3.3)*
4. Build capacity `H`, apply utilization → `H_b`  *(4.1–4.2)*
5. `Cost_per_hour = TCO_annual / H_b`  *(4.3)*
6. Apply margin → `Price_per_hour` and/or subscription  *(6)*
7. Allocate to departments via `w_d`  *(5)*
8. Quantify `V_total`, then `ROI`, `Payback`, `BCR`  *(7)*
9. Stress-test with contingency, break-even, sensitivity  *(8)*

---

## 10. Inputs Checklist

Collect these before populating the model:

- [ ] Capital line items (airframes, payloads, ground control) → `C_cap`, `R`
- [ ] All annual operating line items → `C_soft … C_over`
- [ ] Asset life `N`, discount rate `r`, contingency `c`
- [ ] Operational profile: `D_op`, `F`, `h_f`, availability `A`
- [ ] Expected utilization `U` and per-department usage weights `w_d`
- [ ] Target margin `m` and pricing model choice (6.1–6.5)
- [ ] Legacy-method baseline costs (for `V_avoid`)
- [ ] Time, safety, and recovery parameters (for `V_time`, `V_safety`, `V_recovery`)
- [ ] KPI targets if using SLA-linked pricing (6.5)

---

*Companion document: "Municipal UAS Platform — Capability & Use-Case Catalogue."*
