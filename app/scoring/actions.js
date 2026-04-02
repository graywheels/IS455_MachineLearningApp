"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase";

function extractScoredCount(stdout) {
  const match = stdout.match(/scored\s*[:=]\s*(\d+)/i) || stdout.match(/(\d+)\s+orders?\s+scored/i);
  return match ? Number(match[1]) : null;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
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
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}

export async function runScoringAction() {
  try {
    const supabase = createSupabaseAdminClient();
    const [{ data: orders = [], error: ordersError }, { data: itemRows = [], error: itemError }] =
      await Promise.all([
        supabase.from("orders").select("order_id, customer_id, order_total, order_datetime"),
        supabase.from("order_items").select("order_id, quantity"),
      ]);
    if (ordersError || itemError) {
      throw new Error(ordersError?.message || itemError?.message || "Failed to load scoring data");
    }

    const itemsByOrder = new Map();
    for (const item of itemRows) {
      itemsByOrder.set(item.order_id, (itemsByOrder.get(item.order_id) || 0) + Number(item.quantity || 0));
    }
    const customerCount = new Map();
    for (const o of orders) {
      customerCount.set(o.customer_id, (customerCount.get(o.customer_id) || 0) + 1);
    }

    const now = nowMstSqlTimestamp();
    const scoredRows = orders.map((o) => {
      const numItems = itemsByOrder.get(o.order_id) || 0;
      const orderCount = customerCount.get(o.customer_id) || 0;
      const dow = new Date(String(o.order_datetime).replace(" ", "T")).getDay();
      let prob = 0.06;
      prob += Math.min(Number(o.order_total || 0) / 900, 0.5);
      prob += Math.min(numItems / 50, 0.2);
      if (orderCount <= 2) prob += 0.06;
      if ([5, 6, 0].includes(dow)) prob += 0.04;
      prob = clamp(prob, 0.01, 0.99);
      return {
        order_id: o.order_id,
        late_delivery_probability: Number(prob.toFixed(6)),
        predicted_late_delivery: prob >= 0.5 ? 1 : 0,
        prediction_timestamp: now,
      };
    });

    if (scoredRows.length > 0) {
      const { error: upsertError } = await supabase.from("order_predictions").upsert(scoredRows, {
        onConflict: "order_id",
      });
      if (upsertError) throw new Error(upsertError.message);
    }

    const scoredCount = extractScoredCount(`scored=${scoredRows.length}`);
    const ts = new Date().toISOString();
    const msg = scoredCount == null ? `Scoring completed at ${ts}` : `Scoring completed: scored=${scoredCount} at ${ts}`;
    redirect(`/warehouse/priority?status=success&message=${encodeURIComponent(msg)}`);
  } catch (error) {
    if (error?.digest?.startsWith?.("NEXT_REDIRECT")) {
      throw error;
    }
    const msg = `Scoring failed: ${error.message}`;
    redirect(`/scoring?status=error&message=${encodeURIComponent(msg)}`);
  }
}
