import FlashMessage from "@/components/FlashMessage";
import { all, tableExists } from "@/lib/db";

export default function PriorityQueuePage({ searchParams }) {
  if (!tableExists("order_predictions")) {
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

  const rows = all(
    `SELECT
      o.order_id,
      o.order_datetime AS order_timestamp,
      o.order_total AS total_value,
      0 AS fulfilled,
      c.customer_id,
      c.full_name AS customer_name,
      p.late_delivery_probability,
      p.predicted_late_delivery,
      p.prediction_timestamp
    FROM orders o
    JOIN customers c ON c.customer_id = o.customer_id
    JOIN order_predictions p ON p.order_id = o.order_id
    ORDER BY p.late_delivery_probability DESC, o.order_datetime ASC
    LIMIT 50`,
  );

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
