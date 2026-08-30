/**
 * 瓜子 Blog — 文章数据层
 * 优先从后端 API 获取，失败则降级使用本地静态数据
 */

// 静态数据备份（服务器未启动时使用）
const STATIC_ARTICLES = [
  {
    id: 'hello-world',
    title: '你好，世界！瓜子博客正式上线',
    summary: '经过一段时间的准备和打磨，瓜子博客终于和大家见面了。这篇文章聊聊建站的初衷、技术选型以及对未来的规划。',
    date: '2026-07-10',
    tags: ['随笔', '博客'],
    readingTime: 4,
    content: `## 为什么叫「瓜子博客」？

取这个名字，纯粹是因为瓜子这种小零食总让我想起悠闲的午后时光。`,
    coverColor: '#E8913A'
  },
  {
    id: 'css-grid-guide',
    title: 'CSS Grid 布局完全指南：从入门到实战',
    summary: 'CSS Grid 是现代 Web 布局的利器。本文从基础概念讲起，结合大量实际案例。',
    date: '2026-07-05',
    tags: ['前端开发', 'CSS'],
    readingTime: 8,
    content: `## 什么是 CSS Grid？\n\nCSS Grid Layout 是 CSS 中最强大的布局系统。`,
    coverColor: '#4A90D9'
  },
  {
    id: 'javascript-async',
    title: '深入理解 JavaScript 异步编程',
    summary: '异步编程是 JavaScript 的核心特性之一。',
    date: '2026-06-28',
    tags: ['前端开发', 'JavaScript'],
    readingTime: 10,
    content: `## 为什么需要异步？\n\nJavaScript 是单线程语言。`,
    coverColor: '#F7DF1E'
  }
];

// ========================================
// Markdown 文件解析（GitHub Pages 等纯静态托管场景）
// 与后端 server.js 的 parseMdFile 逻辑保持一致
// ========================================

/**
 * 解析 Markdown frontmatter
 * 格式：
 * ---
 * id: xxx
 * title: xxx
 * date: 2026-01-01
 * tags: ["标签1","标签2"]
 * summary: xxx
 * ---
 * Markdown 正文...
 * @returns {{ article: Object, content: string }}
 */
function parseMdFrontmatter(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('---')) {
    return { article: {}, content: raw ? raw.trim() : '' };
  }

  const endIdx = raw.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { article: {}, content: raw.trim() };
  }

  const fm = raw.substring(4, endIdx);          // frontmatter 内容
  const content = raw.substring(endIdx + 4).trim(); // 正文

  const article = {};
  const lines = fm.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.substring(0, colonIdx).trim();
    const value = line.substring(colonIdx + 1).trim();

    switch (key) {
      case 'id':
      case 'title':
      case 'date':
        article[key] = value;
        break;
      case 'summary':
        article.summary = value;
        break;
      case 'tags':
        // 尝试 JSON 解析，失败则按逗号分割
        try {
          article.tags = JSON.parse(value);
        } catch {
          article.tags = value.split(',').map(t => t.trim()).filter(Boolean);
        }
        break;
      default:
        // 忽略未知字段
        break;
    }
  }

  return { article, content };
}

/**
 * 从 data/articles/<id>.md 静态文件读取完整正文
 * 仅在 API 不可用（纯静态托管）时使用
 */
async function fetchArticleMarkdown(id) {
  try {
    const res = await fetch(`data/articles/${encodeURIComponent(id)}.md`);
    if (!res.ok) return null;
    const raw = await res.text();
    const { article, content } = parseMdFrontmatter(raw);
    return { article, content };
  } catch (e) {
    console.warn('读取 Markdown 文件失败：', e.message);
    return null;
  }
}

// ========================================
// 数据层 API
// ========================================

const BlogAPI = {
  baseURL: '',

  /**
   * 获取所有文章列表
   * 直接请求 API，失败则降级到静态数据
   */
  async getArticles(options = {}) {
    const { tag, search } = options;

    try {
      const params = new URLSearchParams();
      if (tag) params.set('tag', tag);
      if (search) params.set('search', search);
      const url = `${this.baseURL}/api/articles?${params.toString()}`;
      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // API 不可用，降级
      console.warn('API 不可用，使用静态数据', e.message);
    }

    // 降级到静态数据
    let result = [...STATIC_ARTICLES];
    if (tag) result = result.filter(a => a.tags.includes(tag));
    if (search) {
      const kw = search.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(kw) ||
        a.summary.toLowerCase().includes(kw) ||
        a.tags.some(t => t.toLowerCase().includes(kw))
      );
    }
    result.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { articles: result, total: result.length };
  },

  /**
   * 获取单篇文章详情
   * 直接请求 API，失败则降级
   */
  async getArticle(id) {
    try {
      const res = await fetch(`${this.baseURL}/api/articles/${encodeURIComponent(id)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('API 不可用，使用静态数据', e.message);
    }

    // 降级到静态数据
    const meta = STATIC_ARTICLES.find(a => a.id === id);
    if (!meta) return null;
    const idx = STATIC_ARTICLES.indexOf(meta);

    // 纯静态托管（GitHub Pages 等）下，优先从 data/articles/<id>.md 读取完整正文
    let article = meta;
    const md = await fetchArticleMarkdown(id);
    if (md && md.content) {
      article = { ...meta, ...md.article, content: md.content };
    }

    // STATIC_ARTICLES 按日期倒序（新→旧），prev=更旧(idx+1)，next=更新(idx-1)
    return {
      article,
      prev: idx < STATIC_ARTICLES.length - 1 ? { id: STATIC_ARTICLES[idx + 1].id, title: STATIC_ARTICLES[idx + 1].title } : null,
      next: idx > 0 ? { id: STATIC_ARTICLES[idx - 1].id, title: STATIC_ARTICLES[idx - 1].title } : null
    };
  },

  /**
   * 获取所有标签统计
   * 直接请求 API，失败则降级
   */
  async getTags() {
    try {
      const res = await fetch(`${this.baseURL}/api/tags`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('API 不可用，使用静态数据', e.message);
    }

    // 降级到静态数据
    const tagMap = {};
    STATIC_ARTICLES.forEach(a => {
      a.tags.forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; });
    });
    const tags = Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    return { tags };
  },

  // --- 管理后台方法 ---

  /**
   * 验证管理员 Token
   */
  async verifyToken(token) {
    try {
      const res = await fetch(`${this.baseURL}/api/admin/verify?token=${encodeURIComponent(token)}`);
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * 获取所有文章（含完整内容，后台用）
   */
  async getAdminArticles(token) {
    const res = await fetch(`${this.baseURL}/api/admin/articles`, {
      headers: { 'x-admin-token': token }
    });
    return await res.json();
  },

  /**
   * 创建文章
   */
  async createArticle(token, data) {
    const res = await fetch(`${this.baseURL}/api/admin/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token
      },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || '创建失败');
    return result;
  },

  /**
   * 更新文章
   */
  async updateArticle(token, id, data) {
    const res = await fetch(`${this.baseURL}/api/admin/articles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token
      },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || '更新失败');
    return result;
  },

  /**
   * 删除文章
   */
  async deleteArticle(token, id) {
    const res = await fetch(`${this.baseURL}/api/admin/articles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': token }
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || '删除失败');
    return result;
  }
};

// ========================================
// 兼容旧的全局函数（供现有页面使用）
// ========================================

// 同步版本（用于兼容，从 static 数据中获取）
function getTagStats() {
  const tagMap = {};
  STATIC_ARTICLES.forEach(a => {
    a.tags.forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; });
  });
  return tagMap;
}

function getArticlesByTag(tag) {
  if (!tag) return [...STATIC_ARTICLES];
  return STATIC_ARTICLES.filter(a => a.tags.includes(tag));
}

function getArticleById(id) {
  return STATIC_ARTICLES.find(a => a.id === id);
}

function getAdjacentArticles(id) {
  const index = STATIC_ARTICLES.findIndex(a => a.id === id);
  return {
    prev: index > 0 ? STATIC_ARTICLES[index - 1] : null,
    next: index < STATIC_ARTICLES.length - 1 ? STATIC_ARTICLES[index + 1] : null
  };
}

function getAllTags() {
  return [...new Set(STATIC_ARTICLES.flatMap(a => a.tags))].sort();
}
