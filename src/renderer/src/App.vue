<template>
  <div class="app-container">
    <aside class="sidebar-files">
      <div class="sidebar-header">
        <span>📚 我的知识库</span>
        <button class="new-note-btn" title="新建笔记" @click="createNewNote">＋</button>
      </div>
      <div class="file-list">
        <div
          v-for="file in notes"
          :key="file.path"
          class="file-item"
          :class="{ 'is-active': activeFilePath === file.path }"
          @click="openNote(file)"
          @contextmenu.prevent="showContextMenu($event, file)"
        >
          📄
          <input
            v-if="renamingPath === file.path"
            ref="renameInputRef"
            v-model="renameInput"
            class="rename-input"
            @blur="submitRename"
            @keyup.enter="submitRename"
            @keyup.esc="cancelRename"
          />
          <span v-else>{{ file.name }}</span>
        </div>
      </div>
    </aside>
    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <div class="menu-item" @click="startRename">✏️ 重命名</div>
      <div class="menu-item delete" @click="deleteNote">🗑️ 删除</div>
    </div>
    <main class="main-content">
      <TiptapEditor ref="editorRef" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue'
import TiptapEditor from './components/TiptapEditor.vue'

// ==================== 右键菜单与重命名逻辑 ====================

// 右键菜单的状态
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  file: null as NoteFile | null
})

// 重命名状态
const renamingPath = ref('')
const renameInput = ref('')
const renameInputRef = ref<HTMLInputElement[] | null>(null)

// 1. 显示右键菜单
const showContextMenu = (event: MouseEvent, file: NoteFile): void => {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    file: file
  }
}

// 2. 隐藏菜单 (点击其他地方时触发)
const closeContextMenu = (): void => {
  contextMenu.value.show = false
}

// 3. 开始重命名
const startRename = async (): Promise<void> => {
  if (!contextMenu.value.file) return
  renamingPath.value = contextMenu.value.file.path
  renameInput.value = contextMenu.value.file.name
  closeContextMenu()

  // 聚焦到输入框
  await nextTick()
  if (renameInputRef.value && renameInputRef.value.length > 0) {
    renameInputRef.value[0].focus()
    renameInputRef.value[0].select() // 默认全选文字，方便直接修改
  }
}

// 4. 提交重命名
const submitRename = async (): Promise<void> => {
  if (!renamingPath.value) return
  const oldPath = renamingPath.value
  const newName = renameInput.value.trim()

  // 如果名字没变或者为空，直接取消
  if (!newName || newName === contextMenu.value.file?.name) {
    cancelRename()
    return
  }

  const result = await window.api.renameFile(oldPath, newName)
  if (result.success) {
    // 刷新左侧列表
    await loadFiles()
    // 如果重命名的是当前打开的文件，更新一下激活路径
    if (activeFilePath.value === oldPath) {
      activeFilePath.value = result.newPath!
    }
  } else {
    alert(result.error)
  }
  cancelRename()
}

// 5. 取消重命名
const cancelRename = (): void => {
  renamingPath.value = ''
  renameInput.value = ''
}

// 6. 删除文件
const deleteNote = async (): Promise<void> => {
  const file = contextMenu.value.file
  if (!file) return
  closeContextMenu()

  // 给个二次确认，防止手滑
  if (confirm(`确定要将 "${file.name}" 放入回收站吗？`)) {
    const success = await window.api.deleteFile(file.path)
    if (success) {
      await loadFiles() // 重新加载列表
      // 如果删除的是当前打开的文件，清空右侧编辑器
      if (activeFilePath.value === file.path) {
        activeFilePath.value = ''
        if (editorRef.value) editorRef.value.loadContent('')
      }
    }
  }
}

// 监听全局点击事件，用来关闭右键菜单
onMounted(async () => {
  window.addEventListener('click', closeContextMenu)
  loadFiles()
})
onBeforeUnmount(() => {
  window.removeEventListener('click', closeContextMenu)
})
// ========================================================

// 【修复 1】：直接在前端定义这个接口，砍掉跨界 import，瞬间解决 tsconfig 和路径报错！
interface NoteFile {
  name: string
  fileName: string
  path: string
}

// 为了应付极度严格的 TS 检查，我们给编辑器 ref 定义一个明确的接口
interface EditorComponent {
  loadContent: (content: string) => void
}

const notes = ref<NoteFile[]>([])
// 【新增】：当前选中的文件路径
const activeFilePath = ref<string>('')
// 【新增】：编辑器的实例引用
const editorRef = ref<EditorComponent | null>(null)

// 页面加载时，获取文件列表
onMounted(async () => {
  loadFiles()
})

// 【修复 2】：给函数加上 : Promise<void> 满足严格的 ESLint 规则
const loadFiles = async (): Promise<void> => {
  const fileList = await window.api.getNotesList()
  notes.value = fileList
  // 如果有文件，默认自动打开第一篇笔记
  if (fileList.length > 0) {
    openNote(fileList[0])
  }
}

// 【新增】：新建笔记逻辑
const createNewNote = async (): Promise<void> => {
  const newNote = await window.api.createNote()
  if (newNote) {
    notes.value.push(newNote)
    openNote(newNote)
  }
}

// 【修复 3】：同样加上 : Promise<void>
const openNote = async (file: NoteFile): Promise<void> => {
  // 1. 设置当前激活的文件状态
  activeFilePath.value = file.path
  // 2. 读取硬盘里的文件内容
  const content = await window.api.readNote(file.path)
  // 3. 【核心修复】：将读取到的内容，通过 ref 传给子组件，让编辑器立刻渲染！
  if (editorRef.value) {
    editorRef.value.loadContent(content)
  }
}
</script>

<style>
/* 全局重置 */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: #f5f7fa;
}

/* 三列布局容器 */
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* 文件侧边栏样式 */
.sidebar-files {
  width: 220px;
  background-color: #202020;
  /* 经典的深色侧边栏 */
  color: #a3a3a3;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #111;
}

/* 修改原有的 sidebar-header */
.sidebar-header {
  padding: 16px;
  font-size: 13px;
  font-weight: bold;
  color: #fff;
  letter-spacing: 1px;
  /* 变成 flex 布局，让文字和按钮分别靠左右两边 */
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #333;
}

/* 新增的加号按钮样式 */
.new-note-btn {
  background: transparent;
  border: none;
  color: #a3a3a3;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
  transition: color 0.2s;
}

.new-note-btn:hover {
  color: #fff;
  /* 鼠标悬停时亮起 */
}

.file-list {
  padding: 10px 8px;
  overflow-y: auto;
}

.file-item {
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  margin-bottom: 2px;
  transition: all 0.2s;
}

.file-item:hover {
  background-color: #333;
  color: #fff;
}

/* 【新增】：当前选中文件的样式 */
.file-item.is-active {
  background-color: #4a4a4a;
  color: #fff;
  font-weight: bold;
}

/* 右侧主内容区 */
.main-content {
  flex: 1;
  display: flex;
  min-width: 0;
  /* 防止子元素撑破 Flex 布局 */
}

/* 重命名输入框 */
.rename-input {
  width: 80%;
  background: #333;
  border: 1px solid #555;
  color: #fff;
  border-radius: 3px;
  padding: 2px 4px;
  outline: none;
  font-family: inherit;
  font-size: 14px;
}
.rename-input:focus {
  border-color: #68cef8;
}

/* 自定义右键菜单 */
.context-menu {
  position: fixed;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 4px;
  z-index: 9999;
  min-width: 120px;
}

.context-menu .menu-item {
  padding: 6px 12px;
  font-size: 13px;
  color: #ccc;
  cursor: pointer;
  border-radius: 4px;
}

.context-menu .menu-item:hover {
  background: #444;
  color: #fff;
}
.context-menu .menu-item.delete:hover {
  background: #e03131;
  color: #fff;
} /* 删除按钮悬停变红 */
</style>
