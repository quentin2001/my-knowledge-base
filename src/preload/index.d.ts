import { ElectronAPI } from '@electron-toolkit/preload'

// 【升级】：支持文件夹和文件的树形结构
export interface FileNode {
  type: 'file' | 'folder'
  name: string
  path: string
  fileName?: string
  isOpen?: boolean
  children?: FileNode[]
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      saveImage: (buffer: ArrayBuffer, fileName: string) => Promise<string | null>
      // 【新增】
      // 【修改】
      getNotesList: (customPath?: string) => Promise<FileNode[]>
      createNote: (targetDir?: string) => Promise<FileNode | null> // 加上可选参数
      createFolder: (targetDir?: string) => Promise<FileNode | null> // 新增
      readNote: (filePath: string) => Promise<string>
      saveNote: (filePath: string, content: string) => Promise<boolean>
      renameFile: (
        oldPath: string,
        newName: string
      ) => Promise<{ success: boolean; newPath?: string; error?: string }>
      updateSortOrder: (dirPath: string, order: string[]) => Promise<boolean>
      moveNode: (
        oldPath: string,
        newDirPath: string
      ) => Promise<{ success: boolean; newPath?: string; error?: string }>
      deleteFile: (targetPath: string) => Promise<boolean>
      // 【新增】：补上类型声明
      openExternal: (type: 'file' | 'folder') => Promise<void>
      exportToExternal: (sourcePath: string, type: 'current' | 'all') => Promise<boolean>
      // 【新增】：类型声明
      getInitialPath: () => string | null
      getInitialFile: () => string | null
      getWindowEnv: () => Promise<{ folderPath?: string; fileToOpen?: string } | null>
    }
  }
}
