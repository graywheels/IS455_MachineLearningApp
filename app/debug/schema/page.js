import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function DebugSchemaPage() {
  const supabase = createSupabaseAdminClient();
  const expectedTables = [
    { name: "customers", sampleColumns: ["customer_id", "full_name", "email"] },
    { name: "orders", sampleColumns: ["order_id", "customer_id", "order_datetime", "order_total"] },
    { name: "order_items", sampleColumns: ["order_item_id", "order_id", "product_id", "quantity"] },
    { name: "products", sampleColumns: ["product_id", "product_name", "price"] },
    {
      name: "order_predictions",
      sampleColumns: ["order_id", "late_delivery_probability", "predicted_late_delivery"],
    },
  ];
  const results = await Promise.all(
    expectedTables.map(async (table) => {
      const { error } = await supabase.from(table.name).select("*", { head: true, count: "exact" }).limit(1);
      return { ...table, exists: !error, error: error?.message || null };
    }),
  );

  return (
    <main className="card">
      <h2>Debug Schema</h2>
      <p className="muted-text">Developer-only Supabase connectivity and expected-table check.</p>
      <table>
        <thead>
          <tr>
            <th>Table</th>
            <th>Status</th>
            <th>Expected Columns</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.exists ? "Found" : "Missing"}</td>
              <td>{row.sampleColumns.join(", ")}</td>
              <td>{row.error || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
