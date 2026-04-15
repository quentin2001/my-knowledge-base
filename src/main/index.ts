import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  protocol,
  net,
  dialog,
  OpenDialogOptions
} from 'electron'
import { join, dirname, basename } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs-extra' // 建议安装 npm install fs-extra 处理文件夹拷贝更方便

// 【新增】：记录每个窗口 ID 对应的专属路径
const windowStates = new Map<number, { folderPath?: string; fileToOpen?: string }>()
function createWindow(folderPath?: string, fileToOpen?: string): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false, // 默认隐藏，防止白屏闪烁
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // 【新增】：在窗口还健在时，提前把 ID 存到安全的局部变量里
  const currentWebContentsId = mainWindow.webContents.id

  // 【核心魔法】：立刻在小本本上登记它的 ID 和 路径
  windowStates.set(currentWebContentsId, { folderPath, fileToOpen })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 窗口关闭时，从小本本上划掉，防止内存泄漏
  mainWindow.on('closed', () => {
    // 【修复】：使用提前存好的 ID 进行清理，绝对安全！
    windowStates.delete(currentWebContentsId)
  })

  // HMR for renderer base on electron-vite cli.
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

  // --- 【处理打开逻辑】 ---
  ipcMain.handle('open-external', async (event, type: 'file' | 'folder') => {
    try {
      console.log(`👉 [步骤2] 主进程已收到请求，准备弹出系统框: ${type}`)

      // 【核心修复】：通过发送事件的 webContents，精准反查出是哪个窗口点的按钮
      const currentWindow = BrowserWindow.fromWebContents(event.sender) || undefined

      const options: OpenDialogOptions = {
        title: type === 'file' ? '选择 Markdown 文件' : '选择知识库文件夹',
        properties: type === 'file' ? ['openFile'] : ['openDirectory'],
        filters: type === 'file' ? [{ name: 'Markdown', extensions: ['md'] }] : []
      }

      // 强制依附在当前窗口上，绝对不会跑到后台或崩溃
      const result = currentWindow
        ? await dialog.showOpenDialog(currentWindow, options)
        : await dialog.showOpenDialog(options)

      console.log(`👉 [步骤3] 用户选择结果:`, result)

      if (!result.canceled && result.filePaths.length > 0) {
        const targetPath = result.filePaths[0]
        const isFile = fs.statSync(targetPath).isFile()

        const workspacePath = isFile ? dirname(targetPath) : targetPath
        const targetFile = isFile ? targetPath : undefined

        console.log(`👉 [步骤4] 准备创建新窗口, 目录: ${workspacePath}, 文件: ${targetFile}`)
        createWindow(workspacePath, targetFile)
      }
    } catch (error) {
      console.error('❌ [步骤 X] 主进程处理打开事件时遭遇致命错误:', error)
    }
  })

  // --- 【新增】：处理导出逻辑 ---
  ipcMain.handle(
    'export-to-external',
    async (_event, sourcePath: string, type: 'current' | 'all') => {
      const isFolder = type === 'all'
      const result = await dialog.showSaveDialog({
        title: isFolder ? '选择导出文件夹位置' : '导出当前文档',
        defaultPath: isFolder ? '我的笔记导出' : '未命名文档.md',
        buttonLabel: '点击导出'
      })

      if (!result.filePath) return false

      try {
        if (isFolder) {
          // 使用 fs-extra 的 copySync 递归拷贝整个文件夹
          await fs.copy(sourcePath, result.filePath)
        } else {
          // 拷贝单个文件
          await fs.copy(sourcePath, result.filePath)
        }
        // 成功后自动打开所在文件夹（Notion 式的贴心体验）
        shell.showItemInFolder(result.filePath)
        return true
      } catch (err) {
        console.error('导出失败:', err)
        return false
      }
    }
  )

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
  // 【新增】：在主进程也定义好这个严谨的接口，消灭 any
  interface FileNode {
    type: 'file' | 'folder'
    name: string
    path: string
    fileName?: string
    isOpen?: boolean
    children?: FileNode[]
  }

  // --- 【升级】：支持自定义排序的构建树函数 ---
  const buildFileTree = (dirPath: string): FileNode[] => {
    const result: FileNode[] = []
    const items = fs.readdirSync(dirPath, { withFileTypes: true })

    for (const item of items) {
      // 过滤掉我们自己生成的隐藏排序文件和非 md 文件
      if (item.name.startsWith('.')) continue
      if (item.isFile() && !item.name.endsWith('.md')) continue

      const fullPath = join(dirPath, item.name)
      if (item.isDirectory()) {
        result.push({
          type: 'folder',
          name: item.name,
          fileName: item.name, // 记录真实的系统文件名，用于排序
          path: fullPath,
          isOpen: false,
          children: buildFileTree(fullPath)
        })
      } else {
        result.push({
          type: 'file',
          name: item.name.replace('.md', ''),
          fileName: item.name, // 同样记录真实文件名
          path: fullPath
        })
      }
    }

    // 【新增】：读取当前目录下的 .sort.json 记忆文件
    const sortMetaPath = join(dirPath, '.sort.json')
    let sortOrder: string[] = []
    if (fs.existsSync(sortMetaPath)) {
      try {
        sortOrder = JSON.parse(fs.readFileSync(sortMetaPath, 'utf-8'))
      } catch (e) {
        // 忽略 JSON 解析错误
        console.error('解析 .sort.json 失败:', e)
      }
    }

    // 【新增】：根据记忆顺序进行排序
    result.sort((a, b) => {
      const indexA = sortOrder.indexOf(a.fileName!)
      const indexB = sortOrder.indexOf(b.fileName!)

      // 如果两个文件都在记忆列表里，按记忆顺序排
      if (indexA !== -1 && indexB !== -1) return indexA - indexB
      if (indexA !== -1) return -1
      if (indexB !== -1) return 1

      // 兜底策略：新创建的、没有记忆的文件，文件夹排前面，然后按字母排
      if (a.type === b.type) return a.name.localeCompare(b.name)
      return a.type === 'folder' ? -1 : 1
    })

    return result
  }
  // 【修改】：接收自定义路径，如果没有传，就默认使用工作区(workspaceDir)
  ipcMain.handle('get-notes-list', async (_event, customPath?: string) => {
    try {
      return buildFileTree(customPath || workspaceDir)
    } catch (error) {
      console.error('读取目录树失败:', error)
      return []
    }
  })
  // --- 【新增】：新建笔记 ---
  // --- 【修改】：在指定目录下新建笔记 ---
  // 接收一个 targetDir 参数，如果没传，就默认在根目录(workspaceDir)创建
  ipcMain.handle('create-note', async (_event, targetDir?: string) => {
    try {
      const parentDir = targetDir || workspaceDir
      const baseName = '未命名笔记'
      let fileName = `${baseName}.md`
      let filePath = join(parentDir, fileName)
      let counter = 1

      while (fs.existsSync(filePath)) {
        fileName = `${baseName} ${counter}.md`
        filePath = join(parentDir, fileName)
        counter++
      }

      const initialContent = `# ${fileName.replace('.md', '')}\n\n`
      fs.writeFileSync(filePath, initialContent, 'utf-8')

      return { type: 'file', name: fileName.replace('.md', ''), fileName, path: filePath }
    } catch (error) {
      console.error('新建笔记失败:', error)
      return null
    }
  })

  // --- 【新增】：在指定目录下新建文件夹 ---
  ipcMain.handle('create-folder', async (_event, targetDir?: string) => {
    try {
      const parentDir = targetDir || workspaceDir
      let folderName = '新建文件夹'
      let folderPath = join(parentDir, folderName)
      let counter = 1

      while (fs.existsSync(folderPath)) {
        folderName = `新建文件夹 ${counter}`
        folderPath = join(parentDir, folderName)
        counter++
      }

      fs.mkdirSync(folderPath)
      return { type: 'folder', name: folderName, path: folderPath, isOpen: true, children: [] }
    } catch (error) {
      console.error('新建文件夹失败:', error)
      return null
    }
  })
  // --- 【修复】：重命名笔记（区分文件和文件夹） ---
  ipcMain.handle('rename-file', async (_event, oldPath: string, newName: string) => {
    try {
      // 获取文件所在的目录（利用咱们之前在顶部引入的 dirname）
      const dir = dirname(oldPath)

      // 【核心修复】：探查老路径到底是一个文件夹还是文件
      const isDir = fs.statSync(oldPath).isDirectory()

      // 如果是文件夹，新名字直接拼接；如果是文件，才加上 .md 小尾巴
      const newPath = isDir ? join(dir, newName) : join(dir, `${newName}.md`)

      if (fs.existsSync(newPath)) {
        return { success: false, error: '名称已存在' }
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

  // --- 【新增】：保存目录的自定义排序 ---
  ipcMain.handle('update-sort-order', async (_event, dirPath: string, order: string[]) => {
    try {
      const sortMetaPath = join(dirPath, '.sort.json')
      fs.writeFileSync(sortMetaPath, JSON.stringify(order), 'utf-8')
      return true
    } catch (e) {
      console.error('保存排序失败:', e)
      return false
    }
  })

  // --- 【新增】：跨文件夹拖拽时的物理移动 ---
  ipcMain.handle('move-node', async (_event, oldPath: string, newDirPath: string) => {
    try {
      const fileName = basename(oldPath)
      const newPath = join(newDirPath, fileName)

      // 如果原地拖拽，不报错
      if (oldPath === newPath) return { success: true, newPath }

      // 防止覆盖同名文件
      if (fs.existsSync(newPath)) {
        return { success: false, error: '目标文件夹已存在同名文件！' }
      }

      fs.renameSync(oldPath, newPath)
      return { success: true, newPath }
    } catch (error) {
      console.error('移动文件失败:', error)
      return { success: false, error: '跨文件夹移动失败' }
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

// 【新增】：前端通过这个通道，来查询自己的身世（专属路径）
ipcMain.handle('get-window-env', (event) => {
  // event.sender.id 就是发出请求的那个窗口的 ID
  return windowStates.get(event.sender.id) || null
})
