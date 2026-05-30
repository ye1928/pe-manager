// ============================================================
// NAVIGATION
// ============================================================
const pageConfig = {
  'overview':    { icon: '📊', title: '总览', sub: '投资数据一站式总览' },
  'pe-fund':     { icon: '🏦', title: '基金',         sub: '全生命周期管理' },
  'stock':       { icon: '📈', title: '股票',       sub: '股票池 / 持仓 / 卖出复盘' },
  'futures':     { icon: '📦', title: '期货',       sub: '品种 / 持仓 / 平仓复盘' },
  'news':        { icon: '📰', title: '研报资讯', sub: '研报与公众号资讯收集分析' },
  'attribution': { icon: '🎯', title: '归因分析',   sub: '多维度收益归因' },
  'calendar':    { icon: '📅', title: '投资日历',   sub: '重要事件提醒' },
  'vote':        { icon: '🎭', title: '大师投票席', sub: '基于真实投资框架的决策模拟' },
  'knowledge':   { icon: '📚', title: '个人知识库', sub: '个人投资知识管理体系' },
};

let currentPage = 'overview';
let currentPETab = 'holding';

function switchPage(pageId) {
  // 切换页面时关闭所有弹窗
  document.querySelectorAll('.modal-overlay.open').forEach(el => el.classList.remove('open'));

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${pageId}"]`).classList.add('active');
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  const cfg = pageConfig[pageId];
  document.getElementById('page-icon').textContent = cfg.icon;
  document.getElementById('page-title').textContent = cfg.title;
  document.getElementById('page-sub').textContent = cfg.sub;
  currentPage = pageId;

  // 控制「新增」按钮显示
  const addBtn = document.getElementById('btn-add-main');
  if (pageId === 'pe-fund' || pageId === 'stock' || pageId === 'futures') {
    addBtn.style.display = '';
    addBtn.textContent = '＋ 新增';
  } else if (pageId === 'news') {
    addBtn.style.display = '';
    addBtn.textContent = '＋ 录入文章';
  } else if (pageId === 'knowledge') {
    addBtn.style.display = '';
    addBtn.textContent = '＋ 新增知识';
  } else {
    addBtn.style.display = 'none';
  }

  // 控制「批量录入净值」按钮显示
  const batchNavBtn = document.getElementById('btn-batch-nav');
  if (batchNavBtn) batchNavBtn.style.display = pageId === 'pe-fund' ? '' : 'none';

  if (pageId === 'overview') renderDashboard();
  if (pageId === 'pe-fund') renderPEFund();
  if (pageId === 'stock') renderStockList();
  if (pageId === 'futures') renderFuturesList();
  if (pageId === 'news') initNewsPage();
  if (pageId === 'attribution') renderAttribution();
  if (pageId === 'calendar') renderCalendar();
  if (pageId === 'vote') { renderVoteCardsPending(); }
  if (pageId === 'vote') { renderVoteCardsPending(); }
  if (pageId === 'knowledge') { initKnowledgePage(); renderKnowledgePage(); }
}

// ============================================================
// OVERVIEW DASHBOARD
// ============================================================
function renderDashboard() {
  const el = document.getElementById('dashboard-content');
  if (!el) return;

  const fundStats = getPEStats();
  const allFunds = funds;
  const holdingFunds = allFunds.filter(f => f.status === 'holding');
  const stockList = stocks || [];
  const holdingStocks = stockList.filter(s => s.status === 'holding');
  const futuresList = futures || [];
  const holdingFutures = futuresList.filter(f => f.status === 'holding');
  const newsList = articles || [];
  const recentNews = [...newsList].slice(0, 6);
  const totalInvested = fundStats.totalCost || 0;
  const totalFloating = fundStats.totalFloating || 0;
  const totalRealized = fundStats.totalRealized || 0;
  const totalPerfFee = fundStats.totalPerfFee || 0;
  const netGain = totalFloating + totalRealized - totalPerfFee;

  // 资产配置
  const fundAssets = holdingFunds.reduce((s, f) => {
    const r = calcFund(f);
    return s + (r.totalCost + r.totalFloating); // 市值 = 本金 + 浮动盈亏
  }, 0);
  const stockAssets = holdingStocks.reduce((s, st) => s + (calcStock(st).currentValue || 0), 0);
  const futuresAssets = holdingFutures.reduce((s, f) => s + (calcFutures(f).margin || 0), 0);
  const totalAssets = fundAssets + stockAssets + futuresAssets;

  // 股票快照
  const topStocks = holdingStocks.slice(0, 8).map(s => {
    const c = calcStock(s);
    const priceChange = s.currentPrice && s.costPrice ? ((s.currentPrice - s.costPrice) / s.costPrice * 100) : 0;
    return { ...s, ...c, priceChange };
  });

  // 大师投票 - 最新一条
  const latestVote = voteHistory && voteHistory.length > 0 ? voteHistory[voteHistory.length - 1] : null;

  // 知识库计数
  const knowledgeCount = (typeof knowledgeEntries !== 'undefined' ? knowledgeEntries.length : 0);
  // 研报归档数（已有 newsList）
  const reportCount = newsList.length;

  // ===== 标签颜色映射 =====
  const tagColors = {
    '价值投资': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    '成长投资': { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
    '宏观': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    '行业': { bg: 'rgba(6,182,212,0.12)', color: '#06b6d4' },
    '技术分析': { bg: 'rgba(236,72,153,0.12)', color: '#ec4899' },
    '基本面': { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    '其他': { bg: 'rgba(148,163,184,0.12)', color: '#64748b' },
  };
  function getTagStyle(tag) {
    const t = tagColors[tag] || tagColors['其他'];
    return `background:${t.bg};color:${t.color};`;
  }
  function getTag(tag) {
    return `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:600;${getTagStyle(tag)}">${tag}</span>`;
  }

  el.innerHTML = `
    <!-- ===== 顶部 6 卡片 (第一行: 核心指标) ===== -->
    <div class="dash-stat-row">
      <!-- ① 持仓市值 -->
      <div class="dash-stat-card" style="cursor:pointer;" onclick="switchPage('attribution')">
        <div class="dash-stat-inner">
          <div class="dash-stat-label">💰 持仓市值</div>
          <div class="dash-stat-value">¥${fmtWan(totalAssets)}<span class="dash-stat-unit">万</span></div>
          <div class="dash-stat-sub">
            基金 ${fmtWan(fundAssets)}<br>股票 ${fmtWan(stockAssets)}<br>期货 ${fmtWan(futuresAssets)}
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:8px;">点击查看资产配置 →</div>
        </div>
      </div>

      <!-- ② 综合收益 -->
      <div class="dash-stat-card" style="cursor:pointer;" onclick="switchPage('attribution')">
        <div class="dash-stat-inner">
          <div class="dash-stat-label">📊 综合收益</div>
          <div class="dash-stat-value" style="${netGain >= 0 ? 'color:var(--red)' : 'color:var(--green)'}">
            ${netGain >= 0 ? '+' : ''}${fmtWan(netGain)}<span class="dash-stat-unit">万</span>
          </div>
          <div class="dash-stat-sub">浮动 ${fmtWan(totalFloating)}<br>已实现 ${fmtWan(totalRealized)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:8px;">点击查看收益归因 →</div>
        </div>
      </div>

      <!-- ③ 基金资产 -->
      <div class="dash-stat-card" style="cursor:pointer;" onclick="switchPage('pe-fund')">
        <div class="dash-stat-inner">
          <div class="dash-stat-label">🏛️ 基金资产</div>
          <div class="dash-stat-value">¥${fmtWan(fundAssets)}<span class="dash-stat-unit">万</span></div>
          <div class="dash-stat-sub">持仓 ${holdingFunds.length} 只基金<br>总投入 ${fmtWan(totalInvested)} 万</div>
          <div style="font-size:11px;color:var(--text3);margin-top:8px;">点击查看已投基金 →</div>
        </div>
      </div>
    </div>

    <!-- ===== 顶部 6 卡片 (第二行: 股票/期货/知识库) ===== -->
    <div class="dash-stat-row">
      <!-- ④ 股票资产 -->
      <div class="dash-stat-card" style="cursor:pointer;" onclick="switchPage('stock')">
        <div class="dash-stat-inner">
          <div class="dash-stat-label">📈 股票资产</div>
          <div class="dash-stat-value">¥${fmtWan(stockAssets)}<span class="dash-stat-unit">万</span></div>
          <div class="dash-stat-sub">持仓 ${holdingStocks.length} 只股票</div>
          <div style="font-size:11px;color:var(--text3);margin-top:8px;">点击查看股票池 →</div>
        </div>
      </div>

      <!-- ⑤ 期货资产 -->
      <div class="dash-stat-card" style="cursor:pointer;" onclick="switchPage('futures')">
        <div class="dash-stat-inner">
          <div class="dash-stat-label">🔮 期货资产</div>
          <div class="dash-stat-value">¥${fmtWan(futuresAssets)}<span class="dash-stat-unit">万</span></div>
          <div class="dash-stat-sub">持仓 ${holdingFutures.length} 个品种</div>
          <div style="font-size:11px;color:var(--text3);margin-top:8px;">点击查看期货持仓 →</div>
        </div>
      </div>

      <!-- ⑥ 投资知识库 -->
      <div class="dash-stat-card" style="cursor:pointer;" onclick="switchPage('knowledge')">
        <div class="dash-stat-inner">
          <div class="dash-stat-label">🧠 投资知识库</div>
          <div class="dash-stat-value">${knowledgeCount}<span class="dash-stat-unit"> 条</span></div>
          <div class="dash-stat-sub">投资理念 · 交易策略</div>
          <div style="font-size:11px;color:var(--text3);margin-top:8px;">点击查看知识库 →</div>
        </div>
      </div>
    </div>

    <!-- ===== 中间：净值走势 + 资产配置 ===== -->
    <div class="dash-mid-row">
      <!-- 净值走势 -->
      <div class="dash-card">
        <div class="dash-card-header">
          <span class="dash-card-title">📈 净值走势</span>
          <span class="dash-card-hint">归一化起点 1.0</span>
        </div>
        <div class="dash-chart-area">
          <canvas id="dash-nav-chart"></canvas>
        </div>
      </div>

      <!-- 资产配置 -->
      <div class="dash-card">
        <div class="dash-card-header">
          <span class="dash-card-title">🥧 资产配置</span>
          <span class="dash-card-hint">按持仓市值</span>
        </div>
        <div class="dash-pie-row">
          <div class="dash-pie-wrap">
            <canvas id="dash-pie-chart"></canvas>
          </div>
          <div class="dash-pie-legend">
            ${totalAssets > 0 ? `
            <div class="dash-legend-item">
              <span class="dash-legend-dot" style="background:#3b82f6;"></span>
              <div class="dash-legend-info">
                <div class="dash-legend-name">基金资产</div>
                <div class="dash-legend-amount">¥${fmtWan(fundAssets)}万</div>
              </div>
              <div class="dash-legend-pct">${Math.round(fundAssets/totalAssets*100)}%</div>
            </div>
            <div class="dash-legend-item">
              <span class="dash-legend-dot" style="background:#8b5cf6;"></span>
              <div class="dash-legend-info">
                <div class="dash-legend-name">股票资产</div>
                <div class="dash-legend-amount">¥${fmtWan(stockAssets)}万</div>
              </div>
              <div class="dash-legend-pct">${Math.round(stockAssets/totalAssets*100)}%</div>
            </div>
            <div class="dash-legend-item">
              <span class="dash-legend-dot" style="background:#06b6d4;"></span>
              <div class="dash-legend-info">
                <div class="dash-legend-name">期货保证金</div>
                <div class="dash-legend-amount">¥${fmtWan(futuresAssets)}万</div>
              </div>
              <div class="dash-legend-pct">${Math.round(futuresAssets/totalAssets*100)}%</div>
            </div>
            <div class="dash-legend-total">
              <span>合计</span>
              <span>¥${fmtWan(totalAssets)}万</span>
            </div>
            ` : `
            <div style="font-size:12px;color:var(--text3);text-align:center;padding-top:40px;">暂无持仓数据</div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;

  // 渲染净值走势图
  setTimeout(() => renderDashNavChart(fundStats, holdingFunds), 50);
  // 渲染资产配置饼图
  setTimeout(() => renderDashPieChart(fundAssets, stockAssets, futuresAssets), 50);
}

function renderDashNavChart(stats, holdingFunds) {
  const canvas = document.getElementById('dash-nav-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // 收集所有有净值历史的基金
  const validFunds = holdingFunds.filter(f => f.navHistory && f.navHistory.length > 1);

  if (validFunds.length === 0) {
    if (window._dashNavChart) { window._dashNavChart.destroy(); window._dashNavChart = null; }
    return;
  }

  const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#f97316'];

  // 获取所有日期（去重排序）
  const allDatesSet = new Set();
  validFunds.forEach(f => {
    f.navHistory.forEach(p => allDatesSet.add(p.date));
  });
  const allDates = Array.from(allDatesSet).sort();

  // 为每个基金构建与 allDates 对齐的数据
  const datasets = validFunds.map((f, i) => {
    const navMap = new Map(f.navHistory.map(p => [p.date, Number(p.nav)]));
    const data = allDates.map(date => navMap.get(date) ?? null);
    return {
      label: f.name || '基金',
      data: data,
      borderColor: colors[i % colors.length],
      backgroundColor: 'transparent',
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      spanGaps: true,
    };
  });

  if (window._dashNavChart) window._dashNavChart.destroy();
  window._dashNavChart = new Chart(ctx, {
    type: 'line',
    data: { labels: allDates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: validFunds.length > 1,
          position: 'top',
          labels: {
            font: { size: 11, family: '-apple-system, PingFang SC, Microsoft YaHei' },
            color: '#64748b',
            boxWidth: 10,
            padding: 10,
            usePointStyle: true,
            pointStyle: 'circle',
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.9)',
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
          padding: 10,
          callbacks: {
            label: ctx => {
              const val = ctx.raw;
              return val !== null ? `${ctx.dataset.label}: ${val.toFixed(4)}` : null;
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          grid: { color: 'rgba(226,232,240,0.5)', drawBorder: false },
          ticks: {
            font: { size: 10 },
            color: '#94a3b8',
            maxTicksLimit: 6,
            maxRotation: 0,
          }
        },
        y: {
          display: true,
          grid: { color: 'rgba(226,232,240,0.5)', drawBorder: false },
          ticks: {
            font: { size: 10 },
            color: '#94a3b8',
          }
        }
      }
    }
  });
}

function renderDashPieChart(fundAssets, stockAssets, futuresAssets) {
  const canvas = document.getElementById('dash-pie-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const total = fundAssets + stockAssets + futuresAssets;
  const hasData = total > 0;
  if (window._dashPieChart) window._dashPieChart.destroy();
  window._dashPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['基金', '股票资产', '期货保证金'],
      datasets: [{
        data: hasData ? [fundAssets, stockAssets, futuresAssets] : [1, 1, 1],
        backgroundColor: hasData
          ? ['#3b82f6', '#8b5cf6', '#06b6d4']
          : ['#e2e8f0', '#e2e8f0', '#e2e8f0'],
        borderWidth: 0,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.9)',
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
          padding: 10,
          callbacks: {
            label: ctx => `${ctx.label}: ¥${fmtWan(ctx.raw)}万 (${total > 0 ? Math.round(ctx.raw/total*100) : 0}%)`
          }
        }
      },
      cutout: '68%'
    }
  });
}

