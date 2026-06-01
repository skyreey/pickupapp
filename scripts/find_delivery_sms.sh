#!/system/bin/sh
echo "=== Latest 30 SMS containing delivery keywords ==="
content query --uri content://sms/inbox --projection address:body:date --sort "date DESC" | grep -iE "快递|取件|驿站|提货|包裹|取货|丰巢|菜鸟|兔喜|韵达|申通|圆通|中通|妈妈|极兔|顺丰|邮政|德邦|百世|京东" | head -15
