import { env } from "./config/env.js";
import { createDb } from "./db/index.js";
import { createApp } from "./app.js";

async function main() {
  const db = createDb();
  await db.sequelize.authenticate();

  const app = createApp(db);
  app.listen(env.appPort, () => {
    console.log(`[startup] CarVista API listening on ${env.appPublicUrl}`);
    console.log(`[startup] Health check: ${env.appPublicUrl}/health`);
    console.log(`[startup] API docs: ${env.appPublicUrl}/api-docs`);
  });
}

main().catch((error) => {
  console.error("[startup] Fatal startup error:", error);
  process.exit(1);
});
