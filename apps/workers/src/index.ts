import { closeDb } from "@handsup/db";
import { startAggregator, stopAggregator } from "./aggregator";
import { startDemoHost, stopDemoHost } from "./demo";
import { initSentry } from "./sentry";
import { startInsights, stopInsights } from "./insights";
import { startJanitor } from "./janitor";
import { startNlp, stopNlp } from "./nlp";
import { startReports, stopReports } from "./report";

// One process runs every worker. On a bigger deployment, run several copies:
// the stream consumer groups and Redis locks keep them from doing the same work twice.
await initSentry();
await startAggregator();
await startNlp();
startInsights();
startReports();
await startDemoHost();
startJanitor();

async function shutdown() {
  console.log("[workers] shutting down");
  await Promise.allSettled([stopAggregator(), stopNlp(), stopInsights(), stopReports(), stopDemoHost(), closeDb()]);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
