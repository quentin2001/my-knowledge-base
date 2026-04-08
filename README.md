# my-knowledge-base

An Electron application with Vue and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

🗺️ 阶段一：打造极致的“Notion 级”编辑体验（当前阶段）
这个阶段的核心是让“打字”本身变成一种享受，彻底摆脱传统 Markdown 纯文本编辑的割裂感。

1. 魔法斜杠命令 (/ Command Menu)

交互设计： 在任何空行输入 /，光标下方立刻弹出一个丝滑的下拉菜单。支持键盘上下方向键选择，回车确认。

功能涵盖： 快速插入各级标题（H1-H3）、并排分栏、引用块、代码块、分割线等。

2. 大纲目录的“双向联动” (TOC 进阶)

交互设计： 点击左侧大纲的某一个标题，右侧的编辑器顺滑地滚动到对应位置。

视觉优化： 随着你的滚动，左侧大纲中当前阅读的章节会高亮显示。

3. 本地图片管理的“完全体”

功能回溯： 把我们之前写好的“拖拽/粘贴图片静默保存到本地”的 Electron 通信逻辑，用 TypeScript 重构并加回现在的代码中。

交互拓展： 支持点击图片放大预览，或者调整图片大小。

4. 纯正 Markdown 的导入与导出

功能实现： 确保你在编辑器里写的任何富文本、分栏，都能被完美解析为标准的 .md 文本保存，保证数据永远不被软件“绑架”。

📁 阶段二：构建强大的本地知识库系统（文件大脑）
富文本编辑器做好后，我们需要让它变成一个真正的“库”，这需要深度调用 Electron 的系统级能力。

1. 左侧边栏：文件树管理器 (File Tree)

交互设计： 在大纲旁边增加一个“文件浏览器”面板。可以新建文件夹、新建笔记、右键重命名或删除。

拖拽支持： 允许把笔记从一个文件夹拖到另一个文件夹。

2. 无缝的本地 I/O (读写流)

技术实现： 当你在侧边栏点击一个 .md 文件时，瞬间读取内容并在编辑器渲染；当你修改内容时，实现类似 VS Code 的“自动保存 (Auto-save)”。

3. 智能资源归档

管理逻辑： 每一个 .md 文件在硬盘上产生图片时，自动在该文件同级目录创建一个同名的 XXX.assets 文件夹存放图片，让笔记的迁移变得无比简单。

✨ 阶段三：交互进阶与视觉打磨（灵魂外衣）
当基础功能全部跑通，我们会花时间让它变得“好用且好看”。

1. 深色模式 (Dark Mode)

视觉设计： 一键切换全局深色主题，保护夜间写作的眼睛。

2. 标签与全局搜索 (Search)

功能实现： 支持给文章打标签（如 #学习），并提供一个全局搜索框（Ctrl+P 或 Cmd+P），秒级搜出所有笔记中的关键字。

📦 阶段四：打包与分发（修成正果）
3. 跨平台打包

使用 electron-builder 为你的软件配置好看的桌面图标，打包出 Windows 的 .exe 和 macOS 的 .dmg 安装包，你可以发给朋友们炫耀，甚至开源到 GitHub！

为什么不用VScode？
1. 不支持自定义的文件排序，只能按字母顺序排序
2. 并不是一个单纯的笔记软件，工具会影响灵感与生产力
3. 不好看，需要大量的组合配置插件才能达到自己想要的效果，但是现在借助AI直接自己画页面也不是什么难事
