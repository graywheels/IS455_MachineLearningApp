import { createSupabaseAdminClient } from "@/lib/supabase";
import FlashMessage from "@/components/FlashMessage";

export default async function AdminOrdersPage({ searchParams }) {
  const supabase = createSupabaseAdminClient();

  // Fetch the 200 most recent orders across all customers
  const { data: orders = [], error: ordersError } = await supabase
    .from("orders")
    .select(
      "order_id, customer_id, order_datetime, order_total, payment_method, is_fraud"
    )
    .order("order_datetime", { ascending: false })
    .limit(200);

  // Enrich with customer name + email
  const customerIds = [...new Set(orders.map((o) => o.customer_id))];
  const { data: customers = [] } = customerIds.length
    ? await supabase
        .from("customers")
        .select("customer_id, full_name, email")
        .in("customer_id", customerIds)
    : { data: [] };

  // Enrich with fraud predictions (if scoring has been run)
  const orderIds = orders.map((o) => o.order_id);
  const { data: predictions = [] } = orderIds.length
    ? await supabase
        .from("order_predictions")
        .select("order_id, fraud_probability, predicted_fraud")
        .in("order_id", orderIds)
    : { data: [] };

  const customerById   = new Map(customers.map((c) => [c.customer_id, c]));
  const predictionById = new Map(predictions.map((p) => [p.order_id, p]));

  const rows = orders.map((o) => {
    const c = customerById.get(o.customer_id);
    const p = predictionById.get(o.order_id);
    return {
      order_id:          o.order_id,
      order_datetime:    o.order_datetime,
      customer_name:     c?.full_name ?? "Unknown",
      customer_email:    c?.email ?? "—",
      order_total:       o.order_total,
      payment_method:    o.payment_method,
      is_fraud:          o.is_fraud,
      fraud_probability: p?.fraud_probability ?? null,
      predicted_fraud:   p?.predicted_fraud ?? null,
    };
  });

  const fraudCount    = rows.filter((r) => r.is_fraud === 1).length;
  const flaggedCount  = rows.filter((r) => r.predicted_fraud === 1).length;
  const scoredCount   = rows.filter((r) => r.fraud_probability !== null).length;

  return (
    <main className="card">
      <h2>Admin — All Orders</h2>
      <p>
        Global order history across all customers ({orders.length} most recent).{" "}
        Known fraud: <strong>{fraudCount}</strong>.{" "}
        {scoredCount > 0
          ? <>ML-flagged: <strong>{flaggedCount}</strong> of {scoredCount} scored.</>
          : <>Run Scoring to populate fraud predictions.</>}
      </p>
      {ordersError && (
        <p className="muted-text">Error loading orders: {ordersError.message}</p>
      )}
      <FlashMessage searchParams={searchParams} />
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Timestamp</th>
            <th>Customer</th>
            <th>Email</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Known Fraud</th>
            <th>Fraud Prob</th>
            <th>Predicted Fraud</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.order_id}
              style={
                row.is_fraud === 1
                  ? { background: "#ffe8e8" }
                  : row.predicted_fraud === 1
                  ? { background: "#fff8e8" }
                  : undefined
              }
            >
              <td>{row.order_id}</td>
              <td>{row.order_datetime}</td>
              <td>{row.customer_name}</td>
              <td>{row.customer_email}</td>
              <td>${Number(row.order_total).toFixed(2)}</td>
              <td>{row.payment_method}</td>
              <td>{row.is_fraud === 1 ? "✓ Yes" : "No"}</td>
              <td>
                {row.fraud_probability !== null
                  ? Number(row.fraud_probability).toFixed(4)
                  : "—"}
              </td>
              <td>
                {row.predicted_fraud === null
                  ? "—"
                  : row.predicted_fraud === 1
                  ? "⚠ Yes"
                  : "No"}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9}>No orders in database.</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
