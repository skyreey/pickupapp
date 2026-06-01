package expo.modules.notificationreader

import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import android.service.notification.StatusBarNotification
import android.os.Bundle

class ExpoNotificationReaderModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoNotificationReader")

        Events("onNotificationPosted")

        // 引导用户开启通知使用权（跳转系统设置）
        AsyncFunction("requestPermission") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            try {
                val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                true
            } catch (e: Exception) {
                false
            }
        }

        // 检查通知监听权限是否已开启
        AsyncFunction("hasPermission") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            val flat = Settings.Secure.getString(
                context.contentResolver,
                "enabled_notification_listeners"
            )
            flat?.contains(context.packageName) == true
        }

        // 通知监听由系统 NotificationListenerService 自动处理
        // startListening 设置回调桥接：Native Service → JS Event
        AsyncFunction("startListening") {
            PickupNotificationService.onNotificationCallback =
                { packageName, title, text, timestamp ->
                    sendEvent("onNotificationPosted", mapOf(
                        "packageName" to packageName,
                        "title" to title,
                        "text" to text,
                        "timestamp" to timestamp,
                    ))
                }
        }

        AsyncFunction("stopListening") {
            PickupNotificationService.onNotificationCallback = null
        }

        // 读取状态栏中当前所有活跃通知（打开 App 时抓取快照）
        AsyncFunction("getActiveNotifications") {
            val service = PickupNotificationService.instance
            if (service == null) {
                return@AsyncFunction emptyList<Map<String, Any>>()
            }

            val activeNotifs: Array<StatusBarNotification> = try {
                service.activeNotifications ?: emptyArray()
            } catch (e: SecurityException) {
                return@AsyncFunction emptyList<Map<String, Any>>()
            }

            val result = mutableListOf<Map<String, Any>>()
            for (sbn in activeNotifs) {
                val pkg = sbn.packageName
                if (pkg !in PickupNotificationService.TARGET_PACKAGES) continue
                // 检查用户是否关闭了该 App 的监控
                if (!isAppMonitored(pkg)) continue

                val extras: Bundle = sbn.notification.extras
                val title = extras.getCharSequence(
                    android.app.Notification.EXTRA_TITLE
                )?.toString() ?: ""
                val text = extras.getCharSequence(
                    android.app.Notification.EXTRA_TEXT
                )?.toString() ?: ""

                if (title.isNotBlank() || text.isNotBlank()) {
                    result.add(mapOf(
                        "packageName" to pkg,
                        "title" to title,
                        "text" to text,
                        "timestamp" to sbn.postTime,
                    ))
                }
            }

            result
        }

        // ============================================================
        // 分 App 监控开关（SharedPreferences 存储，Service 直接读取）
        // ============================================================

        // 设置某个 App 是否被监控
        AsyncFunction("setAppMonitored") { packageName: String, enabled: Boolean ->
            val context = appContext.reactContext ?: return@AsyncFunction
            val prefs = context.getSharedPreferences("monitored_apps", Context.MODE_PRIVATE)
            prefs.edit().putBoolean(packageName, enabled).apply()
        }

        // 获取某个 App 是否被监控（默认 true = 全部监控）
        AsyncFunction("isAppMonitored") { packageName: String ->
            val context = appContext.reactContext ?: return@AsyncFunction true
            val prefs = context.getSharedPreferences("monitored_apps", Context.MODE_PRIVATE)
            prefs.getBoolean(packageName, true)
        }

        // 获取所有被监控 App 的状态 Map
        AsyncFunction("getAllMonitoredStatus") {
            val context = appContext.reactContext ?: return@AsyncFunction emptyMap<String, Boolean>()
            val prefs = context.getSharedPreferences("monitored_apps", Context.MODE_PRIVATE)
            val result = mutableMapOf<String, Boolean>()
            // 返回所有已知 App 的监控状态
            PickupNotificationService.TARGET_PACKAGES.forEach { pkg ->
                result[pkg] = prefs.getBoolean(pkg, true)
            }
            result
        }

        // 一键全开/全关
        AsyncFunction("setAllMonitored") { enabled: Boolean ->
            val context = appContext.reactContext ?: return@AsyncFunction
            val prefs = context.getSharedPreferences("monitored_apps", Context.MODE_PRIVATE)
            prefs.edit().apply {
                PickupNotificationService.TARGET_PACKAGES.forEach { pkg ->
                    putBoolean(pkg, enabled)
                }
                apply()
            }
        }

        // ============================================================
        // 通用设置存储（SharedPreferences key-value）
        // ============================================================

        AsyncFunction("getSetting") { key: String ->
            val context = appContext.reactContext ?: return@AsyncFunction null
            val prefs = context.getSharedPreferences("app_settings", Context.MODE_PRIVATE)
            // 返回字符串，JS 层自行解析
            prefs.getString(key, null)
        }

        AsyncFunction("setSetting") { key: String, value: String ->
            val context = appContext.reactContext ?: return@AsyncFunction
            val prefs = context.getSharedPreferences("app_settings", Context.MODE_PRIVATE)
            prefs.edit().putString(key, value).apply()
        }
    }

    /** 检查某个 App 是否被用户允许监控 */
    private fun isAppMonitored(packageName: String): Boolean {
        val context = appContext.reactContext ?: return true
        val prefs = context.getSharedPreferences("monitored_apps", Context.MODE_PRIVATE)
        return prefs.getBoolean(packageName, true)
    }
}
