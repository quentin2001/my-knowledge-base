import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    // 【修复】：把原来的 unknown 替换成我们真实的接口定义
    api: {
      saveImage: (buffer: ArrayBuffer, fileName: string) => Promise<string | null>
    }
  }
}
