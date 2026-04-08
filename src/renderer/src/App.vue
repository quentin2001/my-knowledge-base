<template>
  <div class="app-container">
    <aside class="sidebar-files" @contextmenu.prevent="showRootContextMenu($event)">
      <div class="sidebar-header">
        <span>📚 我的知识库</span>
      </div>

      <draggable
        class="file-list"
        :list="notes"
        group="files"
        item-key="path"
        :animation="200"
        @change="onRootDragChange"
      >
        <template #item="{ element }">
          <FileTreeNode
            :node="element"
            :depth="0"
            :active-path="activeFilePath"
            @open-file="openNote"
            @show-context-menu="showContextMenu"
            @toggle-folder="handleToggleFolder"
            @drag-event="handleDragEvent"
            @native-drop="handleNativeDrop"
          />
        </template>
      </draggable>
    </aside>

    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <div class="menu-item" @click="createNewNote(contextMenu.file)">📄 新建笔记</div>
      <div class="menu-item" @click="createNewFolder(contextMenu.file)">📁 新建文件夹</div>
      <template v-if="contextMenu.file !== null">
        <div class="divider"></div>
        <div class="menu-item" @click="startRename">✏️ 重命名</div>
        <div class="menu-item delete" @click="deleteNote">🗑️ 删除</div>
      </template>
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
import { ref, onMounted, nextTick, onBeforeUnmount, provide } from 'vue'
import draggable from 'vuedraggable' // 【新增引入】
import TiptapEditor from './components/TiptapEditor.vue'
import FileTreeNode from './components/FileTreeNode.vue'

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

// 【新增】：在这里也加上拖拽事件的严谨类型
interface DragChangeEvent {
  added?: { element: FileNode; newIndex: number }
  removed?: { element: FileNode; oldIndex: number }
  moved?: { element: FileNode; oldIndex: number; newIndex: number }
}

const notes = ref<FileNode[]>([])
const activeFilePath = ref<string>('')
const editorRef = ref<EditorComponent | null>(null)
const openedFolders = ref<Set<string>>(new Set())
const rootWorkspacePath = ref<string>('')

// 【新增核心魔法】：创建一个全局共享的“幽灵变量”，记住你按下了谁
const globalDraggedNode = ref<FileNode | null>(null)
provide('globalDraggedNode', globalDraggedNode)

const getParentDir = (path: string): string => {
  const normalized = path.replace(/\\/g, '/')
  return normalized.substring(0, normalized.lastIndexOf('/'))
}

const handleToggleFolder = (node: FileNode): void => {
  node.isOpen = !node.isOpen
  if (node.isOpen) openedFolders.value.add(node.path)
  else openedFolders.value.delete(node.path)
}

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
  restoreFolderState(fileList)
  notes.value = fileList
  // 巧妙地获取底层的根目录路径
  if (fileList.length > 0 && !rootWorkspacePath.value) {
    rootWorkspacePath.value = getParentDir(fileList[0].path)
  }
}

const openNote = async (file: FileNode): Promise<void> => {
  if (file.type === 'folder') return
  activeFilePath.value = file.path
  const content = await window.api.readNote(file.path)
  if (editorRef.value) editorRef.value.loadContent(content)
}

// ==================== 拖拽排序核心逻辑 ====================

// 【修复】：将 evt: any 改为 evt: DragChangeEvent
const handleDragEvent = async (payload: {
  evt: DragChangeEvent
  parentPath: string
  children: FileNode[]
}): Promise<void> => {
  const { evt, parentPath, children } = payload
  if (!parentPath) return

  // 1. 同级排序（顺序改变了）
  if (evt.moved) {
    const order = children.map((c) => c.fileName || '')
    await window.api.updateSortOrder(parentPath, order)
  }

  // 2. 跨文件夹移动（把外面文件拖进来了）
  if (evt.added) {
    const movedNode = evt.added.element
    const result = await window.api.moveNode(movedNode.path, parentPath)
    if (result.success) {
      // 物理移动成功后，保存新文件夹里的排序
      const order = children.map((c) => c.fileName || '')
      await window.api.updateSortOrder(parentPath, order)

      // 重新加载彻底刷新路径，并恢复选中状态
      await loadFiles()
      if (activeFilePath.value === movedNode.path) activeFilePath.value = result.newPath!
    } else {
      alert(result.error)
      await loadFiles() // 移动失败，还原 UI
    }
  }
}

// 【修复】：将 evt: any 改为 evt: DragChangeEvent
const onRootDragChange = (evt: DragChangeEvent): void => {
  handleDragEvent({ evt, parentPath: rootWorkspacePath.value, children: notes.value })
}

// 【新增】：处理鼠标直接松开在文件夹名字上的“物理空投”
const handleNativeDrop = async (payload: {
  draggedNode: FileNode
  targetFolder: FileNode
}): Promise<void> => {
  const { draggedNode, targetFolder } = payload

  // 呼叫后端直接把文件移动过去
  const result = await window.api.moveNode(draggedNode.path, targetFolder.path)

  if (result.success) {
    // 极其丝滑的体验：把文件扔进去后，自动帮你展开这个文件夹！
    openedFolders.value.add(targetFolder.path)
    await loadFiles() // 刷新列表

    // 如果你正开着这个文件，更新一下它的路径，防止报错
    if (activeFilePath.value === draggedNode.path) {
      activeFilePath.value = result.newPath!
    }
  } else {
    alert(result.error)
  }
}

// ==================== 右键菜单核心逻辑 ====================
const contextMenu = ref({ show: false, x: 0, y: 0, file: null as FileNode | null })
const showContextMenu = (payload: { event: MouseEvent; node: FileNode }): void => {
  contextMenu.value = {
    show: true,
    x: payload.event.clientX,
    y: payload.event.clientY,
    file: payload.node
  }
}
const showRootContextMenu = (event: MouseEvent): void => {
  contextMenu.value = { show: true, x: event.clientX, y: event.clientY, file: null }
}
const closeContextMenu = (): void => {
  contextMenu.value.show = false
}

const createNewNote = async (targetNode: FileNode | null): Promise<void> => {
  let targetDir = targetNode
    ? targetNode.type === 'folder'
      ? targetNode.path
      : getParentDir(targetNode.path)
    : undefined
  const newNote = await window.api.createNote(targetDir)
  if (newNote) {
    if (targetDir) openedFolders.value.add(targetDir)
    await loadFiles()
    openNote(newNote)
  }
  closeContextMenu()
}

const createNewFolder = async (targetNode: FileNode | null): Promise<void> => {
  let targetDir = targetNode
    ? targetNode.type === 'folder'
      ? targetNode.path
      : getParentDir(targetNode.path)
    : undefined
  const newFolder = await window.api.createFolder(targetDir)
  if (newFolder) {
    if (targetDir) openedFolders.value.add(targetDir)
    await loadFiles()
  }
  closeContextMenu()
}

// ==================== 重命名与删除逻辑 ====================
const renamingPath = ref('')
const renameInput = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

const startRename = async (): Promise<void> => {
  if (!contextMenu.value.file) return
  renamingPath.value = contextMenu.value.file.path
  renameInput.value = contextMenu.value.file.name
  closeContextMenu()
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

  if (!newName || (file && newName === file.name)) return cancelRename()

  const result = await window.api.renameFile(oldPath, newName)
  if (result.success) {
    if (openedFolders.value.has(oldPath)) {
      openedFolders.value.delete(oldPath)
      openedFolders.value.add(result.newPath!)
    }
    await loadFiles()
    if (activeFilePath.value === oldPath) activeFilePath.value = result.newPath!
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
