<template>
  <div class="app-container">
    <aside class="sidebar-files">
      <div class="sidebar-header">
        <span>📚 我的知识库</span>
        <div class="header-actions">
          <button class="new-btn" title="新建文件夹" @click="createNewFolder(null)">📁</button>
          <button class="new-btn" title="新建笔记" @click="createNewNote(null)">➕</button>
        </div>
      </div>

      <div class="file-list">
        <FileTreeNode
          v-for="node in notes"
          :key="node.path"
          :node="node"
          :depth="0"
          :active-path="activeFilePath"
          @open-file="openNote"
          @show-context-menu="showContextMenu"
          @toggle-folder="handleToggleFolder"
        />
      </div>
    </aside>

    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <div class="menu-item" @click="createNewNote(contextMenu.file)">📄 新建笔记</div>
      <div class="menu-item" @click="createNewFolder(contextMenu.file)">📁 新建文件夹</div>
      <div class="divider"></div>
      <div class="menu-item" @click="startRename">✏️ 重命名</div>
      <div class="menu-item delete" @click="deleteNote">🗑️ 删除</div>
    </div>

    <div v-if="renamingPath" class="rename-overlay">
      <div class="rename-modal" @click.stop>
        <div class="modal-title">重命名</div>
        <input
          ref="renameInputRef"
          v-model="renameInput"
          class="rename-input-large"
          @keyup.enter="submitRename"
          @keyup.esc="cancelRename"
        />
        <div class="modal-actions">
          <button class="btn-cancel" @click="cancelRename">取消</button>
          <button class="btn-confirm" @click="submitRename">确定</button>
        </div>
      </div>
    </div>

    <main class="main-content">
      <TiptapEditor ref="editorRef" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue'
import TiptapEditor from './components/TiptapEditor.vue'
import FileTreeNode from './components/FileTreeNode.vue' // 【引入魔法树组件】

// 核心类型定义
interface FileNode {
  type: 'file' | 'folder'
  name: string
  path: string
  fileName?: string
  isOpen?: boolean
  children?: FileNode[]
}

interface EditorComponent {
  loadContent: (content: string) => void
}

// 核心状态
const notes = ref<FileNode[]>([])
const activeFilePath = ref<string>('')
const editorRef = ref<EditorComponent | null>(null)

// 【状态记忆】：记住哪些文件夹是被展开的
const openedFolders = ref<Set<string>>(new Set())

// ==================== 文件树操作逻辑 ====================

// 处理文件夹折叠/展开
const handleToggleFolder = (node: FileNode): void => {
  node.isOpen = !node.isOpen
  if (node.isOpen) {
    openedFolders.value.add(node.path)
  } else {
    openedFolders.value.delete(node.path)
  }
}

// 递归恢复文件夹的展开状态（因为刷新列表时数据会重载）
const restoreFolderState = (nodes: FileNode[]): void => {
  for (const node of nodes) {
    if (node.type === 'folder') {
      node.isOpen = openedFolders.value.has(node.path)
      if (node.children) restoreFolderState(node.children)
    }
  }
}

const loadFiles = async (): Promise<void> => {
  const fileList = await window.api.getNotesList()
  restoreFolderState(fileList) // 恢复展开状态
  notes.value = fileList
}

const openNote = async (file: FileNode): Promise<void> => {
  if (file.type === 'folder') return // 文件夹不可阅读
  activeFilePath.value = file.path
  const content = await window.api.readNote(file.path)
  if (editorRef.value) {
    editorRef.value.loadContent(content)
  }
}

// ==================== 右键菜单与新建逻辑 ====================

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  file: null as FileNode | null
})

// 显示右键菜单（接收来自子组件的事件）
const showContextMenu = (payload: { event: MouseEvent; node: FileNode }): void => {
  contextMenu.value = {
    show: true,
    x: payload.event.clientX,
    y: payload.event.clientY,
    file: payload.node
  }
}

const closeContextMenu = (): void => {
  contextMenu.value.show = false
}

// 智能获取父目录（用于判断新建文件放在哪）
const getParentDir = (path: string): string => {
  const normalized = path.replace(/\\/g, '/')
  return normalized.substring(0, normalized.lastIndexOf('/'))
}

// 新建笔记
const createNewNote = async (targetNode: FileNode | null): Promise<void> => {
  let targetDir: string | undefined = undefined
  if (targetNode) {
    // 如果右键的是文件夹，就在该文件夹下建；如果是文件，就在文件同级建
    targetDir = targetNode.type === 'folder' ? targetNode.path : getParentDir(targetNode.path)
  }
  const newNote = await window.api.createNote(targetDir)
  if (newNote) {
    if (targetDir) openedFolders.value.add(targetDir) // 自动展开父文件夹
    await loadFiles()
    openNote(newNote)
  }
  closeContextMenu()
}

// 新建文件夹
const createNewFolder = async (targetNode: FileNode | null): Promise<void> => {
  let targetDir: string | undefined = undefined
  if (targetNode) {
    targetDir = targetNode.type === 'folder' ? targetNode.path : getParentDir(targetNode.path)
  }
  const newFolder = await window.api.createFolder(targetDir)
  if (newFolder) {
    if (targetDir) openedFolders.value.add(targetDir)
    await loadFiles()
  }
  closeContextMenu()
}

// ==================== 全局重命名与删除逻辑 ====================

const renamingPath = ref('')
const renameInput = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

const startRename = async (): Promise<void> => {
  if (!contextMenu.value.file) return
  renamingPath.value = contextMenu.value.file.path
  renameInput.value = contextMenu.value.file.name
  closeContextMenu()

  // 弹出重命名框并自动聚焦
  await nextTick()
  if (renameInputRef.value) {
    renameInputRef.value.focus()
    renameInputRef.value.select()
  }
}

const submitRename = async (): Promise<void> => {
  if (!renamingPath.value) return
  const oldPath = renamingPath.value
  const newName = renameInput.value.trim()
  const file = contextMenu.value.file

  if (!newName || (file && newName === file.name)) {
    cancelRename()
    return
  }

  const result = await window.api.renameFile(oldPath, newName)
  if (result.success) {
    // 如果重命名了已展开的文件夹，更新记忆状态
    if (openedFolders.value.has(oldPath)) {
      openedFolders.value.delete(oldPath)
      openedFolders.value.add(result.newPath!)
    }
    await loadFiles()
    if (activeFilePath.value === oldPath) {
      activeFilePath.value = result.newPath!
    }
  } else {
    alert(result.error)
  }
  cancelRename()
}

const cancelRename = (): void => {
  renamingPath.value = ''
  renameInput.value = ''
}

const deleteNote = async (): Promise<void> => {
  const file = contextMenu.value.file
  if (!file) return
  closeContextMenu()

  const typeName = file.type === 'folder' ? '文件夹' : '笔记'
  if (confirm(`确定要将${typeName} "${file.name}" 放入回收站吗？`)) {
    const success = await window.api.deleteFile(file.path)
    if (success) {
      await loadFiles()
      if (activeFilePath.value === file.path) {
        activeFilePath.value = ''
        if (editorRef.value) editorRef.value.loadContent('')
      }
    }
  }
}

onMounted(async () => {
  window.addEventListener('click', closeContextMenu)
  await loadFiles()

  // 初始化时，如果根目录有笔记，自动打开第一篇
  if (notes.value.length > 0) {
    const firstFile = notes.value.find((n) => n.type === 'file')
    if (firstFile) openNote(firstFile)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('click', closeContextMenu)
})
</script>

<style>
/* 全局重置保持不变 */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: #f5f7fa;
}
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* 侧边栏与头部 */
.sidebar-files {
  width: 260px;
  background-color: #202020;
  color: #a3a3a3;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #111;
}
.sidebar-header {
  padding: 16px;
  font-size: 13px;
  font-weight: bold;
  color: #fff;
  letter-spacing: 1px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #333;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.new-btn {
  background: transparent;
  border: none;
  color: #a3a3a3;
  font-size: 15px;
  cursor: pointer;
  transition: color 0.2s;
  padding: 0;
}
.new-btn:hover {
  color: #fff;
}

/* 列表区 */
.file-list {
  padding: 10px 8px;
  overflow-y: auto;
  flex: 1;
}
.main-content {
  flex: 1;
  display: flex;
  min-width: 0;
}

/* 右键菜单进阶版 */
.context-menu {
  position: fixed;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 4px;
  z-index: 9999;
  min-width: 140px;
}
.context-menu .menu-item {
  padding: 6px 12px;
  font-size: 13px;
  color: #ccc;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.context-menu .menu-item:hover {
  background: #444;
  color: #fff;
}
.context-menu .menu-item.delete:hover {
  background: #e03131;
  color: #fff;
}
.divider {
  height: 1px;
  background: #444;
  margin: 4px 0;
}

/* 全局高质感重命名弹窗 */
.rename-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}
.rename-modal {
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 20px;
  width: 300px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.modal-title {
  color: #fff;
  font-weight: bold;
  margin-bottom: 12px;
  font-size: 14px;
}
.rename-input-large {
  width: 100%;
  box-sizing: border-box;
  background: #1a1a1a;
  border: 1px solid #555;
  color: #fff;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 14px;
  outline: none;
  margin-bottom: 16px;
}
.rename-input-large:focus {
  border-color: #68cef8;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn-cancel,
.btn-confirm {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: none;
}
.btn-cancel {
  background: #444;
  color: #ccc;
}
.btn-cancel:hover {
  background: #555;
  color: #fff;
}
.btn-confirm {
  background: #68cef8;
  color: #000;
  font-weight: bold;
}
.btn-confirm:hover {
  background: #56b2d8;
}
</style>
