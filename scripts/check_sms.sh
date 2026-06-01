#!/system/bin/sh
echo "=== Latest 15 SMS ==="
content query --uri content://sms/inbox --projection _id:address:body --sort "date DESC" | head -15
echo ""
echo "=== Check injected ==="
content query --uri content://sms/inbox --projection _id:address:body --where "address LIKE '106555%' OR address LIKE '106988%' OR address LIKE '106511%'"
