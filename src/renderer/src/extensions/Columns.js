import { Node, mergeAttributes } from '@tiptap/core'

export const Columns = Node.create({
  name: 'columns',
  // 表明这是一个块级元素
  group: 'block',
  // 核心：这个外壳里面只能包含名为 'column' 的节点，且至少两个
  content: 'column{2,3}',

  // 解析 HTML 时，认准 data-type="columns"
  parseHTML() {
    return [{ tag: 'div[data-type="columns"]' }]
  },

  // 渲染为 HTML 时的结构
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'columns', class: 'tiptap-columns' }),
      0
    ]
  },

  // 添加一个命令，让我们可以在编辑器里一键插入双列布局
  addCommands() {
    return {
      setColumns:
        (cols = 2) =>
        ({ commands }) => {
          // 创建指定数量的列，每列里面默认塞一个空段落
          const columns = Array.from({ length: cols }, () => ({
            type: 'column',
            content: [{ type: 'paragraph' }]
          }))

          return commands.insertContent({
            type: this.name,
            content: columns
          })
        }
    }
  }
})
