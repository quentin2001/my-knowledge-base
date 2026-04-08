import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // 原有的保存图片
  saveImage: (buffer: ArrayBuffer, fileName: string) =>
    ipcRenderer.invoke('save-image', buffer, fileName),

  // 【新增】：文件管理 API
  getNotesList: () => ipcRenderer.invoke('get-notes-list'),
  readNote: (filePath: string) => ipcRenderer.invoke('read-note', filePath),
  saveNote: (filePath: string, content: string) =>
    ipcRenderer.invoke('save-note', filePath, content),
  // 【新增】暴露新建方法
  createNote: () => ipcRenderer.invoke('create-note'),
  // 【新增】：暴露重命名和删除方法
  renameFile: (oldPath: string, newName: string) =>
    ipcRenderer.invoke('rename-file', oldPath, newName),
  deleteFile: (targetPath: string) => ipcRenderer.invoke('delete-file', targetPath)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api) // 确保这里暴露了我们的 api 对象
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
