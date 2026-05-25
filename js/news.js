// ============================================================
// NEWS MODULE - 公众号资讯
// ============================================================
let currentNewsView = 'timeline';
let editingArticleId = null;
let currentArticleId = null;

function saveArticles() {
  DB.save('articles_v1', articles);
}

// 初始化资讯页面
function initNewsPage() {
  renderNewsView();
  updateNewsFilters();
  updateNewsPendingBadge();
}

// 更新侧边栏待验证徽章
function updateNewsPendingBadge() {
  const urgentCount = articles.filter(a => {
    if (a.verification?.verified) return false;
    if ((a.relevance || 3) < 4) return false;
    const daysAgo = Math.floor((Date.now() - new Date(a.date).getTime()) / 86400000);
    return daysAgo >= 7;
  }).length;
  const badge = document.getElementById('news-pending-badge');
  if (badge) {
    badge.textContent = urgentCount;
    badge.style.display = urgentCount > 0 ? '' : 'none';
  }
}

// 更新筛选下拉框
function updateNewsFilters() {
  // 更新来源列表
  const sources = [...new Set(articles.map(a => a.source).filter(Boolean))];
  const sourceSelect = document.getElementById('news-filter-source');
  const sourceList = document.getElementById('source-list');
  sourceSelect.innerHTML = '<option value="">全部来源</option>' +
    sources.map(s => `<option value="${s}">${s}</option>`).join('');
  sourceList.innerHTML = sources.map(s => `<option value="${s}">`).join('');

  // 更新来源类型筛选（显示研报和公众号数量）
  const reportCount = articles.filter(a => a.type === 'report').length;
  const wechatCount = articles.filter(a => a.type === 'wechat' || !a.type).length;
  const typeSelect = document.getElementById('news-filter-type');
  if (typeSelect) {
    typeSelect.innerHTML = `
      <option value="">全部类型</option>
      <option value="report">📑 研报 (${reportCount})</option>
      <option value="wechat">💬 公众号 (${wechatCount})</option>
    `;
  }

  // 更新标签列表
  const allTags = [...new Set(articles.flatMap(a => a.tags || []).filter(Boolean))];
  const tagSelect = document.getElementById('news-filter-tag');
  tagSelect.innerHTML = '<option value="">全部标签</option>' +
    allTags.map(t => `<option value="${t}">${t}</option>`).join('');
}

// 切换资讯视图
function switchNewsView(view) {
  currentNewsView = view;
  document.querySelectorAll('#news-view-tabs .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.newsView === view);
  });
  document.querySelectorAll('.news-view').forEach(v => v.style.display = 'none');
  document.getElementById('news-view-' + view).style.display = 'block';
  renderNewsView();
}

// 获取筛选后的文章
function getFilteredArticles() {
  const typeFilter = document.getElementById('news-filter-type')?.value || '';
  const sourceFilter = document.getElementById('news-filter-source')?.value || '';
  const tagFilter = document.getElementById('news-filter-tag')?.value || '';
  const verifyFilter = document.getElementById('news-filter-verification')?.value || '';
  const search = document.getElementById('news-search')?.value?.toLowerCase() || '';

  return articles.filter(a => {
    // 类型筛选（report/wechat）
    if (typeFilter && a.type !== typeFilter) return false;
    if (sourceFilter && a.source !== sourceFilter) return false;
    if (tagFilter && !(a.tags || []).includes(tagFilter)) return false;
    if (verifyFilter) {
      if (verifyFilter === 'pending' && a.verification?.verified) return false;
      if (verifyFilter === 'correct' && a.verification?.result !== 'correct') return false;
      if (verifyFilter === 'wrong' && a.verification?.result !== 'wrong') return false;
    }
    if (search) {
      const haystack = (a.title + ' ' + (a.summary || '') + ' ' + (a.source || '')).toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));
}

// 渲染资讯视图
function renderNewsView() {
  const filtered = getFilteredArticles();
  const emptyState = document.getElementById('news-empty-state');
  const contentArea = document.getElementById('news-content-area');

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
    contentArea.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  contentArea.style.display = 'block';

  switch (currentNewsView) {
    case 'timeline': renderTimelineView(filtered); break;
    case 'source': renderSourceView(filtered); break;
    case 'list': renderListView(filtered); break;
  }
}

// 渲染时间线视图
function renderTimelineView(articles) {
  const container = document.getElementById('news-view-timeline');
  const grouped = {};

  articles.forEach(a => {
    const month = a.date.substring(0, 7);
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(a);
  });

  let html = '';
  Object.keys(grouped).sort().reverse().forEach(month => {
    const monthArticles = grouped[month];
    const monthLabel = month + '月';
    html += `<div class="news-timeline-date">${monthLabel}</div>`;
    html += monthArticles.map(a => renderArticleCard(a)).join('');
  });

  container.innerHTML = html;
}

// 渲染公众号视图
function renderSourceView(articles) {
  const container = document.getElementById('news-view-source');
  const grouped = {};

  articles.forEach(a => {
    const source = a.source || '未知来源';
    if (!grouped[source]) grouped[source] = [];
    grouped[source].push(a);
  });

  // 按文章数量排序
  const sortedSources = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);

  let html = sortedSources.map(source => {
    const sourceArticles = grouped[source];
    const avgRelevance = (sourceArticles.reduce((sum, a) => sum + (a.relevance || 3), 0) / sourceArticles.length).toFixed(1);
    const verifiedInSrc = sourceArticles.filter(a => a.verification?.verified);
    const correctInSrc = sourceArticles.filter(a => a.verification?.result === 'correct').length;
    const accRate = verifiedInSrc.length >= 1 ? Math.round(correctInSrc / verifiedInSrc.length * 100) + '%' : '待验证';
    const accColor = verifiedInSrc.length < 2 ? 'var(--text3)' :
      correctInSrc / verifiedInSrc.length >= 0.6 ? 'var(--green)' :
      correctInSrc / verifiedInSrc.length >= 0.4 ? 'var(--yellow)' : 'var(--red)';
    const posCount = sourceArticles.filter(a => a.sentiment === 1).length;
    const negCount = sourceArticles.filter(a => a.sentiment === -1).length;
    const sentimentBadge = posCount > negCount
      ? `<span style="color:var(--red);font-size:10px;background:rgba(239,68,68,0.1);padding:2px 6px;border-radius:10px;">偏多</span>`
      : negCount > posCount
      ? `<span style="color:var(--green);font-size:10px;background:rgba(16,185,129,0.1);padding:2px 6px;border-radius:10px;">偏空</span>`
      : `<span style="color:var(--text3);font-size:10px;background:var(--bg4);padding:2px 6px;border-radius:10px;">中性</span>`;
    const urgentCount = sourceArticles.filter(a => {
      if (a.verification?.verified) return false;
      if ((a.relevance || 3) < 4) return false;
      return Math.floor((Date.now() - new Date(a.date).getTime()) / 86400000) >= 7;
    }).length;

    return `<div class="news-source-list">
      <div class="news-source-item" style="cursor:pointer;" onclick="toggleSourceArticles(this)">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div class="news-source-name">${source}</div>
            ${sentimentBadge}
            ${urgentCount > 0 ? `<span style="color:var(--yellow);font-size:10px;background:rgba(245,158,11,0.12);padding:2px 6px;border-radius:10px;">⏰ ${urgentCount}篇待验证</span>` : ''}
          </div>
          <div class="news-source-count" style="margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;">
            <span>${sourceArticles.length}篇文章</span>
            <span>平均关联 ${avgRelevance}⭐</span>
            <span>准确率 <strong style="color:${accColor};">${accRate}</strong>${verifiedInSrc.length > 0 ? `（${verifiedInSrc.length}已验证）` : ''}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:var(--text3);font-size:11px;">查看</span>
          <span class="source-toggle-icon">▼</span>
        </div>
      </div>
      <div class="source-articles" style="display:none;padding-left:16px;margin-top:8px;">
        ${sourceArticles.map(a => renderArticleCard(a)).join('')}
      </div>
    </div>`;
  }).join('');

  container.innerHTML = html || '<div class="empty-state"><div class="icon">📂</div><div class="title">暂无数据</div></div>';
}

function toggleSourceArticles(el) {
  const articles = el.nextElementSibling;
  const icon = el.querySelector('.source-toggle-icon');
  if (articles.style.display === 'none') {
    articles.style.display = 'block';
    icon.textContent = '▲';
  } else {
    articles.style.display = 'none';
    icon.textContent = '▼';
  }
}

// 渲染列表视图
function renderListView(articles) {
  const container = document.getElementById('news-view-list');
  container.innerHTML = articles.map(a => renderArticleCard(a)).join('') || '<div class="empty-state"><div class="icon">📋</div><div class="title">暂无数据</div></div>';
}

// 渲染单篇文章卡片
function renderArticleCard(a) {
  const sentimentLabels = { '-1': '🔴 负面', '0': '⚪ 中性', '1': '🟢 正面' };
  const sentimentClass = { '-1': 'tag-red', '0': 'tag-gray', '1': 'tag-green' };
  const verificationBadge = getVerificationBadge(a.verification);
  const relevanceDots = getRelevanceDots(a.relevance || 3);

  // 计算待验证提醒：高关联度且尚未验证的文章，超时提醒
  let urgencyBanner = '';
  if (!a.verification?.verified && (a.relevance || 3) >= 4) {
    const daysAgo = Math.floor((Date.now() - new Date(a.date).getTime()) / 86400000);
    if (daysAgo >= 7 && daysAgo < 30) {
      urgencyBanner = `<div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:6px;padding:5px 10px;font-size:11px;color:var(--yellow);margin-bottom:8px;display:flex;align-items:center;gap:5px;">
        ⏰ 发布已 <strong>${daysAgo}</strong> 天，高关联文章观点可以验证了
        <button class="btn btn-sm" style="margin-left:auto;padding:2px 8px;font-size:10px;background:rgba(245,158,11,0.2);border:1px solid rgba(245,158,11,0.4);color:var(--yellow);" onclick="event.stopPropagation();openVerificationModal('${a.id}')">去验证</button>
      </div>`;
    } else if (daysAgo >= 30) {
      urgencyBanner = `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:5px 10px;font-size:11px;color:var(--red);margin-bottom:8px;display:flex;align-items:center;gap:5px;">
        🔔 发布已 <strong>${daysAgo}</strong> 天，高关联文章长期未验证
        <button class="btn btn-sm" style="margin-left:auto;padding:2px 8px;font-size:10px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:var(--red);" onclick="event.stopPropagation();openVerificationModal('${a.id}')">去验证</button>
      </div>`;
    }
  }

  return `<div class="news-article-card" onclick="openArticleDetail('${a.id}')">
    <div class="news-article-header">
      <span class="news-source-badge">${a.type === 'report' ? '📑' : '💬'} ${a.source || '未知来源'}</span>
      <div style="display:flex;align-items:center;gap:10px;">
        ${verificationBadge}
        ${relevanceDots}
      </div>
    </div>
    ${urgencyBanner}
    <div class="news-article-title">
      ${a.url ? `<a href="${a.url}" target="_blank" onclick="event.stopPropagation();">${a.title}</a>` : a.title}
    </div>
    <div class="news-article-meta">
      <span>📅 ${a.date}</span>
      <span class="${sentimentClass[a.sentiment + ''] || ''}" style="padding:1px 6px;border-radius:10px;font-size:10px;">
        ${sentimentLabels[a.sentiment + ''] || '⚪ 中性'}
      </span>
      ${a.related ? `<span>🔗 ${a.related}</span>` : ''}
    </div>
    ${(a.summary || '').length > 0 ? `<div class="news-article-summary">${a.summary.substring(0, 150)}${a.summary.length > 150 ? '...' : ''}</div>` : ''}
    ${(a.tags || []).length > 0 ? `<div class="news-tags">
      ${a.tags.map(t => `<span class="tag tag-blue" style="cursor:pointer;" onclick="event.stopPropagation();filterByTag('${t}')">${t}</span>`).join('')}
    </div>` : ''}
  </div>`;
}

// 获取验证徽章
function getVerificationBadge(verification) {
  if (!verification || !verification.verified) {
    return '<span class="news-verification-badge pending">⏳ 待验证</span>';
  }
  const labels = {
    'correct': '✅ 正确',
    'wrong': '❌ 错误',
    'partial': '⚠️ 部分',
    'pending': '⏳ 待验证'
  };
  const classes = {
    'correct': 'correct',
    'wrong': 'wrong',
    'partial': 'pending',
    'pending': 'pending'
  };
  return `<span class="news-verification-badge ${classes[verification.result] || 'pending'}">${labels[verification.result] || '⏳ 待验证'}</span>`;
}

// 获取关联度指示器
function getRelevanceDots(level) {
  const dots = Math.min(5, Math.max(1, level || 3));
  return `<div class="news-relation-indicator" title="行情关联度: ${dots}/5">
    ${Array(5).fill(0).map((_, i) => `<span class="news-relation-dot ${i < dots ? (dots >= 4 ? 'high' : dots >= 3 ? 'medium' : 'low') : ''}" style="opacity:${i < dots ? 1 : 0.3}"></span>`).join('')}
  </div>`;
}

// 获取情感条
function getSentimentBar(sentiment) {
  const pct = ((sentiment + 1) / 2) * 100;
  const isPositive = sentiment > 0;
  return `<div class="news-sentiment-bar" title="情感: ${isPositive ? '正面' : sentiment < 0 ? '负面' : '中性'}">
    <div class="news-sentiment-fill ${isPositive ? 'positive' : sentiment < 0 ? 'negative' : ''}"
         style="${isPositive ? `left:50%;width:${pct - 50}%` : `right:50%;width:${50 - pct}%`}"></div>
  </div>`;
}

// 按标签筛选
function filterByTag(tag) {
  document.getElementById('news-filter-tag').value = tag;
  renderNewsView();
}

// 打开新增文章弹窗
function openAddArticle() {
  editingArticleId = null;
  document.getElementById('modal-article-title').textContent = '📝 录入文章';
  document.getElementById('article-source').value = '';
  document.getElementById('article-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('article-title').value = '';
  document.getElementById('article-url').value = '';
  document.getElementById('article-url-quick').value = '';
  document.getElementById('url-parse-hint').style.display = 'none';
  document.getElementById('article-rawtext').value = '';
  document.getElementById('ai-result-preview').style.display = 'none';
  document.getElementById('ai-analyze-status').textContent = '';
  document.getElementById('article-summary').value = '';
  document.getElementById('article-relevance').value = '3';
  document.getElementById('article-sentiment').value = '0';
  document.getElementById('article-tags').value = '';
  document.getElementById('article-related').value = '';
  // 重置步骤指示器
  updateStepIndicator(1);
  // 展开AI区
  const body = document.getElementById('ai-zone-body');
  const btn = document.getElementById('btn-toggle-ai-zone');
  if (body) body.style.display = 'block';
  if (btn) btn.textContent = '收起';
  openModal('modal-article');
}

// 打开编辑文章弹窗
function openEditArticle(articleId) {
  const article = articles.find(a => a.id === articleId);
  if (!article) return;
  editingArticleId = articleId;
  document.getElementById('modal-article-title').textContent = '✏️ 编辑文章';
  document.getElementById('article-source').value = article.source || '';
  document.getElementById('article-date').value = article.date || '';
  document.getElementById('article-title').value = article.title || '';
  document.getElementById('article-url').value = article.url || '';
  document.getElementById('article-summary').value = article.summary || '';
  document.getElementById('article-relevance').value = article.relevance || 3;
  document.getElementById('article-sentiment').value = article.sentiment || 0;
  document.getElementById('article-tags').value = (article.tags || []).join(', ');
  document.getElementById('article-related').value = article.related || '';
  openModal('modal-article');
}

// 保存文章
function saveArticle() {
  const source = document.getElementById('article-source').value.trim();
  const date = document.getElementById('article-date').value;
  const title = document.getElementById('article-title').value.trim();

  if (!source) { alert('请填写来源名称'); return; }
  if (!date) { alert('请选择发布日期'); return; }
  if (!title) { alert('请填写文章标题'); return; }

  const tagsRaw = document.getElementById('article-tags').value || '';
  const tags = tagsRaw.split(/[,，、]/).map(t => t.trim()).filter(Boolean);

  const articleData = {
    type: document.getElementById('article-type').value || 'wechat',
    source,
    date,
    title,
    url: document.getElementById('article-url').value.trim(),
    summary: document.getElementById('article-summary').value.trim(),
    relevance: parseInt(document.getElementById('article-relevance').value) || 3,
    sentiment: parseInt(document.getElementById('article-sentiment').value) || 0,
    tags,
    related: document.getElementById('article-related').value.trim(),
  };

  if (editingArticleId) {
    const idx = articles.findIndex(a => a.id === editingArticleId);
    if (idx >= 0) {
      articles[idx] = { ...articles[idx], ...articleData };
    }
  } else {
    articles.push({
      id: uuid(),
      ...articleData,
      verification: { verified: false },
      createdAt: new Date().toISOString()
    });
  }

  saveArticles();
  closeModal('modal-article');
  initNewsPage();
}

// 打开文章详情
function openArticleDetail(articleId) {
  currentArticleId = articleId;
  const article = articles.find(a => a.id === articleId);
  if (!article) return;

  document.getElementById('detail-article-title').textContent = article.title;

  const sentimentLabels = { '-1': '🔴 负面', '0': '⚪ 中性', '1': '🟢 正面' };
  const sentimentClass = { '-1': 'tag-red', '0': 'tag-gray', '1': 'tag-green' };
  const sentimentFill = getSentimentBar(article.sentiment || 0);

  const html = `
    <div style="margin-bottom:16px;">
      <span class="news-source-badge" style="font-size:12px;padding:5px 12px;">${article.source || '未知来源'}</span>
      <span style="margin-left:10px;font-size:12px;color:var(--text3);">📅 ${article.date}</span>
    </div>

    ${article.url ? `<div style="margin-bottom:12px;">
      <a href="${article.url}" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none;">
        🔗 打开原文链接
      </a>
    </div>` : ''}

    <div class="news-detail-section">
      <div class="news-detail-section-title">📊 基础信息</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">行情关联度</div>
          <div class="info-value">${getRelevanceDots(article.relevance || 3)} <span style="font-size:11px;color:var(--text3);margin-left:8px;">${article.relevance || 3}/5</span></div>
        </div>
        <div class="info-item">
          <div class="info-label">情感倾向</div>
          <div class="info-value ${sentimentClass[article.sentiment + '']}">${sentimentLabels[article.sentiment + ''] || '⚪ 中性'}</div>
        </div>
        ${article.related ? `<div class="info-item">
          <div class="info-label">关联持仓</div>
          <div class="info-value">${article.related}</div>
        </div>` : ''}
      </div>
      ${(article.tags || []).length > 0 ? `<div class="news-detail-tags">
        ${article.tags.map(t => `<span class="tag tag-blue">${t}</span>`).join('')}
      </div>` : ''}
    </div>

    ${(article.summary || '').length > 0 ? `
    <div class="news-detail-section">
      <div class="news-detail-section-title">📝 核心要点</div>
      <div style="font-size:13px;line-height:1.7;color:var(--text2);">${article.summary}</div>
    </div>` : ''}

    <div class="news-detail-section">
      <div class="news-detail-section-title">🎯 观点验证</div>
      ${renderVerificationSection(article)}
    </div>

    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
      <button class="btn btn-primary btn-sm" onclick="openEditArticle('${article.id}')">✏️ 编辑</button>
      <button class="btn btn-secondary btn-sm" onclick="openVerificationModal('${article.id}')">🎯 验证观点</button>
      <button class="btn btn-danger btn-sm" onclick="deleteArticle('${article.id}')">🗑️ 删除</button>
    </div>
  `;

  document.getElementById('detail-article-content').innerHTML = html;
  openModal('modal-article-detail');
}

// 渲染验证区域
function renderVerificationSection(article) {
  const v = article.verification;
  if (!v || !v.verified) {
    return `<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">
      <div style="font-size:24px;margin-bottom:8px;">⏳</div>
      <div>该文章观点尚未验证</div>
      <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="openVerificationModal('${article.id}')">
        🎯 开始验证
      </button>
    </div>`;
  }

  const resultLabels = {
    'correct': { icon: '✅', label: '观点正确', class: 'correct' },
    'wrong': { icon: '❌', label: '观点错误', class: 'wrong' },
    'partial': { icon: '⚠️', label: '部分验证', class: 'partial' },
    'pending': { icon: '⏳', label: '待验证', class: 'pending' }
  };
  const r = resultLabels[v.result] || resultLabels.pending;

  return `
    <div class="news-verification-item">
      <div style="font-size:24px;">${r.icon}</div>
      <div style="flex:1;">
        <div style="font-weight:600;color:var(--text);">${r.label}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;">
          验证日期：${v.date || '未记录'} ${v.notes ? '· ' + v.notes : ''}
        </div>
      </div>
    </div>
    <button class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="openVerificationModal('${article.id}')">
      🔄 更新验证
    </button>
  `;
}

// 打开验证弹窗
function openVerificationModal(articleId) {
  const article = articles.find(a => a.id === articleId);
  if (!article) return;
  currentArticleId = articleId;

  document.getElementById('verification-original-point').innerHTML = `
    <div style="background:var(--bg3);border-radius:8px;padding:12px;font-size:12px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">📌 原文核心观点</div>
      <div style="color:var(--text2);line-height:1.6;">${article.summary || article.title}</div>
    </div>
  `;

  document.getElementById('verification-result').value = article.verification?.result || '';
  document.getElementById('verification-date').value = article.verification?.date || new Date().toISOString().slice(0, 10);
  document.getElementById('verification-notes').value = article.verification?.notes || '';

  openModal('modal-verification');
}

// 保存验证
function saveVerification() {
  const result = document.getElementById('verification-result').value;
  if (!result) { alert('请选择验证结果'); return; }

  const article = articles.find(a => a.id === currentArticleId);
  if (!article) return;

  article.verification = {
    verified: true,
    result,
    date: document.getElementById('verification-date').value,
    notes: document.getElementById('verification-notes').value.trim()
  };

  saveArticles();
  closeModal('modal-verification');
  openArticleDetail(currentArticleId); // 刷新详情
  renderNewsView();
  updateNewsFilters();
  updateNewsPendingBadge();
}

// 删除文章
function deleteArticle(articleId) {
  if (!confirm('确定删除这篇文章？')) return;
  articles = articles.filter(a => a.id !== articleId);
  saveArticles();
  closeModal('modal-article-detail');
  initNewsPage();
}

// 渲染统计面板
function renderNewsStats() {
  const container = document.getElementById('news-stats-content');

  // 基础统计
  const totalArticles = articles.length;
  const totalSources = new Set(articles.map(a => a.source)).size;
  const verifiedArticles = articles.filter(a => a.verification?.verified);
  const correctCount = articles.filter(a => a.verification?.result === 'correct').length;
  const wrongCount = articles.filter(a => a.verification?.result === 'wrong').length;
  const accuracy = verifiedArticles.length > 0 ? (correctCount / verifiedArticles.length * 100).toFixed(1) : '--';

  // 高关联度文章
  const highRelevance = articles.filter(a => (a.relevance || 3) >= 4).length;

  // 待验证提醒（高关联且超7天）
  const urgentPending = articles.filter(a => {
    if (a.verification?.verified) return false;
    if ((a.relevance || 3) < 4) return false;
    const daysAgo = Math.floor((Date.now() - new Date(a.date).getTime()) / 86400000);
    return daysAgo >= 7;
  }).length;

  // 情感分布
  const sentimentCount = { '-1': 0, '0': 0, '1': 0 };
  articles.forEach(a => {
    const s = (a.sentiment || 0) + '';
    sentimentCount[s] = (sentimentCount[s] || 0) + 1;
  });

  // Top标签
  const tagCount = {};
  articles.forEach(a => (a.tags || []).forEach(t => tagCount[t] = (tagCount[t] || 0) + 1));
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // ─── 公众号准确率统计 ───
  const sourceStats = {};
  articles.forEach(a => {
    const src = a.source || '未知';
    if (!sourceStats[src]) {
      sourceStats[src] = { total: 0, verified: 0, correct: 0, wrong: 0, partial: 0, highRelevance: 0, posCount: 0, negCount: 0 };
    }
    sourceStats[src].total++;
    if ((a.relevance || 3) >= 4) sourceStats[src].highRelevance++;
    if (a.sentiment === 1) sourceStats[src].posCount++;
    if (a.sentiment === -1) sourceStats[src].negCount++;
    if (a.verification?.verified) {
      sourceStats[src].verified++;
      if (a.verification.result === 'correct') sourceStats[src].correct++;
      else if (a.verification.result === 'wrong') sourceStats[src].wrong++;
      else if (a.verification.result === 'partial') sourceStats[src].partial++;
    }
  });

  const rankedSources = Object.entries(sourceStats).sort((a, b) => {
    const aOk = a[1].verified >= 2, bOk = b[1].verified >= 2;
    if (aOk && bOk) return (b[1].correct / b[1].verified) - (a[1].correct / a[1].verified);
    if (aOk) return -1;
    if (bOk) return 1;
    return b[1].total - a[1].total;
  });

  const rankRows = rankedSources.map(([src, s], idx) => {
    const accRate = s.verified >= 1 ? (s.correct / s.verified * 100).toFixed(0) + '%' : '--';
    const accColor = s.verified < 2 ? 'var(--text3)' :
      s.correct / s.verified >= 0.6 ? 'var(--green)' :
      s.correct / s.verified >= 0.4 ? 'var(--yellow)' : 'var(--red)';
    const rankEmoji = idx === 0 && s.verified >= 2 ? '🥇' :
                      idx === 1 && s.verified >= 2 ? '🥈' :
                      idx === 2 && s.verified >= 2 ? '🥉' : (idx + 1) + '.';
    const sentimentText = s.posCount > s.negCount ? `<span style="color:var(--red);font-size:10px;">偏多 +${s.posCount}</span>` :
                          s.negCount > s.posCount ? `<span style="color:var(--green);font-size:10px;">偏空 -${s.negCount}</span>` :
                          `<span style="color:var(--text3);font-size:10px;">中性</span>`;
    const highRelPct = s.total > 0 ? Math.round(s.highRelevance / s.total * 100) : 0;
    const progressBar = s.verified >= 1 ? `
      <div style="height:4px;background:var(--bg4);border-radius:2px;margin-top:4px;overflow:hidden;">
        <div style="height:100%;width:${s.correct / s.verified * 100}%;background:${accColor};border-radius:2px;"></div>
      </div>` : '';
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="font-size:13px;font-weight:600;padding:10px 6px;">${rankEmoji}</td>
      <td style="padding:10px 6px;">
        <div style="font-weight:600;font-size:13px;">${src}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px;">${s.total}篇 · 高关联 ${highRelPct}%</div>
      </td>
      <td style="padding:10px 6px;text-align:center;">
        <div style="font-size:16px;font-weight:700;color:${accColor};">${accRate}</div>
        ${progressBar}
        <div style="font-size:10px;color:var(--text3);margin-top:3px;">${s.verified}篇已验证</div>
      </td>
      <td style="padding:10px 6px;text-align:center;">
        ${s.verified >= 1 ? `<span style="color:var(--green);font-size:11px;">✅${s.correct}</span>
          <span style="color:var(--text3);margin:0 3px;font-size:11px;">/</span>
          <span style="color:var(--red);font-size:11px;">❌${s.wrong}</span>
          ${s.partial > 0 ? `<span style="color:var(--yellow);font-size:11px;"> ⚠️${s.partial}</span>` : ''}`
          : `<span style="color:var(--text3);font-size:11px;">待跟踪</span>`}
      </td>
      <td style="padding:10px 6px;text-align:center;">${sentimentText}</td>
    </tr>`;
  }).join('');

  const html = `
    <div class="news-stat-row">
      <div class="stat-card">
        <div class="stat-label">文章总数</div>
        <div class="stat-value">${totalArticles}</div>
        <div class="stat-sub">${totalSources}个来源</div>
      </div>
      <div class="stat-card cyan">
        <div class="stat-label">高关联文章</div>
        <div class="stat-value">${highRelevance}</div>
        <div class="stat-sub">关联度≥4星</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">综合准确率</div>
        <div class="stat-value">${accuracy}${accuracy !== '--' ? '%' : ''}</div>
        <div class="stat-sub">${correctCount}正确 / ${verifiedArticles.length}已验证</div>
      </div>
      <div class="stat-card" style="border-color:${urgentPending > 0 ? 'rgba(245,158,11,0.4)' : 'var(--border)'};">
        <div class="stat-label">⏰ 待验证提醒</div>
        <div class="stat-value" style="color:${urgentPending > 0 ? 'var(--yellow)' : 'var(--text3)'};">${urgentPending}</div>
        <div class="stat-sub">高关联超7天未验证</div>
      </div>
    </div>

    <div class="info-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:16px;">
      <div class="info-item">
        <div class="info-label">🔴 负面（看空）观点</div>
        <div class="info-value" style="color:var(--red);">${sentimentCount['-1'] || 0}</div>
        <div style="font-size:10px;color:var(--text3);">占比 ${totalArticles ? Math.round(sentimentCount['-1']/totalArticles*100) : 0}%</div>
      </div>
      <div class="info-item">
        <div class="info-label">⚪ 中性观点</div>
        <div class="info-value">${sentimentCount['0'] || 0}</div>
        <div style="font-size:10px;color:var(--text3);">占比 ${totalArticles ? Math.round(sentimentCount['0']/totalArticles*100) : 0}%</div>
      </div>
      <div class="info-item">
        <div class="info-label">🟢 正面（看多）观点</div>
        <div class="info-value" style="color:var(--green);">${sentimentCount['1'] || 0}</div>
        <div style="font-size:10px;color:var(--text3);">占比 ${totalArticles ? Math.round(sentimentCount['1']/totalArticles*100) : 0}%</div>
      </div>
    </div>

    ${rankedSources.length > 0 ? `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header">
        <div class="card-title">🏆 来源观点准确率排行榜</div>
        <div style="font-size:11px;color:var(--text3);">基于你的验证记录自动计算 · 需≥2篇已验证才参与排名</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:30px;"></th>
              <th>来源</th>
              <th style="text-align:center;">准确率</th>
              <th style="text-align:center;">验证明细</th>
              <th style="text-align:center;">情感偏向</th>
            </tr>
          </thead>
          <tbody>${rankRows}</tbody>
        </table>
      </div>
      <div class="alert-box" style="margin-top:12px;font-size:11px;">
        💡 <strong>使用建议：</strong>积累≥5篇文章 + 持续验证观点，准确率排行会越来越准，帮你识别哪些来源值得重点关注
      </div>
    </div>
    ` : ''}

    ${topTags.length > 0 ? `
    <div class="card" style="margin-bottom:12px;">
      <div class="card-header">
        <div class="card-title">🏷️ 高频话题标签</div>
      </div>
      <div class="news-tags" style="padding:8px 0;">
        ${topTags.map(([tag, count]) => `
          <span class="tag tag-blue" style="cursor:pointer;font-size:12px;padding:4px 10px;" onclick="closeModal('modal-news-stats');setTimeout(()=>{filterByTag('${tag}')},100)">
            ${tag} <span style="opacity:0.7;">(${count})</span>
          </span>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="alert-box" style="margin-top:16px;">
      📌 <strong>使用建议：</strong>每次看完文章后录入，每周回顾一次待验证文章，对准确率高的来源给予更多参考权重
    </div>
  `;

  container.innerHTML = html;
  openModal('modal-news-stats');
}

