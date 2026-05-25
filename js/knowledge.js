// ============================================================
// KNOWLEDGE BASE - 个人知识库
// ============================================================
let knowledgeBase = DB.load('knowledge_v1', []);
let currentKnowledgeTab = 'all';
let editingKnowledgeId = null;

// 页面初始化
function initKnowledgePage() {
  // Tab切换
  document.getElementById('knowledge-tabs').addEventListener('click', function(e) {
    if (e.target.classList.contains('tab')) {
      currentKnowledgeTab = e.target.dataset.knowledgeTab;
      document.querySelectorAll('#knowledge-tabs .tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');

      // 决策助手 Tab 隐藏筛选栏和统计卡片
      const isAdvisor = currentKnowledgeTab === 'advisor';
      document.getElementById('knowledge-stats').style.display = isAdvisor ? 'none' : '';
      document.getElementById('knowledge-filter-bar').style.display = isAdvisor ? 'none' : '';

      renderKnowledgePage();
    }
  });

  // 新增按钮
  document.getElementById('btn-add-knowledge').addEventListener('click', function() {
    editingKnowledgeId = null;
    document.getElementById('modal-knowledge-title').textContent = '📝 新增知识';
    document.getElementById('knowledge-title').value = '';
    document.getElementById('knowledge-category').value = '投资理念';
    document.getElementById('knowledge-source').value = '';
    document.getElementById('knowledge-content').value = '';
    document.getElementById('knowledge-tags').value = '';
    document.getElementById('knowledge-related-symbols').value = '';
    openModal('modal-knowledge');
  });

  // 保存知识
  document.getElementById('btn-save-knowledge').addEventListener('click', saveKnowledge);

  // 筛选事件
  document.getElementById('knowledge-filter-category').addEventListener('change', renderKnowledgePage);
  document.getElementById('knowledge-search').addEventListener('input', renderKnowledgePage);
}

// 渲染知识库页面
function renderKnowledgePage() {
  const category = document.getElementById('knowledge-filter-category').value;
  const search = document.getElementById('knowledge-search').value.toLowerCase();

  // 过滤数据
  let filtered = knowledgeBase.filter(k => {
    const matchCategory = !category || k.category === category;
    const matchSearch = !search ||
      k.title.toLowerCase().includes(search) ||
      k.content.toLowerCase().includes(search) ||
      (k.tags || []).some(t => t.toLowerCase().includes(search));
    return matchCategory && matchSearch;
  });

  // 渲染统计
  renderKnowledgeStats();

  // 渲染对应视图
  const views = {
    'all': 'knowledge-view-all',
    'category': 'knowledge-view-category',
    'timeline': 'knowledge-view-timeline',
    'analysis': 'knowledge-view-analysis',
    'advisor': 'knowledge-view-advisor'
  };

  Object.keys(views).forEach(key => {
    const el = document.getElementById(views[key]);
    el.style.display = key === currentKnowledgeTab ? '' : 'none';
  });

  if (filtered.length === 0 && knowledgeBase.length === 0 && currentKnowledgeTab !== 'advisor') {
    document.getElementById('knowledge-empty-state').style.display = '';
    document.getElementById('knowledge-content-area').style.display = 'none';
  } else {
    document.getElementById('knowledge-empty-state').style.display = 'none';
    document.getElementById('knowledge-content-area').style.display = '';

    if (currentKnowledgeTab === 'all') {
      renderKnowledgeAllView(filtered);
    } else if (currentKnowledgeTab === 'category') {
      renderKnowledgeCategoryView();
    } else if (currentKnowledgeTab === 'timeline') {
      renderKnowledgeTimelineView(filtered);
    } else if (currentKnowledgeTab === 'analysis') {
      renderKnowledgeAnalysisView();
    } else if (currentKnowledgeTab === 'advisor') {
      renderKnowledgeAdvisorView();
    }
  }
}

// 渲染统计卡片
function renderKnowledgeStats() {
  const stats = document.getElementById('knowledge-stats');
  const total = knowledgeBase.length;
  const categories = {};
  const sources = {};

  knowledgeBase.forEach(k => {
    categories[k.category] = (categories[k.category] || 0) + 1;
    if (k.source) sources[k.source] = (sources[k.source] || 0) + 1;
  });

  const mostUsedCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  const recentCount = knowledgeBase.filter(k => {
    const created = new Date(k.createdAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return created >= weekAgo;
  }).length;

  stats.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">知识条目</div>
      <div class="stat-value">${total}</div>
      <div class="stat-sub">条</div>
    </div>
    <div class="stat-card cyan">
      <div class="stat-label">本周新增</div>
      <div class="stat-value">${recentCount}</div>
      <div class="stat-sub">条</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-label">热门分类</div>
      <div class="stat-value">${mostUsedCategory ? mostUsedCategory[0].slice(0, 4) : '--'}</div>
      <div class="stat-sub">${mostUsedCategory ? mostUsedCategory[1] + '条' : '暂无数据'}</div>
    </div>
    <div class="stat-card yellow">
      <div class="stat-label">知识来源</div>
      <div class="stat-value">${Object.keys(sources).length}</div>
      <div class="stat-sub">个来源</div>
    </div>
  `;
}

// 渲染全部视图
function renderKnowledgeAllView(items) {
  const container = document.getElementById('knowledge-view-all');
  if (items.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);">没有找到匹配的知识</div>';
    return;
  }

  container.innerHTML = items.map(k => `
    <div class="knowledge-card" onclick="viewKnowledgeDetail('${k.id}')">
      <div class="knowledge-card-header">
        <div>
          <div class="knowledge-card-title">${k.title}</div>
          <div class="knowledge-card-meta">
            <span class="knowledge-category-badge ${getCategoryClass(k.category)}">${k.category}</span>
            <span>📅 ${k.createdAt}</span>
            ${k.source ? `<span class="knowledge-source-tag">📖 ${k.source.length > 15 ? k.source.slice(0, 15) + '...' : k.source}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;" onclick="event.stopPropagation()">
          <button class="btn btn-secondary btn-sm" onclick="editKnowledge('${k.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteKnowledge('${k.id}')">🗑️</button>
        </div>
      </div>
      <div class="knowledge-card-preview">${k.content.slice(0, 150)}${k.content.length > 150 ? '...' : ''}</div>
      ${k.tags && k.tags.length > 0 ? `
        <div class="knowledge-card-tags">
          ${k.tags.map(t => `<span class="tag tag-gray">${t}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

// 渲染分类视图
function renderKnowledgeCategoryView() {
  const container = document.getElementById('knowledge-view-category');
  const categories = ['投资理念', '技术分析', '宏观经济', '心得体会', '行业研究', '其他'];

  container.innerHTML = categories.map(cat => {
    const items = knowledgeBase.filter(k => k.category === cat);
    if (items.length === 0) return '';
    return `
      <div style="margin-bottom:20px;">
        <div class="section-title" style="margin-bottom:12px;">
          <span class="knowledge-category-badge ${getCategoryClass(cat)}">${cat}</span>
          <span style="font-weight:400;color:var(--text3);margin-left:8px;">${items.length}条</span>
        </div>
        ${items.map(k => `
          <div class="knowledge-card" onclick="viewKnowledgeDetail('${k.id}')" style="margin-bottom:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-weight:600;font-size:13px;">${k.title}</div>
                <div style="font-size:11px;color:var(--text3);margin-top:4px;">${k.createdAt}</div>
              </div>
              <div style="display:flex;gap:6px;" onclick="event.stopPropagation()">
                <button class="btn btn-secondary btn-sm" onclick="editKnowledge('${k.id}')">✏️</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

// 渲染时间线视图
function renderKnowledgeTimelineView(items) {
  const container = document.getElementById('knowledge-view-timeline');

  // 按月份分组
  const byMonth = {};
  items.forEach(k => {
    const month = k.createdAt.slice(0, 7);
    byMonth[month] = byMonth[month] || [];
    byMonth[month].push(k);
  });

  const months = Object.keys(byMonth).sort().reverse();

  container.innerHTML = months.map(month => `
    <div style="margin-bottom:24px;">
      <div class="knowledge-timeline-date">${month}</div>
      ${byMonth[month].map(k => `
        <div class="knowledge-card" onclick="viewKnowledgeDetail('${k.id}')" style="margin-bottom:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <span class="knowledge-category-badge ${getCategoryClass(k.category)}" style="font-size:10px;padding:2px 6px;">${k.category}</span>
              <span style="font-weight:600;font-size:14px;margin-left:8px;">${k.title}</span>
            </div>
            <div style="font-size:11px;color:var(--text3);">${k.createdAt}</div>
          </div>
          <div style="font-size:12px;color:var(--text2);margin-top:8px;">${k.content.slice(0, 100)}${k.content.length > 100 ? '...' : ''}</div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

// 渲染AI分析视图
function renderKnowledgeAnalysisView() {
  const container = document.getElementById('knowledge-view-analysis');

  if (knowledgeBase.length < 3) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🤖</div>
        <div class="title">知识积累不足</div>
        <div class="desc">AI分析需要至少3条知识才能进行有效整合，请继续积累。</div>
      </div>
    `;
    return;
  }

  // 基础分析：分类分布、标签统计、关联分析
  const categoryStats = {};
  const tagStats = {};
  const insights = [];

  knowledgeBase.forEach(k => {
    categoryStats[k.category] = (categoryStats[k.category] || 0) + 1;
    (k.tags || []).forEach(t => {
      tagStats[t] = (tagStats[t] || 0) + 1;
    });
  });

  // 生成洞察
  const topCategory = Object.entries(categoryStats).sort((a, b) => b[1] - a[1])[0];
  const topTags = Object.entries(tagStats).sort((a, b) => b[1] - a[1]).slice(0, 5);

  insights.push({
    icon: '📊',
    text: `你的知识库以「${topCategory[0]}」为主（${topCategory[1]}条），建议适当扩展其他领域的知识，形成更均衡的能力圈。`
  });

  if (topTags.length > 0) {
    insights.push({
      icon: '🏷️',
      text: `高频标签：${topTags.map(([t, c]) => `${t}(${c}次)`).join('、')}。这些是你持续关注的重点领域。`
    });
  }

  // 发现关联
  const relatedPairs = [];
  for (let i = 0; i < knowledgeBase.length; i++) {
    for (let j = i + 1; j < knowledgeBase.length; j++) {
      const k1 = knowledgeBase[i], k2 = knowledgeBase[j];
      const sharedTags = (k1.tags || []).filter(t => (k2.tags || []).includes(t));
      if (sharedTags.length > 0) {
        relatedPairs.push({ k1, k2, sharedTags });
      }
    }
  }

  if (relatedPairs.length > 0) {
    insights.push({
      icon: '🔗',
      text: `发现${relatedPairs.length}对相关知识，可考虑将相关知识整合成系统性框架。`
    });
  }

  container.innerHTML = `
    <div class="knowledge-analysis-card">
      <div class="knowledge-analysis-title">📊 知识库概览</div>
      <div class="knowledge-analysis-content">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;">
          <div style="text-align:center;padding:12px;background:var(--bg2);border-radius:8px;">
            <div style="font-size:20px;font-weight:700;">${knowledgeBase.length}</div>
            <div style="font-size:11px;color:var(--text3);">总条目</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--bg2);border-radius:8px;">
            <div style="font-size:20px;font-weight:700;">${Object.keys(categoryStats).length}</div>
            <div style="font-size:11px;color:var(--text3);">覆盖分类</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--bg2);border-radius:8px;">
            <div style="font-size:20px;font-weight:700;">${Object.keys(tagStats).length}</div>
            <div style="font-size:11px;color:var(--text3);">使用标签</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text2);line-height:1.8;">
          ${Object.entries(categoryStats).map(([cat, count]) =>
            `${cat} <strong style="color:var(--accent);">${count}</strong>条`
          ).join(' · ')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">💡 AI洞察</div>
      </div>
      ${insights.map(ins => `
        <div class="knowledge-insight-item">
          <span class="knowledge-insight-icon">${ins.icon}</span>
          <span class="knowledge-insight-text">${ins.text}</span>
        </div>
      `).join('')}
    </div>

    ${relatedPairs.length > 0 ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title">🔗 知识关联</div>
      </div>
      ${relatedPairs.slice(0, 5).map(pair => `
        <div class="knowledge-insight-item" style="cursor:pointer;" onclick="viewKnowledgeDetail('${pair.k1.id}')">
          <span class="knowledge-insight-icon">📚</span>
          <span class="knowledge-insight-text">
            <strong>${pair.k1.title}</strong> 与 <strong>${pair.k2.title}</strong>
            <br>
            <span style="color:var(--text3);font-size:11px;">共享标签：${pair.sharedTags.join('、')}</span>
          </span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="card">
      <div class="card-header">
        <div class="card-title">🎯 升级建议</div>
      </div>
      <div class="knowledge-insight-item">
        <span class="knowledge-insight-icon">✨</span>
        <span class="knowledge-insight-text">
          定期回顾知识库，将过时或被验证错误的知识标记为「已升级」，保持知识库的时效性和准确性。
        </span>
      </div>
      <div class="knowledge-insight-item">
        <span class="knowledge-insight-icon">🔄</span>
        <span class="knowledge-insight-text">
          尝试将相关联的知识整合成系统性框架，如：构建自己的「估值体系」、「交易系统」等专题知识集合。
        </span>
      </div>
    </div>
  `;
}

// ============================================================
// DECISION ADVISOR - 决策助手
// ============================================================

// 渲染决策助手视图
function renderKnowledgeAdvisorView() {
  const container = document.getElementById('knowledge-view-advisor');
  const categories = [
    { value: 'investment', label: '💰 投资决策' },
    { value: 'career', label: '💼 职业发展' },
    { value: 'life', label: '🏠 生活抉择' },
    { value: 'other', label: '📌 其他问题' }
  ];

  container.innerHTML = `
    <div class="decision-advisor-layout">
      <!-- 左侧：输入区 -->
      <div class="decision-input-section">
        <div class="section-title" style="margin-bottom:12px;">🤔 描述你的问题</div>
        <div class="form-group">
          <label class="form-label">问题类型</label>
          <select class="form-input" id="decision-category">
            ${categories.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">详细描述你的问题或面临的选择</label>
          <textarea class="form-input" id="decision-question" rows="6"
            placeholder="请详细描述你的情况、面临的选择、以及你的顾虑...
例如：
- 我在考虑是否要卖出持有的某只股票...
- 我面临两个工作机会...
- 我在纠结是否要买房..."></textarea>
        </div>
        <button class="btn btn-primary" id="btn-run-decision" style="width:100%;padding:12px;">
          🔍 基于知识库分析
        </button>
      </div>

      <!-- 右侧：分析结果 -->
      <div class="decision-result-section">
        <div class="section-title" style="margin-bottom:12px;">📊 分析结果</div>
        <div id="decision-result-area">
          <div class="empty-state" style="padding:40px 20px;">
            <div class="icon">💭</div>
            <div class="title">等待你的问题</div>
            <div class="desc">在左侧输入你的问题，知识库将基于已有知识为你分析利弊</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 历史决策记录 -->
    ${decisionHistory.length > 0 ? `
    <div style="margin-top:24px;">
      <div class="section-title" style="margin-bottom:12px;">📜 历史决策记录 <span style="font-weight:400;color:var(--text3);font-size:12px;">(${decisionHistory.length})</span></div>
      <div id="decision-history-list">
        ${decisionHistory.map(d => `
          <div class="decision-history-item" data-decision-id="${d.id}">
            <div class="decision-history-header" onclick="toggleDecisionHistory('${d.id}')">
              <div style="flex:1;">
                <div class="decision-history-question">${d.question.slice(0, 80)}${d.question.length > 80 ? '...' : ''}</div>
                <div class="decision-history-meta">
                  <span>${getDecisionCategoryLabel(d.category)}</span>
                  <span>·</span>
                  <span>${d.relatedKnowledge.length}条相关知识</span>
                  <span>·</span>
                  <span>${new Date(d.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();loadDecisionHistory('${d.id}')">查看</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--red);" onclick="event.stopPropagation();deleteDecisionHistory('${d.id}')">删除</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
  `;

  // 绑定分析按钮
  document.getElementById('btn-run-decision').addEventListener('click', runDecisionAnalysis);
}

// 获取决策分类标签
function getDecisionCategoryLabel(cat) {
  const map = {
    investment: '💰 投资决策',
    career: '💼 职业发展',
    life: '🏠 生活抉择',
    other: '📌 其他问题'
  };
  return map[cat] || cat;
}

// 运行决策分析
function runDecisionAnalysis() {
  const question = document.getElementById('decision-question').value.trim();
  const category = document.getElementById('decision-category').value;

  if (!question) {
    alert('请先描述你的问题');
    return;
  }

  // 从知识库中匹配相关内容
  const keywords = question.toLowerCase().split(/[\s,，、。.]+/).filter(w => w.length > 2);
  const relatedKnowledge = [];

  knowledgeBase.forEach(k => {
    let relevance = 0;
    const titleLower = k.title.toLowerCase();
    const contentLower = k.content.toLowerCase();
    const tagsLower = (k.tags || []).map(t => t.toLowerCase());

    // 标题匹配
    keywords.forEach(keyword => {
      if (titleLower.includes(keyword)) relevance += 3;
    });

    // 内容匹配
    keywords.forEach(keyword => {
      if (contentLower.includes(keyword)) relevance += 1;
    });

    // 标签匹配
    keywords.forEach(keyword => {
      if (tagsLower.some(t => t.includes(keyword))) relevance += 2;
    });

    // 分类相关度加权
    if (category === 'investment' && ['投资理念', '技术分析', '宏观经济', '行业研究'].includes(k.category)) {
      relevance *= 1.5;
    } else if (category === 'career' && k.category === '心得体会') {
      relevance *= 1.3;
    } else if (category === 'life') {
      // 生活问题接受所有类别
    }

    if (relevance > 0) {
      relatedKnowledge.push({
        id: k.id,
        title: k.title,
        category: k.category,
        relevance: Math.round(relevance * 10) / 10,
        content: k.content,
        tags: k.tags
      });
    }
  });

  // 按相关性排序，取前5条
  relatedKnowledge.sort((a, b) => b.relevance - a.relevance);
  const topKnowledge = relatedKnowledge.slice(0, 5);

  // 生成分析
  const analysis = generateDecisionAnalysis(question, category, topKnowledge);

  // 显示结果
  renderDecisionResult(question, category, topKnowledge, analysis);

  // 保存到历史
  saveDecisionHistory(question, category, topKnowledge, analysis);
}

// 生成决策分析
function generateDecisionAnalysis(question, category, relatedKnowledge) {
  if (relatedKnowledge.length === 0) {
    return {
      pros: [],
      cons: [],
      summary: '知识库中没有找到直接相关的知识。建议：1）尝试用更具体的关键词描述你的问题；2）考虑在知识库中添加相关的知识条目；3）结合自己的判断和其他信息源做决策。',
      recommendation: 'neutral'
    };
  }

  const insights = [];
  const pros = [];
  const cons = [];

  // 分析相关知识的共同主题
  const categories = {};
  relatedKnowledge.forEach(k => {
    categories[k.category] = (categories[k.category] || 0) + 1;
  });

  // 找出最相关的知识类别
  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];

  // 生成建议
  if (topCategory[0] === '投资理念') {
    insights.push('💡 知识库中有较多「投资理念」相关知识可供参考');
    pros.push('可以参考价值投资、长期持有的思维框架');
    if (category === 'investment') {
      pros.push('建议从估值、安全边际、管理层等角度分析');
    }
  } else if (topCategory[0] === '技术分析') {
    insights.push('📊 知识库中有「技术分析」相关经验');
    pros.push('可以参考技术面分析的思路');
  } else if (topCategory[0] === '宏观经济') {
    insights.push('🌍 知识库中有「宏观经济」视角可供参考');
    pros.push('建议考虑宏观环境对决策的影响');
  } else if (topCategory[0] === '心得体会') {
    insights.push('💭 知识库中有相关「心得体会」可参考');
    pros.push('前人的经验教训可能对你有启发');
  }

  // 基于问题类型给出建议
  if (category === 'investment') {
    if (question.includes('买') || question.includes('买入') || question.includes('加仓')) {
      pros.push('考虑这笔投资是否符合你的风险承受能力');
      cons.push('注意仓位管理，避免过度集中');
    }
    if (question.includes('卖') || question.includes('卖出') || question.includes('减仓')) {
      pros.push('卖出决策需要区分是止盈还是止损');
      cons.push('避免因为短期波动做出冲动决策');
    }
  } else if (category === 'career') {
    pros.push('职业选择要考虑长期发展和个人成长');
    cons.push('避免只看短期收入，忽视职业天花板');
  } else if (category === 'life') {
    pros.push('生活决策要平衡理性分析和直觉判断');
    cons.push('考虑这个选择对家庭和生活质量的影响');
  }

  // 生成总结
  let summary = `基于知识库中${relatedKnowledge.length}条相关知识分析：\n`;
  if (topCategory) {
    summary += `主要涉及「${topCategory[0]}」领域，占比${Math.round(topCategory[1] / relatedKnowledge.length * 100)}%。\n`;
  }
  summary += '\n建议结合知识库中的具体条目，综合考虑后做出决策。';

  return {
    insights,
    pros: pros.slice(0, 4),
    cons: cons.slice(0, 4),
    summary,
    recommendation: relatedKnowledge.length >= 3 ? 'supported' : 'partial'
  };
}

// 渲染决策结果
function renderDecisionResult(question, category, relatedKnowledge, analysis) {
  const area = document.getElementById('decision-result-area');

  area.innerHTML = `
    <!-- 问题摘要 -->
    <div class="decision-question-box">
      <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">你的问题</div>
      <div style="font-size:13px;color:var(--text2);line-height:1.6;">${escapeHtml(question)}</div>
    </div>

    <!-- 相关知识 -->
    ${relatedKnowledge.length > 0 ? `
    <div class="decision-section">
      <div class="decision-section-title">📚 相关知识 (${relatedKnowledge.length}条)</div>
      ${relatedKnowledge.map(k => `
        <div class="decision-knowledge-card" onclick="viewKnowledgeDetail('${k.id}')">
          <div class="decision-knowledge-header">
            <span class="knowledge-category-badge ${getCategoryClass(k.category)}">${k.category}</span>
            <span style="color:var(--text3);font-size:11px;">相关度 ${k.relevance.toFixed(1)}</span>
          </div>
          <div class="decision-knowledge-title">${k.title}</div>
          <div class="decision-knowledge-content">${k.content.slice(0, 120)}${k.content.length > 120 ? '...' : ''}</div>
          ${k.tags && k.tags.length > 0 ? `
            <div class="decision-knowledge-tags">
              ${k.tags.slice(0, 3).map(t => `<span class="tag tag-gray">${t}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
    ` : `
    <div class="alert-box" style="margin-bottom:16px;">
      ⚠️ 知识库中没有找到直接相关的知识，建议添加相关条目或换一种描述方式。
    </div>
    `}

    <!-- 分析结果 -->
    <div class="decision-section">
      <div class="decision-section-title">💡 分析与建议</div>

      ${analysis.insights.length > 0 ? `
      <div style="margin-bottom:12px;">
        ${analysis.insights.map(ins => `
          <div class="knowledge-insight-item">
            <span class="knowledge-insight-icon">💡</span>
            <span class="knowledge-insight-text">${ins}</span>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <div class="decision-analysis-grid">
        ${analysis.pros.length > 0 ? `
        <div class="decision-analysis-col">
          <div style="font-weight:600;color:var(--red);margin-bottom:8px;">✓ 建议考虑</div>
          ${analysis.pros.map(p => `
            <div style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--border);color:var(--text2);">${p}</div>
          `).join('')}
        </div>
        ` : ''}
        ${analysis.cons.length > 0 ? `
        <div class="decision-analysis-col">
          <div style="font-weight:600;color:var(--green);margin-bottom:8px;">⚠️ 需要注意</div>
          ${analysis.cons.map(c => `
            <div style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--border);color:var(--text2);">${c}</div>
          `).join('')}
        </div>
        ` : ''}
      </div>

      <div class="decision-summary">
        ${analysis.summary.split('\n').map(line => `<div style="margin-bottom:4px;">${line}</div>`).join('')}
      </div>
    </div>

    <!-- 操作 -->
    <div style="display:flex;gap:12px;margin-top:16px;">
      <button class="btn btn-secondary" onclick="saveCurrentDecision()" style="flex:1;">
        💾 保存此分析
      </button>
      <button class="btn btn-secondary" onclick="document.getElementById('decision-question').value='';renderKnowledgeAdvisorView();" style="flex:1;">
        🔄 重新分析
      </button>
    </div>
  `;

  // 保存当前分析到全局，供保存函数使用
  window._currentDecision = { question, category, relatedKnowledge, analysis };
}

// 保存当前决策到历史
function saveCurrentDecision() {
  if (!window._currentDecision) return;
  const d = window._currentDecision;

  const record = {
    id: uuid(),
    question: d.question,
    category: d.category,
    createdAt: new Date().toISOString(),
    relatedKnowledge: d.relatedKnowledge.map(k => ({
      id: k.id,
      title: k.title,
      category: k.category,
      relevance: k.relevance
    })),
    analysis: d.analysis
  };

  decisionHistory.unshift(record);
  DB.save('decisionHistory_v1', decisionHistory);

  showKnowledgeToast('决策分析已保存');
  renderKnowledgeAdvisorView();
}

// 从历史加载决策
function loadDecisionHistory(id) {
  const record = decisionHistory.find(r => r.id === id);
  if (!record) return;

  // 填充表单
  document.getElementById('decision-category').value = record.category;
  document.getElementById('decision-question').value = record.question;

  // 恢复相关知识内容
  const relatedKnowledge = record.relatedKnowledge.map(rk => {
    const k = knowledgeBase.find(kb => kb.id === rk.id);
    if (k) {
      return { ...rk, content: k.content, tags: k.tags };
    }
    return { ...rk, content: '', tags: [] };
  }).filter(k => k.content);

  // 渲染结果
  renderDecisionResult(record.question, record.category, relatedKnowledge, record.analysis);

  showKnowledgeToast('已加载历史分析');
}

// 删除决策历史
function deleteDecisionHistory(id) {
  if (!confirm('确定删除这条决策记录？')) return;
  decisionHistory = decisionHistory.filter(r => r.id !== id);
  DB.save('decisionHistory_v1', decisionHistory);
  renderKnowledgeAdvisorView();
  showKnowledgeToast('已删除');
}

// 切换历史记录展开/收起
function toggleDecisionHistory(id) {
  // 可扩展：实现展开详情功能
}

// Toast 提示（知识库专用）
function showKnowledgeToast(msg) {
  const existing = document.getElementById('knowledge-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'knowledge-toast';
  toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:10000;opacity:0;transition:opacity 0.3s;';
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.style.opacity = '1');
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// 获取分类样式类
function getCategoryClass(category) {
  const map = {
    '投资理念': 'knowledge-category-investment',
    '技术分析': 'knowledge-category-tech',
    '宏观经济': 'knowledge-category-macro',
    '心得体会': 'knowledge-category-experience',
    '行业研究': 'knowledge-category-industry',
    '其他': 'knowledge-category-other'
  };
  return map[category] || 'knowledge-category-other';
}

// 保存知识
function saveKnowledge() {
  const title = document.getElementById('knowledge-title').value.trim();
  const content = document.getElementById('knowledge-content').value.trim();
  const category = document.getElementById('knowledge-category').value;
  const source = document.getElementById('knowledge-source').value.trim();
  const tagsStr = document.getElementById('knowledge-tags').value.trim();
  const relatedSymbolsStr = document.getElementById('knowledge-related-symbols').value.trim();

  if (!title || !content) {
    alert('请填写标题和内容');
    return;
  }

  const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(t => t) : [];
  const relatedSymbols = relatedSymbolsStr ? relatedSymbolsStr.split(/[,，]/).map(s => s.trim()).filter(s => s) : [];

  if (editingKnowledgeId) {
    // 编辑模式
    const idx = knowledgeBase.findIndex(k => k.id === editingKnowledgeId);
    if (idx >= 0) {
      knowledgeBase[idx] = {
        ...knowledgeBase[idx],
        title,
        content,
        category,
        source,
        tags,
        relatedSymbols,
        updatedAt: new Date().toISOString().slice(0, 10)
      };
    }
  } else {
    // 新增模式
    const today = new Date().toISOString().slice(0, 10);
    knowledgeBase.push({
      id: uuid(),
      title,
      content,
      category,
      source,
      tags,
      relatedSymbols,
      createdAt: today,
      updatedAt: today,
      version: 1
    });
  }

  DB.save('knowledge_v1', knowledgeBase);
  closeModal('modal-knowledge');
  renderKnowledgePage();
}

// 编辑知识
function editKnowledge(id) {
  const k = knowledgeBase.find(x => x.id === id);
  if (!k) return;

  editingKnowledgeId = id;
  document.getElementById('modal-knowledge-title').textContent = '✏️ 编辑知识';
  document.getElementById('knowledge-title').value = k.title || '';
  document.getElementById('knowledge-category').value = k.category || '投资理念';
  document.getElementById('knowledge-source').value = k.source || '';
  document.getElementById('knowledge-content').value = k.content || '';
  document.getElementById('knowledge-tags').value = (k.tags || []).join('，');
  document.getElementById('knowledge-related-symbols').value = (k.relatedSymbols || []).join('，');
  openModal('modal-knowledge');
}

// 删除知识
function deleteKnowledge(id) {
  const k = knowledgeBase.find(x => x.id === id);
  if (!k) return;
  if (!confirm(`确定删除知识「${k.title}」？此操作不可恢复。`)) return;

  knowledgeBase = knowledgeBase.filter(x => x.id !== id);
  DB.save('knowledge_v1', knowledgeBase);
  renderKnowledgePage();
}

// 查看知识详情
function viewKnowledgeDetail(id) {
  const k = knowledgeBase.find(x => x.id === id);
  if (!k) return;

  document.getElementById('detail-knowledge-title').textContent = k.title;
  document.getElementById('detail-knowledge-content').innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
        <span class="knowledge-category-badge ${getCategoryClass(k.category)}">${k.category}</span>
        <span style="font-size:12px;color:var(--text3);">📅 ${k.createdAt}</span>
        ${k.updatedAt !== k.createdAt ? `<span style="font-size:11px;color:var(--text3);">（更新于${k.updatedAt}）</span>` : ''}
      </div>
      ${k.source ? `<div style="font-size:12px;color:var(--text2);margin-bottom:12px;">📖 来源：${k.source}</div>` : ''}
    </div>
    <div class="section-title">内容</div>
    <div style="font-size:13px;color:var(--text2);line-height:1.8;white-space:pre-wrap;">${k.content}</div>
    ${k.tags && k.tags.length > 0 ? `
      <div class="section-title">标签</div>
      <div class="knowledge-card-tags">
        ${k.tags.map(t => `<span class="tag tag-gray">${t}</span>`).join('')}
      </div>
    ` : ''}
    ${k.relatedSymbols && k.relatedSymbols.length > 0 ? `
      <div class="section-title">关联标的</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${k.relatedSymbols.map(s => `<span class="tag tag-blue">${s}</span>`).join('')}
      </div>
    ` : ''}
    <div style="display:flex;gap:8px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
      <button class="btn btn-secondary" onclick="closeModal('modal-knowledge-detail');editKnowledge('${k.id}')">✏️ 编辑</button>
      <button class="btn btn-danger" onclick="closeModal('modal-knowledge-detail');deleteKnowledge('${k.id}')">🗑️ 删除</button>
    </div>
  `;
  openModal('modal-knowledge-detail');
}

