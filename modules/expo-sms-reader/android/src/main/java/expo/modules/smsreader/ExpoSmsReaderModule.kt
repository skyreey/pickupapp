package expo.modules.smsreader

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ExpoSmsReaderModule : Module() {
    private var smsReceiver: SmsReceiver? = null

    private fun logToFile(msg: String) {
        try {
            val ctx = appContext.reactContext ?: return
            val logFile = File(ctx.filesDir, "sms_reader_debug.log")
            val ts = SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.US).format(Date())
            logFile.appendText("$ts $msg\n")
        } catch (_: Exception) {}
    }

    override fun definition() = ModuleDefinition {
        Name("ExpoSmsReader")

        Events("onSmsReceived")

        // ============================================================
        // 权限
        // ============================================================

        AsyncFunction("hasPermission") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.RECEIVE_SMS
            ) == PackageManager.PERMISSION_GRANTED
        }

        // ============================================================
        // 前台实时监听（代码注册 Receiver，带回调）
        // ============================================================

        AsyncFunction("startListening") { promise: Promise ->
            val context = appContext.reactContext ?: run {
                promise.reject("NO_CONTEXT", "React context not available", null)
                return@AsyncFunction
            }

            val hasPerm = ContextCompat.checkSelfPermission(
                context, Manifest.permission.RECEIVE_SMS
            ) == PackageManager.PERMISSION_GRANTED
            if (!hasPerm) {
                promise.reject("NO_PERMISSION", "SMS 权限未授予", null)
                return@AsyncFunction
            }

            try {
                smsReceiver = SmsReceiver { sender, body, timestamp ->
                    sendEvent("onSmsReceived", mapOf(
                        "sender" to sender,
                        "body" to body,
                        "timestamp" to timestamp,
                    ))
                }
                smsReceiver?.register(context)
                promise.resolve()
            } catch (e: SecurityException) {
                promise.reject("SECURITY", "无法注册 SMS 接收器：${e.message}", e)
            } catch (e: Exception) {
                promise.reject("REGISTER_FAILED", e.message ?: "未知错误", e)
            }
        }

        AsyncFunction("stopListening") { promise: Promise ->
            val context = appContext.reactContext ?: run {
                promise.resolve()
                return@AsyncFunction
            }
            smsReceiver?.unregister(context)
            smsReceiver = null
            promise.resolve()
        }

        // ============================================================
        // 后台待处理 SMS（由 manifest-registered SmsReceiver 存储）
        // ============================================================

        AsyncFunction("getPendingSms") {
            val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
            SmsReceiver.drainPendingQueue(context)
        }

        // ============================================================
        // 扫描收件箱（读取已有短信中的取件码）
        // ============================================================

        AsyncFunction("scanSmsInbox") { since: Long ->
            val context = appContext.reactContext
            if (context == null) {
                logToFile("scanSmsInbox: reactContext is null")
                return@AsyncFunction emptyList<Map<String, Any>>()
            }

            val hasReadPerm = ContextCompat.checkSelfPermission(
                context, Manifest.permission.READ_SMS
            ) == PackageManager.PERMISSION_GRANTED
            if (!hasReadPerm) {
                logToFile("scanSmsInbox: READ_SMS permission denied")
                return@AsyncFunction emptyList<Map<String, Any>>()
            }

            logToFile("scanSmsInbox: since=$since, querying inbox...")
            val result = mutableListOf<Map<String, Any>>()
            try {
                val selection = if (since > 0) "date > ?" else null
                val selectionArgs = if (since > 0) arrayOf(since.toString()) else null
                val cursor = context.contentResolver.query(
                    Uri.parse("content://sms/inbox"),
                    arrayOf("address", "body", "date"),
                    selection, selectionArgs, "date DESC"
                )
                if (cursor == null) {
                    logToFile("scanSmsInbox: cursor is null")
                    return@AsyncFunction emptyList<Map<String, Any>>()
                }

                cursor.use {
                    val addressIdx = it.getColumnIndexOrThrow("address")
                    val bodyIdx = it.getColumnIndexOrThrow("body")
                    val dateIdx = it.getColumnIndexOrThrow("date")
                    var count = 0
                    while (it.moveToNext() && count < 500) {
                        result.add(mapOf(
                            "sender" to (it.getString(addressIdx) ?: ""),
                            "body" to (it.getString(bodyIdx) ?: ""),
                            "timestamp" to it.getLong(dateIdx),
                        ))
                        count++
                    }
                    logToFile("scanSmsInbox: got $count SMS")
                }
            } catch (e: SecurityException) {
                logToFile("scanSmsInbox: SecurityException ${e.message}")
                return@AsyncFunction emptyList<Map<String, Any>>()
            } catch (e: Exception) {
                logToFile("scanSmsInbox: Exception ${e.message}")
                return@AsyncFunction emptyList<Map<String, Any>>()
            }

            result
        }
    }
}
