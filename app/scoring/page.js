import FlashMessage from "@/components/FlashMessage";
import { runScoringAction } from "./actions";

export default function ScoringPage({ searchParams }) {
  return (
    <main className="card">
      <h2>Run Scoring</h2>
      <p>
        This triggers <code>python jobs/run_inference.py</code>, which writes predictions into
        <code> order_predictions</code>.
      </p>
      <FlashMessage searchParams={searchParams} />
      <form action={runScoringAction}>
        <button type="submit">Run Scoring</button>
      </form>
    </main>
  );
}
