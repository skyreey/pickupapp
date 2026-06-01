package expo.modules.pickupwidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PickupWidgetModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("ExpoPickupWidget")

        // ============================================================
        // 写入挂件数据到 SharedPreferences 并触发更新
        // ============================================================
        AsyncFunction("updateWidgetData") { jsonData: String ->
            val context = appContext.reactContext ?: return@AsyncFunction
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_WIDGET_DATA, jsonData).apply()

            // 通知 AppWidgetManager 刷新所有挂件实例
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, PickupWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)

            for (appWidgetId in appWidgetIds) {
                PickupWidgetProvider.updateAppWidget(context, appWidgetManager, appWidgetId)
            }
        }

        // ============================================================
        // 读取当前挂件数据（调试用）
        // ============================================================
        AsyncFunction("getWidgetData") {
            val context = appContext.reactContext ?: return@AsyncFunction ""
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.getString(KEY_WIDGET_DATA, "") ?: ""
        }
    }

    companion object {
        const val PREFS_NAME = "pickup_widget_data"
        const val KEY_WIDGET_DATA = "widget_packages_json"
    }
}
