package com.tudidaily.tracker;

import com.intellij.openapi.options.Configurable;
import com.intellij.ui.components.JBTextField;
import com.intellij.util.ui.FormBuilder;
import javax.swing.JComponent;
import javax.swing.JPanel;

/** Settings | Tools | Tudi Tracker. Signing in is not here: Tudi Desktop does it for every editor at once. */
public final class TudiConfigurable implements Configurable {
    private final JBTextField cliPath = new JBTextField();
    private final JBTextField apiUrl = new JBTextField();

    @Override
    public String getDisplayName() {
        return "Tudi Tracker";
    }

    @Override
    public JComponent createComponent() {
        cliPath.getEmptyText().setText("~/.tudi/tudi-cli, then PATH");
        apiUrl.getEmptyText().setText("Tudi Daily");
        JPanel panel = FormBuilder.createFormBuilder()
                .addLabeledComponent("Path to tudi-cli:", cliPath)
                .addLabeledComponent("API url (development):", apiUrl)
                .addComponentFillVertically(new JPanel(), 0)
                .getPanel();
        reset();
        return panel;
    }

    @Override
    public boolean isModified() {
        TudiSettings.State state = TudiSettings.getInstance().getState();
        return !cliPath.getText().equals(state.cliPath) || !apiUrl.getText().equals(state.apiUrl);
    }

    @Override
    public void apply() {
        TudiSettings.State state = TudiSettings.getInstance().getState();
        state.cliPath = cliPath.getText().trim();
        state.apiUrl = apiUrl.getText().trim();
    }

    @Override
    public void reset() {
        TudiSettings.State state = TudiSettings.getInstance().getState();
        cliPath.setText(state.cliPath);
        apiUrl.setText(state.apiUrl);
    }
}
