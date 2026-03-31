import { notFound, redirect } from "next/navigation";
import { all, get } from "@/lib/db";
import { getSelectedCustomerId } from "@/lib/customer";

export default async function OrderDetailPage({ params }) {
  const customerId = await getSelectedCustomerId();
  if (!customerId) redirect("/select-customer");

  const orderId = Number(params.order_id);
  if (!Number.isInteger(orderId)) notFound();

  const order = get(
    `SELECT order_id, customer_id, order_datetime, order_total
     FROM orders
     WHERE order_id = ?`,
    [orderId],
  );

  if (!order || order.customer_id !== customerId) {
    notFound();
  }

  const items = all(
    `SELECT p.product_name, oi.quantity, oi.unit_price, oi.line_total
     FROM order_items oi
     JOIN products p ON p.product_id = oi.product_id
     WHERE oi.order_id = ?
     ORDER BY oi.order_item_id`,
    [orderId],
  );

  return (
    <main className="card">
      <h2>Order #{order.order_id}</h2>
      <p>
        Timestamp: {order.order_datetime} | Total: ${Number(order.order_total).toFixed(2)}
      </p>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={`${item.product_name}-${i}`}>
              <td>{item.product_name}</td>
              <td>{item.quantity}</td>
              <td>${Number(item.unit_price).toFixed(2)}</td>
              <td>${Number(item.line_total).toFixed(2)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4}>No line items found for this order.</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
