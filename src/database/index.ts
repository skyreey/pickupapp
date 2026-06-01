// ============================================================
// 数据库初始化 + 建表
// ============================================================
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('pickup.db');
  }
  return db;
}

export function initDatabase(): void {
  const database = getDatabase();

  // 包裹主表
  database.execSync(`
    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY NOT NULL,
      tracking_number TEXT NOT NULL DEFAULT '',
      carrier TEXT NOT NULL DEFAULT 'unknown',
      carrier_name TEXT NOT NULL DEFAULT '',
      order_source TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL DEFAULT '',
      pickup_code TEXT,
      pickup_address TEXT,
      pickup_point_name TEXT,
      pickup_point_phone TEXT,
      business_hours TEXT,
      notes TEXT,
      current_status TEXT NOT NULL DEFAULT 'pending',
      status_updated_at INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at INTEGER NOT NULL DEFAULT 0,
      picked_up_at INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL DEFAULT 0,
      pinned INTEGER NOT NULL DEFAULT 0,
      sms_raw_text TEXT,
      screenshot_paths TEXT,
      assigned_to TEXT,
      assigned_to_name TEXT,
      pushed_by TEXT,
      push_status TEXT
    );
  `);

  // Safe migration: check column existence via PRAGMA before ALTER (avoids swallowing real errors)
  const cols = database.getAllSync<{ name: string }>("PRAGMA table_info(packages)");
  const colNames = new Set(cols.map(c => c.name));
  const migrations: [string, string][] = [
    ["pickup_point_name", "TEXT"],
    ["pickup_point_phone", "TEXT"],
    ["picked_up_at", "INTEGER NOT NULL DEFAULT 0"],
    ["business_hours", "TEXT"],
    ["notes", "TEXT"],
    ["expires_at", "INTEGER NOT NULL DEFAULT 0"],
    ["pinned", "INTEGER NOT NULL DEFAULT 0"],
    ["sms_raw_text", "TEXT"],
    ["screenshot_paths", "TEXT"],
    ["assigned_to", "TEXT"],
    ["assigned_to_name", "TEXT"],
    ["pushed_by", "TEXT"],
    ["push_status", "TEXT"],
  ];
  for (const [col, def] of migrations) {
    if (!colNames.has(col)) {
      database.execSync(`ALTER TABLE packages ADD COLUMN ${col} ${def};`);
    }
  }

  // 物流轨迹表
  database.execSync(`
    CREATE TABLE IF NOT EXISTS tracking_events (
      id TEXT PRIMARY KEY NOT NULL,
      package_id TEXT NOT NULL,
      time INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      raw_description TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );
  `);

  // 索引：按状态查询（首页筛选）
  database.execSync(`
    CREATE INDEX IF NOT EXISTS idx_packages_status
    ON packages(current_status);
  `);

  // 索引：按创建时间倒序（首页列表）
  database.execSync(`
    CREATE INDEX IF NOT EXISTS idx_packages_created
    ON packages(created_at DESC);
  `);

  // 索引：按快递单号查询（匹配去重）
  database.execSync(`
    CREATE INDEX IF NOT EXISTS idx_packages_tracking
    ON packages(tracking_number);
  `);

  // 索引：按取件码查询（匹配去重）
  database.execSync(`
    CREATE INDEX IF NOT EXISTS idx_packages_pickup_code
    ON packages(pickup_code);
  `);

  // 索引：轨迹关联查询
  database.execSync(`
    CREATE INDEX IF NOT EXISTS idx_events_package
    ON tracking_events(package_id, time DESC);
  `);
}
