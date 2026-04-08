<template>
  <div class="app-layout">
    <aside v-show="showToc" class="sidebar-toc">
      <div class="toc-header">
        <span class="toc-title">📑 页面大纲</span>
        <button class="icon-btn" title="隐藏大纲" @click="showToc = false">◂</button>
      </div>
      <div class="toc-content">
        <div
          v-for="(heading, index) in headings"
          :key="index"
          class="toc-item"
          :style="{ paddingLeft: `${(heading.level - 1) * 16}px` }"
        >
          {{ heading.text }}
        </div>
        <div v-if="headings.length === 0" class="toc-empty">暂无标题</div>
      </div>
    </aside>

    <main class="main-workspace">
      <div class="status-bar">
        <button v-if="!showToc" class="text-btn" @click="showToc = true">▸ 显示大纲</button>
        <button v-if="!showToolbar" class="text-btn" @click="showToolbar = true">
          ▾ 显示工具栏
        </button>
      </div>

      <header v-show="showToolbar" class="top-toolbar">
        <div class="toolbar-group">
          <button @click="editor?.chain().focus().toggleBold().run()"><b>B</b> 加粗</button>
          <button @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
          <button @click="editor?.chain().focus().setColumns(2).run()">◫ 双列布局</button>
        </div>
        <button class="icon-btn hide-toolbar-btn" title="隐藏工具栏" @click="showToolbar = false">
          ▴
        </button>
      </header>

      <div class="editor-container">
        <EditorContent :editor="editor" class="editor-content" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, Ref } from 'vue'
import { useEditor, EditorContent, Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
// 引入 Tiptap 底层 ProseMirror 的标准 Node 类型
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

// 【TypeScript 模块扩展】：明确告诉 TS 编译器我们自定义的 setColumns 命令
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      setColumns: (cols: number) => ReturnType
    }
  }
}

// 引入我们的自定义分栏扩展 (确保这两个文件在你的项目目录中存在)
import { Columns } from '../extensions/Columns'
import { Column } from '../extensions/Column'

// 【新增引入】：引入斜杠命令扩展和配置项
import SlashCommand, { slashSuggestion } from '../extensions/slashCommand'

const showToc = ref(true)
const showToolbar = ref(true)

// 定义大纲数据的严格结构
interface HeadingItem {
  level: number
  text: string
  pos: number
}
const headings: Ref<HeadingItem[]> = ref([])

// 提取大纲的函数（使用严格的 TypeScript 类型）
const extractHeadings = (editorInstance: Editor): void => {
  const extractedHeadings: HeadingItem[] = []

  editorInstance.state.doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.type.name === 'heading') {
      extractedHeadings.push({
        level: node.attrs.level,
        text: node.textContent,
        pos: pos
      })
    }
  })
  headings.value = extractedHeadings
}

// 初始化编辑器
const editor = useEditor({
  content: `
    <h1>🎉 Notion 级体验来了！</h1>
    <p>在这个空行敲击键盘上的 / 键试试看！</p>
    <p></p>
  `,
  extensions: [
    StarterKit,
    Columns,
    Column,
    // 【新增注册】：将斜杠命令和它的配置注入到编辑器中！
    SlashCommand.configure({
      suggestion: slashSuggestion
    })
  ],
  // 确保传入的回调参数类型正确
  onUpdate: ({ editor }) => extractHeadings(editor as Editor),
  onCreate: ({ editor }) => extractHeadings(editor as Editor)
})

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy()
  }
})
</script>

<style scoped>
/* 初始化重置 */
* {
  box-sizing: border-box;
}

/* 整体布局 */
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: #ffffff;
  color: #333;
  text-align: left;
}

/* 左侧大纲 */
.sidebar-toc {
  width: 260px;
  background-color: #f7f7f5;
  border-right: 1px solid #e5e5e5;
  display: flex;
  flex-direction: column;
}

.toc-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #e5e5e5;
  font-weight: bold;
}

.toc-content {
  padding: 16px;
  overflow-y: auto;
}

.toc-item {
  padding: 6px 0;
  font-size: 14px;
  cursor: pointer;
  color: #555;
}

.toc-item:hover {
  color: #000;
  font-weight: 500;
}

.toc-empty {
  color: #999;
  font-size: 13px;
  text-align: center;
  margin-top: 20px;
}

/* 主工作区 */
.main-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.status-bar {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  display: flex;
  gap: 10px;
}

.text-btn {
  background: #f0f0f0;
  border: 1px solid #ddd;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

/* 顶部工具栏 */
.top-toolbar {
  display: flex;
  justify-content: space-between;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.95);
  border-bottom: 1px solid #e5e5e5;
  z-index: 5;
}

.toolbar-group button {
  margin-right: 8px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
}

/* 编辑器容器 */
.editor-container {
  flex: 1;
  overflow-y: auto;
  padding: 40px 60px;
}

.editor-content {
  max-width: 800px;
  margin: 0 auto;
  outline: none;
}

:deep(.tiptap) {
  outline: none;
  min-height: 500px;
}

/* 分栏样式 */
:deep(.tiptap-columns) {
  display: flex;
  gap: 16px;
  margin: 1rem 0;
  width: 100%;
}

:deep(.tiptap-column) {
  flex: 1 1 0%;
  min-width: 0;
  padding: 8px;
  border: 1px dashed #cbd5e1;
  border-radius: 4px;
  background: #f8fafc;
}
</style>
