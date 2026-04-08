<template>
  <div class="app-layout">
    <aside class="sidebar-toc" v-show="showToc">
      <div class="toc-header">
        <span class="toc-title">📑 页面大纲</span>
        <button class="icon-btn" @click="showToc = false" title="隐藏大纲">◂</button>
      </div>
      <div class="toc-content">
        <div v-for="(heading, index) in headings" :key="index" class="toc-item"
          :class="{ 'is-active': index === activeHeadingIndex }"
          :style="{ paddingLeft: `${(heading.level - 1) * 16}px` }" @click="scrollToHeading(heading.pos, index)">
          {{ heading.text }}
        </div>
        <div v-if="headings.length === 0" class="toc-empty">暂无标题</div>
      </div>
    </aside>

    <main class="main-workspace">
      <div class="status-bar">
        <button class="text-btn" v-if="!showToc" @click="showToc = true">▸ 显示大纲</button>
        <button class="text-btn" v-if="!showToolbar" @click="showToolbar = true">▾ 显示工具栏</button>
      </div>

      <header class="top-toolbar" v-show="showToolbar">
        <div class="toolbar-group">
          <button @click="editor?.chain().focus().toggleBold().run()"><b>B</b> 加粗</button>
          <button @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
          <button @click="editor?.chain().focus().setColumns(2).run()">◫ 双列布局</button>
        </div>
        <button class="icon-btn hide-toolbar-btn" @click="showToolbar = false" title="隐藏工具栏">▴</button>
      </header>

      <div class="editor-container" ref="editorContainerRef" @scroll="handleEditorScroll">
        <EditorContent :editor="editor" class="editor-content" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, Ref } from 'vue'
import { useEditor, EditorContent, Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

// 模块扩展声明
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: { setColumns: (cols: number) => ReturnType }
  }
}

// 引入我们的扩展
import { Columns } from '../extensions/Columns'
import { Column } from '../extensions/Column'
import SlashCommand, { slashSuggestion } from '../extensions/slashCommand'

const showToc = ref(true)
const showToolbar = ref(true)

interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}
const headings: Ref<HeadingItem[]> = ref([])

// --- 新增：双向联动核心状态 ---
const activeHeadingIndex = ref(0)
const editorContainerRef = ref<HTMLElement | null>(null)
// 一个标志位，防止点击大纲滚动时触发滚动监听导致高亮闪烁
let isClickScrolling = false

// --- 新增：点击大纲平滑跳转 ---
const scrollToHeading = (pos: number, index: number): void => {
  if (!editor.value) return

  activeHeadingIndex.value = index
  isClickScrolling = true

  // 通过 Tiptap 的 pos 找到真实的 DOM 节点
  const dom = editor.value.view.nodeDOM(pos) as HTMLElement
  if (dom) {
    dom.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // 给平滑滚动留一点时间，之后再恢复滚动监听
  setTimeout(() => {
    isClickScrolling = false
  }, 800)
}

// --- 新增：滚动正文时自动高亮大纲 ---
const handleEditorScroll = (): void => {
  if (!editor.value || !editorContainerRef.value || isClickScrolling || headings.value.length === 0) return

  const containerTop = editorContainerRef.value.getBoundingClientRect().top
  let currentActiveIndex = 0

  // 遍历大纲，找出距离容器顶部最近的那个标题
  for (let i = 0; i < headings.value.length; i++) {
    const dom = editor.value.view.nodeDOM(headings.value[i].pos) as HTMLElement
    if (dom) {
      const rect = dom.getBoundingClientRect()
      // 100 是一个视觉偏移量，表示标题滚动到距离顶部 100px 以内就算激活
      if (rect.top - containerTop < 100) {
        currentActiveIndex = i
      } else {
        break // 因为标题是按顺序的，找到第一个不在判定区内的直接退出循环提高性能
      }
    }
  }

  if (activeHeadingIndex.value !== currentActiveIndex) {
    activeHeadingIndex.value = currentActiveIndex
  }
}

// 提取大纲函数
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
    <h1>双向联动测试</h1>
    <p>向下滚动或者复制粘贴很多文本，产生滚动条来测试！</p>
    <h2>第一章：基础</h2>
    <p>这里是一些内容...</p><br><br><br><br><br>
    <h2>第二章：进阶</h2>
    <p>尝试在左边点击我！</p><br><br><br><br><br>
    <h3>2.1 小节</h3>
    <p>继续向下...</p><br><br><br><br><br>
    <h2>第三章：终章</h2>
    <p>当你滚动到这里，左侧大纲的“第三章”应该会高亮。</p><br><br><br><br><br>
  `,
  extensions: [
    StarterKit,
    Columns,
    Column,
    SlashCommand.configure({
      suggestion: slashSuggestion,
    })
  ],
  onUpdate: ({ editor }) => {
    extractHeadings(editor as Editor)
    handleEditorScroll() // 内容更新时也重新计算一下高亮
  },
  onCreate: ({ editor }) => {
    extractHeadings(editor as Editor)
  }
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

/* 大纲基础样式 */
.toc-item {
  padding: 6px 8px;
  font-size: 14px;
  cursor: pointer;
  color: #555;
  border-radius: 4px;
  margin: 2px 8px;
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toc-item:hover {
  background-color: #efefed;
  color: #000;
}

/* --- 新增：大纲高亮状态样式 --- */
.toc-item.is-active {
  background-color: #e5e5e5;
  color: #000;
  font-weight: 600;
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

/* 编辑器容器 - 设置 scroll-behavior 实现平滑滚动 */
.editor-container {
  flex: 1;
  overflow-y: auto;
  padding: 40px 60px;
  scroll-behavior: smooth;
  /* 开启原生平滑滚动 */
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
