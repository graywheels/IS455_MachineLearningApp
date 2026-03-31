import Link from "next/link";
import { redirect } from "next/navigation";
import FlashMessage from "@/components/FlashMessage";
import { all } from "@/lib/db";
import { getSelectedCustomerId } from "@/lib/customer";

export default async function OrdersPage({ searchParams }) {
  const customerId = await getSelectedCustomerId();
  if (!customerId) redirect("/select-customer");

  const orders = all(
    `SELECT order_id, order_datetime, 0 AS fulfilled, order_total
     FROM orders
     WHERE customer_id = ?
     ORDER BY order_datetime DESC`,
    [customerId],
  );

  return (
    <main className="card">
      <h2>Order History</h2>
      <FlashMessage searchParams={searchParams} />
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
          {orders.map((order) => (
            <tr key={order.order_id}>
              <td>
                <Link href={`/orders/${order.order_id}`}>{order.order_id}</Link>
              </td>
              <td>{order.order_datetime}</td>
              <td>{order.fulfilled}</td>
              <td>${Number(order.order_total).toFixed(2)}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={4}>No orders found for this customer.</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
