package com.tudidaily.tracker;

import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.components.PersistentStateComponent;
import com.intellij.openapi.components.Service;
import com.intellij.openapi.components.State;
import com.intellij.openapi.components.Storage;
import org.jetbrains.annotations.NotNull;

/** The two settings the VS Code extension has too: tudi-cli's path and an API url for development. */
@Service(Service.Level.APP)
@State(name = "TudiTracker", storages = @Storage("tudi-tracker.xml"))
public final class TudiSettings implements PersistentStateComponent<TudiSettings.State> {
    public static final class State {
        /** Empty: ~/.tudi/tudi-cli, then PATH. */
        public String cliPath = "";
        /** Empty: Tudi Daily. */
        public String apiUrl = "";
    }

    private State state = new State();

    public static TudiSettings getInstance() {
        return ApplicationManager.getApplication().getService(TudiSettings.class);
    }

    @Override
    public @NotNull State getState() {
        return state;
    }

    @Override
    public void loadState(@NotNull State loaded) {
        state = loaded;
    }
}
