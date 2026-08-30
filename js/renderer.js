/**
 * 瓜子 Blog — 渲染引擎
 * 处理 Markdown 渲染、代码高亮、阅读时间、分页等
 */

class BlogRenderer {
  constructor() {
    this.md = null;
    this.initMarked();
  }

  /**
   * 初始化 marked.js 配置
   * 兼容 marked v4~v12 的 API 差异
   */
  initMarked() {
    if (typeof marked === 'undefined') {
      console.warn('marked.js 未加载');
      return;
    }

    this.md = new marked.Renderer();

    // 捕获 BlogRenderer 实例引用，供回调中使用
    const self = this;

    // 检测 marked 版本：v5+ code 方法接收 (code, infostring, escaped) 位置参数
    // v4 及更早可能传对象，通过检测参数类型自动兼容
    this.md.code = function(code, infostring, _escaped) {
      // 兼容旧版对象格式 { text, lang }
      let codeText, langStr;
      if (typeof code === 'object' && code !== null) {
        codeText = code.text || '';
        langStr = code.lang || '';
      } else {
        codeText = String(code || '');
        langStr = infostring || '';
      }

      const validLang = langStr && typeof hljs !== 'undefined' && hljs.getLanguage(langStr) ? langStr : '';
      let highlighted;
      try {
        highlighted = validLang
          ? hljs.highlight(codeText, { language: validLang }).value
          : (typeof hljs !== 'undefined' ? hljs.highlightAuto(codeText).value : self._escapeHtml(codeText));
      } catch (e) {
        highlighted = self._escapeHtml(codeText);
      }

      const langLabel = validLang ? `<span class="code-lang">${validLang}</span>` : '';

      return `<div class="code-block-wrapper">` +
        `<button class="copy-btn" onclick="BlogRenderer.copyCode(this)">复制</button>` +
        `${langLabel}` +
        `<pre><code class="hljs${validLang ? ' language-' + validLang : ''}" data-highlighted="yes">${highlighted}</code></pre>` +
        `</div>`;
    };

    // 自定义表格渲染
    this.md.table = function(header, body) {
      // 兼容 marked v5+：可能传 token 对象或合并为单参数
      if (typeof header === 'object' && header !== null) {
        // token 模式，退回默认渲染
        return null;
      }
      if (body === undefined && typeof header === 'string') {
        return '<div class="table-wrapper">' + header + '</div>';
      }
      return '<div class="table-wrapper"><table><thead>' + header + '</thead><tbody>' + body + '</tbody></table></div>';
    };

    // 自定义图片渲染
    this.md.image = function(href, title, text) {
      // 兼容 token 对象模式
      if (typeof href === 'object' && href !== null) {
        return null;
      }
      return `<figure><img src="${href}" alt="${text}" title="${title || ''}" loading="lazy"><figcaption>${text}</figcaption></figure>`;
    };

    // 自定义链接（外链新标签打开）
    this.md.link = function(href, title, text) {
      // 兼容 token 对象模式
      if (typeof href === 'object' && href !== null) {
        return null;
      }
      const isExternal = href && href.startsWith('http') && !href.includes(window.location.hostname);
      const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${href}"${titleAttr}${target}>${text}</a>`;
    };

    // marked v5+ 推荐用 marked.use()，兼容旧版的 setOptions
    if (typeof marked.use === 'function') {
      marked.use({ renderer: this.md, gfm: true, breaks: false });
    } else {
      marked.setOptions({ renderer: this.md, gfm: true, breaks: false });
    }
  }

  /** HTML 转义（highlight.js 不可用时的降级） */
  _escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(text).replace(/[&<>"']/g, c => map[c]);
  }

  /**
   * 渲染 Markdown 为 HTML
   */
  renderMarkdown(content) {
    if (typeof marked === 'undefined') {
      return `<p>${content.replace(/\n/g, '<br>')}</p>`;
    }
    return marked.parse(content);
  }

  /**
   * 计算阅读时间（中文 ~300 字/分钟）
   */
  static calculateReadingTime(content) {
    const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
    const words = content.split(/\s+/).length;
    const total = chineseChars + words;
    const minutes = Math.max(1, Math.round(total / 300));
    return minutes;
  }

  /**
   * 复制代码块
   */
  static copyCode(btn) {
    const wrapper = btn.closest('.code-block-wrapper');
    const code = wrapper.querySelector('code').textContent;

    navigator.clipboard.writeText(code).then(() => {
      btn.textContent = '已复制！';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '复制';
        btn.classList.remove('copied');
      }, 2000);
    }).catch(() => {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      btn.textContent = '已复制！';
      setTimeout(() => { btn.textContent = '复制'; }, 2000);
    });
  }

  /**
   * 格式化日期
   */
  static formatDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}年${month}月${day}日`;
  }

  /**
   * 渲染文章卡片列表
   */
  static renderArticleCards(articles, containerId = 'article-list') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (articles.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>暂无文章</p>
        </div>`;
      return;
    }

    const html = articles.map(article => `
      <article class="article-card">
        <a href="article.html?id=${article.id}" class="article-card-title">${article.title}</a>
        <div class="article-card-meta">
          <span>📅 ${BlogRenderer.formatDate(article.date)}</span>
          <span>📖 ${article.readingTime} 分钟阅读</span>
        </div>
        <p class="article-card-summary">${article.summary}</p>
        <div class="article-card-tags">
          ${article.tags.map(tag => `<a href="tags.html?tag=${encodeURIComponent(tag)}" class="tag">${tag}</a>`).join('')}
        </div>
      </article>
    `).join('');

    container.innerHTML = html;
  }

  /**
   * 渲染标签云
   */
  static renderTagCloud(tagStats, containerId = 'tag-cloud') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const maxCount = Math.max(...Object.values(tagStats), 1);
    const minCount = Math.min(...Object.values(tagStats), 1);

    const entries = Object.entries(tagStats).sort((a, b) => b[1] - a[1]);

    const html = entries.map(([tag, count]) => {
      // 根据计数确定大小等级
      const ratio = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
      let sizeClass = 'tag-sm';
      if (ratio > 0.75) sizeClass = 'tag-xl';
      else if (ratio > 0.5) sizeClass = 'tag-lg';
      else if (ratio > 0.25) sizeClass = 'tag-md';

      return `<a href="tags.html?tag=${encodeURIComponent(tag)}"
        class="tag ${sizeClass}"
        title="${count} 篇文章">
        ${tag} (${count})
      </a>`;
    }).join('');

    container.innerHTML = html;
  }

  /**
   * 渲染分页
   */
  static renderPagination(currentPage, totalPages, containerId, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container || totalPages <= 1) {
      if (container) container.innerHTML = '';
      return;
    }

    let html = '';

    // 上一页
    html += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">← 上一页</button>`;

    // 页码
    const pages = [];
    pages.push(1);

    const start = Math.max(2, currentPage - 2);
    const end = Math.min(totalPages - 1, currentPage + 2);

    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('...');

    if (totalPages > 1) pages.push(totalPages);

    pages.forEach(page => {
      if (page === '...') {
        html += '<span class="page-ellipsis">...</span>';
      } else {
        html += `<button class="${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`;
      }
    });

    // 下一页
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">下一页 →</button>`;

    container.innerHTML = html;

    // 绑定点击事件
    container.querySelectorAll('button:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page);
        if (onPageChange) onPageChange(page);
      });
    });
  }

  /**
   * 渲染文章详情
   * @param {Object} article - 文章对象
   * @param {string} containerId
   * @param {Object|null} prevArticle - 上一篇 { id, title }
   * @param {Object|null} nextArticle - 下一篇 { id, title }
   */
  renderArticleDetail(article, containerId = 'article-detail', prevArticle = null, nextArticle = null) {
    const container = document.getElementById(containerId);
    if (!container || !article) return;

    // 兼容静态数据：如果没有传入 prev/next，使用本地函数计算
    if (prevArticle === null && nextArticle === null) {
      const adjacent = getAdjacentArticles(article.id);
      prevArticle = adjacent.prev;
      nextArticle = adjacent.next;
    }

    let html = `
      <header class="article-header">
        <h1>${article.title}</h1>
        <div class="article-header-meta">
          <span>📅 ${BlogRenderer.formatDate(article.date)}</span>
          <span>📖 约 ${article.readingTime} 分钟阅读</span>
        </div>
        <div class="article-header-tags">
          ${article.tags.map(tag => `<a href="tags.html?tag=${encodeURIComponent(tag)}" class="tag">${tag}</a>`).join('')}
        </div>
      </header>
      <div class="article-content">
        ${this.renderMarkdown(article.content)}
      </div>
      <nav class="article-nav">
        ${prevArticle ? `
          <a href="article.html?id=${prevArticle.id}" class="article-nav-prev">
            <div class="article-nav-label">← 上一篇</div>
            <div class="article-nav-title">${prevArticle.title}</div>
          </a>
        ` : '<div></div>'}
        ${nextArticle ? `
          <a href="article.html?id=${nextArticle.id}" class="article-nav-next">
            <div class="article-nav-label">下一篇 →</div>
            <div class="article-nav-title">${nextArticle.title}</div>
          </a>
        ` : '<div></div>'}
      </nav>
    `;

    container.innerHTML = html;

    // 仅对未被自定义渲染器高亮的代码块补充高亮
    if (typeof hljs !== 'undefined') {
      container.querySelectorAll('pre code:not([data-highlighted])').forEach(block => {
        try { hljs.highlightElement(block); } catch (e) { /* 忽略 */ }
      });
    }
  }
}

// 全局实例
const renderer = new BlogRenderer();
