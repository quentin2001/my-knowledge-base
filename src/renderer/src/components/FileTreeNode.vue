<template>
  <div class="tree-node">
    <div
      class="node-content"
      :class="{ 'is-active': activePath === node.path, 'is-drag-over': isDragOver }"
      :style="{ paddingLeft: depth * 16 + 8 + 'px' }"
      @click="handleClick"
      @contextmenu.prevent.stop="handleContextMenu($event)"
      @mousedown="handleMouseDown"
      @dragover.prevent.stop="handleDragOver"
      @dragleave.prevent.stop="handleDragLeave"
      @drop.prevent.stop="handleDrop"
    >
      <span v-if="node.type === 'folder'" class="icon arrow" :class="{ open: node.isOpen }">▸</span>
      <span v-else class="icon">📄</span>
      <span class="node-name">{{ node.name }}</span>
    </div>

    <draggable
      v-if="node.type === 'folder' && node.isOpen"
      class="node-children"
      :list="node.children"
      group="files"
      item-key="path"
      :animation="200"
      @change="onDragChange"
    >
      <template #item="{ element }">
        <FileTreeNode
          :node="element"
          :depth="depth + 1"
          :active-path="activePath"
          @open-file="$emit('open-file', $event)"
          @show-context-menu="$emit('show-context-menu', $event)"
          @toggle-folder="$emit('toggle-folder', $event)"
          @drag-event="$emit('drag-event', $event)"
          @native-drop="$emit('native-drop', $event)"
        />
      </template>
    </draggable>
  </div>
</template>

<script setup lang="ts">
import { inject, Ref, ref } from 'vue' // 【新增】：引入 inject 和 ref
import draggable from 'vuedraggable'

interface FileNode {
  type: 'file' | 'folder'
  name: string
  path: string
  fileName?: string
  isOpen?: boolean
  children?: FileNode[]
}

interface DragChangeEvent {
  added?: { element: FileNode; newIndex: number }
  removed?: { element: FileNode; oldIndex: number }
  moved?: { element: FileNode; oldIndex: number; newIndex: number }
}

const props = defineProps<{
  node: FileNode
  depth: number
  activePath: string
}>()

// 【新增】：抛出 native-drop 事件
const emit = defineEmits([
  'open-file',
  'show-context-menu',
  'toggle-folder',
  'drag-event',
  'native-drop'
])

// 【核心魔法 1】：接收顶层共享的“当前正在拖拽的节点”
const globalDraggedNode = inject<Ref<FileNode | null>>('globalDraggedNode')
const isDragOver = ref(false) // 控制高亮效果

const handleClick = (): void => {
  if (props.node.type === 'folder') emit('toggle-folder', props.node)
  else emit('open-file', props.node)
}

const handleContextMenu = (event: MouseEvent): void => {
  emit('show-context-menu', { event, node: props.node })
}

const onDragChange = (evt: DragChangeEvent): void => {
  emit('drag-event', { evt, parentPath: props.node.path, children: props.node.children })
}

// ==================== 原生拖拽探测逻辑 ====================

// 1. 当鼠标点下时，记住这个节点（它即将被拖拽）
const handleMouseDown = (): void => {
  if (globalDraggedNode) globalDraggedNode.value = props.node
}

// 2. 当有东西拖到这个节点上面时
const handleDragOver = (): void => {
  if (props.node.type === 'folder' && globalDraggedNode?.value) {
    const dragged = globalDraggedNode.value
    // 保护机制：不能拖到自己身上，也不能把父文件夹拖到自己的子文件夹里
    if (dragged.path !== props.node.path && !props.node.path.startsWith(dragged.path)) {
      isDragOver.value = true
    }
  }
}

// 3. 拖走了，取消高亮
const handleDragLeave = (): void => {
  isDragOver.value = false
}

// 4. 【高光时刻】：松开鼠标，完成物理空投！
const handleDrop = (): void => {
  isDragOver.value = false
  if (props.node.type === 'folder' && globalDraggedNode?.value) {
    const dragged = globalDraggedNode.value
    if (dragged.path !== props.node.path && !props.node.path.startsWith(dragged.path)) {
      emit('native-drop', { draggedNode: dragged, targetFolder: props.node })
    }
  }
}
</script>

<style scoped>
.node-content {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
  color: #a3a3a3;
  font-size: 14px;
  user-select: none;
  border-radius: 4px;
  margin: 1px 4px;
  transition: all 0.2s;
  box-sizing: border-box;
  border: 1px solid transparent;
}
.node-content:hover {
  background-color: #333;
  color: #fff;
}
.node-content.is-active {
  background-color: #4a4a4a;
  color: #fff;
  font-weight: bold;
}

/* 【新增】：拖拽悬浮时的极致视觉反馈 */
.node-content.is-drag-over {
  background-color: rgba(104, 206, 248, 0.15);
  border: 1px dashed #68cef8;
  color: #fff;
}

.icon {
  margin-right: 6px;
  font-size: 12px;
  width: 14px;
  text-align: center;
}
.arrow {
  transition: transform 0.2s;
  display: inline-block;
}
.arrow.open {
  transform: rotate(90deg);
}
.node-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
