package expo.modules.gallerylauncher

import android.app.Activity
import android.content.Intent
import android.provider.MediaStore
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class ExpoGalleryLauncherModule : Module() {
  private var pendingPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoGalleryLauncher")

    AsyncFunction("launchGallery") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "No current activity", null)
        return@AsyncFunction
      }
      pendingPromise = promise

      val intent = Intent(Intent.ACTION_PICK).apply {
        setDataAndType(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, "image/*")
        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
      }
      activity.startActivityForResult(intent, 1001)
    }

    OnActivityResult { _, payload ->
      val promise = pendingPromise ?: return@OnActivityResult
      pendingPromise = null

      if (payload.resultCode != Activity.RESULT_OK) {
        promise.resolve(emptyList<String>())
        return@OnActivityResult
      }

      val data = payload.data
      if (data == null) {
        promise.resolve(emptyList<String>())
        return@OnActivityResult
      }

      val uris = mutableListOf<String>()
      // Multi-select
      val clip = data.clipData
      if (clip != null) {
        for (i in 0 until clip.itemCount) {
          uris.add(clip.getItemAt(i).uri.toString())
        }
      }
      // Single select
      val singleUri = data.data
      if (singleUri != null) {
        uris.add(singleUri.toString())
      }
      promise.resolve(uris)
    }
  }
}
