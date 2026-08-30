/**
 * 瓜子 Blog — 管理后台逻辑
 * 文章列表管理、新建/编辑/删除文章
 */

// ========================================
// 状态管理
// ========================================
let adminToken = '';
let editingArticleId = null;
let allArticles = [];
let currentView = 'list';

// ========================================
// DOM 元素
// ========================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ========================================
// 初始化
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  // 检查是否已保存 token
  const savedToken = localStorage.getItem('guazi_admin_token');
  if (savedToken) {
    adminToken = savedToken;
    verifyAndEnter();
  }

  initEventListeners();
});

function initEventListeners() {
  // 登录
  $('#login-btn').addEventListener('click', handleLogin);
  $('#token-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // 退出
  $('#btn-logout').addEventListener('click', handleLogout);

  // 导航切换
  $$('.admin-nav-item').forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });

  // 编辑器
  $('#editor-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleSave();
  });
  $('#btn-cancel-edit').addEventListener('click', () => switchView('list'));
  $('#btn-cancel-edit-bottom').addEventListener('click', () => switchView('list'));

  // Markdown 实时预览
  const contentArea = $('#article-content');
  const previewArea = $('#editor-preview');
  const autoPreview = $('#auto-preview');
  const charCount = $('#char-count');

  let previewTimeout;

  function updatePreview() {
    const content = contentArea.value;
    charCount.textContent = `${content.length} 字`;
    if (autoPreview.checked && typeof marked !== 'undefined') {
      previewArea.innerHTML = marked.parse(content || '*暂无内容*');
    }
  }

  contentArea.addEventListener('input', () => {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(updatePreview, 300);
  });

  autoPreview.addEventListener('change', () => {
    if (autoPreview.checked) updatePreview();
  });

  // 预览模式切换（全屏编辑器/全屏预览）
  $('#btn-preview-toggle').addEventListener('click', () => {
    const workspace = $('.editor-workspace');
    const editorPane = workspace.querySelectorAll('.editor-pane');
    const isFullEditor = editorPane[1].style.display === 'none';

    if (isFullEditor) {
      editorPane[1].style.display = '';
      workspace.style.gridTemplateColumns = '1fr 1fr';
      $('#btn-preview-toggle').textContent = '👁️ 切换预览模式';
    } else {
      editorPane[1].style.display = 'none';
      workspace.style.gridTemplateColumns = '1fr';
      $('#btn-preview-toggle').textContent = '📝 返回编辑';
    }
  });

  // 删除弹窗
  $('#btn-delete-cancel').addEventListener('click', closeDeleteModal);
  $('#btn-delete-confirm').addEventListener('click', handleDeleteConfirm);
  $('#delete-modal').addEventListener('click', (e) => {
    if (e.target === $('#delete-modal')) closeDeleteModal();
  });
}

// ========================================
// 登录 / 退出
// ========================================
async function handleLogin() {
  const token = $('#token-input').value.trim();
  if (!token) {
    showLoginError('请输入 Token');
    return;
  }

  const valid = await BlogAPI.verifyToken(token);
  if (valid) {
    adminToken = token;
    localStorage.setItem('guazi_admin_token', token);
    showAdminApp();
  } else {
    showLoginError('Token 验证失败，请检查后重试');
  }
}

async function verifyAndEnter() {
  const valid = await BlogAPI.verifyToken(adminToken);
  if (valid) {
    showAdminApp();
  } else {
    localStorage.removeItem('guazi_admin_token');
    adminToken = '';
    $('#token-input').focus();
  }
}

function showLoginError(msg) {
  $('#login-error').textContent = msg;
}

function handleLogout() {
  localStorage.removeItem('guazi_admin_token');
  adminToken = '';
  editingArticleId = null;
  allArticles = [];
  $('#admin-app').style.display = 'none';
  $('#login-overlay').style.display = '';
  $('#token-input').value = '';
  $('#token-input').focus();
}

function showAdminApp() {
  $('#login-overlay').style.display = 'none';
  $('#admin-app').style.display = '';
  loadArticles();
}

// ========================================
// 视图切换
// ========================================
function switchView(view) {
  currentView = view;

  // 更新导航高亮
  $$('.admin-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });

  // 切换视图
  $('#view-list').style.display = view === 'list' ? '' : 'none';
  $('#view-editor').style.display = view === 'editor' ? '' : 'none';

  if (view === 'list') {
    editingArticleId = null;
    loadArticles();
  }

  if (view === 'editor' && !editingArticleId) {
    resetEditorForm();
    $('#editor-title-label').textContent = '新建文章';
    $('#btn-save-text').textContent = '发布文章';
  }
}

// ========================================
// 文章列表管理
// ========================================
async function loadArticles() {
  try {
    const data = await BlogAPI.getAdminArticles(adminToken);
    allArticles = data.articles;
    renderArticleTable();
    $('#admin-article-count').textContent = `共 ${allArticles.length} 篇`;
  } catch (err) {
    allArticles = [];
    renderArticleTable();
    $('#admin-article-count').textContent = '加载失败';
  }
}

function renderArticleTable() {
  const tbody = $('#admin-article-list-body');

  if (allArticles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="admin-empty">暂无文章，点击左侧「新建文章」开始创作</td></tr>';
    return;
  }

  tbody.innerHTML = allArticles.map(article => `
    <tr>
      <td class="article-title-cell">${article.title}</td>
      <td>${article.date}</td>
      <td>
        <div class="article-tags-cell">
          ${article.tags.map(t => `<span class="tag tag-sm">${t}</span>`).join('')}
        </div>
      </td>
      <td>
        <div class="article-actions">
          <button class="admin-btn admin-btn-outline admin-btn-sm" data-action="edit" data-id="${article.id}">编辑</button>
          <button class="admin-btn admin-btn-sm" style="background:#fff0f0;color:#e53935;border:1px solid #ffcdd2;" data-action="delete" data-id="${article.id}">删除</button>
        </div>
      </td>
    </tr>
  `).join('');

  // 绑定操作事件
  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => editArticle(btn.dataset.id));
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
  });
}

// ========================================
// 编辑文章
// ========================================
function editArticle(id) {
  const article = allArticles.find(a => a.id === id);
  if (!article) return;

  editingArticleId = id;
  $('#article-title').value = article.title;
  $('#article-summary').value = article.summary || '';
  $('#article-tags').value = (article.tags || []).join(', ');
  $('#article-date').value = article.date || '';
  $('#article-content').value = article.content || '';
  $('#char-count').textContent = `${(article.content || '').length} 字`;
  $('#editor-title-label').textContent = '编辑文章';
  $('#btn-save-text').textContent = '保存修改';

  switchView('editor');

  // 触发预览更新
  $('#article-content').dispatchEvent(new Event('input'));
}

function resetEditorForm() {
  editingArticleId = null;
  $('#article-title').value = '';
  $('#article-summary').value = '';
  $('#article-tags').value = '';
  $('#article-date').value = new Date().toISOString().split('T')[0];
  $('#article-content').value = '';
  $('#char-count').textContent = '0 字';
  $('#editor-preview').innerHTML = '<p style="color: var(--color-text-muted); text-align: center; margin-top: 60px;">在左侧输入 Markdown 内容即可预览</p>';
}

// ========================================
// 保存文章
// ========================================
async function handleSave() {
  const title = $('#article-title').value.trim();
  const content = $('#article-content').value.trim();

  if (!title) {
    alert('请输入文章标题');
    $('#article-title').focus();
    return;
  }
  if (!content) {
    alert('请输入文章内容');
    $('#article-content').focus();
    return;
  }

  const data = {
    title,
    summary: $('#article-summary').value.trim(),
    tags: $('#article-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    date: $('#article-date').value || undefined,
    content
  };

  $('#btn-save-text').textContent = '保存中...';
  $('#btn-save').disabled = true;

  try {
    if (editingArticleId) {
      await BlogAPI.updateArticle(adminToken, editingArticleId, data);
      showToast('文章已更新');
    } else {
      await BlogAPI.createArticle(adminToken, data);
      showToast('文章发布成功');
    }

    editingArticleId = null;
    resetEditorForm();
    switchView('list');
  } catch (err) {
    alert(`操作失败：${err.message}`);
  } finally {
    $('#btn-save-text').textContent = editingArticleId ? '保存修改' : '发布文章';
    $('#btn-save').disabled = false;
  }
}

// ========================================
// 删除文章
// ========================================
let deleteTargetId = null;

function openDeleteModal(id) {
  const article = allArticles.find(a => a.id === id);
  if (!article) return;

  deleteTargetId = id;
  $('#delete-article-title').textContent = article.title;
  $('#delete-modal').style.display = '';
}

function closeDeleteModal() {
  deleteTargetId = null;
  $('#delete-modal').style.display = 'none';
}

async function handleDeleteConfirm() {
  if (!deleteTargetId) return;

  $('#btn-delete-confirm').textContent = '删除中...';
  $('#btn-delete-confirm').disabled = true;

  try {
    await BlogAPI.deleteArticle(adminToken, deleteTargetId);
    showToast('文章已删除');
    closeDeleteModal();
    loadArticles();
  } catch (err) {
    alert(`删除失败：${err.message}`);
  } finally {
    $('#btn-delete-confirm').textContent = '确认删除';
    $('#btn-delete-confirm').disabled = false;
  }
}

// ========================================
// Toast 提示
// ========================================
function showToast(message) {
  const existing = $('.admin-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'admin-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: #2D2D2D;
    color: #fff;
    padding: 10px 24px;
    border-radius: 8px;
    font-size: 0.9rem;
    z-index: 3000;
    animation: toastIn 0.3s ease;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// 注入 toast 动画
const style = document.createElement('style');
style.textContent = '@keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }';
document.head.appendChild(style);
