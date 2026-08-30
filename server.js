/**
 * 瓜子 Blog — 后端服务
 * Express + Markdown 文件存储（data/articles/*.md）
 * 启动：node server.js
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// --- 中间件 ---
app.use(express.json({ limit: '2mb' }));
// 静态文件：JS/CSS 禁用缓存，确保修改后浏览器立即获取最新版本
app.use(express.static(__dirname, {
  setHeaders: (res, filepath) => {
    if (filepath.match(/\.(js|css)$/)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
  }
}));

// --- 配置 ---
const DATA_DIR = path.join(__dirname, 'data');
const ARTICLES_DIR = path.join(DATA_DIR, 'articles');
const JSON_FILE = path.join(DATA_DIR, 'articles.json'); // 旧格式兼容
const ADMIN_TOKEN_FILE = path.join(DATA_DIR, '.admin-token');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ARTICLES_DIR)) fs.mkdirSync(ARTICLES_DIR, { recursive: true });

// --- 管理后台认证 ---
function getAdminToken() {
  if (fs.existsSync(ADMIN_TOKEN_FILE)) {
    return fs.readFileSync(ADMIN_TOKEN_FILE, 'utf-8').trim();
  }
  const token = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(ADMIN_TOKEN_FILE, token);
  return token;
}
const ADMIN_TOKEN = getAdminToken();

function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token === ADMIN_TOKEN) return next();
  res.status(401).json({ error: '未授权访问，请在管理后台输入 Token' });
}

// ============================================================
// Frontmatter 解析器（轻量，零依赖）
// ============================================================

/**
 * 从 .md 文件读取文章对象
 * 格式：
 * ---
 * id: xxx
 * title: xxx
 * date: 2026-01-01
 * tags: ["标签1","标签2"]
 * summary: xxx
 * ---
 * Markdown 正文...
 */
function parseMdFile(filepath) {
  try {
    const raw = fs.readFileSync(filepath, 'utf-8');

    // 检查 frontmatter
    if (!raw.startsWith('---')) {
      // 无 frontmatter，整篇当 content
      return { content: raw.trim() };
    }

    const endIdx = raw.indexOf('\n---', 3);
    if (endIdx === -1) {
      return { content: raw.trim() };
    }

    const fm = raw.substring(4, endIdx);           // frontmatter 内容
    const content = raw.substring(endIdx + 4).trim(); // 正文

    const article = {};

    // 按行解析 key: value
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

    article.content = content || '';
    return article;
  } catch (err) {
    console.error('解析文件失败：', filepath, err.message);
    return null;
  }
}

/**
 * 将文章对象序列化为 .md 文件内容
 */
function toMdContent(article) {
  const lines = ['---'];
  lines.push(`id: ${article.id}`);
  lines.push(`title: ${article.title}`);
  lines.push(`date: ${article.date}`);

  if (article.tags && article.tags.length > 0) {
    lines.push(`tags: ${JSON.stringify(article.tags)}`);
  }

  if (article.summary) {
    lines.push(`summary: ${article.summary}`);
  }

  lines.push('---');
  lines.push('');
  lines.push(article.content || '');
  return lines.join('\n');
}

// ============================================================
// 文章数据操作（基于 .md 文件）
// ============================================================

/** 扫描 data/articles/ 目录，读取所有文章（含正文），按日期倒序 */
function readArticles() {
  // 首次启动：如果 articles 目录为空但 articles.json 存在，自动迁移
  const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md'));
  if (files.length === 0 && fs.existsSync(JSON_FILE)) {
    console.log('检测到旧 articles.json，自动迁移到 .md 格式...');
    migrateFromJson();
    return readArticles();
  }

  const articles = [];
  for (const filename of files) {
    const filepath = path.join(ARTICLES_DIR, filename);
    const article = parseMdFile(filepath);
    if (article) {
      articles.push(article);
    }
  }

  // 按日期倒序
  articles.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return articles;
}

/** 从旧 articles.json 迁移数据 */
function migrateFromJson() {
  if (!fs.existsSync(JSON_FILE)) return;
  try {
    const articles = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
    for (const article of articles) {
      const filepath = path.join(ARTICLES_DIR, article.id + '.md');
      fs.writeFileSync(filepath, toMdContent(article), 'utf-8');
    }
    console.log(`已迁移 ${articles.length} 篇文章到 data/articles/`);
  } catch (err) {
    console.error('迁移失败：', err.message);
  }
}

/** 创建/覆盖一篇文章的 .md 文件 */
function writeMdFile(article) {
  const filepath = path.join(ARTICLES_DIR, article.id + '.md');
  fs.writeFileSync(filepath, toMdContent(article), 'utf-8');
}

/** 删除一篇文章的 .md 文件（重命名到 .trash 目录） */
function deleteMdFile(id) {
  const filepath = path.join(ARTICLES_DIR, id + '.md');
  if (!fs.existsSync(filepath)) return false;

  const trashDir = path.join(DATA_DIR, '.trash');
  if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });

  const trashPath = path.join(trashDir, id + '-' + Date.now() + '.md');
  fs.renameSync(filepath, trashPath);
  return true;
}

// 生成唯一 ID
function generateId(title) {
  const base = title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);
  const suffix = Date.now().toString(36);
  return base + '-' + suffix;
}

// 估算阅读时间
function estimateReadingTime(content) {
  const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = content.split(/\s+/).length;
  const total = chineseChars + words;
  return Math.max(1, Math.round(total / 300));
}

// ============================================================
// API 路由
// ============================================================

// --- 公开 API ---

// 获取所有文章（不含正文，只返回元数据）
app.get('/api/articles', (req, res) => {
  const articles = readArticles();
  const { tag, search } = req.query;

  let result = articles.map(a => ({
    id: a.id,
    title: a.title,
    summary: a.summary,
    date: a.date,
    tags: a.tags,
    readingTime: a.readingTime || estimateReadingTime(a.content || '')
  }));

  if (tag) {
    result = result.filter(a => a.tags && a.tags.includes(tag));
  }

  if (search) {
    const keyword = search.toLowerCase();
    result = result.filter(a =>
      (a.title || '').toLowerCase().includes(keyword) ||
      (a.summary || '').toLowerCase().includes(keyword) ||
      (a.tags || []).some(t => t.toLowerCase().includes(keyword))
    );
  }

  res.json({ articles: result, total: result.length });
});

// 获取单篇文章详情（含正文）
app.get('/api/articles/:id', (req, res) => {
  const articles = readArticles();
  const index = articles.findIndex(a => a.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: '文章不存在' });
  }

  const article = { ...articles[index] };
  if (!article.readingTime) {
    article.readingTime = estimateReadingTime(article.content || '');
  }

  // prev = 更旧的文章（日期更早），next = 更新的文章（日期更晚）
  // articles 按日期倒序排列（新→旧），所以 index+1 是更旧的，index-1 是更新的
  res.json({
    article,
    prev: index < articles.length - 1 ? { id: articles[index + 1].id, title: articles[index + 1].title } : null,
    next: index > 0 ? { id: articles[index - 1].id, title: articles[index - 1].title } : null
  });
});

// 获取所有标签
app.get('/api/tags', (req, res) => {
  const articles = readArticles();
  const tagMap = {};
  articles.forEach(a => {
    (a.tags || []).forEach(t => {
      tagMap[t] = (tagMap[t] || 0) + 1;
    });
  });
  const sorted = Object.entries(tagMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
  res.json({ tags: sorted });
});

// --- 管理后台 API（需要认证） ---

app.get('/api/admin/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, token: ADMIN_TOKEN });
});

app.get('/api/admin/articles', authMiddleware, (req, res) => {
  const articles = readArticles();
  res.json({ articles });
});

// 创建文章
app.post('/api/admin/articles', authMiddleware, (req, res) => {
  const { title, summary, tags, content, date } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: '标题不能为空' });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '内容不能为空' });
  }

  const article = {
    id: generateId(title),
    title: title.trim(),
    summary: summary ? summary.trim() : content.substring(0, 120).replace(/[#*>`\n\r]/g, ''),
    tags: tags || [],
    date: date || new Date().toISOString().split('T')[0],
    content: content.trim(),
    readingTime: estimateReadingTime(content)
  };

  writeMdFile(article);
  res.status(201).json({ article, message: '文章创建成功' });
});

// 更新文章
app.put('/api/admin/articles/:id', authMiddleware, (req, res) => {
  const articles = readArticles();
  const index = articles.findIndex(a => a.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: '文章不存在' });
  }

  const article = { ...articles[index] };
  const { title, summary, tags, content, date } = req.body;

  if (title !== undefined) article.title = title.trim();
  if (summary !== undefined) article.summary = summary.trim();
  if (tags !== undefined) article.tags = tags;
  if (date !== undefined) article.date = date;
  if (content !== undefined) {
    article.content = content.trim();
    article.readingTime = estimateReadingTime(content);
  }

  // 如果 id 变了（标题改了导致 id 变化），需要删除旧文件写新的
  writeMdFile(article);
  res.json({ article, message: '文章更新成功' });
});

// 删除文章
app.delete('/api/admin/articles/:id', authMiddleware, (req, res) => {
  const articles = readArticles();
  const article = articles.find(a => a.id === req.params.id);

  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }

  deleteMdFile(req.params.id);
  res.json({ article, message: '文章已删除' });
});

// ============================================================
// SPA fallback
// ============================================================
app.get('*', (req, res) => {
  if (req.path.match(/\.(html|css|js|png|jpg|svg|ico)$/) || req.path.startsWith('/api/')) {
    return res.status(404).send('Not Found');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// 启动服务器
// ============================================================
app.listen(PORT, () => {
  console.log('═══════════════════════════════════════');
  console.log('  🌻 瓜子 Blog 服务已启动');
  console.log('═══════════════════════════════════════');
  console.log(`  前台访问：http://localhost:${PORT}`);
  console.log(`  管理后台：http://localhost:${PORT}/admin.html`);
  console.log(`  Admin Token：${ADMIN_TOKEN}`);
  console.log(`  文章目录：${ARTICLES_DIR}`);
  console.log('───────────────────────────────────────');
  console.log('  文章以 .md 文件存储在 data/articles/ 中');
  console.log('═══════════════════════════════════════');
});
