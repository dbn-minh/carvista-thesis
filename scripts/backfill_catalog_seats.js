import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const CSV_PATH = path.resolve(process.cwd(), "data", "enriched_selected_50_models.csv");

const SPECIAL_MODEL_SEAT_RULES = new Map([
  ["Chevrolet|Traverse", 8],
  ["Dodge|Grand Caravan", 7],
  ["Ford|Explorer", 7],
  ["Ford|F-150", 6],
  ["GMC|Acadia", 7],
  ["Honda|Odyssey", 8],
  ["Kia|Sorento", 5],
  ["Ram|1500", 6],
  ["Toyota|Tacoma", 5],
]);

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    skipCsv: argv.includes("--skip-csv"),
    skipDb: argv.includes("--skip-db"),
  };
}

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      field = "";

      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += character;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((value) => value !== "")) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return { headers: [], records: [] };
  }

  const headers = rows[0];
  const records = rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, headerIndex) => {
      record[header] = values[headerIndex] ?? "";
    });
    return record;
  });

  return { headers, records };
}

function stringifyCsv(headers, records) {
  const escape = (value) => {
    const raw = value == null ? "" : String(value);
    if (/[",\r\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const lines = [
    headers.map(escape).join(","),
    ...records.map((record) => headers.map((header) => escape(record[header] ?? "")).join(",")),
  ];

  return `${lines.join("\r\n")}\r\n`;
}

function buildNaturalKey(row) {
  return [row.make_name, row.model_name, row.model_year, row.trim_name].join("|");
}

function buildModelKey(row) {
  return [row.make_name, row.model_name].join("|");
}

function toNumber(value) {
  if (value == null) {
    return Number.NaN;
  }
  const normalized = String(value).trim();
  if (!normalized) {
    return Number.NaN;
  }
  return Number(normalized);
}

function resolveSeats(row) {
  const modelKey = buildModelKey(row);
  const year = toNumber(row.model_year);
  const doors = toNumber(row.doors);
  const bodyRefined = String(row.body_class_refined || "");
  const engine = String(row.engine || "");
  const trim = String(row.trim_name || "");

  if (modelKey === "BMW|3 Series") {
    if (bodyRefined.includes("Convertible") || doors === 2) {
      return 4;
    }
    return 5;
  }

  if (modelKey === "Chevrolet|Silverado 1500") {
    if (doors === 2) {
      return 3;
    }
    return 6;
  }

  if (modelKey === "Chevrolet|Volt") {
    return year >= 2013 ? 5 : 4;
  }

  if (modelKey === "Toyota|Highlander") {
    if (year <= 2003 && engine.startsWith("2.4L")) {
      return 5;
    }
    return 7;
  }

  if (modelKey === "Toyota|Sienna") {
    return trim.includes("8-Passenger") ? 8 : 7;
  }

  if (SPECIAL_MODEL_SEAT_RULES.has(modelKey)) {
    return SPECIAL_MODEL_SEAT_RULES.get(modelKey);
  }

  return 5;
}

function buildUpdatePlan(records) {
  return records.map((record) => {
    const desiredSeats = resolveSeats(record);
    const currentSeats = toNumber(record.seats);
    const changed = Number.isNaN(currentSeats) || currentSeats !== desiredSeats;

    return {
      row: record,
      key: buildNaturalKey(record),
      desiredSeats,
      currentSeats: Number.isNaN(currentSeats) ? null : currentSeats,
      changed,
    };
  });
}

function getDbConfig() {
  const rawUrl =
    process.env.DATABASE_URL ||
    process.env.MYSQL_URL ||
    process.env.MYSQL_PUBLIC_URL ||
    process.env.RAILWAY_DATABASE_URL ||
    "";

  let urlConfig = {};
  if (rawUrl) {
    const parsed = new URL(rawUrl);
    urlConfig = {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : undefined,
      user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      database: parsed.pathname ? parsed.pathname.replace(/^\//, "") : undefined,
    };
  }

  return {
    host: process.env.DB_HOST || urlConfig.host || "localhost",
    port: Number(process.env.DB_PORT || urlConfig.port || 3308),
    user: process.env.DB_USER || urlConfig.user || "user",
    password: process.env.DB_PASSWORD || urlConfig.password || "password",
    database: process.env.DB_NAME || urlConfig.database || "carvista",
  };
}

async function syncCsv(headers, records, plan, dryRun) {
  const changedRows = plan.filter((item) => item.changed);
  if (dryRun || changedRows.length === 0) {
    return { updated: changedRows.length };
  }

  changedRows.forEach((item) => {
    item.row.seats = String(item.desiredSeats);
  });

  await fs.writeFile(CSV_PATH, stringifyCsv(headers, records), "utf8");
  return { updated: changedRows.length };
}

async function syncDatabase(plan, dryRun) {
  let connection;
  const summary = {
    matched: 0,
    updated: 0,
    alreadyCorrect: 0,
    unmatched: [],
  };

  try {
    connection = await mysql.createConnection(getDbConfig());
    if (!dryRun) {
      await connection.beginTransaction();
    }

    for (const item of plan) {
      const [rows] = await connection.execute(
        `
          SELECT cv.variant_id, cv.seats
          FROM car_variants cv
          JOIN car_models cm ON cm.model_id = cv.model_id
          JOIN car_makes mk ON mk.make_id = cm.make_id
          WHERE mk.name = ?
            AND cm.name = ?
            AND cv.model_year = ?
            AND cv.trim_name = ?
        `,
        [item.row.make_name, item.row.model_name, Number(item.row.model_year), item.row.trim_name],
      );

      if (rows.length === 0) {
        summary.unmatched.push(item.key);
        continue;
      }

      const currentSeats = rows[0].seats == null ? null : Number(rows[0].seats);
      summary.matched += 1;

      if (currentSeats === item.desiredSeats) {
        summary.alreadyCorrect += 1;
        continue;
      }

      if (!dryRun) {
        await connection.execute("UPDATE car_variants SET seats = ? WHERE variant_id = ?", [
          item.desiredSeats,
          rows[0].variant_id,
        ]);
      }
      summary.updated += 1;
    }

    if (!dryRun) {
      await connection.commit();
    }
  } catch (error) {
    if (connection && !dryRun) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }

  return summary;
}

async function main() {
  const { dryRun, skipCsv, skipDb } = parseArgs(process.argv.slice(2));
  const csvText = await fs.readFile(CSV_PATH, "utf8");
  const { headers, records } = parseCsv(csvText);
  const plan = buildUpdatePlan(records);
  const changedRows = plan.filter((item) => item.changed);

  if (!skipCsv) {
    const csvResult = await syncCsv(headers, records, plan, dryRun);
    console.log(`[seats] csv rows ${dryRun ? "planned" : "updated"}: ${csvResult.updated}`);
  } else {
    console.log("[seats] csv sync skipped");
  }

  if (!skipDb) {
    try {
      const dbResult = await syncDatabase(plan, dryRun);
      console.log(`[seats] db matched rows: ${dbResult.matched}`);
      console.log(`[seats] db rows ${dryRun ? "planned" : "updated"}: ${dbResult.updated}`);
      console.log(`[seats] db rows already correct: ${dbResult.alreadyCorrect}`);
      if (dbResult.unmatched.length > 0) {
        console.log(`[seats] db unmatched natural keys: ${dbResult.unmatched.length}`);
        dbResult.unmatched.slice(0, 10).forEach((key) => console.log(`  - ${key}`));
      }
    } catch (error) {
      console.warn(`[seats] db sync skipped: ${error.message}`);
    }
  } else {
    console.log("[seats] db sync skipped");
  }

  console.log(`[seats] total rows needing correction: ${changedRows.length}`);
}

await main();
