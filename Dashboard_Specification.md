# GLENPA REAL — MSL Clinical Intelligence Dashboard
## Premium dashboard redesign specification | Version 1.0 | Demonstration data only

**Purpose:** Transform the study-wide MSL view into an engaging, interpretable, scientifically sound, bilingual (English and Arabic) analytics experience. Preserve 20 clinics, 25 fictional patients per clinic, and patient timelines containing baseline, Month 3, and Month 6 visits. This is a design specification; it does not deploy or change the live GitHub website.

**Design direction:** Executive Navy & Teal. Deep navy `#0D2238`, teal `#00A98F`, cool cyan `#47C6D1`, white `#FFFFFF`, warm amber `#F4B860` for workflow attention, red `#D55B72` only for safety review. Use restrained gradients, spacious layouts, soft shadows, crisp typography, accessible contrast, and subtle movement. All analytics must use the underlying fictional dataset, never arbitrary decorative values.

## 1. Persistent navigation and global controls
- Fixed left navigation (desktop): Overview, Clinical Insights, Safety, Clinic Intelligence, Patient Directory, Data Quality, Reports.
- Mobile: compact top navigation and bottom or collapsible navigation without losing access to patient search.
- Sticky header: global clinic selector (All clinics or one clinic), study-period selector, Glenpa strength (10/5 or 25/5 mg), sex (Male/Female), completed-visit count, language EN/AR, reset filters, and `Export` action.
- Show a prominent `FICTIONAL DEMONSTRATION DATA` banner. Display active filter chips and the patient count underlying the current analysis.
- Global quick search by study ID or fictional name; shortcut `Ctrl/⌘ + K` on desktop.
- Every clinic visualization navigates to that clinic. Every patient entry opens the patient profile. Breadcrumbs always show Overview › Clinic › Patient.

## 2. Executive overview — a deliberate visual hierarchy
### 2.1 Hero: study status
A single wide navy panel with study name, period, 20 clinics, target 500 patients and a discrete progress ring. The hero is a visual identity element, not an exaggerated efficacy claim.

### 2.2 KPI constellation
Six distinct cards (two rows on desktop, swipeable/stacked on mobile):
1. Enrolled patients — number and percentage of target.
2. Recorded baseline visits — numerator and denominator.
3. Month 3 visit completion — numerator, denominator, and bar.
4. Month 6 visit completion — numerator, denominator, and bar.
5. Mean within-patient HbA1c change at Month 6 — **percentage points**, only patients with both baseline and Month 6 values, display `n`.
6. Patients with ≥1 reported adverse event — number and proportion of patients with available safety follow-up; distinguish unique patients from event reports.
Hover reveals definitions and denominators; no autoplay counters that distract from reading.

### 2.3 Study journey funnel
A four-stage horizontal funnel: Enrolled → Baseline available → Month 3 recorded → Month 6 recorded. Show counts and completion relative to enrolled. Do not label missing visits "dropout" without confirmed disposition.

### 2.4 Visit mix / circular rings
Three rings for **1, 2, and 3 recorded visits**. These are mutually exclusive, so together they sum to enrolled patients. A separate cumulative visit funnel must not reuse these percentages as if they were mutually exclusive.

## 3. Clinical Insights — efficacy visual storytelling
### 3.1 HbA1c trajectories
- Elegant line graph with baseline, Month 3 and Month 6; selectable **all recorded observations** vs **paired cohort**.
- The paired cohort uses only people with relevant matched visits; `n` and analysis type must remain visible.
- Plot HbA1c as `%` and report differences as `percentage points (pp)`, never percentage reduction unless explicitly calculated.
- Tooltips provide timepoint, number with recorded value, mean/median, and variability if appropriate.

### 3.2 HbA1c response distribution
Four attractive horizontal segmented bars for paired Month 6 delta HbA1c: ≤−1.0 pp, >−1.0 to ≤−0.5 pp, >−0.5 to <+0.5 pp, and ≥+0.5 pp. Clearly mark these as **descriptive visualization categories, not prespecified clinical thresholds** unless protocol-defined.

### 3.3 Patient-level waterfall
One horizontal/vertical waterfall bar per paired patient, sorted by observed change. Optional clinic filter. For 500 patients, use pagination or virtualization; never produce a single unreadable wall of bars. Tooltip jumps to patient profile.

### 3.4 Glucose and renal descriptors
Simple separate distributions for fasting plasma glucose (FPG, mg/dL) and estimated glomerular filtration rate (eGFR, mL/min/1.73 m²), by visit and strength. Avoid using these as unsupported clinical-effect claims.

### 3.5 Treatment-strength composition
Donut for Glenpa 10 mg/5 mg vs 25 mg/5 mg at each visit. Record dose switching and reasons as clinical context. Do not make causal comparisons between nonrandomized treatment groups.

## 4. Clinical characteristics — who is in the study?
- Comorbidity treemap or ranked horizontal bars: hypertension, dyslipidemia, chronic kidney disease, coronary artery disease, heart failure, obesity, and additional reported conditions. **Multi-select categories overlap**; totals can exceed 100%. Count unique patients per condition.
- Baseline medication classes: metformin, insulin, sulfonylureas, statins, antihypertensives, other. These categories also overlap. Use consistent medication-class mapping, not free-text substring approximations in production.
- Age distribution: histogram with clear bins; sex distribution: Male/Female, matching the demo's current data field.
- Clinical descriptions and comorbidity translations must use validated vocabulary in both languages.

## 5. Safety and pharmacovigilance intelligence
- Distinguish **adverse events (AEs)**, **serious adverse events (SAEs)**, and **adverse drug reactions (ADRs)**. AEs are not automatically ADRs.
- Safety summary: patients with ≥1 AE; total AE reports; categories by preferred term if coded; serious/not serious; outcome; reporting status if available.
- Attractive stacked bars by visit and horizontal event-category bars, both with visible denominator and missing-data statements.
- Separate **review-needed flag** from an actual severity or causality conclusion.
- Prominent disclaimer: a management analytics dashboard **does not replace** the company's validated pharmacovigilance intake and reporting process.

## 6. Clinic Intelligence — action-oriented comparisons
- Full 20-clinic ranked tile grid, each tile showing `x/25 enrolled`, Month 3 completion, Month 6 completion, and data completeness.
- Heatmap matrix with clinic rows and measures as columns. Hover to see numerators; click to open clinic.
- Clinic scorecards include 25 fictional patients, visit mix, paired HbA1c analysis with `n`, medical-history completeness and safety events.
- Ranking is based on **operational measures** such as completion/data completeness, not clinical outcome "best clinic" rankings.
- Sparkline strip for clinic follow-up capture over time (if timestamps are available).

## 7. Patient directory and longitudinal profile
- Search by clinic, fictional name or study ID. Present compact cards with visit completion chip and next visit status.
- Profile header: patient ID, clinic, age, Male/Female, Glenpa strength, recorded visit count.
- Baseline history is entered once. Comorbidities and concomitant medicines persist, with subsequent diagnoses and medication starts/stops shown as dated changes.
- Chronological **3-node timeline**: Baseline (Month 0), Month 3 (at least 3 calendar months after baseline), Month 6 (at least 3 calendar months after Month 3). A missing visit is shown as **not recorded**, not assumed overdue absent scheduling logic.
- Expandable visit cards contain actual date, HbA1c, FPG, eGFR (when available), other lab values, Glenpa strength, concomitant medication changes, diagnoses, AE observations, and clinician notes.
- Small multiples chart HbA1c and FPG by visit (with units). Do not interpolate between missing values.
- Staff follow-up form only requests **new** lab results, new medication/diagnostic changes, and safety/clinical notes; past history remains visible as reference.

## 8. Data Quality & operational follow-up
- Donut for visit-data completeness; missing HbA1c or FPG counts; missing safety assessment flags; unsaved/incomplete patient profiles.
- Rule-based checks: valid clinical measurement ranges, impossible dates, out-of-order visit dates, duplicate IDs, and Month 3/Month 6 intervals under 3 calendar months.
- Flags are review prompts, not automated clinical decisions.
- Corrected data should preserve an audit trail **in a future production implementation**.

## 9. Reports and exports
- One-click study-wide executive overview, clinic report, and individual patient timeline print views.
- CSV export respects current filters and uses pseudonymized study identifiers in clinical research contexts.
- Each report states extraction date, active filters, definitions of derived measures, denominator, missingness, and `Fictional demo data` watermark.
- Include an export access log in a production system; the current GitHub Pages demo cannot provide reliable centralized audit logging.

## 10. Interaction, motion and accessibility
- Animate only on deliberate transitions; subtle card hover (150–220 ms), chart highlights, and smooth drill-down; honor `prefers-reduced-motion`.
- A chart must be understandable without color. Add labels, legends, tooltips, and keyboard support.
- Bilingual EN/AR: right-to-left layout, aligned numeric units, correct Arabic clinical terms, legible Arabic font fallback, localized date presentation.
- iPhone: charts stack into one column, tables scroll horizontally, tap targets ≥44 px, sticky search, and persistent shortcut compatibility.

## 11. Proposed page architecture
| Page | Top feature | Primary visualization | Action |
| --- | --- | --- | --- |
| Overview | Navy study hero + six KPI cards | Funnel + visit mix rings | Select clinic |
| Clinical Insights | Paired HbA1c KPI | Line + waterfall + response bands | Open patient |
| Patient Characteristics | Comorbidity summary | Treemap + medication bars | Filter records |
| Safety | Event-report banner | AE categories + timing | Review patient |
| Clinic Intelligence | Operational scorecards | 20-clinic heatmap | Open clinic |
| Patient Directory | Search + filters | Visit-status cards | Open timeline |
| Data Quality | Missingness summary | Gap matrix + validation list | Review record |
| Reports | Current filters + export date | Export/print catalogue | Download |

## 12. Implementation priorities
**Phase 1 (design release):** KPI constellation, attractive visit rings, enhanced paired HbA1c chart, clinic heatmap, responsive mobile layout, bilingual navigation.

**Phase 2 (scientific analytics):** response bands, waterfall, comorbidity and medication visuals, complete safety numerator/denominator checks, print-friendly reports.

**Phase 3 (connected clinical system, separate from this design demo):** authenticated Firebase users, Firestore rules, protected patient-level information, edit logs, change history, and privacy/pharmacovigilance governance.

**Important limitation:** The present GLENPA REAL GitHub Pages application is a fictional-data demonstration with client-side access controls. Do not upload or use real patient identities or health records in this public demonstration.
