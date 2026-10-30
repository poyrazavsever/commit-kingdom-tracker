package com.tudidaily.tracker;

import com.intellij.ide.BrowserUtil;
import com.intellij.ide.plugins.PluginManager;
import com.intellij.openapi.Disposable;
import com.intellij.openapi.application.ApplicationInfo;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.application.ApplicationNamesInfo;
import com.intellij.openapi.components.Service;
import com.intellij.openapi.fileEditor.FileDocumentManager;
import com.intellij.openapi.fileEditor.FileEditorManager;
import com.intellij.openapi.editor.Document;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.project.ProjectManager;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.util.concurrency.AppExecutorUtil;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Tudi Tracker for the IntelliJ family (ADR-024): reports coding to tudi-cli, which strips everything private before
 * anything leaves the computer. The plugin never reads file contents. Signing in belongs to Tudi Desktop (ADR-027): it
 * writes the key to tudi-cli's config and installs tudi-cli; until then the plugin sends nothing and points to Tudi
 * Desktop.
 */
@Service(Service.Level.APP)
public final class TudiTracker implements Disposable {
    public static final String PLUGIN_ID = "com.tudidaily.tracker";
    private static final long TODAY_EVERY_MINUTES = 5;
    private static final long CONFIG_CHECK_SECONDS = 5;
    private static final long TODAY_TIMEOUT_MS = 30_000;

    /** What the status bar shows. */
    public record Status(boolean signedIn, String text, String tooltip) {
    }

    private final HeartbeatGate gate = new HeartbeatGate();
    private final LineCounter lines = new LineCounter();
    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();
    private final AtomicBoolean refreshing = new AtomicBoolean();
    private final Path config = TudiConfig.configPath();
    private final ScheduledFuture<?> todayTimer;
    private final ScheduledFuture<?> configTimer;
    private volatile boolean signedIn = TudiConfig.isSignedIn(config);
    private volatile Status status = setupStatus();
    private volatile FileTime configTime = modified(config);

    public TudiTracker() {
        var scheduler = AppExecutorUtil.getAppScheduledExecutorService();
        todayTimer = scheduler.scheduleWithFixedDelay(this::refreshToday, 0, TODAY_EVERY_MINUTES, TimeUnit.MINUTES);
        // Signing in or out in Tudi Desktop shows up within a few seconds.
        configTimer = scheduler.scheduleWithFixedDelay(() -> {
            FileTime now = modified(config);
            if (!Objects.equals(now, configTime)) {
                configTime = now;
                refreshToday();
            }
        }, CONFIG_CHECK_SECONDS, CONFIG_CHECK_SECONDS, TimeUnit.SECONDS);
    }

    public static TudiTracker getInstance() {
        return ApplicationManager.getApplication().getService(TudiTracker.class);
    }

    public Status status() {
        return status;
    }

    public void onStatusChange(Runnable listener, Disposable parent) {
        listeners.add(listener);
        com.intellij.openapi.util.Disposer.register(parent, () -> listeners.remove(listener));
    }

    /** A change in a document: counts only for a local file open in front of the user, like the VS Code extension. */
    public void documentChanged(Document document, CharSequence oldText, CharSequence newText) {
        VirtualFile file = FileDocumentManager.getInstance().getFile(document);
        if (file == null || !isSelected(file)) return;
        String path = localPath(file);
        // Lines gather between heartbeats and go with the next one for this file.
        if (path != null) lines.add(path, LineCounter.delta(oldText, newText));
        beat(file, false);
    }

    public void documentSaved(Document document) {
        beat(FileDocumentManager.getInstance().getFile(document), true);
    }

    public void fileOpened(VirtualFile file) {
        beat(file, false);
    }

    /** Status bar click: set up when signed out, otherwise refresh today's time. */
    public void statusClicked() {
        if (signedIn) ApplicationManager.getApplication().executeOnPooledThread(this::refreshToday);
        else BrowserUtil.browse(TudiConfig.SETUP_URL);
    }

    private void beat(VirtualFile file, boolean isWrite) {
        if (!signedIn || file == null) return;
        String path = localPath(file);
        if (path == null || !gate.shouldSend(path, isWrite, System.currentTimeMillis())) return;
        TudiCli.Settings settings = settings();
        int humanLines = lines.take(path);
        ApplicationManager.getApplication().executeOnPooledThread(() -> TudiCli.sendHeartbeat(path, isWrite, settings, humanLines));
    }

    /** The file's path on disk, or null for anything that is not a local file. */
    private static String localPath(VirtualFile file) {
        if (!file.isInLocalFileSystem() || file.isDirectory()) return null;
        try {
            return file.toNioPath().toString();
        } catch (UnsupportedOperationException e) {
            return null;
        }
    }

    private static boolean isSelected(VirtualFile file) {
        for (Project project : ProjectManager.getInstance().getOpenProjects()) {
            if (project.isDisposed()) continue;
            for (VirtualFile selected : FileEditorManager.getInstance(project).getSelectedFiles()) {
                if (selected.equals(file)) return true;
            }
        }
        return false;
    }

    private void refreshToday() {
        if (!refreshing.compareAndSet(false, true)) return;
        try {
            signedIn = TudiConfig.isSignedIn(config);
            if (!signedIn) {
                setStatus(setupStatus());
                return;
            }
            try {
                String today = TudiCli.run(List.of("--today"), settings(), TODAY_TIMEOUT_MS);
                setStatus(new Status(true, today.isEmpty() ? "Kingdom" : today, "Commit Kingdom Tracker: today"));
            } catch (IOException e) {
                // Signed in, but tudi-cli is missing or cannot answer: Tudi Desktop installs and updates it.
                setStatus(new Status(true, "Kingdom", "Commit Kingdom Tracker: open Commit Kingdom Desktop to finish setting up."));
            }
        } finally {
            refreshing.set(false);
        }
    }

    private void setStatus(Status next) {
        status = next;
        for (Runnable listener : listeners) listener.run();
    }

    private static Status setupStatus() {
        return new Status(false, "Commit Kingdom: set up", "Install Commit Kingdom Desktop and sign in to count your coding.");
    }

    private static TudiCli.Settings settings() {
        TudiSettings.State state = TudiSettings.getInstance().getState();
        return new TudiCli.Settings(state.cliPath.trim(), state.apiUrl.trim(), pluginName());
    }

    /** "pycharm/2024.2.4 tudi-jetbrains/0.1.0": the backend reads the IDE from the name before "tudi-…". */
    static String pluginName() {
        String ide = ApplicationNamesInfo.getInstance().getProductName().toLowerCase(Locale.ROOT).replace(" ", "");
        String ideVersion = ApplicationInfo.getInstance().getFullVersion().replace(" ", "");
        // getPluginByClass is public API; PluginManagerCore.getPlugin is internal and fails the Marketplace verifier.
        var plugin = PluginManager.getPluginByClass(TudiTracker.class);
        return ide + "/" + ideVersion + " tudi-jetbrains/" + (plugin == null ? "0" : plugin.getVersion());
    }

    private static FileTime modified(Path file) {
        try {
            return Files.getLastModifiedTime(file);
        } catch (IOException e) {
            return null;
        }
    }

    @Override
    public void dispose() {
        todayTimer.cancel(false);
        configTimer.cancel(false);
    }
}
