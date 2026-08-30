---
id: javascript-async
title: 深入理解 JavaScript 异步编程：Promise、async/await 与事件循环
date: 2026-06-28
tags: ["前端开发","JavaScript"]
summary: 异步编程是 JavaScript 的核心特性之一。本文从回调函数讲起，逐步深入到 Promise、async/await 以及事件循环机制。
---

## 为什么需要异步？

JavaScript 是**单线程**语言，这意味着一次只能做一件事。如果某个操作耗时较长（比如网络请求），页面就会「卡住」。

异步编程就是解决这个问题的——在等待耗时操作的同时，不阻塞其他代码的执行。

## 回调函数时代

最早处理异步的方式是回调函数：

```javascript
// 回调地狱示例
getUser(userId, function(user) {
  getPosts(user.id, function(posts) {
    getComments(posts[0].id, function(comments) {
      console.log(comments);
    });
  });
});
```

这种层层嵌套的代码被称为**「回调地狱」**。

## Promise：更好的异步方案

```javascript
fetchUser(1)
  .then(user => console.log(user.name))
  .then(() => fetchPosts(user.id))
  .catch(err => console.error('出错了：', err));
```

## async/await：异步代码的终极形态

```javascript
async function loadDashboard() {
  try {
    const user = await fetchCurrentUser();
    const [notifications, tasks] = await Promise.all([
      fetchNotifications(user.id),
      fetchTasks(user.id),
    ]);
    return { user, notifications, tasks };
  } catch (error) {
    console.error('加载失败：', error);
    return null;
  }
}
```

## 事件循环

```javascript
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
console.log('4');
// 输出顺序：1 → 4 → 3 → 2
```

> 记住：**微任务优先于宏任务**！

异步编程是 JavaScript 开发者的必修课。掌握好 async/await 和 Promise，能写出更清晰的异步代码。
