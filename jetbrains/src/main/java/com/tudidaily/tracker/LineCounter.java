package com.tudidaily.tracker;

import java.util.HashMap;
import java.util.Map;

/**
 * The person's line changes per file since that file's last heartbeat. tudi-cli gets them as --human-line-changes, so
 * the server can tell a person's minutes from an AI tool's (ADR-024): without them every slice looks human. Lines are
 * net (added minus removed), the way tudi-cli counts AI lines.
 */
public final class LineCounter {
    private final Map<String, Integer> pending = new HashMap<>();

    /** Net lines one edit adds: line breaks in the new text minus line breaks in the text it replaced. */
    public static int delta(CharSequence oldText, CharSequence newText) {
        return breaks(newText) - breaks(oldText);
    }

    public synchronized void add(String file, int delta) {
        if (delta != 0) pending.merge(file, delta, Integer::sum);
    }

    /** Returns and clears what has gathered for the file. */
    public synchronized int take(String file) {
        Integer lines = pending.remove(file);
        return lines == null ? 0 : lines;
    }

    private static int breaks(CharSequence text) {
        int count = 0;
        for (int i = 0; i < text.length(); i++) {
            if (text.charAt(i) == '\n') count++;
        }
        return count;
    }
}
