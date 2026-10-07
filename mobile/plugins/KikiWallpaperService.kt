package com.kiki.wallpaper

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class KikiWallpaperService : WallpaperService() {
  override fun onCreateEngine(): Engine = KikiEngine()

  private inner class KikiEngine : Engine() {
    private val handler = Handler(Looper.getMainLooper())
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private var sources = emptyList<String>()
    private var interval = 1000L
    private var index = -1
    private var visible = false
    private val advance = object : Runnable {
      override fun run() {
        if (!visible || sources.isEmpty()) return
        index = (index + 1) % sources.size
        drawWallpaper()
        handler.postDelayed(this, interval)
      }
    }

    init { readPlaylist() }

    private fun readPlaylist() {
      try {
        val config = File(filesDir, "kiki-wallpaper-playlist.json")
        val data = JSONObject(config.readText())
        val array = data.getJSONArray("localUris")
        sources = (0 until array.length()).map { array.getString(it) }
        interval = data.optLong("intervalMs", 1000L).coerceAtLeast(1000L)
      } catch (_: Exception) {
        sources = emptyList()
      }
    }

    override fun onVisibilityChanged(isVisible: Boolean) {
      visible = isVisible
      handler.removeCallbacks(advance)
      if (visible) {
        readPlaylist()
        index = if (sources.isEmpty()) -1 else (index + 1) % sources.size
        drawWallpaper()
        handler.postDelayed(advance, interval)
      }
    }

    override fun onSurfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
      super.onSurfaceChanged(holder, format, width, height)
      drawWallpaper()
    }

    private fun loadImage(uriText: String, targetWidth: Int, targetHeight: Int): Bitmap? {
      val uri = Uri.parse(uriText)
      val path = uri.path ?: return null
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(path, bounds)
      var sample = 1
      while (bounds.outWidth / sample > targetWidth * 2 || bounds.outHeight / sample > targetHeight * 2) sample *= 2
      return BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
    }

    private fun drawWallpaper() {
      if (index < 0 || index >= sources.size) return
      val holder = surfaceHolder
      var canvas: Canvas? = null
      try {
        canvas = holder.lockCanvas()
        if (canvas != null) {
          canvas.drawColor(Color.BLACK)
          val bitmap = loadImage(sources[index], canvas.width, canvas.height)
          if (bitmap != null) {
            val scale = maxOf(canvas.width.toFloat() / bitmap.width, canvas.height.toFloat() / bitmap.height)
            val width = bitmap.width * scale
            val height = bitmap.height * scale
            val target = RectF((canvas.width - width) / 2f, (canvas.height - height) / 2f, (canvas.width + width) / 2f, (canvas.height + height) / 2f)
            canvas.drawBitmap(bitmap, null, target, paint)
            bitmap.recycle()
          }
        }
      } catch (_: Exception) {
      } finally {
        if (canvas != null) holder.unlockCanvasAndPost(canvas)
      }
    }

    override fun onDestroy() {
      visible = false
      handler.removeCallbacks(advance)
      super.onDestroy()
    }
  }
}
