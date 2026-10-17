package com.tudidaily.tracker;

import com.intellij.openapi.application.WriteAction;
import com.intellij.openapi.fileEditor.FileDocumentManager;
import com.intellij.testFramework.fixtures.BasePlatformTestCase;
import com.intellij.testFramework.fixtures.TempDirTestFixture;
import com.intellij.testFramework.fixtures.impl.TempDirTestFixtureImpl;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Runs the plugin inside a real IDE with a stand-in tudi-cli that writes down how it was called: the listeners in
 * plugin.xml must turn opening, typing and saving into heartbeats, and the status bar must show what --today answers.
 */
public class TudiTrackerIdeTest extends BasePlatformTestCase {
    private static final boolean WINDOWS = System.getProperty("os.name", "").startsWith("Windows");

    private Path home;
    private Path log;
    private String realHome;

    @Override
    protected TempDirTestFixture createTempDirTestFixture() {
        // Heartbeats are only for files on disk, so the test files must be real ones.
        return new TempDirTestFixtureImpl();
    }

    @Override
    protected void setUp() throws Exception {
        home = Files.createTempDirectory("tudi-home");
        log = home.resolve("calls.log");
        Files.writeString(home.resolve(".tudi.cfg"), "[settings]\napi_key = 3f2c0c1e-1111-4222-8333-444455556666\n");
        realHome = System.getProperty("user.home");
        // TudiTracker finds ~/.tudi.cfg when it starts, which is during this test.
        System.setProperty("user.home", home.toString());
        super.setUp();
        TudiSettings.getInstance().getState().cliPath = fakeCli().toString();
    }

    @Override
    protected void tearDown() throws Exception {
        try {
            TudiSettings.getInstance().getState().cliPath = "";
            System.setProperty("user.home", realHome);
        } finally {
            super.tearDown();
        }
    }

    public void testOpeningTypingAndSavingBecomeHeartbeatsAndTheStatusShowsToday() throws Exception {
        TudiTracker tracker = TudiTracker.getInstance();
        tracker.statusClicked();
        waitFor(() -> tracker.status().text().equals("1 hr 2 mins"));
        assertTrue(tracker.status().signedIn());

        myFixture.configureByText("game.py", "print('hi')\n<caret>");
        String path = myFixture.getFile().getVirtualFile().toNioPath().toString();
        waitFor(() -> calls().stream().anyMatch(call -> call.contains("--entity") && call.contains("game.py")));

        myFixture.type("x = 1\n");
        WriteAction.runAndWait(() -> FileDocumentManager.getInstance().saveDocument(myFixture.getEditor().getDocument()));
        waitFor(() -> calls().stream().anyMatch(call -> call.contains("game.py") && call.contains("--write")));

        String write = calls().stream().filter(call -> call.contains("--write")).findFirst().orElseThrow();
        assertTrue(write, write.contains(path));
        assertTrue(write, write.contains("tudi-jetbrains/"));
        // The IDE's name goes before tudi-jetbrains: that is what Code Tower shows.
        assertTrue(write, write.matches(".*--plugin \"?[a-z]+/\\S+ tudi-jetbrains/.*"));
    }

    private Path fakeCli() throws IOException {
        if (WINDOWS) {
            Path cli = home.resolve("tudi-cli.bat");
            Files.writeString(cli, String.join("\r\n",
                    "@echo off",
                    "echo %* >> \"%~dp0calls.log\"",
                    "if \"%1\"==\"--today\" echo 1 hr 2 mins",
                    ""), StandardCharsets.UTF_8);
            return cli;
        }
        Path cli = home.resolve("tudi-cli");
        Files.writeString(cli, String.join("\n",
                "#!/bin/sh",
                "echo \"$*\" >> \"$(dirname \"$0\")/calls.log\"",
                "if [ \"$1\" = \"--today\" ]; then echo '1 hr 2 mins'; fi",
                ""), StandardCharsets.UTF_8);
        cli.toFile().setExecutable(true);
        return cli;
    }

    private List<String> calls() {
        try {
            return Files.exists(log) ? Files.readAllLines(log) : List.of();
        } catch (IOException e) {
            return List.of();
        }
    }

    private void waitFor(java.util.function.BooleanSupplier condition) throws InterruptedException {
        long until = System.currentTimeMillis() + 15_000;
        while (!condition.getAsBoolean()) {
            if (System.currentTimeMillis() > until) fail("timed out; tudi-cli calls: " + calls());
            com.intellij.testFramework.PlatformTestUtil.dispatchAllEventsInIdeEventQueue();
            Thread.sleep(50);
        }
    }
}
