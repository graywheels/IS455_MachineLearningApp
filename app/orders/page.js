import Link from "next/link";
import { redirect } from "next/navigation";
import FlashMessage from "@/components/FlashMessage";
import { getSelectedCustomerId } from "@/lib/customer";
import { createSupabaseAdminClient } from "@/lib/supabase";

export default async function OrdersPage({ searchParams }) {
  const customerId = await getSelectedCustomerId();
  if (!customerId) redirect("/select-customer");
  const supabase = createSupabaseAdminClient();

  const { data: orders = [] } = await supabase
    .from("orders")
    .select("order_id, order_datetime, order_total")
    .eq("customer_id", customerId)
    .order("order_datetime", { ascending: false });

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
              <td>0</td>
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
