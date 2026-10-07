import test from "node:test";
import assert from "node:assert/strict";
import { calendarDate, calendarWindow, generateDailyDonorReport, generateDonorInsights, parseMoneyToCents, parseNonNegativeInteger, percentageChange, supportedCurrency, summarizeDonorData } from "../supabase/functions/_shared/rule-analysis.ts";

const org = "org-a";
const donation = (id: string, amount: unknown, date = "2026-10-07", donorId: string | null = "donor-a", organization = org) => ({ id, organization_id: organization, amount, donation_date: date, donor_id: donorId, status: "success", currency: "SAR" });
const summarize = (donations: ReturnType<typeof donation>[]) => summarizeDonorData({ organizationId: org, asOf: "2026-10-07", donations });

test("money arithmetic uses integer cents, including Arabic and Persian digits", () => {
  assert.equal(parseMoneyToCents("١٬٢٣٤٫٥٦"), 123456);
  assert.equal(parseMoneyToCents("۱۲۳۴.۵۶"), 123456);
  assert.equal(parseMoneyToCents(" 1,234.50 "), 123450);
  assert.equal(parseMoneyToCents(0), 0);
  assert.equal(parseMoneyToCents(0.29), 29);
  assert.equal(parseNonNegativeInteger("٣٠"), 30);
  assert.equal(summarize([donation("d1", "0.10"), donation("d2", "0.20")]).totals.donations_amount_cents, 30);
});

test("missing, malformed, negative, nonfinite and sub-cent money is rejected", () => {
  for (const value of [undefined, null, "", " ", true, {}, [], "12x", "1,23", "1e2", "-10", -1, NaN, Infinity, "1.005", 1.005, "90071992547410.00"]) {
    assert.equal(parseMoneyToCents(value), null, String(value));
  }
  assert.equal(parseMoneyToCents("90071992547409.91"), Number.MAX_SAFE_INTEGER);
  assert.equal(parseNonNegativeInteger("2.5"), null);
});

test("money totals throw rather than silently overflow", () => {
  assert.throws(() => summarize([donation("a", "90071992547409.91"), donation("b", "0.01")]), /safe integer/);
});

test("zero denominators are explicitly unavailable", () => {
  assert.equal(percentageChange(0, 0), null);
  assert.equal(percentageChange(100, 0), null);
  assert.equal(percentageChange(0, 100), -100);
  assert.equal(percentageChange(120, 100), 20);
  assert.equal(percentageChange(100, NaN), null);
  const result = generateDonorInsights({ panel: "recurring", context: { org_totals: { currency: "SAR", donations_count: 0, donations_total: 0, donors_count: 0 }, recurring_count: 0 } }, { organizationId: org });
  assert.equal(result.metrics.average_donation_cents, null);
  assert.equal(result.metrics.donations_per_donor, null);
  assert.equal(result.metrics.recurring_share_percent, null);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("date-only and timestamp inputs have explicit Saudi calendar semantics", () => {
  assert.equal(calendarDate("2026-10-07"), "2026-10-07");
  assert.equal(calendarDate("2026-10-06T21:00:00Z"), "2026-10-07");
  assert.equal(calendarDate("2026-10-07T00:30:00+03:00", 0), "2026-10-06");
  assert.equal(calendarDate("٢٠٢٦-١٠-٠٧"), "2026-10-07");
  for (const value of ["2026-02-29", "2026-02-31", "2026-13-01", "07/10/2026", "2026-10-07T12:00:00", "not a date", null, new Date(NaN)]) assert.equal(calendarDate(value), null);
  assert.throws(() => calendarDate("2026-10-07", 900), /offset/);
});

test("calendar windows handle leap years, month-end clamping and complete prior periods", () => {
  assert.deepEqual(calendarWindow("last_month", "2024-03-31"), { from: "2024-02-01", to: "2024-02-29", utc_offset_minutes: 180 });
  assert.equal(calendarWindow("last_3_months", "2026-05-31").from, "2026-02-28");
  assert.equal(calendarWindow("last_12_months", "2024-02-29").from, "2023-02-28");
  assert.deepEqual(calendarWindow("last_week", "2026-01-04"), { from: "2025-12-28", to: "2026-01-03", utc_offset_minutes: 180 });
  assert.equal(calendarWindow("last_30_days", "2026-10-07").from, "2026-09-08");
  assert.deepEqual(calendarWindow("last_year", "2026-01-01"), { from: "2025-01-01", to: "2025-12-31", utc_offset_minutes: 180 });
  assert.throws(() => calendarWindow("custom", "2026-10-07", { from: "2026-10-02", to: "2026-10-01" }), /range/);
});

test("daily comparisons respect calendar boundaries and report supporting rows", () => {
  const result = summarize([
    donation("before", "10", "2026-10-06T20:59:59Z"),
    donation("boundary", "20", "2026-10-06T21:00:00Z"),
    donation("date-only", "0.25", "2026-10-07"),
    donation("prior30", "100", "2026-09-07"),
    donation("current30", "300", "2026-09-08"),
  ]);
  assert.equal(result.comparisons.today.amount_cents, 2025);
  assert.equal(result.comparisons.yesterday.amount_cents, 1000);
  assert.equal(result.comparisons.today_change_percent, 102.5);
  assert.equal(result.comparisons.previous_30_days.amount_cents, 10000);
  assert.equal(result.comparisons.current_30_days.amount_cents, 33025);
  assert.deepEqual(result.comparisons.today.evidence.row_ids, ["boundary", "date-only"]);
  assert.equal(result.source, "rules-v1");
});

test("organization isolation excludes foreign and unscoped fixtures", () => {
  const rows = [donation("a", 10), donation("b", 99999, undefined, "donor-b", "org-b"), { ...donation("c", 20), organization_id: undefined }];
  const result = summarizeDonorData({ organizationId: org, asOf: "2026-10-07", donations: rows });
  assert.equal(result.totals.donations_amount_cents, 1000);
  assert.equal(result.quality.excluded_organization_rows, 2);
  assert.deepEqual(result.evidence.row_ids, ["a"]);
  assert.ok(!JSON.stringify(result).includes("99999"));
  const trusted = summarizeDonorData({ organizationId: org, asOf: "2026-10-07", donations: rows, tenantFiltered: true });
  assert.equal(trusted.totals.donations_amount_cents, 3000);
  assert.equal(trusted.quality.excluded_organization_rows, 1);
});

test("trusted tenant-filtered data does not override an explicit foreign or null scope", () => {
  const result = summarizeDonorData({ organizationId: org, asOf: "2026-10-07", tenantFiltered: true, donations: [{ ...donation("bad", 99), organization_id: null }, donation("other", 88, undefined, "d", "org-b")] });
  assert.equal(result.totals.donations, 0);
  assert.equal(result.quality.excluded_organization_rows, 2);
  assert.throws(() => generateDonorInsights({ org_id: "org-b" }, { organizationId: org }), /scope/);
  assert.throws(() => generateDonorInsights({}, { organizationId: "org-b", summary: summarize([]) }), /scope/);
});

test("invalid values, unsupported statuses, duplicates and identity gaps are surfaced", () => {
  const result = summarizeDonorData({ organizationId: org, asOf: "2026-10-07", donations: [
    donation("valid", 1), donation("valid", 1), donation("invalid", "garbage"), donation("missing", null),
    donation("bad-date", 30, "2026-02-31"), donation("future", 10, "2026-10-08"),
    { ...donation("failed", 999), status: "failed" }, { ...donation("status", 999), status: "mystery" },
    donation("anonymous", 2, undefined, null),
  ] });
  assert.equal(result.totals.donations_amount_cents, 300);
  assert.equal(result.quality.invalid_rows, 4);
  assert.equal(result.quality.invalid_values, 4);
  assert.equal(result.quality.unsupported_rows, 2);
  assert.equal(result.quality.duplicate_rows, 1);
  assert.equal(result.quality.missing_identity_rows, 1);
  assert.equal(result.cohorts.observed_donors, 1);
});

test("names are never used to merge donor identities", () => {
  const rows = [{ ...donation("a", 1, undefined, null), donor_name: "Same name" }, { ...donation("b", 2, undefined, null), donor_name: "Same name" }, donation("c", 3, undefined, "known")];
  const result = summarize(rows);
  assert.equal(result.cohorts.observed_donors, 1);
  assert.equal(result.cohorts.repeat_donors, 0);
  assert.equal(result.cohorts.unidentified_donation_rows, 2);
});

test("major retention uses the prior cohort and two equal non-overlapping periods", () => {
  const result = summarize([
    donation("prior-a", "10000", "2026-06-01", "a"), donation("prior-b", "15000", "2026-06-01", "b"),
    donation("retained-a", "0.01", "2026-09-01", "a"), donation("zero-b", 0, "2026-09-01", "b"),
    donation("new-major", "90000", "2026-09-01", "c"), donation("small-prior", 1, "2026-06-01", "c"),
  ]);
  const cohort = result.cohorts.major_retention;
  assert.equal(cohort.previous_donors, 2);
  assert.equal(cohort.retained_donors, 1);
  assert.equal(cohort.retention_percent, 50);
  assert.deepEqual(cohort.not_observed_donor_ids, ["b"]);
  assert.equal(cohort.previous_period.to, "2026-07-09");
  assert.equal(cohort.current_period.from, "2026-07-10");
  assert.ok(result.findings.some(finding => finding.rule_id === "major-donor-retention-90d"));
});

test("absent data stays unavailable and empty data does not invent findings", () => {
  const result = summarize([]);
  assert.equal(result.totals.donors, null);
  assert.equal(result.totals.active_campaigns, null);
  assert.equal(result.cohorts.major_retention.retention_percent, null);
  assert.deepEqual(result.findings, []);
  assert.deepEqual(generateDailyDonorReport(result).suggested_tasks, []);
  assert.deepEqual(generateDonorInsights({}, { organizationId: org }).segments, []);
});

test("campaign arithmetic excludes zero goals and reports remaining cents exactly", () => {
  const result = summarizeDonorData({ organizationId: org, asOf: "2026-10-07", donations: [], campaigns: [
    { id: "near", organization_id: org, status: "active", name: "Project", currency: "SAR", goal_amount: "100.10", collected_amount: "90.09" },
    { id: "zero", organization_id: org, status: "active", currency: "SAR", goal_amount: 0, collected_amount: 0 },
    { id: "foreign", organization_id: "org-b", status: "active", currency: "SAR", goal_amount: 100, collected_amount: 90 },
  ] });
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].evidence.metrics.remaining_cents, 1001);
  assert.equal(result.quality.invalid_values, 1);
  assert.equal(result.quality.excluded_organization_rows, 1);
});

test("subscription and cart findings describe observations without asserting failed payments or revenue", () => {
  const result = summarizeDonorData({ organizationId: org, asOf: "2026-10-07", donations: [],
    subscriptions: [{ id: "s", organization_id: org, status: "active", donor_id: "d", next_charge_date: "2026-10-06" }],
    abandonedCarts: [{ id: "a", organization_id: org, currency: "SAR", amount: "12.34", abandoned_at: "2026-10-05", recovered: false }, { id: "r", organization_id: org, currency: "SAR", amount: 99, abandoned_at: "2026-10-07", recovered: true }],
  });
  assert.equal(result.totals.abandoned_3_calendar_days, 1);
  assert.equal(result.findings.find(f => f.insight_type === "abandoned_cart_recovery")?.evidence.metrics.amount_cents, 1234);
  assert.match(result.findings.find(f => f.insight_type === "lapsing_recurring")!.summary, /لا يثبت/);
});

test("aggregate donor-insights keeps UI contract and performs real derived calculations", () => {
  const payload = { panel: "recurring", context: { org_totals: { currency: "SAR", donors_count: "١٠", donations_count: 25, donations_total: "1234.50" }, recurring_count: 4, top_projects: [{ project: "Water", currency: "SAR", total: "1000.10" }] } };
  const result = generateDonorInsights(payload, { organizationId: org });
  assert.equal(result.metrics.average_donation_cents, 4938);
  assert.equal(result.metrics.donations_per_donor, 2.5);
  assert.equal(result.metrics.recurring_share_percent, 40);
  for (const key of ["segments", "retention_ideas", "creative_campaigns", "content_drafts", "tier_actions", "evidence"]) assert.ok(Array.isArray(result[key as keyof typeof result]));
  assert.equal(typeof result.executive_summary, "string");
  assert.equal(result.evidence[0].dataset, "supplied_aggregate");
  assert.equal(result.evidence[0].period, null);
  assert.ok(!("major_donor_retention_percent" in result.metrics));
  assert.equal(result.source, "rules-v1");
});

test("invalid aggregate amounts and impossible retention are not silently coerced", () => {
  const result = generateDonorInsights({ panel: "top", context: { org_totals: { currency: "SAR", donations_count: "oops", donations_total: null }, major_donor_retention: { previous_count: 2, retained_count: 3 } } }, { organizationId: org });
  assert.equal(result.quality.invalid_values, 3);
  assert.ok(!("major_donor_retention_percent" in result.metrics));
  assert.ok(!result.retention_ideas.some(row => row.title.includes("استمرار")));
});

test("supplied aggregate retention explicitly computes counts without inventing cohort periods", () => {
  const result = generateDonorInsights({ panel: "top", context: { major_donor_retention: { previous_count: 8, retained_count: 6 } } }, { organizationId: org });
  assert.equal(result.metrics.major_donor_retention_percent, 75);
  assert.equal(result.retention_ideas[0].evidence?.period, null);
  assert.match(result.retention_ideas[0].description, /تعريف المجموعة والفترتين/);
});

test("daily JSON is deterministic, evidence-backed, and has no synthetic task quota", () => {
  const summary = summarize([donation("a", "1.23")]);
  assert.deepEqual(generateDailyDonorReport(summary), generateDailyDonorReport(summary));
  const daily = generateDailyDonorReport(summary);
  assert.equal(daily.source, "rules-v1");
  assert.equal(daily.suggested_tasks.length, 0);
  assert.ok(daily.insights.every(row => row.evidence.row_ids.length > 0));
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(daily)));
});

test("raw-data summary overrides untrusted client totals and discloses partial reads", () => {
  const summary = summarizeDonorData({ organizationId: org, asOf: "2026-10-07", donations: [donation("a", "0.30")], incomplete: true });
  const result = generateDonorInsights({ panel: "overview", context: { org_totals: { currency: "SAR", donations_total: 9999, donations_count: 999 } } }, { organizationId: org, summary });
  assert.equal(result.metrics.donations_total_cents, 30);
  assert.equal(result.metrics.donations_count, 1);
  assert.ok(result.limitations.some(value => value.includes("جزئي")));
  assert.deepEqual(result.evidence[0].row_ids, ["a"]);
});

test("an analysis date does not invent an observation period for anonymous aggregates", () => {
  const result = generateDonorInsights({ panel: "overview", context: { org_totals: { currency: "SAR", donations_count: 2 } } }, { organizationId: org, asOf: "2026-10-07" });
  assert.equal(result.analysis_date, "2026-10-07");
  assert.equal(result.period, null);
  assert.equal(result.evidence[0].period, null);
});

test("currency accepts only explicit SAR and precise Arabic Saudi-riyal aliases", () => {
  for (const value of ["SAR", "sar", " SAR ", "ر.س", "ر.س.", "ريال سعودي", "الريال السعودي"]) assert.equal(supportedCurrency(value), "SAR");
  for (const value of [undefined, null, "", "USD", "AED", "ريال", "﷼", "ريال قطري", "SR", 682]) assert.equal(supportedCurrency(value), null);
});

test("USD and missing-currency donations never enter SAR totals, comparisons or major cohorts", () => {
  const result = summarizeDonorData({ organizationId: org, asOf: "2026-10-07", donations: [
    donation("sar", "10.25"), { ...donation("arabic", "١٢٫٣٤"), currency: "ريال سعودي" },
    { ...donation("usd", "50000", "2026-06-01", "usd-donor"), currency: "USD" },
    { ...donation("missing", "60000", "2026-06-01", "unknown-currency-donor"), currency: undefined },
    { ...donation("ambiguous", "70000"), currency: "ريال" },
  ] });
  assert.equal(result.totals.donations_amount_cents, 2259);
  assert.equal(result.totals.donations, 2);
  assert.equal(result.comparisons.today.amount_cents, 2259);
  assert.equal(result.cohorts.major_retention.previous_donors, 0);
  assert.equal(result.quality.unsupported_currency_rows, 2);
  assert.equal(result.quality.missing_currency_rows, 1);
  assert.deepEqual(result.evidence.row_ids, ["arabic", "sar"]);
  assert.equal(result.evidence.metrics.currency, "SAR");
  assert.ok(result.quality.issues.some(row => row.row_id === "usd" && row.reason === "unsupported_currency"));
  assert.ok(result.quality.issues.some(row => row.row_id === "missing" && row.reason === "missing_or_invalid_currency"));
});

test("campaign and cart amounts require a supported currency too", () => {
  const result = summarizeDonorData({ organizationId: org, asOf: "2026-10-07", donations: [],
    campaigns: [{ id: "usd-campaign", organization_id: org, status: "active", currency: "USD", goal_amount: 100, collected_amount: 90 }],
    abandonedCarts: [{ id: "missing-cart", organization_id: org, amount: 12, abandoned_at: "2026-10-07", recovered: false }],
  });
  assert.equal(result.totals.active_campaigns, 1);
  assert.equal(result.totals.abandoned_3_calendar_days, 1);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].evidence.metrics.amount_cents, null);
  assert.equal(result.quality.unsupported_currency_rows, 1);
  assert.equal(result.quality.missing_currency_rows, 1);
});

test("unknown-currency aggregate money is unavailable and never labelled SAR", () => {
  for (const currency of [undefined, "USD", "ريال"]) {
    const result = generateDonorInsights({ panel: "overview", context: { currency, org_totals: { donations_count: 2, donations_total: "100.25" }, abandoned_value: 90, top_projects: [{ project: "Water", total: 80 }] } }, { organizationId: org });
    assert.ok(!("donations_total_cents" in result.metrics));
    assert.equal(result.metrics.average_donation_cents, null);
    assert.ok(!("abandoned_value_cents" in result.metrics));
    assert.ok(!("project:Water:cents" in result.metrics));
    assert.ok(!JSON.stringify(result).includes("ر.س"));
    assert.ok(result.quality.missing_currency_rows + result.quality.unsupported_currency_rows >= 3);
  }
});

test("explicit Arabic aggregate currency enables exact arithmetic but cannot override a project currency", () => {
  const result = generateDonorInsights({ panel: "overview", context: { currency: "ريال سعودي", org_totals: { donations_count: 2, donations_total: "100.10" }, top_projects: [{ project: "USD Project", total: 80, currency: "USD" }, { project: "SAR Project", total: "40.05" }] } }, { organizationId: org });
  assert.equal(result.metrics.donations_total_cents, 10010);
  assert.equal(result.metrics.average_donation_cents, 5005);
  assert.equal(result.metrics["project:SAR Project:cents"], 4005);
  assert.ok(!("project:USD Project:cents" in result.metrics));
  assert.equal(result.quality.unsupported_currency_rows, 1);
});

test("conflicting duplicate identifiers are excluded regardless of row order", () => {
  const rows = [donation("conflict", 10), donation("ok", 1), donation("conflict", 20)];
  const forward = summarize(rows), reverse = summarize([...rows].reverse());
  assert.equal(forward.totals.donations_amount_cents, 100);
  assert.deepEqual(forward.totals, reverse.totals);
  assert.deepEqual(forward.evidence, reverse.evidence);
  assert.equal(forward.quality.duplicate_rows, 1);
  assert.equal(forward.quality.invalid_rows, 2);
  assert.ok(forward.quality.issues.some(row => row.reason === "conflicting_duplicate_identifier"));
  assert.deepEqual(forward.evidence.row_ids, ["ok"]);
});

test("real schema-shaped activities without currency retain accurate counts and unavailable money", () => {
  const result = summarizeDonorData({ organizationId: org, asOf: "2026-10-07", donations: [],
    campaigns: [{ id: "c", organization_id: org, status: "active", goal_amount: 100, collected_amount: 90 }],
    gifts: [{ id: "g", organization_id: org, amount: 55, gift_date: "2026-10-01" }, { id: "g-old", organization_id: org, amount: 5, gift_date: "2026-01-01" }],
    abandonedCarts: [{ id: "a", organization_id: org, amount: 12, abandoned_at: "2026-10-07", recovered: false }, { id: "a-recovered", organization_id: org, amount: 8, abandoned_at: "2026-10-07", recovered: true }],
    failedDonations: [{ id: "f", organization_id: org, amount: 20, attempted_at: "2026-10-06" }, { id: "f-invalid", organization_id: org, amount: 20, attempted_at: "not a date" }],
  });
  assert.equal(result.totals.active_campaigns, 1);
  assert.equal(result.totals.gifts_90d, 1);
  assert.equal(result.totals.abandoned_3_calendar_days, 1);
  assert.equal(result.totals.failed_30d, 1);
  assert.equal(result.totals.gifts_90d_amount_cents, null);
  assert.equal(result.totals.abandoned_3_calendar_days_amount_cents, null);
  assert.equal(result.totals.failed_30d_amount_cents, null);
  assert.equal(result.quality.invalid_rows, 1);
  assert.equal(result.quality.accepted_rows, 6);
  assert.ok(!result.findings.some(row => row.insight_type === "campaign_near_goal"));
  const cart = result.findings.find(row => row.insight_type === "abandoned_cart_recovery")!;
  assert.equal(cart.evidence.metrics.count, 1);
  assert.equal(cart.evidence.metrics.amount_cents, null);
  assert.equal(cart.evidence.metrics.amount_unavailable_rows, 1);
  assert.equal(cart.evidence.metrics.currency, undefined);
  assert.match(cart.summary, /القيمة النقدية الإجمالية غير متاحة/);
});

test("mixed-currency and invalid-amount activities never produce a partial sum labelled as a total", () => {
  const result = summarizeDonorData({ organizationId: org, asOf: "2026-10-07", donations: [],
    abandonedCarts: [
      { id: "sar", organization_id: org, currency: "SAR", amount: "2.50", abandoned_at: "2026-10-07" },
      { id: "usd", organization_id: org, currency: "USD", amount: 10, abandoned_at: "2026-10-07" },
      { id: "bad-amount", organization_id: org, currency: "SAR", amount: null, abandoned_at: "2026-10-07" },
    ],
  });
  assert.equal(result.totals.abandoned_3_calendar_days, 3);
  assert.equal(result.totals.abandoned_3_calendar_days_amount_cents, null);
  const cart = result.findings.find(row => row.insight_type === "abandoned_cart_recovery")!;
  assert.equal(cart.evidence.metrics.amount_cents, null);
  assert.equal(cart.evidence.metrics.amount_unavailable_rows, 2);
  assert.deepEqual(cart.evidence.row_ids, ["bad-amount", "sar", "usd"]);
});
