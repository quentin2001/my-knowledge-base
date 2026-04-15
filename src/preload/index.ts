import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // 原有的保存图片
  saveImage: (buffer: ArrayBuffer, fileName: string) =>
    ipcRenderer.invoke('save-image', buffer, fileName),

  // 【新增】：文件管理 API
  // 【修改】
  getNotesList: (customPath?: string) => ipcRenderer.invoke('get-notes-list', customPath),
  readNote: (filePath: string) => ipcRenderer.invoke('read-note', filePath),
  saveNote: (filePath: string, content: string) =>
    ipcRenderer.invoke('save-note', filePath, content),
  // 【新增】暴露新建方法
  createNote: (targetDir?: string) => ipcRenderer.invoke('create-note', targetDir),
  createFolder: (targetDir?: string) => ipcRenderer.invoke('create-folder', targetDir),
  // 【新增】：暴露重命名和删除方法
  renameFile: (oldPath: string, newName: string) =>
    ipcRenderer.invoke('rename-file', oldPath, newName),
  deleteFile: (targetPath: string) => ipcRenderer.invoke('delete-file', targetPath),
  updateSortOrder: (dirPath: string, order: string[]) =>
    ipcRenderer.invoke('update-sort-order', dirPath, order),
  moveNode: (oldPath: string, newDirPath: string) =>
    ipcRenderer.invoke('move-node', oldPath, newDirPath),
  // 【新增】：补上缺失的打开和导出桥梁
  openExternal: (type: 'file' | 'folder') => ipcRenderer.invoke('open-external', type),
  exportToExternal: (sourcePath: string, type: 'current' | 'all') =>
    ipcRenderer.invoke('export-to-external', sourcePath, type),
  // 【新增】：安全地获取 Node.js 层的启动参数
  getInitialPath: () => {
    const prefix = '--initial-path='
    const pathArg = process.argv.find((arg) => arg.startsWith(prefix))
    // 【修复】：使用 substring 精准截取，哪怕路径里有等号也不怕
    return pathArg ? pathArg.substring(prefix.length) : null
  },
  getInitialFile: () => {
    const prefix = '--open-file='
    const fileArg = process.argv.find((arg) => arg.startsWith(prefix))
    return fileArg ? fileArg.substring(prefix.length) : null
  },
  // 【新增】：查询当前窗口环境的桥梁
  getWindowEnv: () => ipcRenderer.invoke('get-window-env')
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
