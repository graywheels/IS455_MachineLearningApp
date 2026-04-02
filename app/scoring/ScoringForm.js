"use client";

import { useState } from "react";
import { runScoringAction } from "./actions";

/**
 * Client wrapper around the Run Scoring server action.
 * Disables the button while the request is in-flight to prevent concurrent
 * scoring runs from the same browser session.
 */
export default function ScoringForm() {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      await runScoringAction();
    } catch {
      // Server action calls redirect() on both success and error paths.
      // A thrown NEXT_REDIRECT is handled by the framework; other unexpected
      // errors reset the button so the user can retry.
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Running inference…" : "Run Scoring"}
      </button>
      {pending && (
        <p className="muted-text" style={{ marginTop: "0.5rem" }}>
          ML inference running — scoring all orders. This may take a few seconds…
        </p>
      )}
    </form>
  );
}
