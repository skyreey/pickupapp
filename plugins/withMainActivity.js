/**
 * Expo Config Plugin — 修改 MainActivity.kt
 * 注入 onNewIntent + handleShareIntent 以支持转发短信导入
 */
const { withMainActivity } = require('@expo/config-plugins');

const SHARE_HANDLER_CODE = `
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleShareIntent(intent)
  }

  /** 接收其他App转发来的短信文本，存入 SharedPreferences 供 JS 层读取 */
  private fun handleShareIntent(intent: Intent?) {
    if (intent == null) return
    if (Intent.ACTION_SEND != intent.action) return
    if ("text/plain" != intent.type) return

    val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return
    if (sharedText.isBlank()) return

    val prefs = getSharedPreferences("app_settings", Context.MODE_PRIVATE)
    prefs.edit().putString("pending_shared_sms", sharedText).apply()
  }
`;

const SHARE_IMPORTS = `
import android.content.Intent
import android.content.Context
`;

function withPickupMainActivity(config) {
  return withMainActivity(config, (config) => {
    const src = config.modResults.contents;

    // 注入 import
    if (!src.includes('import android.content.Intent')) {
      config.modResults.contents = src.replace(
        'import expo.modules.ReactActivityDelegateWrapper',
        `${SHARE_IMPORTS}\nimport expo.modules.ReactActivityDelegateWrapper`,
      );
    }

    // 注入 onCreate 中的 handleShareIntent 调用
    let modified = config.modResults.contents;
    if (!modified.includes('handleShareIntent(intent)')) {
      modified = modified.replace(
        'super.onCreate(null)',
        'super.onCreate(null)\n    handleShareIntent(intent)',
      );
    }

    // 注入 onNewIntent / handleShareIntent
    if (!modified.includes('fun onNewIntent')) {
      modified = modified.replace(
        'override fun getMainComponentName',
        `${SHARE_HANDLER_CODE}\n\n  override fun getMainComponentName`,
      );
    }

    config.modResults.contents = modified;
    return config;
  });
}

module.exports = withPickupMainActivity;
