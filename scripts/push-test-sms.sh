#!/system/bin/sh
# ============================================================
# 测试 SMS 插入脚本（在设备上运行）
# 注意：body 中不能有英文冒号 ":"，否则 content insert 解析失败
# 用法: adb push push-test-sms.sh /sdcard/ && adb shell sh /sdcard/push-test-sms.sh
# ============================================================

insert_sms() {
  local body="$1"
  local addr="$2"
  local date="$3"

  /system/bin/content insert \
    --uri content://sms/inbox \
    --bind address:s:"$addr" \
    --bind body:s:"$body" \
    --bind date:l:"$date" \
    --bind read:i:1 \
    --bind type:i:1 \
    --bind seen:i:1
}

NOW=$(date +%s)000

# 短信1：菜鸟驿站，带营业时间（无英文冒号）
insert_sms \
  "【菜鸟驿站】您的申通快递已到菜鸟驿站，取件码3-2-1108，地址-幸福小区东门便利店，营业时间-09：00-21：00，请尽快领取。" \
  "菜鸟驿站" \
  "$NOW"

# 短信2：丰巢快递柜（无英文冒号）
insert_sms \
  "【丰巢】凭取件码88291至丰巢柜取件，地址-科技园区A座大堂，快递单号YT7766889922，24小时内免费。" \
  "丰巢" \
  "$((NOW - 600000))"

# 短信3：极兔速递（无英文冒号）
insert_sms \
  "【极兔速递】您的包裹已到站点，取件码A-502，站点-极兔速递朝阳网点，电话13800138000，地址-朝阳区建国路88号，营业时间-08：30-20：00。" \
  "J&T" \
  "$((NOW - 1200000))"

# 短信4：韵达快递（无英文冒号）
insert_sms \
  "【韵达快递】您的包裹已由驿站代收，取件码5-3-206，地址-阳光花园西门超市，营业时间-08：00-22：00。" \
  "韵达快递" \
  "$((NOW - 86400000))"

echo "done"
