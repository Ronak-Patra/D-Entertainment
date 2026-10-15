package com.vega

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * Drop-in for android.util.Log that also keeps the newest ~500 KB of Vega logs
 * (~2 MB with detailed logging) on disk, so users can export them with a bug
 * report. Lines are queued and written by one background thread, so callers
 * never wait on the disk.
 *
 * Debug and verbose lines are kept only while detailed logging is on.
 */
object VegaLog {
    // Two files each, so ~500 KB normally and ~2 MB with detailed logging.
    private const val FILE_LIMIT_BYTES = 250 * 1024L
    private const val DETAILED_FILE_LIMIT_BYTES = 1024 * 1024L
    private const val QUEUE_LIMIT = 5_000

    private val queue = LinkedBlockingQueue<String>()
    private val timeFormat = SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.US)

    @Volatile private var logDir: File? = null
    @Volatile var detailed = false

    // Query values are dropped and secret headers masked; tokens and cookies
    // must never reach a file the user shares.
    private val urlQuery = Regex("""(https?://[^\s?#"']+)\?[^\s"']*""")
    private val secretHeader = Regex(
        """(?i)\b(cookie|set-cookie|authorization|x-api-key|token|api[_-]?key)(["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;}]+)""",
    )

    fun init(context: Context) {
        if (logDir != null) return
        synchronized(this) {
            if (logDir != null) return
            logDir = File(context.filesDir, "logs").apply { mkdirs() }
            Thread(::writeLoop, "VegaLogWriter").apply { isDaemon = true }.start()
            installCrashHandler()
        }
    }

    fun v(tag: String, msg: String?, tr: Throwable? = null): Int =
        record(Log.VERBOSE, tag, msg.orEmpty(), tr)

    fun d(tag: String, msg: String?, tr: Throwable? = null): Int =
        record(Log.DEBUG, tag, msg.orEmpty(), tr)

    fun i(tag: String, msg: String?, tr: Throwable? = null): Int =
        record(Log.INFO, tag, msg.orEmpty(), tr)

    fun w(tag: String, msg: String?, tr: Throwable? = null): Int =
        record(Log.WARN, tag, msg.orEmpty(), tr)

    fun w(tag: String, tr: Throwable): Int = record(Log.WARN, tag, "", tr)

    fun e(tag: String, msg: String?, tr: Throwable? = null): Int =
        record(Log.ERROR, tag, msg.orEmpty(), tr)

    /** Lines from JS, already formatted by level; stored the same way as native ones. */
    fun fromJs(level: Int, tag: String, msg: String) {
        Log.println(level, tag, msg)
        enqueue(level, tag, msg)
    }

    private fun record(level: Int, tag: String, msg: String, tr: Throwable?): Int {
        val text = if (tr != null) "$msg\n${Log.getStackTraceString(tr)}" else msg
        val written = Log.println(level, tag, text)
        enqueue(level, tag, text)
        return written
    }

    private fun enqueue(level: Int, tag: String, msg: String) {
        if (level < Log.INFO && !detailed) return
        // A stalled writer must not grow memory without bound.
        if (queue.size >= QUEUE_LIMIT) return
        val levelChar = when (level) {
            Log.VERBOSE -> 'V'
            Log.DEBUG -> 'D'
            Log.INFO -> 'I'
            Log.WARN -> 'W'
            else -> 'E'
        }
        val time = synchronized(timeFormat) { timeFormat.format(Date()) }
        queue.offer("$time $levelChar/$tag: ${sanitize(msg)}\n")
    }

    fun sanitize(text: String): String =
        text.replace(urlQuery) { "${it.groupValues[1]}?…" }
            .replace(secretHeader) { "${it.groupValues[1]}${it.groupValues[2]}<hidden>" }

    private fun current(dir: File) = File(dir, "d-entertainment-0.log")
    private fun previous(dir: File) = File(dir, "d-entertainment-1.log")

    private fun writeLoop() {
        while (true) {
            try {
                val first = queue.poll(1, TimeUnit.SECONDS) ?: continue
                val batch = StringBuilder(first)
                while (true) batch.append(queue.poll() ?: break)
                write(batch.toString())
            } catch (_: InterruptedException) {
                return
            } catch (e: Exception) {
                Log.w("VegaLog", "Log write failed", e)
            }
        }
    }

    @Synchronized
    private fun write(text: String) {
        val dir = logDir ?: return
        val file = current(dir)
        val limit = if (detailed) DETAILED_FILE_LIMIT_BYTES else FILE_LIMIT_BYTES
        if (file.length() + text.length > limit) {
            previous(dir).delete()
            file.renameTo(previous(dir))
        }
        FileWriter(current(dir), true).use { it.write(text) }
    }

    /** Writes everything queued so far. Used before export and on a crash. */
    fun flush() {
        val batch = StringBuilder()
        while (true) batch.append(queue.poll() ?: break)
        if (batch.isNotEmpty()) write(batch.toString())
    }

    private fun installCrashHandler() {
        val next = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            try {
                e("VegaCrash", "Uncaught exception on ${thread.name}", error)
                flush()
            } catch (_: Throwable) {
            }
            next?.uncaughtException(thread, error)
        }
    }

    /** Older lines first, so the file reads top to bottom. */
    fun readAll(): String {
        flush()
        val dir = logDir ?: return ""
        return listOf(previous(dir), current(dir))
            .filter { it.exists() }
            .joinToString("") { it.readText() }
    }

    fun clear() {
        queue.clear()
        val dir = logDir ?: return
        synchronized(this) {
            previous(dir).delete()
            current(dir).delete()
        }
    }
}
