import FlashMessage from "@/components/FlashMessage";
import { createSupabaseAdminClient } from "@/lib/supabase";

export default async function PriorityQueuePage({ searchParams }) {
  const supabase = createSupabaseAdminClient();

  // Verify table is accessible
  const { error: tableError } = await supabase
    .from("order_predictions")
    .select("order_id")
    .limit(1);

  if (tableError) {
    return (
      <main className="card">
        <h2>Fraud Priority Queue</h2>
        <p>High-risk orders flagged by the ML inference job — verify these before fulfillment.</p>
        <FlashMessage searchParams={searchParams} />
        <p className="muted-text">
          Missing required table: <code>order_predictions</code>. Run the ML pipeline or click{" "}
          <strong>Run Scoring</strong> first.
        </p>
      </main>
    );
  }

  // Top-50 highest fraud probability orders
  const { data: predictions = [] } = await supabase
    .from("order_predictions")
    .select("order_id, fraud_probability, predicted_fraud, prediction_timestamp")
    .order("fraud_probability", { ascending: false })
    .limit(50);

  // Enrich with order and customer data
  const orderIds = predictions.map((p) => p.order_id);
  const { data: orders = [] } = orderIds.length
    ? await supabase
        .from("orders")
        .select("order_id, customer_id, order_datetime, order_total, is_fraud")
        .in("order_id", orderIds)
    : { data: [] };

  const customerIds = [...new Set(orders.map((o) => o.customer_id))];
  const { data: customers = [] } = customerIds.length
    ? await supabase
        .from("customers")
        .select("customer_id, full_name")
        .in("customer_id", customerIds)
    : { data: [] };

  const orderById    = new Map(orders.map((o) => [o.order_id, o]));
  const customerById = new Map(customers.map((c) => [c.customer_id, c]));

  const rows = predictions.map((p) => {
    const o = orderById.get(p.order_id);
    const c = o ? customerById.get(o.customer_id) : null;
    return {
      order_id:             p.order_id,
      order_timestamp:      o?.order_datetime ?? "—",
      total_value:          o?.order_total ?? 0,
      customer_name:        c?.full_name ?? "Unknown",
      fraud_probability:    p.fraud_probability,
      predicted_fraud:      p.predicted_fraud,
      actual_fraud:         o?.is_fraud ?? null,
      prediction_timestamp: p.prediction_timestamp,
    };
  });

  const flaggedCount = rows.filter((r) => r.predicted_fraud === 1).length;

  return (
    <main className="card">
      <h2>Fraud Priority Queue</h2>
      <p>
        High-risk orders flagged by ML inference — review before fulfillment. Showing top 50 by
        fraud probability. <strong>{flaggedCount}</strong> predicted fraud
        {flaggedCount === 1 ? "" : "s"}.
      </p>
      <FlashMessage searchParams={searchParams} />
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Order Timestamp</th>
            <th>Total Value</th>
            <th>Customer</th>
            <th>Fraud Probability</th>
            <th>Predicted Fraud</th>
            <th>Actual Fraud</th>
            <th>Scored At</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.order_id}
              style={row.predicted_fraud === 1 ? { background: "#fff3f3" } : undefined}
            >
              <td>{row.order_id}</td>
              <td>{row.order_timestamp}</td>
              <td>${Number(row.total_value).toFixed(2)}</td>
              <td>{row.customer_name}</td>
              <td>{Number(row.fraud_probability).toFixed(4)}</td>
              <td>{row.predicted_fraud === 1 ? "⚠ Yes" : "No"}</td>
              <td>
                {row.actual_fraud === null ? "—" : row.actual_fraud === 1 ? "✓ Fraud" : "Legit"}
              </td>
              <td>{row.prediction_timestamp}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8}>No predictions yet — click Run Scoring to generate scores.</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
