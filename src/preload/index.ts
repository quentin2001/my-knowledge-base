import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 自定义我们要暴露给 Vue 的 API
const api = {
  // 新增保存图片的桥梁方法
  saveImage: (arrayBuffer, fileName) => ipcRenderer.invoke('save-image', arrayBuffer, fileName)
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
