<template>
  <div class="command-menu">
    <div class="menu-header">基础块</div>
    <button
      v-for="(item, index) in items"
      :key="index"
      class="menu-item"
      :class="{ 'is-active': index === selectedIndex }"
      @click="selectItem(index)"
    >
      <span class="item-title">{{ item.title }}</span>
      <span class="item-desc">{{ item.description }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
// 【修复 1】：引入我们刚才写好的结构类型
import type { CommandItem } from '../extensions/slashCommand'

// 【修复 2】：使用精准的类型替换 any
const props = defineProps<{
  items: CommandItem[]
  command: (item: CommandItem) => void
}>()

const selectedIndex = ref(0)

watch(
  () => props.items,
  () => {
    selectedIndex.value = 0
  }
)

// 【修复 3】：明确函数没有返回值 (void)
const selectItem = (index: number): void => {
  const item = props.items[index]
  if (item) {
    props.command(item)
  }
}

defineExpose({
  // 顺手给暴露的方法也加上布尔值的返回类型
  onKeyDown: ({ event }: { event: KeyboardEvent }): boolean => {
    if (event.key === 'ArrowUp') {
      selectedIndex.value = (selectedIndex.value + props.items.length - 1) % props.items.length
      return true
    }
    if (event.key === 'ArrowDown') {
      selectedIndex.value = (selectedIndex.value + 1) % props.items.length
      return true
    }
    if (event.key === 'Enter') {
      selectItem(selectedIndex.value)
      return true
    }
    return false
  }
})
</script>

<style scoped>
.command-menu {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #e5e5e5;
  padding: 8px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-header {
  font-size: 12px;
  color: #999;
  padding: 4px 8px;
  font-weight: 600;
}

.menu-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: transparent;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
}

.menu-item:hover,
.menu-item.is-active {
  background: #f1f1ef;
  /* Notion 经典的悬停灰色 */
}

.item-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.item-desc {
  font-size: 12px;
  color: #777;
  margin-top: 2px;
}
</style>
