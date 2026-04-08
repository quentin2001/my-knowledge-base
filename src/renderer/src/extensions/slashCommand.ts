import { Extension } from '@tiptap/core'
import Suggestion, { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { VueRenderer } from '@tiptap/vue-3'
import tippy, { Instance, GetReferenceClientRect } from 'tippy.js'
import CommandList from '../components/CommandList.vue'
import type { Editor, Range } from '@tiptap/core'

// 【修复 1】：提取菜单项的类型定义，彻底告别 any
export interface CommandItem {
  title: string
  description: string
  action: (props: { editor: Editor; range: Range }) => void
}

const SlashCommand = Extension.create({
  name: 'slashCommand',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({
          editor,
          range,
          props
        }: {
          editor: Editor
          range: Range
          props: CommandItem
        }) => {
          props.action({ editor, range })
        }
      }
    }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion
      })
    ]
  }
})

export const slashSuggestion = {
  // 【修复 2】：为 items 函数明确返回类型
  items: ({ query }: { query: string }): CommandItem[] => {
    return [
      {
        title: 'H1 一级标题',
        description: '大字号的章节标题',
        action: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
        }
      },
      {
        title: 'H2 二级标题',
        description: '中等字号的副标题',
        action: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
        }
      },
      {
        title: '分栏',
        description: '左右并排显示两列内容',
        action: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setColumns(2).run()
        }
      }
    ]
      .filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10)
  },

  render: () => {
    let component: VueRenderer
    let popup: Instance

    return {
      onStart: (props: SuggestionProps) => {
        component = new VueRenderer(CommandList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) return

        popup = tippy(document.body, {
          getReferenceClientRect: props.clientRect as GetReferenceClientRect,
          appendTo: () => document.body,
          content: component.element as Element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
      },
      onUpdate(props: SuggestionProps) {
        component.updateProps(props)
        if (!props.clientRect) return
        // 【修复 2】：去掉 popup[0]，直接使用 popup
        popup.setProps({ 
          getReferenceClientRect: props.clientRect as GetReferenceClientRect 
        })
      },
      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === 'Escape') {
          // 【修复 3】：去掉 popup[0]
          popup.hide() 
          return true
        }
        return component.ref?.onKeyDown(props)
      },
      onExit() {
        // 【修复 4】：去掉 popup[0]
        popup.destroy() 
        component.destroy()
      },
    }
  }
}

export default SlashCommand
