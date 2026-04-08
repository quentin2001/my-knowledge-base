import { app, BrowserWindow, shell, ipcMain } from 'electron' // 确保 ipcMain 被引入
import { join } from 'path'
import fs from 'fs'
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  // 加上这一行，让它每次启动都自动打开调试工具！
  mainWindow.webContents.openDevTools()

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // 1. 注册保存图片的 IPC 通道
  ipcMain.handle('save-image', async (event, arrayBuffer, fileName) => {
    try {
      // 【重点】这里我们先临时写死一个你电脑上的测试目录，比如文档下的 MyKnowledgeBase
      // 等我们下一步做“打开/保存 md 文件”功能时，再把这里换成动态的当前笔记目录
      const targetDir = join(app.getPath('documents'), 'MyKnowledgeBase', 'images')

      // 如果文件夹不存在，就自动创建它
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }

      // 组合完整的文件路径
      const filePath = join(targetDir, fileName)

      // 将前端传来的 ArrayBuffer 转换为 Node.js 可以写入的 Buffer 并保存
      const buffer = Buffer.from(arrayBuffer)
      fs.writeFileSync(filePath, buffer)

      // 返回一个本地可以访问的绝对路径给前端显示（添加 file:// 协议）
      return `file://${filePath.replace(/\\/g, '/')}`
    } catch (error) {
      console.error('保存图片失败:', error)
      return null
    }
  })
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
