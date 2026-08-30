/**
 * 瓜子 Blog — 公共逻辑
 * 导航栏、移动端菜单、阅读进度、回到顶部等
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initActiveNav();
  initBackToTop();
  initReadingProgress();
  initSmoothScroll();
});

/**
 * 移动端菜单切换
 */
function initMobileMenu() {
  const toggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (!toggle || !navLinks) return;

  toggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen);
  });

  // 点击导航链接后关闭菜单
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  // 点击页面其他区域关闭菜单
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  // ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navLinks.classList.contains('open')) {
      navLinks.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
}

/**
 * 标记当前页所在导航项
 */
function initActiveNav() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-links a');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath ||
        (currentPath === '' && href === 'index.html') ||
        (currentPath === '/' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/**
 * 回到顶部按钮
 */
function initBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        if (window.scrollY > 400) {
          btn.classList.add('visible');
        } else {
          btn.classList.remove('visible');
        }
        ticking = false;
      });
      ticking = true;
    }
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/**
 * 阅读进度条（仅文章详情页）
 */
function initReadingProgress() {
  const progressBar = document.querySelector('.reading-progress');
  if (!progressBar) return;

  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
        progressBar.style.width = `${progress}%`;
        ticking = false;
      });
      ticking = true;
    }
  });
}

/**
 * 平滑滚动（用于锚点链接）
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href').substring(1);
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/**
 * 生成 HTML 头部（统一模板）
 * @param {Object} options
 * @param {string} options.title - 页面标题
 * @param {string} options.description - 页面描述
 */
function getPageHead(options = {}) {
  const siteName = '瓜子 Blog';
  const fullTitle = options.title
    ? `${options.title} — ${siteName}`
    : siteName;
  const description = options.description || '一个关于前端开发、工具推荐和技术分享的个人博客';
  const basePath = options.basePath || '.';

  return `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${description}">
    <title>${fullTitle}</title>
    <link rel="stylesheet" href="${basePath}/css/style.css">
    <!-- Marked.js — Markdown 渲染 -->
    <script src="https://cdn.jsdelivr.net/npm/marked@11/marked.min.js"></script>
    <!-- Highlight.js — 代码高亮 -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/atom-one-dark.min.css">
    <script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/highlight.min.js"></script>
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  `;
}

/**
 * 生成导航栏
 * @param {string} basePath - 相对路径
 */
function getNavbar(basePath = '.') {
  return `
    <nav class="navbar">
      <div class="container">
        <a href="${basePath}/index.html" class="nav-brand">
          <span class="logo-icon">🌻</span>
          瓜子 Blog
        </a>
        <ul class="nav-links">
          <li><a href="${basePath}/index.html">首页</a></li>
          <li><a href="${basePath}/articles.html">文章</a></li>
          <li><a href="${basePath}/tags.html">标签</a></li>
          <li><a href="${basePath}/about.html">关于</a></li>
        </ul>
        <button class="nav-toggle" aria-label="菜单" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  `;
}

/**
 * 生成页脚
 */
function getFooter() {
  const year = new Date().getFullYear();
  return `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-brand">🌻 瓜子 Blog</div>
        <p>记录思考，分享成长 &copy; ${year}</p>
      </div>
    </footer>
  `;
}

/**
 * 回到顶部按钮
 */
function getBackToTop() {
  return '<button class="back-to-top" aria-label="回到顶部" title="回到顶部">↑</button>';
}
