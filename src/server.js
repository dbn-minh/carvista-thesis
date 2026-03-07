import { env } from "./config/env.js";
import { createDb } from "./db/index.js";
import { createApp } from "./app.js";

async function main() {
  const db = createDb();
  await db.sequelize.authenticate();

  const app = createApp(db);
  app.listen(env.appPort, () => {
    console.log(`✅ API running: http://localhost:${env.appPort}`);
    console.log(`✅ Swagger:     http://localhost:${env.appPort}/api-docs`);
  });
}

main().catch((e) => {
  console.error("❌ Startup error:", e);
  process.exit(1);
});