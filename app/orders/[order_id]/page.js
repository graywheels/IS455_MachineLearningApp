import { notFound, redirect } from "next/navigation";
import { getSelectedCustomerId } from "@/lib/customer";
import { createSupabaseAdminClient } from "@/lib/supabase";

export default async function OrderDetailPage({ params }) {
  const customerId = await getSelectedCustomerId();
  if (!customerId) redirect("/select-customer");
  const supabase = createSupabaseAdminClient();

  const orderId = Number(params.order_id);
  if (!Number.isInteger(orderId)) notFound();

  const { data: order } = await supabase
    .from("orders")
    .select("order_id, customer_id, order_datetime, order_total")
    .eq("order_id", orderId)
    .maybeSingle();

  if (!order || order.customer_id !== customerId) {
    notFound();
  }

  const { data: orderItems = [] } = await supabase
    .from("order_items")
    .select("product_id, quantity, unit_price, line_total, order_item_id")
    .eq("order_id", orderId)
    .order("order_item_id", { ascending: true });
  const productIds = [...new Set(orderItems.map((i) => i.product_id))];
  const { data: products = [] } = productIds.length
    ? await supabase.from("products").select("product_id, product_name").in("product_id", productIds)
    : { data: [] };
  const nameByProductId = new Map(products.map((p) => [p.product_id, p.product_name]));
  const items = orderItems.map((item) => ({
    ...item,
    product_name: nameByProductId.get(item.product_id) || `Product ${item.product_id}`,
  }));

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
