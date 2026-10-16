import { contextBridge, ipcRenderer } from 'electron';

/** The always-on-top Tudi only listens; it can ask Tudi Desktop for nothing. */
contextBridge.exposeInMainWorld('mascot', {
  onView: (listener: (view: unknown) => void) => ipcRenderer.on('mascot', (_event, view) => listener(view)),
});
