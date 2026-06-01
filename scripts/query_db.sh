#!/system/bin/sh
DB=/data/data/com.carl.pickupapp/files/SQLite/pickup.db
echo "=== Package count ==="
sqlite3 "$DB" "SELECT COUNT(*) FROM packages;"
echo "=== Latest 5 packages ==="
sqlite3 "$DB" "SELECT id, pickupCode, carrierName, currentStatus FROM packages ORDER BY createdAt DESC LIMIT 5;"
echo "=== Status breakdown ==="
sqlite3 "$DB" "SELECT currentStatus, COUNT(*) FROM packages GROUP BY currentStatus;"
