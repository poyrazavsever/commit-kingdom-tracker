package com.tudidaily.tracker;

import com.intellij.openapi.editor.Document;
import com.intellij.openapi.editor.event.DocumentEvent;
import com.intellij.openapi.editor.event.DocumentListener;
import com.intellij.openapi.fileEditor.FileDocumentManagerListener;
import com.intellij.openapi.fileEditor.FileEditorManagerEvent;
import com.intellij.openapi.fileEditor.FileEditorManagerListener;
import org.jetbrains.annotations.NotNull;

/** The three moments that become heartbeats, registered in plugin.xml: typing, saving and switching files. */
public final class TudiListeners {
    private TudiListeners() {
    }

    public static final class Typing implements DocumentListener {
        @Override
        public void documentChanged(@NotNull DocumentEvent event) {
            TudiTracker.getInstance().documentChanged(event.getDocument(), event.getOldFragment(), event.getNewFragment());
        }
    }

    public static final class Saving implements FileDocumentManagerListener {
        @Override
        public void beforeDocumentSaving(@NotNull Document document) {
            TudiTracker.getInstance().documentSaved(document);
        }
    }

    public static final class Switching implements FileEditorManagerListener {
        @Override
        public void selectionChanged(@NotNull FileEditorManagerEvent event) {
            TudiTracker.getInstance().fileOpened(event.getNewFile());
        }
    }
}
