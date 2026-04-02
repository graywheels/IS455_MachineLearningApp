import FlashMessage from "@/components/FlashMessage";
import { createSupabaseAdminClient } from "@/lib/supabase";

export default async function PriorityQueuePage({ searchParams }) {
  const supabase = createSupabaseAdminClient();
  const { error: predictionError } = await supabase
    .from("order_predictions")
    .select("order_id")
    .limit(1);
  if (predictionError) {
    return (
      <main className="card">
        <h2>Late Delivery Priority Queue</h2>
        <p>
          This queue helps warehouse teams prioritize high-risk orders first so likely late
          deliveries can be handled earlier.
        </p>
        <FlashMessage searchParams={searchParams} />
        <p className="muted-text">
          Missing required table: `order_predictions`. Run your ML pipeline/inference first.
        </p>
      </main>
    );
  }
  const { data: predictions = [] } = await supabase
    .from("order_predictions")
    .select("order_id, late_delivery_probability, predicted_late_delivery, prediction_timestamp")
    .order("late_delivery_probability", { ascending: false })
    .limit(50);
  const orderIds = predictions.map((p) => p.order_id);
  const { data: orders = [] } = orderIds.length
    ? await supabase
        .from("orders")
        .select("order_id, customer_id, order_datetime, order_total")
        .in("order_id", orderIds)
    : { data: [] };
  const customerIds = [...new Set(orders.map((o) => o.customer_id))];
  const { data: customers = [] } = customerIds.length
    ? await supabase.from("customers").select("customer_id, full_name").in("customer_id", customerIds)
    : { data: [] };
  const orderById = new Map(orders.map((o) => [o.order_id, o]));
  const customerById = new Map(customers.map((c) => [c.customer_id, c]));
  const rows = predictions.map((p) => {
    const o = orderById.get(p.order_id);
    const c = o ? customerById.get(o.customer_id) : null;
    return {
      order_id: p.order_id,
      order_timestamp: o?.order_datetime ?? null,
      total_value: o?.order_total ?? 0,
      fulfilled: 0,
      customer_id: o?.customer_id ?? null,
      customer_name: c?.full_name ?? "Unknown",
      late_delivery_probability: p.late_delivery_probability,
      predicted_late_delivery: p.predicted_late_delivery,
      prediction_timestamp: p.prediction_timestamp,
    };
  });

  return (
    <main className="card">
      <h2>Late Delivery Priority Queue</h2>
      <p>
        This queue helps warehouse teams prioritize high-risk orders first so likely late
        deliveries can be handled earlier.
      </p>
      <FlashMessage searchParams={searchParams} />
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Order Timestamp</th>
            <th>Total Value</th>
            <th>Fulfilled</th>
            <th>Customer ID</th>
            <th>Customer Name</th>
            <th>Late Delivery Probability</th>
            <th>Predicted Late Delivery</th>
            <th>Prediction Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.order_id}>
              <td>{row.order_id}</td>
              <td>{row.order_timestamp}</td>
              <td>${Number(row.total_value).toFixed(2)}</td>
              <td>{row.fulfilled}</td>
              <td>{row.customer_id}</td>
              <td>{row.customer_name}</td>
              <td>{Number(row.late_delivery_probability).toFixed(4)}</td>
              <td>{row.predicted_late_delivery}</td>
              <td>{row.prediction_timestamp}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9}>No predictions found yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
