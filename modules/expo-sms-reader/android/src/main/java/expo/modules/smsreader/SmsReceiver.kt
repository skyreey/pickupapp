package expo.modules.smsreader

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.provider.Telephony
import android.telephony.SmsMessage
import org.json.JSONArray
import org.json.JSONObject

/**
 * SMS 广播接收器
 *
 * 两种工作模式：
 * 1. Manifest 注册（无参构造）：系统实例化，SMS 存 SharedPreferences 队列
 * 2. 代码注册（带回调）：ExpoSmsReaderModule 注册，实时通知 JS 层
 */
class SmsReceiver @JvmOverloads constructor(
    private val callback: ((sender: String, body: String, timestamp: Long) -> Unit)? = null
) : BroadcastReceiver() {

    private var registered = false

    companion object {
        private const val PREFS_NAME = "expo_sms_reader_pending"
        private const val KEY_QUEUE = "pending_sms_queue"

        /** 存储 SMS 到 SharedPreferences 队列（供后台接收时使用） */
        fun storeToPendingQueue(context: Context, sender: String, body: String, timestamp: Long) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val queueStr = prefs.getString(KEY_QUEUE, "[]") ?: "[]"
            val queue = JSONArray(queueStr)

            val item = JSONObject().apply {
                put("sender", sender)
                put("body", body)
                put("timestamp", timestamp)
            }
            queue.put(item)

            // 最多保留 50 条
            while (queue.length() > 50) {
                queue.remove(0)
            }

            prefs.edit().putString(KEY_QUEUE, queue.toString()).apply()
        }

        /** 读取并清空待处理 SMS 队列 */
        fun drainPendingQueue(context: Context): List<Map<String, Any>> {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val queueStr = prefs.getString(KEY_QUEUE, "[]") ?: "[]"
            val queue = JSONArray(queueStr)
            val result = mutableListOf<Map<String, Any>>()

            for (i in 0 until queue.length()) {
                val item = queue.getJSONObject(i)
                result.add(mapOf(
                    "sender" to item.getString("sender"),
                    "body" to item.getString("body"),
                    "timestamp" to item.getLong("timestamp"),
                ))
            }

            // 清空队列
            prefs.edit().putString(KEY_QUEUE, "[]").apply()
            return result
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        for (message in messages) {
            val sender = message.originatingAddress ?: ""
            val body = message.messageBody ?: ""
            val timestamp = message.timestampMillis

            // 优先使用实时回调（App 在前台时）
            if (callback != null) {
                callback(sender, body, timestamp)
            } else {
                // 后台模式：存入队列，等 App 回到前台时处理
                storeToPendingQueue(context, sender, body, timestamp)
            }
        }
    }

    fun register(context: Context) {
        if (registered) return
        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
        filter.priority = IntentFilter.SYSTEM_HIGH_PRIORITY

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(this, filter, Context.RECEIVER_EXPORTED)
        } else {
            context.registerReceiver(this, filter)
        }
        registered = true
    }

    fun unregister(context: Context) {
        if (!registered) return
        try {
            context.unregisterReceiver(this)
        } catch (_: Exception) { }
        registered = false
    }
}
