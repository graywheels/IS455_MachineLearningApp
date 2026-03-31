"use server";

import { redirect } from "next/navigation";
import { spawn } from "node:child_process";

const TIMEOUT_MS = 60_000;

function extractScoredCount(stdout) {
  const match = stdout.match(/scored\s*[:=]\s*(\d+)/i) || stdout.match(/(\d+)\s+orders?\s+scored/i);
  return match ? Number(match[1]) : null;
}

export async function runScoringAction() {
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn("python", ["jobs/run_inference.py"], { cwd: process.cwd() });
      let stdout = "";
      let stderr = "";
      let finished = false;

      const timeout = setTimeout(() => {
        if (!finished) {
          child.kill("SIGTERM");
          reject(new Error("Scoring timed out after 60 seconds"));
        }
      }, TIMEOUT_MS);

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => {
        finished = true;
        clearTimeout(timeout);
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(stderr || stdout || `Python exited with code ${code}`));
      });
    });

    const scoredCount = extractScoredCount(result.stdout);
    const ts = new Date().toISOString();
    const msg = scoredCount == null ? `Scoring completed at ${ts}` : `Scoring completed: scored=${scoredCount} at ${ts}`;
    redirect(`/warehouse/priority?status=success&message=${encodeURIComponent(msg)}`);
  } catch (error) {
    const msg = `Scoring failed: ${error.message}`;
    redirect(`/scoring?status=error&message=${encodeURIComponent(msg)}`);
  }
}
