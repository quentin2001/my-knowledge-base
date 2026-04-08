<template>
  <div class="tree-node">
    <div
      class="node-content"
      :class="{ 'is-active': activePath === node.path }"
      :style="{ paddingLeft: depth * 16 + 8 + 'px' }"
      @click="handleClick"
      @contextmenu.prevent.stop="handleContextMenu($event)"
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
        />
      </template>
    </draggable>
  </div>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable' // 【新增引入】

interface FileNode {
  type: 'file' | 'folder'
  name: string
  path: string
  fileName?: string
  isOpen?: boolean
  children?: FileNode[]
}

// 【新增】：严格定义拖拽事件的类型，彻底抛弃 any
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

const emit = defineEmits(['open-file', 'show-context-menu', 'toggle-folder', 'drag-event'])

const handleClick = (): void => {
  if (props.node.type === 'folder') {
    emit('toggle-folder', props.node)
  } else {
    emit('open-file', props.node)
  }
}

const handleContextMenu = (event: MouseEvent): void => {
  emit('show-context-menu', { event, node: props.node })
}

// 【修复】：用 DragChangeEvent 替换掉 any
const onDragChange = (evt: DragChangeEvent): void => {
  emit('drag-event', { evt, parentPath: props.node.path, children: props.node.children })
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
