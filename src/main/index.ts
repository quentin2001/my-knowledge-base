import { app, shell, BrowserWindow, ipcMain, protocol, net, dialog } from 'electron'
import { join, dirname } from 'path'
import fs from 'fs'
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
  // --- 【新增核心逻辑】：注册自定义协议 local:// ---
  // 绕过 Electron 的物理限制，安全地将本地图片转换给前端
  // --- 【修复】：直接无缝转换为标准的 file 协议 ---
  protocol.handle('local', (request) => {
    // 此时的 request.url 已经是安全的 local:///C:/...
    // 我们直接把它替换成系统底层完美支持的 file:/// 即可！
    const fileUrl = request.url.replace('local://', 'file://')
    return net.fetch(fileUrl)
  })

  // 1. 注册保存图片的 IPC 通道
  ipcMain.handle('save-image', async (_event, arrayBuffer, fileName) => {
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

      // 【关键修复】：这里不要返回 file:// 了，返回我们刚才注册的 local:// 协议！
      return `local:///${filePath.replace(/\\/g, '/')}`
    } catch (error) {
      console.error('保存图片失败:', error)
      return null
    }
  })

  // --- 【新增】：导出 Markdown 文件 ---
  ipcMain.handle('export-md', async (_event, markdownContent: string) => {
    // 唤起系统的“另存为”弹窗
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出为 Markdown',
      defaultPath: '未命名笔记.md',
      filters: [{ name: 'Markdown 文件', extensions: ['md'] }]
    })

    if (!canceled && filePath) {
      // 写入文件
      fs.writeFileSync(filePath, markdownContent, 'utf-8')
      return true // 导出成功
    }
    return false // 用户取消了操作
  })

  // --- 【新增】：导入 Markdown 文件 ---
  ipcMain.handle('import-md', async () => {
    // 唤起系统的“选择文件”弹窗
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '导入 Markdown',
      properties: ['openFile'],
      filters: [{ name: 'Markdown 文件', extensions: ['md'] }]
    })

    if (!canceled && filePaths.length > 0) {
      // 读取文件内容并返回给前端
      const content = fs.readFileSync(filePaths[0], 'utf-8')
      return content
    }
    return null // 用户取消了操作
  })

  // ==================== 文件系统管理 ====================
  // 定义你的专属笔记根目录：文档/MyKnowledgeBase/Notes
  const workspaceDir = join(app.getPath('documents'), 'MyKnowledgeBase', 'Notes')

  // 确保根目录存在
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true })
    // 顺手给用户创建一个欢迎文件
    fs.writeFileSync(
      join(workspaceDir, '欢迎使用.md'),
      '# 🎉 欢迎来到你的专属知识库！\n在这里写下你的第一篇笔记吧。',
      'utf-8'
    )
  }

  // 1. 获取文件列表 (目前先做单层目录，后续我们再升级成无限嵌套的树形结构)
  ipcMain.handle('get-notes-list', async () => {
    try {
      const files = fs.readdirSync(workspaceDir)
      // 只返回 .md 文件，并附带绝对路径
      return files
        .filter((file) => file.endsWith('.md'))
        .map((file) => ({
          name: file.replace('.md', ''), // 隐藏后缀名好看一点
          fileName: file,
          path: join(workspaceDir, file)
        }))
    } catch (error) {
      console.error('读取目录失败:', error)
      return []
    }
  })
  // --- 【新增】：新建笔记 ---
  ipcMain.handle('create-note', async () => {
    try {
      const baseName = '未命名笔记'
      let fileName = `${baseName}.md`
      let filePath = join(workspaceDir, fileName)
      let counter = 1

      // 智能重名检测：如果"未命名笔记.md"存在，就自动变成"未命名笔记 1.md"
      while (fs.existsSync(filePath)) {
        fileName = `${baseName} ${counter}.md`
        filePath = join(workspaceDir, fileName)
        counter++
      }

      // 创建一个自带一级标题的空文件
      const initialContent = `# ${fileName.replace('.md', '')}\n\n`
      fs.writeFileSync(filePath, initialContent, 'utf-8')

      // 把新文件的数据返回给前端
      return {
        name: fileName.replace('.md', ''),
        fileName: fileName,
        path: filePath
      }
    } catch (error) {
      console.error('新建笔记失败:', error)
      return null
    }
  })
  // --- 【新增】：重命名笔记 ---
  ipcMain.handle('rename-file', async (_event, oldPath: string, newName: string) => {
    try {
      // 获取文件所在的目录
      const dir = dirname(oldPath)
      // 拼接新的文件路径 (别忘了加 .md 后缀)
      const newPath = join(dir, `${newName}.md`)
      // 如果新名字的文件已经存在，阻止重命名
      if (fs.existsSync(newPath)) {
        return { success: false, error: '文件名已存在' }
      }
      fs.renameSync(oldPath, newPath)
      return { success: true, newPath }
    } catch (error) {
      console.error('重命名失败:', error)
      return { success: false, error: '系统错误' }
    }
  })

  // --- 【新增】：安全删除笔记 ---
  ipcMain.handle('delete-file', async (_event, targetPath: string) => {
    try {
      // 强烈推荐！使用 shell.trashItem 会把文件放入系统的“回收站”，而不是永久销毁，给用户吃颗后悔药
      await shell.trashItem(targetPath)
      return true
    } catch (error) {
      console.error('删除失败:', error)
      return false
    }
  })
  // 2. 读取单个笔记内容
  ipcMain.handle('read-note', async (_event, filePath: string) => {
    try {
      return fs.readFileSync(filePath, 'utf-8')
    } catch (error) {
      console.error('读取笔记失败:', error)
      return ''
    }
  })

  // 3. 保存单个笔记内容 (用于后续的自动保存)
  ipcMain.handle('save-note', async (_event, filePath: string, content: string) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8')
      return true
    } catch (error) {
      console.error('保存笔记失败:', error)
      return false
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
