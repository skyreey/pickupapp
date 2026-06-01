package expo.modules.pickupforeground

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoPickupForegroundModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoPickupForeground")

        AsyncFunction("startForeground") { count: Int ->
            val context = appContext.reactContext ?: return@AsyncFunction
            PickupForegroundService.pendingCount = count
            val intent = Intent(context, PickupForegroundService::class.java)
            intent.action = PickupForegroundService.ACTION_START
            context.startForegroundService(intent)
        }

        AsyncFunction("updatePendingCount") { count: Int ->
            val context = appContext.reactContext ?: return@AsyncFunction
            PickupForegroundService.pendingCount = count
            PickupForegroundService.updateNotification(context)
        }

        AsyncFunction("stopForeground") {
            val context = appContext.reactContext ?: return@AsyncFunction null
            val intent = Intent(context, PickupForegroundService::class.java)
            intent.action = PickupForegroundService.ACTION_STOP
            context.startService(intent)
            null
        }
    }
}
