package expo.modules.notificationreader

import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * 通知监听服务
 *
 * 需要用户在系统设置中开启"通知使用权"
 * 设置路径：设置 → 无障碍/特殊权限 → 通知使用权 → 取件通
 *
 * 监听所有 App 发出的通知，过滤购物/物流相关通知
 * 将通知内容通过 EventEmitter 发送到 JS 层
 */
class PickupNotificationService : NotificationListenerService() {

    companion object {
        private const val TAG = "PickupNotifService"
        private const val PREFS_NAME = "monitored_apps"

        /** 当前服务实例（用于跨线程访问 activeNotifications） */
        var instance: PickupNotificationService? = null
            private set

        /** 购物/物流 App 包名列表 */
        val TARGET_PACKAGES = setOf(
            "com.taobao.taobao",           // 淘宝
            "com.jingdong.app.mall",       // 京东
            "com.xunmeng.pinduoduo",       // 拼多多
            "com.ss.android.ugc.aweme",    // 抖音
            "com.alibaba.android.rimet",   // 钉钉（淘宝物流通知）
            "com.cainiao.wireless",        // 菜鸟
            "com.sankuai.meituan",         // 美团
            "com.taobao.idlefish",         // 闲鱼
            "com.alibaba.wireless",        // 1688
            "com.xiaomi.shop",             // 小米商城
            "com.xingin.xhs",              // 小红书
            "com.kuaishou.nebula",         // 快手
            "com.vipshop",                 // 唯品会
            "com.suning.mobile.ebuy",      // 苏宁
            "com.tencent.mm",              // 微信（Pro激活支付检测）
            "com.eg.android.AlipayGphone", // 支付宝（Pro激活支付检测）
        )

        /** 支付App（始终监听，不受监控开关控制） */
        val PAYMENT_PACKAGES = setOf(
            "com.tencent.mm",
            "com.eg.android.AlipayGphone",
        )

        /** JS 层回调（由 Expo Module 设置） */
        var onNotificationCallback: ((String, String, String, Long) -> Unit)? = null
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        super.onNotificationPosted(sbn)

        val packageName = sbn.packageName

        // 仅处理购物相关 App 的通知
        if (packageName !in TARGET_PACKAGES) return

        // 支付App始终监听，购物App需检查监控开关
        if (packageName !in PAYMENT_PACKAGES && !isAppMonitored(packageName)) return

        val notification = sbn.notification
        val extras = notification.extras

        val title = extras.getCharSequence(
            android.app.Notification.EXTRA_TITLE
        )?.toString() ?: ""

        val text = extras.getCharSequence(
            android.app.Notification.EXTRA_TEXT
        )?.toString() ?: ""

        val timestamp = sbn.postTime

        if (title.isNotBlank() || text.isNotBlank()) {
            Log.d(TAG, "收到通知: $packageName - $title")

            onNotificationCallback?.invoke(packageName, title, text, timestamp)
        }
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        instance = this
        Log.d(TAG, "通知监听服务已连接")
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.d(TAG, "通知监听服务已断开")
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    /** 检查某个 App 是否被用户允许监控（默认 true） */
    private fun isAppMonitored(packageName: String): Boolean {
        return try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.getBoolean(packageName, true)
        } catch (e: Exception) {
            true // 异常时默认允许
        }
    }
}
