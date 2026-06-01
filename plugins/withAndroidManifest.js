/**
 * 自定义 Expo Config Plugin
 * 向 AndroidManifest.xml 注入：
 *   1. SMS 相关权限
 *   2. SmsReceiver（BroadcastReceiver）
 *   3. PickupNotificationService（NotificationListenerService）
 *   4. PickupWidgetProvider（AppWidgetProvider）
 */
const { withAndroidManifest } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

function withPickupAndroidConfig(config) {
  return withAndroidManifest(config, (modConfig) => {
    const androidManifest = modConfig.modResults;

    // ============================================================
    // 1. 添加权限声明
    // ============================================================
    const REQUIRED_PERMISSIONS = [
      'android.permission.RECEIVE_SMS',
      'android.permission.READ_SMS',
      'android.permission.INTERNET',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
    ];

    const existingPerms = new Set(
      (androidManifest.manifest['uses-permission'] || []).map(
        (p) => p.$?.['android:name']
      ),
    );

    for (const perm of REQUIRED_PERMISSIONS) {
      if (!existingPerms.has(perm)) {
        if (!androidManifest.manifest['uses-permission']) {
          androidManifest.manifest['uses-permission'] = [];
        }
        androidManifest.manifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    }

    // ============================================================
    // 2. 声明 SmsReceiver（BroadcastReceiver）
    // ============================================================
    if (!androidManifest.manifest.application) {
      androidManifest.manifest.application = [{}];
    }
    const app = androidManifest.manifest.application[0];

    if (!app.receiver) app.receiver = [];

    // 检查是否已存在
    const hasSmsReceiver = app.receiver.some(
      (r) => r.$?.['android:name'] === 'expo.modules.smsreader.SmsReceiver',
    );

    if (!hasSmsReceiver) {
      app.receiver.push({
        $: {
          'android:name': 'expo.modules.smsreader.SmsReceiver',
          'android:exported': 'true',
          'android:permission': 'android.permission.BROADCAST_SMS',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.provider.Telephony.SMS_RECEIVED' } },
            ],
          },
        ],
      });
    }

    // ============================================================
    // 3. 声明 PickupNotificationService
    // ============================================================
    if (!app.service) app.service = [];

    const hasNotifService = app.service.some(
      (s) =>
        s.$?.['android:name'] ===
        'expo.modules.notificationreader.PickupNotificationService',
    );

    if (!hasNotifService) {
      app.service.push({
        $: {
          'android:name':
            'expo.modules.notificationreader.PickupNotificationService',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name':
                    'android.service.notification.NotificationListenerService',
                },
              },
            ],
          },
        ],
      });
    }

    // ============================================================
    // 3.5 给 MainActivity 添加接收文本分享的 intent-filter
    // ============================================================
    if (!app.activity) app.activity = [];
    const mainActivity = app.activity.find(
      (a) => a.$?.['android:name'] === '.MainActivity',
    );
    if (mainActivity) {
      if (!mainActivity['intent-filter']) mainActivity['intent-filter'] = [];
      const hasSendFilter = mainActivity['intent-filter'].some(
        (f) =>
          f.action &&
          f.action.some(
            (act) => act.$?.['android:name'] === 'android.intent.action.SEND',
          ),
      );
      if (!hasSendFilter) {
        mainActivity['intent-filter'].push({
          action: [
            { $: { 'android:name': 'android.intent.action.SEND' } },
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          ],
          data: [
            { $: { 'android:mimeType': 'text/plain' } },
          ],
        });
      }
    }

    // ============================================================
    // 4. 声明 PickupWidgetProvider（AppWidgetProvider）
    // ============================================================
    if (!app.receiver) app.receiver = [];

    const hasWidgetProvider = app.receiver.some(
      (r) =>
        r.$?.['android:name'] ===
        'expo.modules.pickupwidget.PickupWidgetProvider',
    );

    if (!hasWidgetProvider) {
      app.receiver.push({
        $: {
          'android:name': 'expo.modules.pickupwidget.PickupWidgetProvider',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name':
                    'android.appwidget.action.APPWIDGET_UPDATE',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/pickup_widget_info',
            },
          },
        ],
      });
    }

    return modConfig;
  });
}

module.exports = withPickupAndroidConfig;
