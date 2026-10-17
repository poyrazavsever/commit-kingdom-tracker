package com.tudidaily.tracker;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * tudi-cli's config, written by Tudi Desktop (ADR-027). The plugin only checks that a key is there; it never reads the
 * key into the IDE, tudi-cli does that itself.
 */
public final class TudiConfig {
    /** Where Tudi Desktop gets the plugin and the computer signed in. */
    public static final String SETUP_URL = "https://tudidaily.com/tracker";

    private static final Pattern HEADER = Pattern.compile("^\\s*\\[([^\\]]+)]\\s*$");
    private static final Pattern API_KEY = Pattern.compile("^\\s*api_key\\s*=\\s*\\S+", Pattern.CASE_INSENSITIVE);

    private TudiConfig() {
    }

    /** {@code <TUDI_HOME or home>/.tudi.cfg} (cli/pkg/ini). */
    public static Path configPath(Map<String, String> env, String home) {
        String custom = env.get("TUDI_HOME");
        if (custom == null || custom.isEmpty()) custom = env.get("WAKATIME_HOME");
        if (custom == null || custom.isEmpty()) return Path.of(home, ".tudi.cfg");
        if (custom.equals("~") || custom.startsWith("~/") || custom.startsWith("~\\")) custom = home + custom.substring(1);
        return Path.of(custom, ".tudi.cfg");
    }

    public static Path configPath() {
        return configPath(System.getenv(), System.getProperty("user.home"));
    }

    /** Whether Tudi Desktop has signed this computer in: a non-empty api_key under [settings]. */
    public static boolean isSignedIn(Path file) {
        if (!Files.isRegularFile(file)) return false;
        try {
            boolean inSettings = false;
            for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                Matcher header = HEADER.matcher(line);
                if (header.matches()) inSettings = header.group(1).trim().toLowerCase(Locale.ROOT).equals("settings");
                else if (inSettings && API_KEY.matcher(line).find()) return true;
            }
        } catch (IOException e) {
            return false;
        }
        return false;
    }
}
