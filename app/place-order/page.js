import { redirect } from "next/navigation";
import FlashMessage from "@/components/FlashMessage";
import { getSelectedCustomerId } from "@/lib/customer";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { placeOrderAction } from "./actions";

export default async function PlaceOrderPage({ searchParams }) {
  const customerId = await getSelectedCustomerId();
  if (!customerId) redirect("/select-customer");
  const supabase = createSupabaseAdminClient();

  const { data: products = [] } = await supabase
    .from("products")
    .select("product_id, product_name, price")
    .eq("is_active", 1)
    .order("product_name", { ascending: true });

  return (
    <main className="card">
      <h2>Place Order</h2>
      <p className="muted-text">Add at least one line item with quantity {">"} 0.</p>
      <FlashMessage searchParams={searchParams} />

      {products.length === 0 ? (
        <p>No active products found.</p>
      ) : (
        <form action={placeOrderAction}>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4].map((idx) => (
                <tr key={idx}>
                  <td>
                    <select name="product_id" defaultValue="">
                      <option value="">-- optional row --</option>
                      {products.map((product) => (
                        <option key={product.product_id} value={product.product_id}>
                          {product.product_name} (${Number(product.price).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input type="number" name="quantity" min="1" step="1" defaultValue="" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="submit">Place Order</button>
        </form>
      )}
    </main>
  );
}
