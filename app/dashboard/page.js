import { redirect } from "next/navigation";
import { all, get } from "@/lib/db";
import { getSelectedCustomerId } from "@/lib/customer";

export default async function DashboardPage() {
  const customerId = await getSelectedCustomerId();
  if (!customerId) redirect("/select-customer");

  const customer = get(
    `SELECT customer_id, full_name, email
     FROM customers
     WHERE customer_id = ?`,
    [customerId],
  );
  if (!customer) redirect("/select-customer?status=error&message=Customer%20not%20found");

  const totals = get(
    `SELECT
       COUNT(*) AS total_orders,
       COALESCE(SUM(order_total), 0) AS total_spend
     FROM orders
     WHERE customer_id = ?`,
    [customerId],
  );

  const recentOrders = all(
    `SELECT order_id, order_datetime, 0 AS fulfilled, order_total
     FROM orders
     WHERE customer_id = ?
     ORDER BY order_datetime DESC
     LIMIT 5`,
    [customerId],
  );

  return (
    <main>
      <section className="card">
        <h2>Customer Dashboard</h2>
        <p>
          <strong>{customer.full_name}</strong> ({customer.email})
        </p>
        <p>Total orders: {totals.total_orders}</p>
        <p>Total spend: ${Number(totals.total_spend).toFixed(2)}</p>
      </section>

      <section className="card">
        <h3>Recent Orders</h3>
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Order Timestamp</th>
              <th>Fulfilled</th>
              <th>Total Value</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((order) => (
              <tr key={order.order_id}>
                <td>{order.order_id}</td>
                <td>{order.order_datetime}</td>
                <td>{order.fulfilled}</td>
                <td>${Number(order.order_total).toFixed(2)}</td>
              </tr>
            ))}
            {recentOrders.length === 0 && (
              <tr>
                <td colSpan={4}>No orders yet for this customer.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
