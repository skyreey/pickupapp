#!/system/bin/sh
cat > /data/data/com.carl.pickupapp/shared_prefs/app_settings.xml << 'EOF'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="has_scanned_sms">0</string>
</map>
EOF
echo "OK"
