package expo.modules.pickupforeground

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class PickupForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "pickup_foreground"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "ACTION_START"
        const val ACTION_STOP = "ACTION_STOP"

        var pendingCount: Int = 0
        private var notificationManager: NotificationManager? = null

        fun updateNotification(context: Context) {
            val nm = notificationManager
                ?: context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager = nm
            nm.notify(NOTIFICATION_ID, buildNotification(context, pendingCount))
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                createNotificationChannel()
                startForeground(NOTIFICATION_ID, buildNotification(this, pendingCount))
                return START_STICKY
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "取件提醒",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "显示待取包裹数量"
                setShowBadge(false)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
            notificationManager = nm
        }
    }
}

private fun buildNotification(context: Context, count: Int): Notification {
    val tapIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val pendingIntent = PendingIntent.getActivity(
        context,
        0,
        tapIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(context, PickupForegroundService.CHANNEL_ID)
        .setContentTitle("取件通 · 运行中")
        .setContentText(if (count > 0) "当前有 $count 个包裹待取" else "暂无待取包裹")
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setContentIntent(pendingIntent)
        .build()
}
