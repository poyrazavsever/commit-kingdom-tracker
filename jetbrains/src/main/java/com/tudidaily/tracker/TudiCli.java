package com.tudidaily.tracker;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/** Starts tudi-cli the way WakaTime plugins start wakatime-cli. Privacy is the CLI's job; the plugin passes only the path. */
public final class TudiCli {
    public record Settings(String cliPath, String apiUrl, String plugin) {
    }

    private TudiCli() {
    }

    /** The configured path, then ~/.tudi/tudi-cli (where Tudi Desktop installs it), then whatever is on PATH. */
    public static String findCli(String configured, String home, boolean windows) {
        if (configured != null && !configured.isEmpty() && Files.isRegularFile(Path.of(configured))) return configured;
        String name = windows ? "tudi-cli.exe" : "tudi-cli";
        Path installed = Path.of(home, ".tudi", name);
        return Files.isRegularFile(installed) ? installed.toString() : name;
    }

    static String findCli(Settings settings) {
        return findCli(settings.cliPath(), System.getProperty("user.home"), System.getProperty("os.name", "").startsWith("Windows"));
    }

    public static List<String> heartbeatArgs(String file, boolean isWrite, Settings settings, int humanLines) {
        List<String> args = new ArrayList<>(List.of("--entity", file, "--plugin", settings.plugin(), "--human-line-changes", Integer.toString(humanLines)));
        if (isWrite) args.add("--write");
        if (!settings.apiUrl().isEmpty()) args.addAll(List.of("--api-url", settings.apiUrl()));
        return args;
    }

    /**
     * Starts a heartbeat and does not wait for it: the IDE never blocks on the CLI. Errors are swallowed; the CLI keeps an
     * offline queue and retries on its own.
     */
    public static void sendHeartbeat(String file, boolean isWrite, Settings settings, int humanLines) {
        List<String> command = new ArrayList<>();
        command.add(findCli(settings));
        command.addAll(heartbeatArgs(file, isWrite, settings, humanLines));
        try {
            new ProcessBuilder(command)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();
        } catch (IOException e) {
            // No CLI yet: the status bar asks the user to open Tudi Desktop.
        }
    }

    /** Runs a CLI command that answers on stdout (--today) with a time limit. Call it off the UI thread. */
    public static String run(List<String> args, Settings settings, long timeoutMs) throws IOException {
        List<String> command = new ArrayList<>();
        command.add(findCli(settings));
        command.addAll(args);
        if (!settings.apiUrl().isEmpty()) command.addAll(List.of("--api-url", settings.apiUrl()));
        command.addAll(List.of("--plugin", settings.plugin()));
        Process process = new ProcessBuilder(command).redirectError(ProcessBuilder.Redirect.DISCARD).start();
        try (InputStream out = process.getInputStream()) {
            if (!process.waitFor(timeoutMs, TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                throw new IOException("tudi-cli did not answer in time");
            }
            String text = new String(out.readAllBytes(), StandardCharsets.UTF_8).trim();
            if (process.exitValue() != 0) throw new IOException("tudi-cli exited with " + process.exitValue());
            return text;
        } catch (InterruptedException e) {
            process.destroyForcibly();
            Thread.currentThread().interrupt();
            throw new IOException("interrupted", e);
        }
    }
}
