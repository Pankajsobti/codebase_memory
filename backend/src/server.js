import app from "./app.js";
import connectDB from "./config/db.js";
import env from "./config/env.js";

async function start() {
  await connectDB();

  app.listen(env.port, () => {
    console.log(`[server] Codebase Memory backend listening on port ${env.port}`);
  });
}

start().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
