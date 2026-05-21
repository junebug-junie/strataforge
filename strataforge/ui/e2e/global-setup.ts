/** Wait for Strata API before UI e2e (docker cold start). */
export default async function globalSetup() {
  const base = process.env.STRATA_API_URL ?? "http://127.0.0.1:8787";
  const paths = ["/health", "/api/health"];
  for (let i = 0; i < 40; i++) {
    for (const path of paths) {
      try {
        const res = await fetch(`${base}${path}`);
        if (res.ok) return;
      } catch {
        /* retry */
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`API not healthy at ${base}`);
}
