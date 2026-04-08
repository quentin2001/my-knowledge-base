import { ElectronAPI } from '@electron-toolkit/preload'

// 定义一下文件条目的类型
export interface NoteFile {
  name: string
  fileName: string
  path: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      saveImage: (buffer: ArrayBuffer, fileName: string) => Promise<string | null>
      // 【新增】
      getNotesList: () => Promise<NoteFile[]>
      readNote: (filePath: string) => Promise<string>
      saveNote: (filePath: string, content: string) => Promise<boolean>
    }
  }
}
