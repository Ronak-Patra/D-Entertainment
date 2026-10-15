package com.vega

import android.content.Context
import android.media.AudioManager
import android.media.audiofx.LoudnessEnhancer
import android.util.Log
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.brentvatne.react.ReactNativeVideoManager
import com.brentvatne.react.RNVPlugin
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager
import java.util.concurrent.ConcurrentHashMap

private const val TAG = "VolumeBooster"

/**
 * VolumeBoosterModule: provides audio loudness enhancement beyond 100% (up to 200%).
 * Uses Android's native LoudnessEnhancer audio effect attached both directly to active
 * ExoPlayer audio session IDs and to global session (0) with MODIFY_AUDIO_SETTINGS permission.
 */
class VolumeBoosterModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), RNVPlugin {

    private var currentBoost: Float = 1.0f
    private val activePlayers = ConcurrentHashMap<String, ExoPlayer>()
    private val activeEnhancers = ConcurrentHashMap<Int, LoudnessEnhancer>()

    init {
        try {
            ReactNativeVideoManager.getInstance().registerPlugin(this)
        } catch (e: Throwable) {
            Log.w(TAG, "Failed to register with ReactNativeVideoManager: ${e.message}")
        }
    }

    override fun getName(): String = "VolumeBooster"

    override fun onInstanceCreated(id: String, player: Any) {
        if (player is ExoPlayer) {
            activePlayers[id] = player
            val sessionId = try { player.audioSessionId } catch (t: Throwable) { 0 }
            if (sessionId > 0 && currentBoost > 1.0f) {
                applyBoostToSession(sessionId, currentBoost)
            }
            player.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY && currentBoost > 1.0f) {
                        val sid = try { player.audioSessionId } catch (t: Throwable) { 0 }
                        if (sid > 0) {
                            applyBoostToSession(sid, currentBoost)
                        }
                    }
                }
            })
        }
    }

    override fun onInstanceRemoved(id: String, player: Any) {
        activePlayers.remove(id)
        if (player is ExoPlayer) {
            val sessionId = try { player.audioSessionId } catch (t: Throwable) { 0 }
            if (sessionId > 0) {
                releaseEnhancer(sessionId)
            }
        }
    }

    @Synchronized
    private fun getOrCreateEnhancer(sessionId: Int): LoudnessEnhancer? {
        var enhancer = activeEnhancers[sessionId]
        if (enhancer == null) {
            try {
                enhancer = LoudnessEnhancer(sessionId)
                activeEnhancers[sessionId] = enhancer
            } catch (e: Throwable) {
                Log.w(TAG, "Failed to initialize LoudnessEnhancer for session $sessionId: ${e.message}")
            }
        }
        return enhancer
    }

    private fun applyBoostToSession(sessionId: Int, boost: Float) {
        val enhancer = getOrCreateEnhancer(sessionId) ?: return
        try {
            if (boost <= 1.0f) {
                enhancer.enabled = false
                enhancer.setTargetGain(0)
            } else {
                // Map 1.0..2.0 to 0..2500 mB (+25 dB gain for impactful, clear loudness boost)
                val gainMb = ((boost - 1.0f) * 2500.0f).toInt()
                enhancer.setTargetGain(gainMb)
                if (!enhancer.enabled) {
                    enhancer.enabled = true
                }
            }
        } catch (e: Throwable) {
            Log.e(TAG, "Error applying enhancer to session $sessionId: ${e.message}")
        }
    }

    private fun releaseEnhancer(sessionId: Int) {
        activeEnhancers.remove(sessionId)?.let { enhancer ->
            try {
                enhancer.enabled = false
                enhancer.release()
            } catch (e: Throwable) {
                // ignore
            }
        }
    }

    @ReactMethod
    fun setBoost(level: Double, promise: Promise) {
        try {
            val clamped = level.toFloat().coerceIn(1.0f, 2.0f)
            currentBoost = clamped

            if (clamped <= 1.0f) {
                resetInternal()
                promise.resolve(1.0)
                return
            }

            // Maximize system music volume when boosting
            try {
                val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                audioManager?.let { am ->
                    val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
                    am.setStreamVolume(AudioManager.STREAM_MUSIC, max, 0)
                }
            } catch (e: Throwable) {
                Log.w(TAG, "Failed to set stream volume to max: ${e.message}")
            }

            // Apply to global output mix session 0
            applyBoostToSession(0, clamped)

            // Apply to all active ExoPlayer instances
            for (player in activePlayers.values) {
                val sid = try { player.audioSessionId } catch (t: Throwable) { 0 }
                if (sid > 0) {
                    applyBoostToSession(sid, clamped)
                }
            }

            // Also re-apply to all currently tracked enhancers
            for ((sid, _) in activeEnhancers) {
                applyBoostToSession(sid, clamped)
            }

            promise.resolve(clamped.toDouble())
        } catch (e: Throwable) {
            Log.e(TAG, "Error setting volume boost: ${e.message}")
            promise.resolve(1.0)
        }
    }

    private fun resetInternal() {
        for ((_, enhancer) in activeEnhancers) {
            try {
                enhancer.enabled = false
                enhancer.setTargetGain(0)
            } catch (e: Throwable) {
                // ignore
            }
        }
    }

    @ReactMethod
    fun resetBoost(promise: Promise) {
        try {
            currentBoost = 1.0f
            resetInternal()
            promise.resolve(true)
        } catch (e: Throwable) {
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
            ReactNativeVideoManager.getInstance().unregisterPlugin(this)
        } catch (e: Throwable) {
            // ignore
        }
        for ((_, enhancer) in activeEnhancers) {
            try {
                enhancer.enabled = false
                enhancer.release()
            } catch (e: Throwable) {
                // ignore
            }
        }
        activeEnhancers.clear()
        activePlayers.clear()
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
