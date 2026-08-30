---
id: css-grid-guide
title: CSS Grid 布局完全指南：从入门到实战
date: 2026-07-05
tags: ["前端开发","CSS"]
summary: CSS Grid 是现代 Web 布局的利器。本文从基础概念讲起，结合大量实际案例，带你彻底掌握 Grid 布局的核心用法。
---

## 什么是 CSS Grid？

CSS Grid Layout（网格布局）是 CSS 中最强大的布局系统。它是一个**二维布局系统**，可以同时处理列和行，而 Flexbox 本质上是一维的。

## 基础概念

在开始之前，先了解两个核心概念：

- **Grid Container**：设置了 `display: grid` 的元素
- **Grid Items**：网格容器的直接子元素

### 创建第一个 Grid

```css
.container {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
}
```

上面的代码创建了一个三列等宽的网格，间距为 20px。

## fr 单位详解

`fr` 是 Grid 中最实用的单位，代表「可用空间的一份」：

```css
.grid {
  display: grid;
  grid-template-columns: 200px 1fr 2fr;
}
```

| 列 | 宽度计算 |
|----|----------|
| 第一列 | 固定 200px |
| 第二列 | 剩余空间的 1/3 |
| 第三列 | 剩余空间的 2/3 |

## 实用布局模式

### 自适应卡片网格

这是我最常用的模式，不需要媒体查询就能自动响应：

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}
```

> 建议把 Grid 和 Flexbox 配合使用：宏观布局用 Grid，组件内部用 Flexbox。

希望这篇文章对你有所帮助！
