import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('meanwaile', {});
