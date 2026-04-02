import { redirect } from "next/navigation";
import { getSelectedCustomerId } from "@/lib/customer";
import { createSupabaseAdminClient } from "@/lib/supabase";

export default async function DashboardPage() {
  const customerId = await getSelectedCustomerId();
  if (!customerId) redirect("/select-customer");
  const supabase = createSupabaseAdminClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("customer_id, full_name, email")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (!customer) redirect("/select-customer?status=error&message=Customer%20not%20found");

  const { data: ordersForTotals = [] } = await supabase
    .from("orders")
    .select("order_total")
    .eq("customer_id", customerId);
  const totals = {
    total_orders: ordersForTotals.length,
    total_spend: ordersForTotals.reduce((sum, o) => sum + Number(o.order_total || 0), 0),
  };

  const { data: recentOrders = [] } = await supabase
    .from("orders")
    .select("order_id, order_datetime, order_total")
    .eq("customer_id", customerId)
    .order("order_datetime", { ascending: false })
    .limit(5);

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
                <td>0</td>
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
