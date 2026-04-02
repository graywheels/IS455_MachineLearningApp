import FlashMessage from "@/components/FlashMessage";
import ScoringForm from "./ScoringForm";

export default function ScoringPage({ searchParams }) {
  return (
    <main className="card">
      <h2>Run Scoring</h2>
      <p>
        Triggers ML fraud inference against all orders and writes{" "}
        <code>fraud_probability</code> + <code>predicted_fraud</code> into{" "}
        <code>order_predictions</code> in Supabase.
      </p>
      <p className="muted-text" style={{ fontSize: "0.85rem" }}>
        On local dev the Python inference job (<code>jobs/run_inference.py</code>) is also
        attempted and writes to <code>shop.db</code>. On Vercel, JS inference runs instead.
      </p>
      <FlashMessage searchParams={searchParams} />
      <ScoringForm />
    </main>
  );
}
