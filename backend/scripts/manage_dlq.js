import dotenv from "dotenv";
dotenv.config();

import {
  getDLQDepth,
  peekDLQMessages,
  replayDLQMessages,
  purgeDLQ,
} from "../src/services/dlqManager.service.js";

async function main() {
  const action = process.argv[2] || "inspect";

  console.log(`=== SanitiGo DLQ Management Utility [action: ${action}] ===`);

  if (action === "inspect" || action === "count") {
    const depth = await getDLQDepth();
    console.log(`Current DLQ Depth: ${depth} message(s)`);

    if (depth > 0 && action === "inspect") {
      console.log("\n--- Peeking at up to 5 messages ---");
      const messages = await peekDLQMessages(5);
      console.log(JSON.stringify(messages, null, 2));
    }
  } else if (action === "replay") {
    const limit = Number(process.argv[3]) || 50;
    console.log(`Executing controlled replay of up to ${limit} message(s)...`);
    const result = await replayDLQMessages(limit);
    console.log("Replay Result:", result);
  } else if (action === "purge") {
    console.log("Purging all messages from DLQ...");
    const count = await purgeDLQ();
    console.log(`Purged ${count} message(s).`);
  } else {
    console.log("Unknown action. Available actions: inspect, replay, count, purge");
  }
}

main().catch((err) => {
  console.error("DLQ Manager script error:", err);
  process.exit(1);
});
