import { Node, mergeAttributes } from '@tiptap/core'

export const Column = Node.create({
  name: 'column',
  // 属于我们自定义的 column 组
  group: 'column',
  // 核心：这一列里面可以放任何块级元素（段落、图片、标题等）
  content: 'block+',
  // 隔离光标：防止在左列按退格键时，不小心把右列的内容删掉
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'column', class: 'tiptap-column' }),
      0
    ]
  }
})
