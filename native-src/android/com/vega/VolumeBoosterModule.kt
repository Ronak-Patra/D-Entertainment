package com.vega

import android.media.audiofx.LoudnessEnhancer
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.uimanager.ViewManager

private const val TAG = "VolumeBooster"

/**
 * VolumeBoosterModule: provides VLC-style audio loudness enhancement beyond 100% (up to 200%).
 * Uses Android's native LoudnessEnhancer audio effect on global output audio session (0).
 */
class VolumeBoosterModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var loudnessEnhancer: LoudnessEnhancer? = null
    private var currentBoost: Float = 1.0f

    override fun getName(): String = "VolumeBooster"

    @Synchronized
    private fun getOrCreateEnhancer(): LoudnessEnhancer? {
        if (loudnessEnhancer == null) {
            try {
                // Audio session 0 applies to media output mix
                loudnessEnhancer = LoudnessEnhancer(0)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to initialize LoudnessEnhancer: ${e.message}")
            }
        }
        return loudnessEnhancer
    }

    @ReactMethod
    fun setBoost(level: Double, promise: Promise) {
        try {
            // level: 1.0 (100%, no boost) up to 2.0 (200% boost)
            val clamped = level.toFloat().coerceIn(1.0f, 2.0f)
            currentBoost = clamped

            if (clamped <= 1.0f) {
                loudnessEnhancer?.let {
                    it.enabled = false
                    it.setTargetGain(0)
                }
                promise.resolve(1.0)
                return
            }

            val enhancer = getOrCreateEnhancer()
            if (enhancer != null) {
                // Map 1.0..2.0 to 0..1800 mB (+18 dB gain, matching VLC's 200% ceiling)
                val gainMb = ((clamped - 1.0f) * 1800.0f).toInt()
                enhancer.setTargetGain(gainMb)
                if (!enhancer.enabled) {
                    enhancer.enabled = true
                }
                promise.resolve(clamped.toDouble())
            } else {
                promise.resolve(1.0)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error setting volume boost: ${e.message}")
            promise.resolve(1.0)
        }
    }

    @ReactMethod
    fun resetBoost(promise: Promise) {
        try {
            currentBoost = 1.0f
            loudnessEnhancer?.let {
                it.enabled = false
                it.setTargetGain(0)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getBoost(promise: Promise) {
        promise.resolve(currentBoost.toDouble())
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        try {
            loudnessEnhancer?.enabled = false
            loudnessEnhancer?.release()
            loudnessEnhancer = null
        } catch (e: Exception) {
            // ignore
        }
    }
}

class VolumeBoosterPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(VolumeBoosterModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
