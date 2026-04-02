import FlashMessage from "@/components/FlashMessage";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { selectCustomerAction } from "./actions";

export default async function SelectCustomerPage({ searchParams }) {
  const supabase = createSupabaseAdminClient();
  const { data: customers = [] } = await supabase
    .from("customers")
    .select("customer_id, full_name, email")
    .order("full_name", { ascending: true })
    .limit(1000);

  return (
    <main className="card">
      <h2>Select Customer</h2>
      <p className="muted-text">Choose a customer to act as for app testing.</p>
      <FlashMessage searchParams={searchParams} />

      {customers.length === 0 ? (
        <p>No customers found in `customers` table.</p>
      ) : (
        <form action={selectCustomerAction}>
          <label htmlFor="customer_id">Customer</label>
          <br />
          <select id="customer_id" name="customer_id" required defaultValue="">
            <option value="" disabled>
              Select a customer...
            </option>
            {customers.map((c) => (
              <option key={c.customer_id} value={c.customer_id}>
                {c.full_name} ({c.email})
              </option>
            ))}
          </select>
          <br />
          <button type="submit">Use this customer</button>
        </form>
      )}
    </main>
  );
}
