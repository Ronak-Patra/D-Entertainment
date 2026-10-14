package com.vega

import android.app.UiModeManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

class LauncherIconModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), LifecycleEventListener {
    companion object {
        private const val PREFS = "vega_launcher"
        private const val PREF_ICON = "icon"

        // Enabled by the manifest until the user picks a color, then always disabled.
        private const val DEFAULT_ALIAS = "LauncherDefault"

        private val ALIASES = mapOf(
            "white" to "LauncherWhite",
            "tomato" to "LauncherTomato",
            "gray" to "LauncherGray",
            "blue" to "LauncherBlue",
            "lavender" to "LauncherLavender",
        )
        private val ALL_ALIASES = ALIASES.values + DEFAULT_ALIAS

        @JvmStatic
        var instance: LauncherIconModule? = null

        @JvmStatic
        fun emitPipChange(isInPip: Boolean) {
            try {
                instance?.reactApplicationContext
                    ?.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("onSystemPipChanged", isInPip)
            } catch (e: Exception) {
                // Ignore if bridge not initialized
            }
        }
    }

    private val isTv: Boolean
        get() = (reactApplicationContext.getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager)
            ?.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION

    // TV launchers redraw the banner on every alias change, so TV applies only the
    // last selection, when the user leaves Vega.
    private var pendingTvIcon: String? = null

    init {
        instance = this
        reactContext.addLifecycleEventListener(this)
    }

    override fun getName(): String = "LauncherIconModule"

    @ReactMethod
    fun setPipPlaybackActive(active: Boolean) {
        MainActivity.isVideoPlaying = active
        com.facebook.react.bridge.UiThreadUtil.runOnUiThread {
            MainActivity.currentMainActivity?.updatePipParams(active)
        }
    }

    @ReactMethod
    fun enterGlobalPip(promise: Promise) {
        com.facebook.react.bridge.UiThreadUtil.runOnUiThread {
            val activity = reactApplicationContext.currentActivity ?: MainActivity.currentMainActivity
            if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (activity.isInPictureInPictureMode) {
                    promise.resolve(true)
                    return@runOnUiThread
                }
                MainActivity.isVideoPlaying = true
                try {
                    val builder = android.app.PictureInPictureParams.Builder()
                        .setAspectRatio(android.util.Rational(16, 9))
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        builder.setAutoEnterEnabled(true)
                        builder.setSeamlessResizeEnabled(true)
                    }
                    val entered = activity.enterPictureInPictureMode(builder.build())
                    promise.resolve(entered)
                } catch (e: Exception) {
                    promise.reject("PIP_ERROR", e.message)
                }
            } else {
                promise.resolve(false)
            }
        }
    }

    @Synchronized
    @ReactMethod
    fun setIcon(icon: String, promise: Promise) {
        val splashThemes = mapOf(
            "white" to R.style.BootTheme_White,
            "tomato" to R.style.BootTheme_Tomato,
            "gray" to R.style.BootTheme_Gray,
            "blue" to R.style.BootTheme_Blue,
            "lavender" to R.style.BootTheme_Lavender,
        )
        val selectedAlias = ALIASES[icon]
        val selectedSplashTheme = splashThemes[icon]
        if (selectedAlias == null || selectedSplashTheme == null) {
            promise.reject("LAUNCHER_ICON_ERROR", "Unknown launcher icon: $icon")
            return
        }

        try {
            // Android 12+ creates the first splash frame before MainActivity.onCreate.
            // Persist its native theme now so it matches RNBootSplash on the next launch.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                reactApplicationContext.currentActivity
                    ?.splashScreen
                    ?.setSplashScreenTheme(selectedSplashTheme)
            }
            reactApplicationContext
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(PREF_ICON, icon)
                .commit()
            if (isTv) {
                pendingTvIcon = icon
            } else {
                applyLauncherAlias(selectedAlias)
            }
            promise.resolve(icon)
        } catch (error: Exception) {
            promise.reject("LAUNCHER_ICON_ERROR", error.message, error)
        }
    }

    private fun component(alias: String): ComponentName {
        val packageName = reactApplicationContext.packageName
        return ComponentName(packageName, "$packageName.$alias")
    }

    private fun isAliasEnabled(packageManager: PackageManager, alias: String): Boolean =
        when (packageManager.getComponentEnabledSetting(component(alias))) {
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
            PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> alias == DEFAULT_ALIAS
            else -> false
        }

    private fun applyLauncherAlias(selectedAlias: String) {
        val packageManager = reactApplicationContext.packageManager
        // Change only aliases in the wrong state; every change makes launchers reload.
        val changes = ALL_ALIASES.filter { alias ->
            isAliasEnabled(packageManager, alias) != (alias == selectedAlias)
        }
        if (changes.isEmpty()) return
        val stateOf = { alias: String ->
            if (alias == selectedAlias) PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            else PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.setComponentEnabledSettings(changes.map { alias ->
                PackageManager.ComponentEnabledSetting(
                    component(alias),
                    stateOf(alias),
                    PackageManager.DONT_KILL_APP,
                )
            })
        } else {
            // Enable the new alias first so the app always has a launcher entry.
            changes.sortedByDescending { it == selectedAlias }.forEach { alias ->
                packageManager.setComponentEnabledSetting(
                    component(alias),
                    stateOf(alias),
                    PackageManager.DONT_KILL_APP,
                )
            }
        }
    }

    @Synchronized
    private fun applyIcon(icon: String) {
        try {
            applyLauncherAlias(ALIASES[icon] ?: return)
        } catch (error: Exception) {
            VegaLog.w("LauncherIconModule", "Could not apply launcher color", error)
        }
    }

    @Synchronized
    override fun onHostResume() {
        // Bring the aliases in line with the saved color. This covers a TV process
        // that stopped before pause and installs updated from builds where the
        // manifest enabled a different alias.
        if (pendingTvIcon != null) return
        reactApplicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(PREF_ICON, null)
            ?.let(::applyIcon)
    }

    @Synchronized
    override fun onHostPause() {
        val icon = pendingTvIcon ?: return
        pendingTvIcon = null
        applyIcon(icon)
    }

    override fun onHostDestroy() {
        onHostPause()
    }
}

class LauncherIconPackage : com.facebook.react.ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(LauncherIconModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
