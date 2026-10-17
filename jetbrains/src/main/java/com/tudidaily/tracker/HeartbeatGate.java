package com.tudidaily.tracker;

import java.util.Objects;

/**
 * Decides when a change becomes a heartbeat: a save always does, switching to another file does, and typing in the same
 * file does once every two minutes (the same rhythm as WakaTime plugins). Keeps the CLI from starting on every keystroke.
 */
public final class HeartbeatGate {
    public static final long REPEAT_MS = 2 * 60 * 1000;

    private String lastFile;
    private long lastAt;

    public synchronized boolean shouldSend(String file, boolean isWrite, long now) {
        boolean send = isWrite || !Objects.equals(file, lastFile) || now - lastAt >= REPEAT_MS;
        if (send) {
            lastFile = file;
            lastAt = now;
        }
        return send;
    }
}
