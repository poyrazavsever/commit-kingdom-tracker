package com.tudidaily.tracker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class HeartbeatTest {
    private static final TudiCli.Settings SETTINGS = new TudiCli.Settings("", "", "pycharm/2024.2.4 tudi-jetbrains/0.1.0");

    @Test
    void typingInOneFileSendsAHeartbeatEveryTwoMinutesNotOnEveryKeystroke() {
        HeartbeatGate gate = new HeartbeatGate();
        assertTrue(gate.shouldSend("a.py", false, 0));
        assertFalse(gate.shouldSend("a.py", false, 1_000));
        assertFalse(gate.shouldSend("a.py", false, HeartbeatGate.REPEAT_MS - 1));
        assertTrue(gate.shouldSend("a.py", false, HeartbeatGate.REPEAT_MS));
    }

    @Test
    void aSaveOrAnotherFileAlwaysSends() {
        HeartbeatGate gate = new HeartbeatGate();
        gate.shouldSend("a.py", false, 0);
        assertTrue(gate.shouldSend("a.py", true, 10));
        assertTrue(gate.shouldSend("b.py", false, 20));
    }

    @Test
    void theCliGetsTheFileOnlyAsAnArgument() {
        assertEquals(
                List.of("--entity", "/p/a.py", "--plugin", "pycharm/2024.2.4 tudi-jetbrains/0.1.0", "--human-line-changes", "4", "--write"),
                TudiCli.heartbeatArgs("/p/a.py", true, SETTINGS, 4));
        assertEquals(
                List.of("--entity", "/p/a.py", "--plugin", "x/1 tudi-jetbrains/0.1.0", "--human-line-changes", "0", "--api-url", "http://localhost:5130"),
                TudiCli.heartbeatArgs("/p/a.py", false, new TudiCli.Settings("", "http://localhost:5130", "x/1 tudi-jetbrains/0.1.0"), 0));
    }

    @Test
    void linesGatherPerFileUntilThatFileSendsAHeartbeat() {
        assertEquals(2, LineCounter.delta("", "a\nb\n"));
        assertEquals(-3, LineCounter.delta("x\ny\nz\n", ""));
        assertEquals(0, LineCounter.delta("x", "y"));
        LineCounter lines = new LineCounter();
        lines.add("/p/a.py", 2);
        lines.add("/p/b.py", -1);
        lines.add("/p/a.py", 1);
        assertEquals(3, lines.take("/p/a.py"));
        assertEquals(0, lines.take("/p/a.py"));
        assertEquals(-1, lines.take("/p/b.py"));
    }

    @Test
    void tudiCliIsFoundWhereTudiDesktopInstallsIt(@TempDir Path home) throws IOException {
        assertEquals("tudi-cli.exe", TudiCli.findCli("", home.toString(), true));
        Path installed = home.resolve(".tudi").resolve("tudi-cli");
        Files.createDirectories(installed.getParent());
        Files.writeString(installed, "");
        assertEquals(installed.toString(), TudiCli.findCli("", home.toString(), false));
        Path custom = home.resolve("my-cli");
        Files.writeString(custom, "");
        assertEquals(custom.toString(), TudiCli.findCli(custom.toString(), home.toString(), false));
    }
}
