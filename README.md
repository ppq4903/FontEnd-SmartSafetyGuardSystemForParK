# vue-tlias-management

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin).

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

# 项目运行流程
- 用户访问应用，首先加载index.html
- index.html加载src/main.js，初始化Vue应用
- Vue应用根据当前URL路由显示对应页面
- 页面组件通过API模块与后端交互获取数据
- 数据通过Vue的响应式系统更新到页面上

# vue单文件组件也是组件，本质上是一个包含特定属性和方法的JavaScript对象
当你写App.vue这样的单文件组件时，构建工具（如Vite）会帮你做这些事：

提取\<script\>部分的内容
提取\<template\>部分的内容并编译成渲染函数
提取\<style\>部分的内容并处理样式
把这些内容组合成一个标准的JavaScript对象
所以最终，你的App.vue文件在运行时就变成了一个像这样的对象：

`javascript`
// 这是构建工具处理后App.vue的实际内容（简化版）
const App = {
  data() { /* ... */ },
  methods: { /* ... */ },
  render() { /* 编译后的模板渲染函数 */ }
}

export default App
因此，当你在main.js中执行import App from './App.vue'时，你导入的实际上就是一个组件对象，这个对象可以被createApp函数使用