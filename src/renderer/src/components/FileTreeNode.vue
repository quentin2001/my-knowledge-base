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

    <div v-if="node.type === 'folder' && node.isOpen" class="node-children">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :active-path="activePath"
        @open-file="$emit('open-file', $event)"
        @show-context-menu="$emit('show-context-menu', $event)"
        @toggle-folder="$emit('toggle-folder', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface FileNode {
  type: 'file' | 'folder'
  name: string
  path: string
  fileName?: string
  isOpen?: boolean
  children?: FileNode[]
}

const props = defineProps<{
  node: FileNode
  depth: number
  activePath: string
}>()

const emit = defineEmits(['open-file', 'show-context-menu', 'toggle-folder'])

const handleClick = (): void => {
  if (props.node.type === 'folder') {
    emit('toggle-folder', props.node)
  } else {
    emit('open-file', props.node)
  }
}

const handleContextMenu = (event: MouseEvent): void => {
  // 把具体的事件和节点信息抛给上层 App.vue
  emit('show-context-menu', { event, node: props.node })
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
