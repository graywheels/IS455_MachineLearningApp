import FlashMessage from "@/components/FlashMessage";
import { runScoringAction } from "./actions";

export default function ScoringPage({ searchParams }) {
  return (
    <main className="card">
      <h2>Run Scoring</h2>
      <p>
        This triggers server-side inference and writes predictions into
        <code> order_predictions</code> in Supabase.
      </p>
      <FlashMessage searchParams={searchParams} />
      <form action={runScoringAction}>
        <button type="submit">Run Scoring</button>
      </form>
    </main>
  );
}
