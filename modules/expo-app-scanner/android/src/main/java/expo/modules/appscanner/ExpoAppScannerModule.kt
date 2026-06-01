package expo.modules.appscanner

import android.content.pm.PackageManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * 已安装购物 App 扫描器
 *
 * 检测手机上安装了哪些购物/电商平台，
 * 返回包名和应用名，JS 层据此展示监控范围。
 *
 * 注意：需要 AndroidManifest 中 <queries> 声明对应包名，
 * Android 11+ 上才能查询到安装状态。
 */
class ExpoAppScannerModule : Module() {
    /** 已知购物 App 包名 → 中文名映射 */
    private val SHOPPING_PACKAGES = mapOf(
        "com.taobao.taobao"        to "淘宝",
        "com.jingdong.app.mall"    to "京东",
        "com.xunmeng.pinduoduo"    to "拼多多",
        "com.ss.android.ugc.aweme" to "抖音",
        "com.alibaba.android.rimet" to "钉钉",
        "com.cainiao.wireless"     to "菜鸟",
        "com.sankuai.meituan"      to "美团",
        "com.taobao.idlefish"      to "闲鱼",
        "com.alibaba.wireless"     to "1688",
        "com.xiaomi.shop"          to "小米商城",
        "com.xingin.xhs"           to "小红书",
        "com.kuaishou.nebula"      to "快手",
        "com.smzdm.client.android"  to "什么值得买",
        "com.vipshop"              to "唯品会",
        "com.suning.mobile.ebuy"   to "苏宁易购",
        "com.dangdang.buy2"        to "当当",
        "com.mogujie"              to "蘑菇街",
        "com.taobao.etao"          to "一淘",
        "tv.danmaku.bili"          to "B站",
    )

    override fun definition() = ModuleDefinition {
        Name("ExpoAppScanner")

        // 扫描已安装的购物 App，返回 [ { packageName, name }, ... ]
        AsyncFunction("scanInstalledShoppingApps") {
            val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, String>>()
            val pm = context.packageManager
            val result = mutableListOf<Map<String, String>>()

            for ((pkg, name) in SHOPPING_PACKAGES) {
                try {
                    val info = pm.getPackageInfo(pkg, 0)
                    if (info != null) {
                        result.add(mapOf(
                            "packageName" to pkg,
                            "name" to name,
                        ))
                    }
                } catch (_: PackageManager.NameNotFoundException) {
                    // 未安装，跳过
                }
            }

            result
        }

        // 检查单个 App 是否已安装
        AsyncFunction("isAppInstalled") { packageName: String ->
            val context = appContext.reactContext ?: return@AsyncFunction false
            try {
                context.packageManager.getPackageInfo(packageName, 0)
                true
            } catch (_: PackageManager.NameNotFoundException) {
                false
            }
        }

        // 获取 App 自身安装时间（毫秒时间戳）
        AsyncFunction("getSelfInstallTime") {
            val context = appContext.reactContext ?: return@AsyncFunction 0L
            try {
                val info = context.packageManager.getPackageInfo(context.packageName, 0)
                info.firstInstallTime
            } catch (_: PackageManager.NameNotFoundException) {
                0L
            }
        }
    }
}
