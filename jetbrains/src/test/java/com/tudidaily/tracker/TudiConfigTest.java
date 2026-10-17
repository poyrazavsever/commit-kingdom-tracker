package com.tudidaily.tracker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class TudiConfigTest {
    @Test
    void theConfigLivesWhereTudiCliAndTudiDesktopPutIt() {
        assertEquals(Path.of("/home/ada", ".tudi.cfg"), TudiConfig.configPath(Map.of(), "/home/ada"));
        assertEquals(Path.of("/opt/tudi", ".tudi.cfg"), TudiConfig.configPath(Map.of("TUDI_HOME", "/opt/tudi"), "/home/ada"));
        assertEquals(Path.of("/home/ada/tudi", ".tudi.cfg"), TudiConfig.configPath(Map.of("TUDI_HOME", "~/tudi"), "/home/ada"));
        assertEquals(Path.of("/opt/waka", ".tudi.cfg"), TudiConfig.configPath(Map.of("WAKATIME_HOME", "/opt/waka"), "/home/ada"));
    }

    @Test
    void signedInOnlyWithAKeyInSettings(@TempDir Path dir) throws IOException {
        Path file = dir.resolve(".tudi.cfg");
        assertFalse(TudiConfig.isSignedIn(file));
        Files.writeString(file, "[settings]\ndebug = true\n");
        assertFalse(TudiConfig.isSignedIn(file));
        Files.writeString(file, "[git]\napi_key = nope\n[settings]\napi_key = \n");
        assertFalse(TudiConfig.isSignedIn(file));
        Files.writeString(file, "[settings]\r\napi_key = 3f2c0c1e-1111-4222-8333-444455556666\r\n");
        assertTrue(TudiConfig.isSignedIn(file));
    }
}
