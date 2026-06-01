#!/system/bin/sh
# Reset has_scanned_sms flag via run-as
cat > /data/data/com.carl.pickupapp/shared_prefs/app_settings.xml << 'XMLEOF'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="has_scanned_sms">0</string>
</map>
XMLEOF
echo "Reset done"
