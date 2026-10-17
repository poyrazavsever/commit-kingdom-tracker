package com.tudidaily.tracker;

import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.util.IconLoader;
import com.intellij.openapi.util.NlsContexts;
import com.intellij.openapi.wm.CustomStatusBarWidget;
import com.intellij.openapi.wm.StatusBar;
import com.intellij.openapi.wm.StatusBarWidget;
import com.intellij.openapi.wm.StatusBarWidgetFactory;
import com.intellij.ui.components.JBLabel;
import com.intellij.util.ui.JBUI;
import java.awt.Cursor;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import javax.swing.Icon;
import javax.swing.JComponent;
import org.jetbrains.annotations.NotNull;

/** "🔥 Tudi: set up" until Tudi Desktop signs in, then today's coding; a click sets up or refreshes. */
public final class TudiStatusWidget implements CustomStatusBarWidget {
    public static final String ID = "TudiTracker";
    private static final Icon FLAME = IconLoader.getIcon("/icons/flame.svg", TudiStatusWidget.class);

    private final JBLabel label = new JBLabel(FLAME);

    TudiStatusWidget() {
        label.setBorder(JBUI.Borders.empty(0, 6));
        label.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        label.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent event) {
                TudiTracker.getInstance().statusClicked();
            }
        });
        TudiTracker tracker = TudiTracker.getInstance();
        tracker.onStatusChange(() -> ApplicationManager.getApplication().invokeLater(this::show), this);
        show();
    }

    private void show() {
        TudiTracker.Status status = TudiTracker.getInstance().status();
        label.setText(status.text());
        label.setToolTipText(status.tooltip());
    }

    @Override
    public @NotNull String ID() {
        return ID;
    }

    @Override
    public JComponent getComponent() {
        return label;
    }

    @Override
    public void install(@NotNull StatusBar statusBar) {
    }

    @Override
    public void dispose() {
    }

    public static final class Factory implements StatusBarWidgetFactory {
        @Override
        public @NotNull String getId() {
            return ID;
        }

        @Override
        public @NotNull @NlsContexts.ConfigurableName String getDisplayName() {
            return "Tudi Tracker";
        }

        @Override
        public @NotNull StatusBarWidget createWidget(@NotNull Project project) {
            return new TudiStatusWidget();
        }
    }
}
