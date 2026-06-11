<p align="center">
  <a href="https://github.com/oneworks-ai/app">
    <img alt="One Works 万可图标" src="https://raw.githubusercontent.com/oneworks-ai/app/main/apps/desktop/build/icons/metal/transparent/light.png" width="180">
  </a>
</p>

<p align="center">
  <a href="https://github.com/oneworks-ai/app"><img alt="One Works" src="https://img.shields.io/badge/One%20Works-open%20source-111827?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/oneworks"><img alt="npm" src="https://img.shields.io/npm/v/oneworks?label=npm&style=flat-square"></a>
  <a href="https://github.com/oneworks-ai/app/releases"><img alt="Release" src="https://img.shields.io/github/v/release/oneworks-ai/app?include_prereleases&label=release&style=flat-square"></a>
  <a href="https://oneworks-ai.github.io/docs/"><img alt="Docs" src="https://img.shields.io/badge/docs-online-2563eb?style=flat-square"></a>
</p>

<p align="center">
  <a href="./README.md">English</a> | 简体中文 | <a href="./README.ja.md">日本語</a>
</p>

<h1 align="center">一介 YiJie</h1>

<p align="center"><strong>正在构建 One Works，一个面向 AI 工作流的开源工作空间。</strong></p>

## 当前重点

我目前主要在做 [One Works](https://github.com/oneworks-ai/app)：一个开源 AI 工作空间，用来统一管理 coding agents、插件、适配器、运行时数据和配置体系，覆盖桌面端、Web、VS Code 和 CLI。

核心目标很直接：一次配置，全部工作。One Works 会标准化工具的安装、启动、连接、配置和扩展方式，让同一个项目可以在本地桌面、浏览器界面、编辑器集成和命令行自动化之间切换，而不用重复搭建每一套环境。

## 从这里开始

```bash
npx oneworks
```

| 链接 | 说明 |
| --- | --- |
| [oneworks-ai/app](https://github.com/oneworks-ai/app) | 主 monorepo，包含 CLI、桌面端、Web client、VS Code 扩展、适配器和共享包 |
| [文档](https://oneworks-ai.github.io/docs/) | 使用指南和接入文档 |
| [Releases](https://github.com/oneworks-ai/app/releases) | 桌面端构建产物和 package release tags |
| [npm: oneworks](https://www.npmjs.com/package/oneworks) | `npx oneworks` 的 bootstrap 包 |

## 我关注的方向

- 面向 AI 编程工作流的可扩展插件架构
- 跨工具、跨入口的一致配置体系
- local-first 的桌面端和 Web 体验
- TypeScript、runtime protocol、adapter 和开发者工具链
- 足够实用、可以每天使用的开源系统
