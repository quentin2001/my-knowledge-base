<template>
  <div class="app-container">
    <aside class="sidebar-files">
      <div class="sidebar-header">📚 我的知识库</div>
      <div class="file-list">
        <div v-for="file in notes" :key="file.path" class="file-item" @click="openNote(file)">
          📄 {{ file.name }}
        </div>
      </div>
    </aside>

    <main class="main-content">
      <TiptapEditor />
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

const notes = ref<NoteFile[]>([])

// 页面加载时，获取文件列表
onMounted(async () => {
  loadFiles()
})

// 【修复 2】：给函数加上 : Promise<void> 满足严格的 ESLint 规则
const loadFiles = async (): Promise<void> => {
  const fileList = await window.api.getNotesList()
  notes.value = fileList
}

// 【修复 3】：同样加上 : Promise<void>
const openNote = async (file: NoteFile): Promise<void> => {
  console.log('准备打开文件:', file.name)
  const content = await window.api.readNote(file.path)
  console.log('文件内容前 20 个字符:', content.substring(0, 20) + '...')
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

.sidebar-header {
  padding: 16px;
  font-size: 13px;
  font-weight: bold;
  color: #fff;
  letter-spacing: 1px;
  text-transform: uppercase;
  border-bottom: 1px solid #333;
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

/* 右侧主内容区 */
.main-content {
  flex: 1;
  display: flex;
  min-width: 0;
  /* 防止子元素撑破 Flex 布局 */
}
</style>
