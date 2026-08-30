/**
 * 迁移脚本：将 data/articles.json 转为 data/articles/*.md
 * 运行：node migrate-to-md.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const JSON_FILE = path.join(DATA_DIR, 'articles.json');
const ARTICLES_DIR = path.join(DATA_DIR, 'articles');

// 确保 articles 目录存在
if (!fs.existsSync(ARTICLES_DIR)) {
  fs.mkdirSync(ARTICLES_DIR, { recursive: true });
}

// 读取 JSON
if (!fs.existsSync(JSON_FILE)) {
  console.log('articles.json 不存在，无需迁移');
  process.exit(0);
}

const articles = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

// 序列化一篇文章为 .md 格式
function articleToMd(article) {
  const { id, title, date, tags, summary, content } = article;
  const lines = ['---'];
  lines.push(`id: ${id}`);
  lines.push(`title: ${title}`);
  lines.push(`date: ${date}`);

  // tags 一行搞定：tags: [标签1, 标签2]
  const tagsStr = JSON.stringify(tags);
  lines.push(`tags: ${tagsStr}`);

  if (summary) {
    // summary 中可能有冒号，放在单行没问题
    lines.push(`summary: ${summary}`);
  }

  lines.push('---');
  lines.push('');  // 空行分隔
  lines.push(content);
  return lines.join('\n') + '\n';
}

let count = 0;
for (const article of articles) {
  const filename = article.id + '.md';
  const filepath = path.join(ARTICLES_DIR, filename);
  const md = articleToMd(article);
  fs.writeFileSync(filepath, md, 'utf-8');
  count++;
  console.log(`  已创建：${filename}`);
}

console.log(`\n迁移完成！共 ${count} 篇文章 → data/articles/`);
console.log('旧文件 data/articles.json 保留，确认无问题后可手动删除');
