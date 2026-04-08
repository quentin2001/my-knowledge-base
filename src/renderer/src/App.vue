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
        >
          📄 {{ file.name }}
        </div>
      </div>
    </aside>

    <main class="main-content">
      <TiptapEditor ref="editorRef" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TiptapEditor from './components/TiptapEditor.vue'

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
</style>
