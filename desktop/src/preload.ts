import { contextBridge, ipcRenderer } from 'electron';

/** The only things the window may ask of Tudi Desktop; it never sees the device key. */
contextBridge.exposeInMainWorld('tudi', {
  state: () => ipcRenderer.invoke('state'),
  signIn: () => ipcRenderer.invoke('sign-in'),
  cancelSignIn: () => ipcRenderer.invoke('cancel-sign-in'),
  rename: (name: string) => ipcRenderer.invoke('rename', name),
  signOut: () => ipcRenderer.invoke('sign-out'),
  openApp: () => ipcRenderer.invoke('open-app'),
  installExtension: (id: string) => ipcRenderer.invoke('install-extension', id),
  onState: (listener: (state: unknown) => void) => ipcRenderer.on('state', (_event, state) => listener(state)),
});
