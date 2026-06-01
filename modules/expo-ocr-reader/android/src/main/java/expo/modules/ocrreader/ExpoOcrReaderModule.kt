package expo.modules.ocrreader

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoOcrReaderModule : Module() {
  companion object {
    // ML Kit 建议不超过这个尺寸，过大反而降低精度
    private const val MAX_DIMENSION = 1920
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoOcrReader")

    AsyncFunction("recognizeImage") { uri: String, promise: Promise ->
      try {
        val context = appContext.reactContext ?: run {
          promise.reject("NO_CONTEXT", "React context not available", null)
          return@AsyncFunction
        }

        // 1. 加载图片
        val uriObj = Uri.parse(uri)
        val inputStream = context.contentResolver.openInputStream(uriObj) ?: run {
          promise.reject("LOAD_FAILED", "Cannot open image", null)
          return@AsyncFunction
        }
        val bitmap = inputStream.use { BitmapFactory.decodeStream(it) }
        if (bitmap == null) {
          promise.reject("LOAD_FAILED", "Cannot decode image", null)
          return@AsyncFunction
        }

        // 2. EXIF 旋转校正（相册截图的 orientation 可能不对）
        val corrected = try {
          val rotated = rotateByExif(bitmap, uriObj)
          if (rotated !== bitmap) {
            bitmap.recycle()
          }
          rotated
        } catch (_: Exception) { bitmap }

        // 3. 缩放到合理尺寸（提高速度 + 精度）
        val scaled = scaleToMax(corrected, MAX_DIMENSION)
        if (scaled !== corrected) {
          corrected.recycle()
        }

        // 4. 送入 ML Kit 识别
        val image = InputImage.fromBitmap(scaled, 0)
        val recognizer = TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())

        recognizer.process(image)
          .addOnSuccessListener { visionText ->
            scaled.recycle()
            promise.resolve(visionText.text)
          }
          .addOnFailureListener { e ->
            scaled.recycle()
            promise.reject("OCR_FAILED", e.message ?: "OCR failed", e)
          }
      } catch (e: Exception) {
        promise.reject("OCR_ERROR", e.message ?: "Unknown error", e)
      }
    }
  }

  /** 根据 EXIF orientation 旋转图片 */
  private fun rotateByExif(bitmap: Bitmap, uri: Uri): Bitmap {
    val rotation = try {
      val inp = appContext.reactContext?.contentResolver?.openInputStream(uri) ?: return bitmap
      val exif = inp.use { ExifInterface(it) }
      when (exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> return bitmap
      }
    } catch (_: Exception) { return bitmap }

    val matrix = Matrix().apply { postRotate(rotation) }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
  }

  /** 按比例缩放到最长边不超过 maxPx */
  private fun scaleToMax(bitmap: Bitmap, maxPx: Int): Bitmap {
    val (w, h) = bitmap.width to bitmap.height
    if (w <= maxPx && h <= maxPx) return bitmap

    val scale = maxPx.toFloat() / maxOf(w, h)
    val newW = (w * scale).toInt()
    val newH = (h * scale).toInt()
    return Bitmap.createScaledBitmap(bitmap, newW, newH, true)
  }
}
