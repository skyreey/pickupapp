package expo.modules.pickupwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject

/**
 * 桌面挂件 AppWidgetProvider
 *
 * 从 SharedPreferences 读取包裹数据（由 PickupWidgetModule 写入），
 * 用 RemoteViews 渲染到挂件布局。
 */
class PickupWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {

        internal fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_layout)

            // ----- 点击挂件打开 App -----
            val launchIntent = context.packageManager
                .getLaunchIntentForPackage(context.packageName)
                ?.apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }

            val pendingIntent = PendingIntent.getActivity(
                context, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            // ----- 读取 SharedPreferences 中的数据 -----
            val prefs = context.getSharedPreferences(
                PickupWidgetModule.PREFS_NAME, Context.MODE_PRIVATE
            )
            val jsonData = prefs.getString(PickupWidgetModule.KEY_WIDGET_DATA, null)

            if (jsonData.isNullOrBlank()) {
                showEmptyState(views)
            } else {
                try {
                    val data = JSONObject(jsonData)
                    val pendingCount = data.optInt("pendingCount", 0)
                    val packages = data.optJSONArray("packages") ?: JSONArray()

                    if (pendingCount == 0 || packages.length() == 0) {
                        showEmptyState(views)
                    } else {
                        showPackageData(views, pendingCount, packages, context)
                    }
                } catch (e: Exception) {
                    showEmptyState(views)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun showEmptyState(views: RemoteViews) {
            views.setTextViewText(R.id.widget_badge, "0")
            views.setViewVisibility(R.id.widget_badge, View.VISIBLE)
            views.setViewVisibility(R.id.widget_package_list, View.GONE)
            views.setViewVisibility(R.id.widget_empty_state, View.VISIBLE)
        }

        private fun showPackageData(
            views: RemoteViews,
            pendingCount: Int,
            packages: JSONArray,
            context: Context
        ) {
            views.setTextViewText(R.id.widget_badge, "${pendingCount}件待取")
            views.setViewVisibility(R.id.widget_badge, View.VISIBLE)
            views.setViewVisibility(R.id.widget_empty_state, View.GONE)
            views.setViewVisibility(R.id.widget_package_list, View.VISIBLE)

            val maxVisible = 3
            val itemIds = listOf(R.id.widget_item_1, R.id.widget_item_2, R.id.widget_item_3)
            val codeIds = listOf(R.id.widget_code_1, R.id.widget_code_2, R.id.widget_code_3)
            val stationIds = listOf(R.id.widget_station_1, R.id.widget_station_2, R.id.widget_station_3)
            val dividerIds = listOf(R.id.widget_divider_1, R.id.widget_divider_2, R.id.widget_divider_3)

            for (i in 0 until maxVisible) {
                if (i < packages.length()) {
                    val pkg = packages.getJSONObject(i)
                    val code = pkg.optString("pickupCode", "")
                    val station = pkg.optString("pickupPointName", "")
                    val carrier = pkg.optString("carrierName", "")
                    val pkgId = pkg.optString("id", "")

                    views.setViewVisibility(itemIds[i], View.VISIBLE)
                    views.setTextViewText(codeIds[i], code)
                    views.setTextViewText(
                        stationIds[i],
                        if (station.isNotBlank()) station else carrier
                    )
                    views.setViewVisibility(dividerIds[i], View.VISIBLE)

                    // 每个包裹项独立点击 → 跳转详情页
                    if (pkgId.isNotBlank()) {
                        val detailUri = Uri.parse("pickupapp://detail/$pkgId")
                        val detailIntent = Intent(Intent.ACTION_VIEW, detailUri).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        }
                        val detailPendingIntent = PendingIntent.getActivity(
                            context, i + 1, detailIntent,
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                        )
                        views.setOnClickPendingIntent(itemIds[i], detailPendingIntent)
                    }
                } else {
                    views.setViewVisibility(itemIds[i], View.GONE)
                    views.setViewVisibility(dividerIds[i], View.GONE)
                }
            }

            val remainder = packages.length() - maxVisible
            if (remainder > 0) {
                views.setViewVisibility(R.id.widget_more_text, View.VISIBLE)
                views.setTextViewText(R.id.widget_more_text, "还有 ${remainder} 件待取")
            } else {
                views.setViewVisibility(R.id.widget_more_text, View.GONE)
            }
        }
    }
}
