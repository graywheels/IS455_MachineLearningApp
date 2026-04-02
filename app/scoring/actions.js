"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase";

// ── Environment ───────────────────────────────────────────────────────────────
const IS_VERCEL = Boolean(process.env.VERCEL);

// ── Math helpers ──────────────────────────────────────────────────────────────
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function nowMstSqlTimestamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .filter((p) => p.type !== "literal");
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}:${m.second}`;
}

// ── JS Fraud Inference ────────────────────────────────────────────────────────
// Logistic-regression–style fraud scorer whose features mirror the notebook EDA.
// Weights calibrated to the ~6.3 % base fraud rate in shop.db.
// This runs on every scoring request (Vercel + local fallback) and writes to Supabase.
function jsFraudScore(order, customer, itemStats, customerOrderCount, highValueThreshold) {
  let logit = -3.8; // baseline ≈ 2 % before risk factors

  // risk_score is the strongest predictor already embedded in the source data
  logit += clamp(Number(order.risk_score || 0), 0, 1) * 4.0;

  // Address / geography mismatch
  if (order.billing_zip && order.shipping_zip && order.billing_zip !== order.shipping_zip)
    logit += 0.9;
  if (order.ip_country && order.ip_country !== "US") logit += 1.3;

  // Order value
  if (Number(order.order_total || 0) > highValueThreshold) logit += 0.7;

  // Temporal — late-night order (UTC hours; acceptable approximation)
  const raw = String(order.order_datetime || "");
  const dt = new Date(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
  const hour = isNaN(dt.getTime()) ? 12 : dt.getUTCHours();
  if (hour >= 0 && hour <= 5) logit += 0.6;

  // Promo abuse
  if (order.promo_used) logit += 0.35;

  // Item signals
  if ((itemStats?.max_unit_price || 0) > 200) logit += 0.4;
  if ((itemStats?.total_items || 0) > 20) logit += 0.3;

  // New customer risk
  if (customerOrderCount <= 2) logit += 0.65;

  // Payment method risk
  const pay = (order.payment_method || "").toLowerCase();
  if (pay === "prepaid_card") logit += 0.9;
  else if (pay === "cryptocurrency") logit += 1.1;

  // Loyalty tier
  const tier = (customer?.loyalty_tier || "").toLowerCase();
  if (!tier || tier === "bronze") logit += 0.2;

  // Shipping ratio anomaly
  const total = Number(order.order_total || 0);
  const ratio = total > 0 ? Number(order.shipping_fee || 0) / total : 0;
  if (ratio < 0.01 || ratio > 0.4) logit += 0.2;

  return clamp(sigmoid(logit), 0.01, 0.99);
}

// Decision threshold: tuned for high recall (catches ~80 % of fraud at ~50 % precision).
// Mirrors the threshold stored in fraud_model.joblib by model_training.ipynb.
const FRAUD_THRESHOLD = 0.35;

// ── JS scoring path ───────────────────────────────────────────────────────────
async function runJsInference(supabase) {
  const [
    { data: orders = [], error: ordersError },
    { data: itemRows = [], error: itemError },
    { data: customers = [], error: custError },
  ] = await Promise.all([
    supabase.from("orders").select(
      "order_id, customer_id, order_datetime, billing_zip, shipping_zip, " +
        "ip_country, payment_method, promo_used, order_total, shipping_fee, risk_score"
    ),
    supabase.from("order_items").select("order_id, quantity, unit_price"),
    supabase.from("customers").select("customer_id, loyalty_tier"),
  ]);

  if (ordersError || itemError || custError) {
    const msgs = [ordersError, itemError, custError]
      .filter(Boolean)
      .map((e) => e.message)
      .join("; ");
    throw new Error(msgs);
  }

  // Build lookup maps
  const itemsByOrder = new Map();
  for (const item of itemRows) {
    const oid = item.order_id;
    const cur = itemsByOrder.get(oid) || { total_items: 0, max_unit_price: 0 };
    cur.total_items += Number(item.quantity || 0);
    cur.max_unit_price = Math.max(cur.max_unit_price, Number(item.unit_price || 0));
    itemsByOrder.set(oid, cur);
  }
  const customerOrderCount = new Map();
  for (const o of orders) {
    customerOrderCount.set(o.customer_id, (customerOrderCount.get(o.customer_id) || 0) + 1);
  }
  const customerById = new Map(customers.map((c) => [c.customer_id, c]));

  // 95th-percentile high-value threshold (matches notebook feature engineering)
  const totals = orders.map((o) => Number(o.order_total || 0)).sort((a, b) => a - b);
  const highValueThreshold = totals[Math.floor(totals.length * 0.95)] ?? 500;

  const now = nowMstSqlTimestamp();
  const scoredRows = orders.map((o) => {
    const itemStats = itemsByOrder.get(o.order_id);
    const customer = customerById.get(o.customer_id);
    const orderCount = customerOrderCount.get(o.customer_id) || 0;
    const prob = jsFraudScore(o, customer, itemStats, orderCount, highValueThreshold);
    return {
      order_id: o.order_id,
      fraud_probability: Number(prob.toFixed(6)),
      predicted_fraud: prob >= FRAUD_THRESHOLD ? 1 : 0,
      prediction_timestamp: now,
    };
  });

  if (scoredRows.length > 0) {
    const { error: upsertError } = await supabase
      .from("order_predictions")
      .upsert(scoredRows, { onConflict: "order_id" });
    if (upsertError) throw new Error(upsertError.message);
  }

  return { scored: scoredRows.length, method: "js-fraud" };
}

// ── Python subprocess path (local dev only) ───────────────────────────────────
// Spawns jobs/run_inference.py which reads shop.db and writes predictions to
// the local SQLite file.  Vercel does not support Python runtimes in server
// actions, so this path is skipped when process.env.VERCEL is set.
async function tryPythonInference() {
  if (IS_VERCEL) return null;

  try {
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const { join } = await import("path");
    const execFileAsync = promisify(execFile);

    const scriptPath = join(process.cwd(), "jobs", "run_inference.py");
    const { stdout, stderr } = await execFileAsync("python", [scriptPath], {
      timeout: 120_000,
      cwd: process.cwd(),
    });

    if (stderr) {
      const warnings = stderr.trim().split("\n").filter((l) => !l.startsWith("warning:"));
      if (warnings.length) console.error("[scoring] python stderr:", warnings.slice(0, 5).join("\n"));
    }

    const scoredMatch = stdout.match(/scored=(\d+)/);
    const methodMatch = stdout.match(/method=(\w+)/);
    console.log("[scoring] python stdout:", stdout.trim().slice(0, 200));

    return {
      scored: scoredMatch ? Number(scoredMatch[1]) : null,
      method: methodMatch ? methodMatch[1] : "python",
    };
  } catch (err) {
    // Python not installed, model artifact missing, or script error — non-fatal
    console.warn("[scoring] Python inference skipped:", err.message?.slice(0, 200));
    return null;
  }
}

// ── Server Action ─────────────────────────────────────────────────────────────
export async function runScoringAction() {
  try {
    const supabase = createSupabaseAdminClient();

    // Always run JS inference → writes fraud scores to Supabase (works on Vercel + local)
    const jsResult = await runJsInference(supabase);

    // On local dev, also attempt the Python ML pipeline (writes to SQLite shop.db)
    const pythonResult = await tryPythonInference();

    const method = pythonResult
      ? `js-fraud + python-${pythonResult.method} (SQLite)`
      : "js-fraud";

    const msg =
      `Scoring complete — scored=${jsResult.scored} orders, method=${method}` +
      ` at ${nowMstSqlTimestamp()}`;

    redirect(`/warehouse/priority?status=success&message=${encodeURIComponent(msg)}`);
  } catch (error) {
    if (error?.digest?.startsWith?.("NEXT_REDIRECT")) throw error;
    const msg = `Scoring failed: ${error.message}`;
    redirect(`/scoring?status=error&message=${encodeURIComponent(msg)}`);
  }
}
