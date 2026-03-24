const guardPromises = new Map();

export function runSchemaGuard(key, guardFn) {
  if (!guardPromises.has(key)) {
    guardPromises.set(
      key,
      Promise.resolve()
        .then(guardFn)
        .catch((error) => {
          guardPromises.delete(key);
          throw error;
        })
    );
  }

  return guardPromises.get(key);
}

export async function ensureColumn(sequelize, tableName, columnName, definition) {
  const [rows] = await sequelize.query(
    `
      SELECT COLUMN_NAME AS columnName
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :tableName
        AND COLUMN_NAME = :columnName
      LIMIT 1
    `,
    {
      replacements: { tableName, columnName },
    }
  );

  if (Array.isArray(rows) && rows.length > 0) {
    return false;
  }

  await sequelize.query(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
  );
  return true;
}
