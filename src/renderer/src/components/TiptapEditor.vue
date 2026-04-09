<template>
  <div class="editor-wrapper">
    <header class="editor-header">
      <div class="header-left">
        <button
          class="tool-btn"
          :class="{ 'is-active': showToc }"
          title="页面大纲"
          @click="showToc = !showToc"
        >
          📑 大纲
        </button>
        <div class="header-divider"></div>
        <button class="tool-btn" title="导入 Markdown" @click="importMarkdown">📥 导入</button>
        <button class="tool-btn" title="导出 Markdown" @click="exportMarkdown">📤 导出</button>
      </div>

      <div class="header-right"></div>
    </header>

    <div class="editor-layout">
      <Transition name="slide-left">
        <aside v-if="showToc" class="toc-sidebar">
          <div class="toc-header">目录</div>
          <div class="toc-content">
            <div
              v-for="(heading, index) in headings"
              :key="index"
              class="toc-item"
              :class="{ 'is-active': activeHeadingIndex === index }"
              :style="{ paddingLeft: (heading.level - 1) * 12 + 12 + 'px' }"
              @click="scrollToHeading(heading.pos, index)"
            >
              {{ heading.text }}
            </div>
            <div v-if="headings.length === 0" class="empty-toc">暂无标题</div>
          </div>
        </aside>
      </Transition>

      <main class="editor-main">
        <div v-if="editor" class="format-toolbar">
          <button
            class="format-btn"
            :class="{ 'is-active': editor.isActive('bold') }"
            @click="editor.chain().focus().toggleBold().run()"
          >
            B 加粗
          </button>
          <button
            class="format-btn"
            :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }"
            @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
          >
            H2
          </button>
          <button class="format-btn" @click="editor.chain().focus().setColumns(2).run()">
            ⏸ 双列布局
          </button>
        </div>

        <div class="editor-scroll-area" @click="focusEditorBottom">
          <editor-content :editor="editor" class="tiptap-content" />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, Ref } from 'vue'
import { useEditor, EditorContent, Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

// --- 【新增 1】：引入图片相关和 ProseMirror 底层类型 ---
import Image from '@tiptap/extension-image'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { Slice } from '@tiptap/pm/model'

// 【新增引入】：Markdown 解析器
import { Markdown } from 'tiptap-markdown'

// 声明模块...
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

// 【新增】：点击外部空白处，智能将光标聚焦到文档末尾
const focusEditorBottom = (e: MouseEvent): void => {
  const target = e.target as HTMLElement
  // 只有当点击的确实是外层空白区域（而不是文字本身）时，才触发聚焦到底部
  if (target.classList.contains('editor-scroll-area') && editor.value) {
    editor.value.chain().focus('end').run()
  }
}

interface HeadingItem {
  level: number
  text: string
  pos: number
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
  if (!editor.value || !editorContainerRef.value || isClickScrolling || headings.value.length === 0)
    return

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
// ==================== 图片处理完全体 ====================

// 上传并插入图片的函数
const uploadAndInsertImage = async (
  file: File,
  view: EditorView,
  coordinates: { pos: number } | null
): Promise<void> => {
  if (!file) return

  const fileName = `img_${Date.now()}_${file.name}`
  const arrayBuffer = await file.arrayBuffer()

  try {
    // 呼叫 Electron 主进程保存图片到本地
    const localFilePath = await window.api.saveImage(arrayBuffer, fileName)

    if (localFilePath) {
      // 保存成功，插入本地 file:// 路径到编辑器
      const node = view.state.schema.nodes.image.create({ src: localFilePath })
      const transaction = view.state.tr.insert(
        coordinates ? coordinates.pos : view.state.selection.to,
        node
      )
      view.dispatch(transaction)
    }
  } catch (error) {
    console.error('图片保存失败', error)
  }
}

// 编写 Prosemirror 拦截插件
const CustomImageHandler = new Plugin({
  key: new PluginKey('customImageHandler'),
  props: {
    // 【修复 1】：对于 handlePaste，我们只用到前两个参数，直接删掉第三个参数！
    handlePaste(view: EditorView, event: ClipboardEvent) {
      const items = Array.from(event.clipboardData?.items || [])
      const imageItem = items.find((item) => item.type.startsWith('image'))

      if (imageItem) {
        event.preventDefault()
        const file = imageItem.getAsFile()
        if (file) {
          uploadAndInsertImage(file, view, null)
        }
        return true
      }
      return false
    },
    // 【修复 2】：对于 handleDrop，我们需要第 4 个参数，所以用专门的注释让 ESLint 忽略这一行的未使用变量警告

    handleDrop(view: EditorView, event: DragEvent, _slice: Slice, moved: boolean) {
      if (!moved && event.dataTransfer && event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0]
        if (file.type.startsWith('image')) {
          event.preventDefault()
          const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })
          uploadAndInsertImage(file, view, coordinates)
          return true
        }
      }
      return false
    }
  }
})

// 扩展官方 Image 插件，塞入拦截器
const CustomImage = Image.extend({
  addProseMirrorPlugins() {
    return [CustomImageHandler]
  }
})
// ========================================================

// 初始化编辑器
const editor = useEditor({
  content: `开始书写`,
  extensions: [
    StarterKit,
    Columns,
    Column,
    SlashCommand.configure({ suggestion: slashSuggestion }),
    // 【新增 3】：注册我们接管了拖拽粘贴的图片扩展
    CustomImage,
    // 【新增】：注册 Markdown 解析器
    Markdown
  ],
  onUpdate: ({ editor }) => {
    extractHeadings(editor as Editor)
    handleEditorScroll() // 内容更新时也重新计算一下高亮
  },
  onCreate: ({ editor }) => {
    extractHeadings(editor as Editor)
  }
})
// ==================== Markdown 导入导出 ====================

// 【新增】：定义一个极其严谨的类型，彻底抛弃 any
interface MarkdownStorage {
  markdown: {
    getMarkdown: () => string
  }
}

const exportMarkdown = async (): Promise<void> => {
  if (!editor.value) return

  // 【终极修复】：听从 TS 的建议，先转为 unknown，再转为我们的目标类型
  const mdContent = (editor.value.storage as unknown as MarkdownStorage).markdown.getMarkdown()

  // 调用 Electron 主进程的导出弹窗
  const success = await window.electron.ipcRenderer.invoke('export-md', mdContent)
  if (success) {
    alert('🎉 导出成功！')
  }
}

const importMarkdown = async (): Promise<void> => {
  if (!editor.value) return

  const mdContent = await window.electron.ipcRenderer.invoke('import-md')
  if (mdContent) {
    // 将读取到的 md 字符串重新渲染进编辑器
    editor.value.commands.setContent(mdContent)
    alert('✨ 导入成功！')
  }
}
// ========================================================
onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy()
  }
})
// ==================== 暴露给父组件的方法 ====================
const loadContent = (newContent: string): void => {
  if (editor.value) {
    // 使用 Tiptap 的 setContent 命令强制替换当前编辑器里的所有内容
    editor.value.commands.setContent(newContent)
  }
}

// 使用 defineExpose 让父组件 (App.vue) 可以直接调用这个函数
defineExpose({
  loadContent
})
</script>
<style scoped>
.editor-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background-color: var(--bg-main);
  color: var(--text-main);
}

/* 1. 顶部操作栏 */
.editor-header {
  flex-shrink: 0;
  height: 52px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  background: var(--bg-main);
  border-bottom: 1px solid var(--border-light);
}
.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tool-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}
.tool-btn:hover {
  background: var(--item-hover);
  color: var(--text-main);
}
.tool-btn.is-active {
  background: var(--item-active);
  color: var(--text-active);
  font-weight: 500;
}
.header-divider {
  width: 1px;
  height: 14px;
  background: var(--border-light);
  margin: 0 6px;
}

/* 2. 下方左右分栏布局 */
.editor-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
  background-color: var(--bg-main);
}

/* 3. 左侧大纲栏 */
.toc-sidebar {
  width: 240px;
  flex-shrink: 0;
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.toc-header {
  padding: 16px 20px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}
.toc-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}
.toc-item {
  padding: 6px 8px;
  margin-bottom: 2px;
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-main);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.1s ease;
}
.toc-item:hover {
  background-color: var(--item-hover);
}
.toc-item.is-active {
  background-color: var(--item-active);
  color: var(--text-active);
  font-weight: 500;
}
.empty-toc {
  color: var(--text-muted);
  text-align: center;
  padding: 20px 0;
  font-size: 13px;
}

/* 4. 右侧编辑器主体 */
.editor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0;
}
.format-toolbar {
  flex-shrink: 0;
  padding: 8px 40px;
  background: var(--bg-main);
  display: flex;
  gap: 8px;
  z-index: 10;
  border-bottom: 1px solid var(--border-light);
}
.format-btn {
  background: var(--bg-main);
  border: 1px solid var(--border-light);
  color: var(--text-main);
  font-size: 13px;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.format-btn:hover {
  background: var(--item-hover);
  border-color: var(--text-muted);
}
.format-btn.is-active {
  background: var(--item-hover);
  border-color: var(--text-muted);
  font-weight: 600;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.editor-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px 60px 80px;
  cursor: text;
}
.tiptap-content {
  max-width: 800px;
  margin: 0 auto;
  outline: none;
}

/* 【核心修复】：确保编辑器内的文字颜色跟随主题 */
:deep(.ProseMirror) {
  outline: none !important;
  border: none !important;
  min-height: calc(100vh - 200px);
  color: var(--text-main); /* 跟随主题变色 */
}
:deep(.ProseMirror:focus) {
  outline: none !important;
}

/* 进出场动画 */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.slide-left-enter-from,
.slide-left-leave-to {
  margin-left: -240px;
  opacity: 0;
}
</style>
