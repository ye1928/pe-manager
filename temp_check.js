
// ============================================================
// DATA STORE
// ============================================================
const DB = {
  load(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; }
  },
  save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }
};

// 数据结构
// funds: [{
//   id, name, company, strategy, perfFee（业绩报酬比例0-100）, status, note, createdAt,
//   latestNav, navDate,
//   batches: [{ id, date, amount(万), costNav, note }],
//   dividends: [{ id, date, perShare, note }],
//   navHistory: [{ id, date, nav, cumNav?, type, note }]  // 历史净值序列，cumNav=导入的累计净值
// }]

// 研报资讯数据结构
// articles: [{
//   id, type(report/wechat), source(来源名称), title, url, date, summary,
//   tags[], sentiment(-1/0/1), relevance(1-5),
//   related(关联的基金/股票), verification({verified, result, date, notes}),
//   createdAt
// }]

let funds = DB.load('funds_v2', []);
let articles = DB.load('articles_v1', []);

// ============================================================
// VOTE HISTORY DATA
// ============================================================
// voteHistory_v1: [{ id, text, type, horizon, createdAt,
//                    avgScore, bullCount, bearCount, neutralCount,
//                    investors: [{ id, name, avatar, avatarBg, style, score, verdict, sentiment }] }]
let voteHistory = DB.load('voteHistory_v1', []);
let currentVoteTab = 'current'; // 'current' | 'history'

// ============================================================
// DECISION ADVISOR DATA
// ============================================================
// decisionHistory_v1: [{ id, question, category, createdAt,
//                        relatedKnowledge: [{ id, title, category, relevance, content }],
//                        analysis: String,
//                        decision: String }]
let decisionHistory = DB.load('decisionHistory_v1', []);

// ============================================================
// STOCK DATA
// ============================================================
// stocks_v2: [{ id, code, name, market, status(holding/watchlist/sold), note,
//               trades: [{ id, type(buy/sell), date, price, qty, note }],
//               createdAt }]
let stocks = DB.load('stocks_v2', []);
let currentStockTab = 'holding';

// ============================================================
// FUTURES DATA
// ============================================================
// futures_v2: [{ id, code, name, multiplier, direction(long/short),
//               status(holding/watchlist/closed), marginRate,
//               trades: [{ id, type(open/close), date, price, qty, note }],
//               createdAt }]
let futures = DB.load('futures_v2', []);
let currentFuturesTab = 'holding';

// ============================================================
// DATA EXPORT / IMPORT
// ============================================================
function exportAllData() {
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    data: {
      funds: DB.load('funds_v2', []),
      articles: DB.load('articles_v1', []),
      stocks: DB.load('stocks_v2', []),
      futures: DB.load('futures_v2', []),
      knowledgeBase: DB.load('knowledge_v1', []),
      voteHistory: DB.load('voteHistory_v1', [])
    }
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `投资数据_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  alert('数据已导出！文件包含：基金、资讯、股票、期货、知识库全部数据');
}

function importAllData(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.data) throw new Error('无效的数据格式');

      const { funds: importedFunds, articles: importedArticles, stocks: importedStocks, futures: importedFutures, knowledgeBase: importedKnowledgeBase } = data.data;

      // 导入前自动备份（保留最近3份）
      const backupKey = 'backup_' + Date.now();
      const backupData = {
        funds: DB.load('funds_v2', []),
        articles: DB.load('articles_v1', []),
        stocks: DB.load('stocks_v2', []),
        futures: DB.load('futures_v2', []),
        calendarEvents: DB.load('calendar_events_v1', []),
        knowledgeBase: DB.load('knowledge_v1', []),
        backupTime: new Date().toLocaleString()
      };
      DB.save(backupKey, backupData);
      // 清理过期备份（只保留最近3份）
      cleanupOldBackups(3);

      // 确认覆盖（现在提示备份信息）
      if (!confirm(`即将导入数据：\n- 基金 ${(importedFunds||[]).length} 条\n- 资讯 ${(importedArticles||[]).length} 条\n- 股票 ${(importedStocks||[]).length} 条\n- 期货 ${(importedFutures||[]).length} 条\n- 知识库 ${(importedKnowledgeBase||[]).length} 条\n\n⚠️ 已自动备份当前数据！\n如需恢复，可在浏览器开发者工具 → Application → LocalStorage 中查找 backup_ 开头的键。\n\n确定继续导入吗？`)) {
        return;
      }

      // 保存数据
      DB.save('funds_v2', importedFunds || []);
      DB.save('articles_v1', importedArticles || []);
      DB.save('stocks_v2', importedStocks || []);
      DB.save('futures_v2', importedFutures || []);
      DB.save('knowledge_v1', importedKnowledgeBase || []);

      // 重新加载
      funds = DB.load('funds_v2', []);
      articles = DB.load('articles_v1', []);
      stocks = DB.load('stocks_v2', []);
      futures = DB.load('futures_v2', []);
      knowledgeBase = DB.load('knowledge_v1', []);

      // 刷新当前页面
      refreshCurrentPage();

      alert('✅ 数据导入成功！\n💡 如需恢复导入前的数据，请在浏览器开发者工具中查找 backup_ 开头的 LocalStorage 键。');
    } catch (err) {
      alert('导入失败：' + err.message);
    }
  };
  reader.readAsText(file);
}

function cleanupOldBackups(keep) {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('backup_')).sort().reverse();
  keys.slice(keep).forEach(k => localStorage.removeItem(k));
}

// ============================================================
// ATTRIBUTION ANALYSIS
// ============================================================
let attrSourceChart = null;
let attrRankChart = null;
let attrAllocationChart = null;
let attrPnlChart = null;

function renderAttribution() {
  // 销毁旧图表（避免重复渲染）
  [attrSourceChart, attrRankChart, attrAllocationChart, attrPnlChart].forEach(c => { if (c) c.destroy(); });

  // === 汇总统计 ===
  let totalFundCost = 0, totalFundGain = 0, totalFundCount = 0;
  let totalStockCost = 0, totalStockGain = 0, totalStockCount = 0;
  let totalFuturesCost = 0, totalFuturesGain = 0, totalFuturesCount = 0;
  let profitableCount = 0, losingCount = 0;

  // 基金
  funds.forEach(f => {
    const c = calcFund(f);
    totalFundCost += c.totalCost;
    totalFundGain += c.netGain;
    totalFundCount++;
    if (c.netGain > 0) profitableCount++; else if (c.netGain < 0) losingCount++;
  });

  // 股票
  stocks.forEach(s => {
    const c = calcStock(s);
    totalStockCost += c.avgCostTotal;
    totalStockGain += c.netGain;
    totalStockCount++;
    if (c.netGain > 0) profitableCount++; else if (c.netGain < 0) losingCount++;
  });

  // 期货
  futures.forEach(f => {
    const c = calcFutures(f);
    totalFuturesCost += Math.abs(c.margin || 0);
    totalFuturesGain += c.netGain;
    totalFuturesCount++;
    if (c.netGain > 0) profitableCount++; else if (c.netGain < 0) losingCount++;
  });

  const totalCost = totalFundCost + totalStockCost + totalFuturesCost;
  const totalGain = totalFundGain + totalStockGain + totalFuturesGain;
  const totalCount = totalFundCount + totalStockCount + totalFuturesCount;

  // 概览卡片
  const overviewEl = document.getElementById('attribution-overview');
  overviewEl.innerHTML = `
    <div class="card" style="text-align:center;padding:16px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">累计投入本金</div>
      <div style="font-size:20px;font-weight:700;">${fmtWan(totalCost)}</div>
    </div>
    <div class="card" style="text-align:center;padding:16px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">净盈亏合计</div>
      <div style="font-size:20px;font-weight:700;${pnlClass(totalGain)}">${totalGain >= 0 ? '+' : ''}${fmtWan(totalGain)}</div>
    </div>
    <div class="card" style="text-align:center;padding:16px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">累计收益率</div>
      <div style="font-size:20px;font-weight:700;${pnlClass(totalGain)}">${totalCost > 0 ? fmtPct(totalGain / totalCost) : '--'}</div>
    </div>
    <div class="card" style="text-align:center;padding:16px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">投资标的数</div>
      <div style="font-size:20px;font-weight:700;">${totalCount}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px;">私募${totalFundCount} · 股${totalStockCount} · 期${totalFuturesCount}</div>
    </div>
  `;

  // === 图1：收益来源分布（饼图）===
  const sourceData = [
    { label: '私募基金', value: totalFundGain, color: '#3b82f6' },
    { label: '股票', value: totalStockGain, color: '#f59e0b' },
    { label: '期货', value: totalFuturesGain, color: '#8b5cf6' },
  ].filter(d => d.value !== 0);

  attrSourceChart = new Chart(document.getElementById('attribution-source-chart'), {
    type: 'doughnut',
    data: {
      labels: sourceData.map(d => d.label),
      datasets: [{
        data: sourceData.map(d => Math.abs(d.value)),
        backgroundColor: sourceData.map(d => d.color),
        borderColor: 'transparent',
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${totalGain >= 0 ? '+' : ''}${fmtWan(sourceData[ctx.dataIndex].value)}`
          }
        }
      }
    }
  });

  // === 图2：盈亏排名（水平条形图）===
  const allEntities = [
    ...funds.map(f => ({ name: f.name, gain: calcFund(f).netGain, type: '基金' })),
    ...stocks.map(s => ({ name: s.name, gain: calcStock(s).netGain, type: '股票' })),
    ...futures.map(f => ({ name: f.name, gain: calcFutures(f).netGain, type: '期货' })),
  ].sort((a, b) => b.gain - a.gain).slice(0, 10);

  const rankColors = allEntities.map(d => d.gain >= 0 ? '#ef4444' : '#22c55e');
  attrRankChart = new Chart(document.getElementById('attribution-rank-chart'), {
    type: 'bar',
    data: {
      labels: allEntities.map(d => d.name.length > 10 ? d.name.slice(0, 10) + '…' : d.name),
      datasets: [{
        label: '净盈亏',
        data: allEntities.map(d => d.gain),
        backgroundColor: rankColors,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.raw >= 0 ? '+' : ''}${fmtWan(ctx.raw)}` } } },
      scales: {
        x: { ticks: { color: '#64748b', callback: v => fmtWan(v) }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } }
      }
    }
  });

  // === 图3：资产配置占比 ===
  const allocData = [
    { label: '私募基金', value: totalFundCost, color: '#3b82f6' },
    { label: '股票', value: totalStockCost, color: '#f59e0b' },
    { label: '期货', value: totalFuturesCost, color: '#8b5cf6' },
  ].filter(d => d.value > 0);

  attrAllocationChart = new Chart(document.getElementById('attribution-allocation-chart'), {
    type: 'pie',
    data: {
      labels: allocData.map(d => d.label),
      datasets: [{
        data: allocData.map(d => d.value),
        backgroundColor: allocData.map(d => d.color),
        borderColor: 'transparent',
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = totalCost > 0 ? (ctx.raw / totalCost * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${fmtWan(ctx.raw)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  // === 图4：盈亏分布（环形图）===
  const hasData = profitableCount + losingCount;
  attrPnlChart = new Chart(document.getElementById('attribution-pnl-chart'), {
    type: 'doughnut',
    data: {
      labels: ['盈利', '亏损', '持平'],
      datasets: [{
        data: [profitableCount, losingCount, Math.max(0, totalCount - profitableCount - losingCount)],
        backgroundColor: ['#ef4444', '#22c55e', '#64748b'],
        borderColor: 'transparent',
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 12 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}个` } }
      }
    }
  });
}

// ============================================================
// ATTRIBUTION TAB SWITCHING
// ============================================================
let currentAttrTab = 'pnl';
let selectedCorrFunds = new Set();
let selectedNavFitFunds = new Set();
let navFitChart = null;

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('attr-tab')) {
    currentAttrTab = e.target.dataset.attrTab;
    document.querySelectorAll('.attr-tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    document.querySelectorAll('[id^="attr-tab-"]').forEach(el => el.style.display = 'none');
    document.getElementById('attr-tab-' + currentAttrTab).style.display = '';
    if (currentAttrTab === 'pnl') renderAttribution();
    if (currentAttrTab === 'correlation') renderCorrelation();
    if (currentAttrTab === 'navfit') renderNavFit();
    if (currentAttrTab === 'portfolio') renderPortfolioSim();
  }
});

// ============================================================
// CORRELATION ANALYSIS
// ============================================================
const CORR_COLORS = [
  '#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6',
  '#06b6d4','#ec4899','#14b8a6','#f97316','#6366f1'
];

function getCorrelationFunds() {
  return funds.filter(f => {
    const navs = f.navHistory || [];
    return navs.length >= 10;
  });
}

function calcCorrelationMatrix(selectedIds) {
  if (selectedIds.size < 2) return null;
  const selFunds = funds.filter(f => selectedIds.has(f.id));
  // Build aligned return series
  const allDates = new Set();
  selFunds.forEach(f => {
    (f.navHistory || []).forEach(n => allDates.add(n.date));
  });
  const sortedDates = [...allDates].sort();
  if (sortedDates.length < 10) return null;

  // Get NAV maps
  const navMaps = {};
  selFunds.forEach(f => {
    const navs = (f.navHistory || []).sort((a, b) => a.date.localeCompare(b.date));
    navMaps[f.id] = {};
    navs.forEach(n => { navMaps[f.id][n.date] = Number(n.nav); });
  });

  // Calculate daily returns (skip first date)
  const returns = {};
  selFunds.forEach(f => {
    returns[f.id] = [];
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = navMaps[f.id][sortedDates[i - 1]];
      const curr = navMaps[f.id][sortedDates[i]];
      if (prev && curr && prev > 0) {
        returns[f.id].push((curr - prev) / prev);
      }
    }
  });

  // Pearson correlation
  const ids = selFunds.map(f => f.id);
  const n = ids.length;
  const corr = {};
  for (let i = 0; i < n; i++) {
    corr[ids[i]] = {};
    for (let j = 0; j < n; j++) {
      if (i === j) { corr[ids[i]][ids[j]] = 1; continue; }
      const ri = returns[ids[i]];
      const rj = returns[ids[j]];
      const len = Math.min(ri.length, rj.length);
      if (len < 5) { corr[ids[i]][ids[j]] = null; continue; }
      const ri2 = ri.slice(0, len), rj2 = rj.slice(0, len);
      const meanI = ri2.reduce((a, b) => a + b, 0) / len;
      const meanJ = rj2.reduce((a, b) => a + b, 0) / len;
      const cov = ri2.reduce((s, v, k) => s + (v - meanI) * (rj2[k] - meanJ), 0);
      const stdI = Math.sqrt(ri2.reduce((s, v) => s + (v - meanI) ** 2, 0));
      const stdJ = Math.sqrt(rj2.reduce((s, v) => s + (v - meanJ) ** 2, 0));
      corr[ids[i]][ids[j]] = stdI > 0 && stdJ > 0 ? cov / (stdI * stdJ) : null;
    }
  }
  return { corr, ids, funds: selFunds };
}

function corrColor(val) {
  if (val === null) return '#e2e8f0';
  // 负相关：橙红 → 零：中灰 → 正相关：蓝
  const t = (val + 1) / 2; // 0..1
  if (t < 0.5) {
    // 负相关区间：#ef4444(红) → #f8fafc(白)
    const s = t * 2;
    const r = Math.round(239 - (239 - 248) * s);
    const g = Math.round(68 + (250 - 68) * s);
    const b = Math.round(68 + (252 - 68) * s);
    return `rgb(${r},${g},${b})`;
  } else {
    // 正相关区间：#f8fafc(白) → #3b82f6(蓝)
    const s = (t - 0.5) * 2;
    const r = Math.round(248 - (248 - 59) * s);
    const g = Math.round(250 - (250 - 130) * s);
    const b = Math.round(252 - (252 - 246) * s);
    return `rgb(${r},${g},${b})`;
  }
}

function corrTextColor(val) {
  if (val === null) return '#94a3b8';
  // 强相关时用白色文字，弱相关时用深色
  return Math.abs(val) > 0.6 ? '#fff' : '#334155';
}

function renderCorrelation() {
  const allCorrFunds = getCorrelationFunds();
  if (allCorrFunds.length === 0) {
    document.getElementById('corr-heatmap-container').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text3);">至少需要2只以上有10条以上净值数据的基金才能计算相关性</div>';
    document.getElementById('corr-summary').innerHTML = '';
    document.getElementById('corr-pairs-list').innerHTML = '';
    return;
  }

  // Render fund chips (selector)
  const selDiv = document.getElementById('corr-fund-selector');
  // Default: select first 6
  if (selectedCorrFunds.size === 0) {
    allCorrFunds.slice(0, 6).forEach(f => selectedCorrFunds.add(f.id));
  }
  selDiv.innerHTML = allCorrFunds.map((f, i) => {
    const sel = selectedCorrFunds.has(f.id) ? 'selected' : '';
    const color = CORR_COLORS[i % CORR_COLORS.length];
    return `<span class="corr-chip ${sel}" data-corr-id="${f.id}" data-corr-idx="${i}" style="${sel ? `background:${color};border-color:${color};` : ''}">
      <span class="chip-dot" style="background:${color}"></span>${f.name.length > 8 ? f.name.slice(0, 8) + '…' : f.name}
    </span>`;
  }).join('');

  // Chip click
  selDiv.querySelectorAll('.corr-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.corrId;
      if (selectedCorrFunds.has(id)) {
        selectedCorrFunds.delete(id);
        chip.classList.remove('selected');
        chip.style.background = '';
        chip.style.borderColor = '';
      } else {
        selectedCorrFunds.add(id);
        const idx = parseInt(chip.dataset.corrIdx);
        chip.classList.add('selected');
        chip.style.background = CORR_COLORS[idx % CORR_COLORS.length];
        chip.style.borderColor = CORR_COLORS[idx % CORR_COLORS.length];
      }
      renderCorrelation();
    });
  });

  document.getElementById('corr-select-all').onclick = () => {
    allCorrFunds.forEach(f => selectedCorrFunds.add(f.id));
    renderCorrelation();
  };
  document.getElementById('corr-select-clear').onclick = () => {
    selectedCorrFunds.clear();
    renderCorrelation();
  };

  if (selectedCorrFunds.size < 2) {
    document.getElementById('corr-heatmap-container').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text3);">请选择至少2只基金以计算相关性</div>';
    document.getElementById('corr-summary').innerHTML = '';
    document.getElementById('corr-pairs-list').innerHTML = '';
    return;
  }

  const result = calcCorrelationMatrix(selectedCorrFunds);
  if (!result) {
    document.getElementById('corr-heatmap-container').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text3);">净值数据不足以计算相关性（需至少5个共同交易日）</div>';
    document.getElementById('corr-summary').innerHTML = '';
    document.getElementById('corr-pairs-list').innerHTML = '';
    return;
  }
  const { corr, ids, funds: selFunds } = result;

  // Summary stats
  const vals = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (corr[ids[i]][ids[j]] !== null) vals.push(corr[ids[i]][ids[j]]);
    }
  }
  const avgCorr = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const maxCorr = vals.length > 0 ? Math.max(...vals.map(Math.abs)) : 0;
  const highCorrPairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const v = corr[ids[i]][ids[j]];
      if (v !== null && Math.abs(v) > 0.6) {
        const fi = selFunds.find(f => f.id === ids[i]);
        const fj = selFunds.find(f => f.id === ids[j]);
        highCorrPairs.push({ fi, fj, v });
      }
    }
  }
  highCorrPairs.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));

  const avgAbs = vals.length > 0 ? vals.reduce((a, b) => a + Math.abs(b), 0) / vals.length : 0;
  document.getElementById('corr-summary').innerHTML = `
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">平均相关性</div>
      <div style="font-size:18px;font-weight:700;color:var(--accent);">${avgCorr >= 0 ? '+' : ''}${avgCorr.toFixed(3)}</div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">最大相关度</div>
      <div style="font-size:18px;font-weight:700;color:${maxCorr > 0.7 ? 'var(--red)' : 'var(--green)'};">${maxCorr.toFixed(3)}</div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">相关组合数</div>
      <div style="font-size:18px;font-weight:700;">${vals.length}</div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">高相关对（|r|>0.6）</div>
      <div style="font-size:18px;font-weight:700;color:${highCorrPairs.length > 0 ? 'var(--yellow)' : 'var(--green)'};">${highCorrPairs.length}</div>
    </div>
  `;

  // Heatmap HTML
  const nameMap = {};
  selFunds.forEach(f => { nameMap[f.id] = f.name; });
  const displayNames = ids.map(id => {
    const n = nameMap[id];
    return n.length > 8 ? n.slice(0, 8) + '…' : n;
  });
  const headerTh = displayNames.map((n, i) => {
    const fund = selFunds.find(f => f.id === ids[i]);
    const color = CORR_COLORS[selFunds.indexOf(fund) % CORR_COLORS.length];
    return `<th title="${nameMap[ids[i]]}" style="color:${color};">${n}</th>`;
  }).join('');
  const rows = ids.map((rowId, i) => {
    const cells = ids.map((colId, j) => {
      const v = corr[rowId][colId];
      if (v === null) return `<td><div class="corr-cell" style="background:#e2e8f0;color:#94a3b8;">—</div></td>`;
      const bg = corrColor(v);
      const tc = corrTextColor(v);
      return `<td><div class="corr-cell" style="background:${bg};color:${tc};" title="${nameMap[rowId]} vs ${nameMap[colId]}: ${v.toFixed(3)}">${v.toFixed(2)}</div></td>`;
    }).join('');
    return `<tr><th title="${nameMap[rowId]}" style="color:${CORR_COLORS[selFunds.findIndex(f=>f.id===rowId) % CORR_COLORS.length]};">${displayNames[i]}</th>${cells}</tr>`;
  }).join('');

  document.getElementById('corr-heatmap').innerHTML =
    `<table class="corr-heatmap-table"><thead><tr><th></th>${headerTh}</tr></thead><tbody>${rows}</tbody></table>`;

  // High corr pairs
  const pairsEl = document.getElementById('corr-pairs-list');
  if (highCorrPairs.length === 0) {
    pairsEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--green);font-size:12px;">暂无|r|>0.6的高相关组合，走势相对独立 ✅</div>';
  } else {
    pairsEl.innerHTML = highCorrPairs.slice(0, 8).map(p => {
      const badge = Math.abs(p.v) > 0.8 ? { text: '极强', bg: '#ef4444' } : { text: '强', bg: '#f59e0b' };
      const direction = p.v > 0 ? '正相关 ↗' : '负相关 ↘';
      return `<div class="corr-pair-card">
        <div>
          <div class="corr-pair-names" style="color:var(--accent);">${p.fi.name}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">${p.fi.status === 'tracking' ? '🔍跟踪' : '🏦持仓'} vs ${p.fj.status === 'tracking' ? '🔍跟踪' : '🏦持仓'} · ${direction}</div>
        </div>
        <div>
          <div class="corr-pair-val" style="color:${Math.abs(p.v) > 0.8 ? '#ef4444' : '#f59e0b'};">${p.v > 0 ? '+' : ''}${p.v.toFixed(3)}</div>
          <span class="corr-pair-badge" style="background:${badge.bg};color:#fff;">${badge.text}</span>
        </div>
      </div>`;
    }).join('');
  }
}

// ============================================================
// NAV FIT ANALYSIS
// ============================================================
let navFitCompareMode = false;

// PORTFOLIO SIMULATION
// ============================================================
let portfolioAlloc = {}; // { fundId: amount in 万 }
let portfolioChart = null;

function getPortfolioFunds() {
  return funds.filter(f => {
    const navs = f.navHistory || [];
    return navs.length >= 5;
  });
}

function renderPortfolioSim() {
  const allFunds = getPortfolioFunds();
  if (allFunds.length === 0) {
    document.getElementById('portfolio-pool').innerHTML =
      '<div style="font-size:12px;color:var(--text3);padding:10px;">暂无净值数据</div>';
    document.getElementById('portfolio-allocations').innerHTML = '';
    return;
  }

  // Render fund pool chips (only those not yet in allocation)
  const poolDiv = document.getElementById('portfolio-pool');
  poolDiv.innerHTML = allFunds.map((f, i) => {
    const color = CORR_COLORS[i % CORR_COLORS.length];
    const inAlloc = portfolioAlloc.hasOwnProperty(f.id);
    return `<span class="portfolio-pool-chip ${inAlloc ? 'used' : ''}"
      data-pf-id="${f.id}"
      style="${inAlloc ? 'opacity:0.4;cursor:not-allowed;' : `border-color:${color};color:${color};`}">
      ${f.name.length > 8 ? f.name.slice(0, 8) + '…' : f.name}
    </span>`;
  }).join('');

  poolDiv.querySelectorAll('.portfolio-pool-chip').forEach(chip => {
    if (!portfolioAlloc.hasOwnProperty(chip.dataset.pfId)) {
      chip.addEventListener('click', () => {
        const fid = chip.dataset.pfId;
        const f = allFunds.find(x => x.id === fid);
        if (f) {
          portfolioAlloc[fid] = 100; // default 100万
          renderPortfolioSim();
        }
      });
    }
  });

  // Render allocation list
  const allocDiv = document.getElementById('portfolio-allocations');
  const allocEntries = Object.entries(portfolioAlloc).filter(([id, amt]) => amt > 0);
  if (allocEntries.length === 0) {
    allocDiv.innerHTML = '<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px;">点击上方基金名称加入配置</div>';
  } else {
    const totalAmount = allocEntries.reduce((s, [, a]) => s + a, 0);
    document.getElementById('portfolio-total-bar').style.display = 'block';
    document.getElementById('portfolio-total-amount').textContent = totalAmount.toFixed(0) + ' 万';

    allocDiv.innerHTML = allocEntries.map(([id, amt]) => {
      const f = allFunds.find(x => x.id === id);
      if (!f) return '';
      const idx = allFunds.findIndex(x => x.id === id);
      const color = CORR_COLORS[idx % CORR_COLORS.length];
      const pct = totalAmount > 0 ? ((amt / totalAmount) * 100).toFixed(1) : '0.0';
      return `<div class="portfolio-alloc-item">
        <span class="portfolio-alloc-color" style="background:${color};"></span>
        <span class="portfolio-alloc-name" title="${f.name}">${f.name.length > 8 ? f.name.slice(0, 8) + '…' : f.name}</span>
        <div class="portfolio-alloc-input-wrap">
          <input class="portfolio-alloc-input" type="number" min="0" step="10" value="${amt}"
            data-pf-id="${id}" />
          <span style="font-size:11px;color:var(--text3);">万</span>
        </div>
        <span class="portfolio-alloc-pct">${pct}%</span>
        <button class="portfolio-alloc-remove" data-pf-remove="${id}" title="移除">✕</button>
      </div>`;
    }).join('');

    // Weight change handlers
    allocDiv.querySelectorAll('.portfolio-alloc-input').forEach(inp => {
      inp.addEventListener('input', () => {
        const val = parseFloat(inp.value) || 0;
        portfolioAlloc[inp.dataset.pfId] = Math.max(0, val);
        renderPortfolioSim();
      });
    });
    // Remove handlers
    allocDiv.querySelectorAll('.portfolio-alloc-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        delete portfolioAlloc[btn.dataset.pfRemove];
        renderPortfolioSim();
      });
    });
  }

  // Compute portfolio NAV series
  const activeAlloc = Object.entries(portfolioAlloc).filter(([, a]) => a > 0);
  if (activeAlloc.length === 0) {
    document.getElementById('portfolio-chart').parentElement.innerHTML =
      '<div style="text-align:center;padding:60px;color:var(--text3);">请先在左侧添加基金配置</div>';
    document.getElementById('portfolio-summary').innerHTML = '';
    document.getElementById('portfolio-stats').innerHTML = '';
    if (portfolioChart) { portfolioChart.destroy(); portfolioChart = null; }
    return;
  }

  const allocFunds = activeAlloc.map(([id]) => allFunds.find(f => f.id === id)).filter(Boolean);
  const totalAmt = activeAlloc.reduce((s, [, a]) => s + a, 0);

  // Build NAV maps
  const navMaps = {};
  allocFunds.forEach(f => {
    navMaps[f.id] = {};
    (f.navHistory || []).forEach(n => { navMaps[f.id][n.date] = Number(n.nav); });
  });

  // Collect aligned dates
  const allDates = new Set();
  allocFunds.forEach(f => (f.navHistory || []).forEach(n => allDates.add(n.date)));
  const sortedDates = [...allDates].sort();

  // Compute weighted portfolio NAV at each date
  const portfolioSeries = [];
  const fundSeriesMap = {};
  allocFunds.forEach(f => { fundSeriesMap[f.id] = []; });

  for (const d of sortedDates) {
    let weightedNav = 0;
    let hasData = false;
    allocFunds.forEach(f => {
      const nav = navMaps[f.id][d];
      if (nav !== undefined) {
        hasData = true;
        weightedNav += nav * (portfolioAlloc[f.id] / totalAmt);
      }
      fundSeriesMap[f.id].push({ date: d, nav: nav || null });
    });
    if (hasData) portfolioSeries.push({ date: d, nav: weightedNav });
  }

  // Normalize portfolio series to 1.0
  const baseNav = portfolioSeries.length > 0 ? portfolioSeries[0].nav : 1;
  const normPortfolio = portfolioSeries.map(p => ({ date: p.date, nav: p.nav / baseNav }));

  // Summary cards
  const finalNav = normPortfolio.length > 0 ? normPortfolio[normPortfolio.length - 1].nav : 1;
  const totalReturn = finalNav - 1;
  const firstDate = normPortfolio.length > 0 ? normPortfolio[0].date : '-';
  const lastDate = normPortfolio.length > 0 ? normPortfolio[normPortfolio.length - 1].date : '-';

  // Compute max drawdown
  let peak = 1, maxDD = 0;
  normPortfolio.forEach(p => { if (p.nav > peak) peak = p.nav; const dd = (peak - p.nav) / peak; if (dd > maxDD) maxDD = dd; });

  // Annualized return
  const days = normPortfolio.length > 1
    ? Math.max(1, (new Date(normPortfolio[normPortfolio.length - 1].date) - new Date(normPortfolio[0].date)) / 86400000)
    : 1;
  const annualized = (days / 365) > 0 ? Math.pow(1 + totalReturn, 365 / days) - 1 : 0;

  document.getElementById('portfolio-summary').innerHTML = `
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">区间收益率</div>
      <div style="font-size:18px;font-weight:700;color:${totalReturn >= 0 ? 'var(--red)' : 'var(--green)'};">${totalReturn >= 0 ? '+' : ''}${(totalReturn * 100).toFixed(1)}%</div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">年化收益率</div>
      <div style="font-size:18px;font-weight:700;color:${annualized >= 0 ? 'var(--red)' : 'var(--green)'};">${annualized >= 0 ? '+' : ''}${(annualized * 100).toFixed(1)}%</div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">最大回撤</div>
      <div style="font-size:18px;font-weight:700;color:var(--red);">-${(maxDD * 100).toFixed(1)}%</div>
    </div>
  `;

  // Stats table
  const fmtRet = v => `<span style="color:${v >= 0 ? 'var(--red)' : 'var(--green)'};font-weight:600;">${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%</span>`;
  document.getElementById('portfolio-stats').innerHTML = `
    <table>
      <thead><tr><th>基金</th><th>配置（万）</th><th>权重</th><th>区间收益</th><th>年化收益</th><th>最大回撤</th></tr></thead>
      <tbody>
        ${allocFunds.map((f, i) => {
          const amt = portfolioAlloc[f.id] || 0;
          const w = totalAmt > 0 ? ((amt / totalAmt) * 100).toFixed(1) : '0.0';
          const fSeries = [];
          const fDates = new Set((f.navHistory || []).map(n => n.date));
          const fSorted = [...fDates].sort();
          const fNavs = {};
          (f.navHistory || []).forEach(n => { fNavs[n.date] = Number(n.nav); });
          fSorted.forEach(d => fSeries.push({ date: d, nav: fNavs[d] }));
          const fBase = fSeries.length > 0 ? fSeries[0].nav : 1;
          const fNorm = fSeries.map(p => ({ date: p.date, nav: p.nav / fBase }));
          const fFinal = fNorm.length > 0 ? fNorm[fNorm.length - 1].nav : 1;
          const fRet = fFinal - 1;
          const fDays = fSeries.length > 1 ? Math.max(1, (new Date(fSeries[fSeries.length-1].date) - new Date(fSeries[0].date)) / 86400000) : 1;
          const fAnn = (fDays / 365) > 0 ? Math.pow(1 + fRet, 365 / fDays) - 1 : 0;
          let fPeak = 1, fDD = 0;
          fNorm.forEach(p => { if (p.nav > fPeak) fPeak = p.nav; const dd = (fPeak - p.nav) / fPeak; if (dd > fDD) fDD = dd; });
          const color = CORR_COLORS[allFunds.findIndex(x => x.id === f.id) % CORR_COLORS.length];
          return `<tr>
            <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:5px;"></span>${f.name}</td>
            <td>${amt.toFixed(0)}</td>
            <td>${w}%</td>
            <td>${fmtRet(fRet)}</td>
            <td>${fmtRet(fAnn)}</td>
            <td style="color:var(--red);">-${(fDD * 100).toFixed(1)}%</td>
          </tr>`;
        }).join('')}
        <tr style="background:var(--bg3);font-weight:700;">
          <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent);margin-right:5px;"></span>组合净值</td>
          <td>${totalAmt.toFixed(0)}</td>
          <td>100%</td>
          <td>${fmtRet(totalReturn)}</td>
          <td>${fmtRet(annualized)}</td>
          <td style="color:var(--red);">-${(maxDD * 100).toFixed(1)}%</td>
        </tr>
      </tbody>
    </table>
  `;

  // Destroy old chart
  if (portfolioChart) { portfolioChart.destroy(); portfolioChart = null; }

  // Build datasets: individual funds (light) + portfolio (bold)
  const datasets = [
    // Individual funds as background
    ...allocFunds.map((f, i) => {
      const fSeries = fundSeriesMap[f.id];
      const color = CORR_COLORS[allFunds.findIndex(x => x.id === f.id) % CORR_COLORS.length];
      const fBase = fSeries.length > 0 && fSeries[0].nav ? fSeries[0].nav : 1;
      const validPoints = fSeries.filter(p => p.nav !== null);
      return {
        label: f.name + '（单只）',
        data: validPoints.map(p => ({ x: p.date, y: p.nav / fBase })),
        borderColor: color + '55',
        backgroundColor: 'transparent',
        tension: 0.2, pointRadius: 0, borderWidth: 1,
        borderDash: [3, 3],
        spanGaps: true,
      };
    }),
    // Portfolio NAV (bold)
    {
      label: '🎯 组合净值',
      data: normPortfolio.map(p => ({ x: p.date, y: p.nav })),
      borderColor: '#3b82f6',
      backgroundColor: '#3b82f622',
      tension: 0.2, pointRadius: 0, pointHoverRadius: 3, borderWidth: 2,
      fill: true, spanGaps: true,
    },
  ];

  portfolioChart = new Chart(document.getElementById('portfolio-chart'), {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(4)}`,
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: { tooltipFormat: 'yyyy-MM-dd', displayFormats: { day: 'MM-dd', week: 'MM-dd', month: 'yyyy-MM' } },
          ticks: { color: '#64748b', maxTicksLimit: 10, font: { size: 11 }, maxRotation: 0 },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
          ticks: { color: '#64748b', callback: v => v.toFixed(2), font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' },
          title: { display: true, text: '净值（起点=1）', color: '#94a3b8', font: { size: 11 } },
        }
      }
    }
  });
}

function getNavFitFunds() {
  return funds.filter(f => {
    const navs = f.navHistory || [];
    return navs.length >= 5;
  });
}

function renderNavFit() {
  const allNavFitFunds = getNavFitFunds();
  navFitCompareMode = document.getElementById('navfit-compare-mode').checked;

  if (allNavFitFunds.length === 0) {
    document.getElementById('navfit-chart').parentElement.innerHTML =
      '<div style="text-align:center;padding:60px;color:var(--text3);">暂无净值数据，请先为基金录入净值历史</div>';
    document.getElementById('navfit-summary').innerHTML = '';
    document.getElementById('navfit-stats-table').innerHTML = '';
    return;
  }

  // Selector chips
  const selDiv = document.getElementById('navfit-fund-selector');
  if (selectedNavFitFunds.size === 0) {
    allNavFitFunds.slice(0, 4).forEach(f => selectedNavFitFunds.add(f.id));
  }
  selDiv.innerHTML = allNavFitFunds.map((f, i) => {
    const sel = selectedNavFitFunds.has(f.id) ? 'selected' : '';
    const color = CORR_COLORS[i % CORR_COLORS.length];
    return `<span class="navfit-chip ${sel}" data-navfit-id="${f.id}" style="${sel ? `color:${color};border-color:${color};background:color-mix(in srgb,${color} 12%,transparent);` : ''}">
      <span class="chip-dot" style="background:${color}"></span>${f.name.length > 8 ? f.name.slice(0, 8) + '…' : f.name}
    </span>`;
  }).join('');

  selDiv.querySelectorAll('.navfit-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.navfitId;
      const idx = allNavFitFunds.findIndex(f => f.id === id);
      const color = CORR_COLORS[idx % CORR_COLORS.length];
      if (selectedNavFitFunds.has(id)) {
        selectedNavFitFunds.delete(id);
        chip.classList.remove('selected');
        chip.style.color = '';
        chip.style.borderColor = '';
        chip.style.background = '';
      } else {
        selectedNavFitFunds.add(id);
        chip.classList.add('selected');
        chip.style.color = color;
        chip.style.borderColor = color;
        chip.style.background = `color-mix(in srgb, ${color} 12%, transparent)`;
      }
      renderNavFit();
    });
  });

  document.getElementById('navfit-select-all').onclick = () => {
    allNavFitFunds.forEach(f => selectedNavFitFunds.add(f.id));
    renderNavFit();
  };
  document.getElementById('navfit-select-clear').onclick = () => {
    selectedNavFitFunds.clear();
    renderNavFit();
  };
  document.getElementById('navfit-compare-mode').onchange = () => renderNavFit();

  const selFunds = allNavFitFunds.filter(f => selectedNavFitFunds.has(f.id));
  if (selFunds.length === 0) {
    document.getElementById('navfit-chart').parentElement.innerHTML =
      '<div style="text-align:center;padding:60px;color:var(--text3);">请选择至少1只基金</div>';
    document.getElementById('navfit-summary').innerHTML = '';
    document.getElementById('navfit-stats-table').innerHTML = '';
    return;
  }

  // Collect all dates
  const allDates = new Set();
  selFunds.forEach(f => (f.navHistory || []).forEach(n => allDates.add(n.date)));
  const sortedDates = [...allDates].sort();
  const navMaps = {};
  selFunds.forEach(f => {
    navMaps[f.id] = {};
    (f.navHistory || []).forEach(n => { navMaps[f.id][n.date] = Number(n.nav); });
  });

  // Compute normalized series
  // 默认模式：每只基金用自己最早的净值归一化到1.0（各自起点=1.0，观察相对走势）
  // 横向对比模式：找所有基金中最晚的开始日期作为共同起点，只取共同起点之后的日期进行归一化
  const normalizedSeries = {};

  // Find the latest "first date" across all selected funds as the common anchor
  let commonStartDate = null;
  if (navFitCompareMode) {
    selFunds.forEach(f => {
      const navMap = navMaps[f.id];
      const firstDate = sortedDates.find(d => navMap[d]);
      if (firstDate && (!commonStartDate || firstDate > commonStartDate)) {
        commonStartDate = firstDate;
      }
    });
  }

  selFunds.forEach(f => {
    const navMap = navMaps[f.id];
    // 默认：全部日期；横向对比：只取共同起点及之后的日期
    const allSeries = [];
    for (const d of sortedDates) {
      if (navMap[d]) {
        if (!navFitCompareMode || d >= commonStartDate) {
          allSeries.push({ date: d, nav: navMap[d] });
        }
      }
    }
    if (allSeries.length >= 2) {
      let baseNav;
      if (navFitCompareMode && commonStartDate) {
        // 横向对比：用共同起点日期的净值作为base（allSeries[0].date 必然 >= commonStartDate）
        baseNav = allSeries[0].nav;
      } else {
        // 默认：各自起点=1.0
        baseNav = allSeries[0].nav;
      }
      normalizedSeries[f.id] = allSeries.map(p => ({ date: p.date, nav: p.nav / baseNav }));
    }
  });

  // Stats per fund
  const fundStats = selFunds.map((f, i) => {
    const series = normalizedSeries[f.id] || [];
    const color = CORR_COLORS[i % CORR_COLORS.length];
    const returns = [];
    for (let j = 1; j < series.length; j++) {
      returns.push((series[j].nav - series[j - 1].nav) / series[j - 1].nav);
    }
    const avgRet = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const std = returns.length > 1 ? Math.sqrt(returns.reduce((s, r) => s + (r - avgRet) ** 2, 0) / (returns.length - 1)) : 0;
    const finalNav = series.length > 0 ? series[series.length - 1].nav : 1;
    const totalReturn = finalNav - 1;
    // Max drawdown
    let peak = 1, maxDD = 0;
    series.forEach(p => { if (p.nav > peak) peak = p.nav; const dd = (peak - p.nav) / peak; if (dd > maxDD) maxDD = dd; });
    return { f, color, series, avgRet, std, totalReturn, maxDD, navCount: series.length };
  });

  // Summary cards
  const maxReturn = Math.max(...fundStats.map(s => s.totalReturn));
  const minReturn = Math.min(...fundStats.map(s => s.totalReturn));
  const maxDD = Math.min(...fundStats.map(s => s.maxDD));
  document.getElementById('navfit-summary').innerHTML = `
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">最优收益（区间）</div>
      <div style="font-size:18px;font-weight:700;color:${maxReturn >= 0 ? 'var(--red)' : 'var(--green)'};">${maxReturn >= 0 ? '+' : ''}${(maxReturn * 100).toFixed(1)}%</div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">最差收益（区间）</div>
      <div style="font-size:18px;font-weight:700;color:${minReturn >= 0 ? 'var(--red)' : 'var(--green)'};">${minReturn >= 0 ? '+' : ''}${(minReturn * 100).toFixed(1)}%</div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">最大回撤控制最优</div>
      <div style="font-size:18px;font-weight:700;color:var(--red);">${(maxDD * 100).toFixed(1)}%</div>
    </div>
  `;

  // Dynamic chart description
  const descEl = document.getElementById('navfit-chart-desc');
  if (descEl) {
    descEl.textContent = navFitCompareMode
      ? '以所有基金中最晚的开始日期为共同起点进行归一化，适合比较"从买入时点起"的相对表现'
      : '每只基金以各自最早净值日期为起点归一化至 1.0，观察相对走势差异';
  }

  // Destroy old chart
  if (navFitChart) { navFitChart.destroy(); navFitChart = null; }

  // Build datasets
  const datasets = fundStats.map(s => ({
    label: s.f.name,
    data: s.series.map(p => ({ x: p.date, y: p.nav })),
    borderColor: s.color,
    backgroundColor: s.color + '22',
    tension: 0.2,
    pointRadius: 0,
    pointHoverRadius: 4,
    borderWidth: 1.5,
    spanGaps: true,
    fill: false,
  }));

  navFitChart = new Chart(document.getElementById('navfit-chart'), {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 12 }, boxWidth: 16 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(4)}`,
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: { tooltipFormat: 'yyyy-MM-dd', displayFormats: { day: 'MM-dd', week: 'MM-dd', month: 'yyyy-MM', year: 'yyyy' } },
          ticks: { color: '#64748b', maxTicksLimit: 12, font: { size: 11 }, maxRotation: 0 },
          grid: { color: 'rgba(255,255,255,0.05)' },
          title: { display: true, text: '日期', color: '#94a3b8', font: { size: 11 } },
        },
        y: {
          ticks: { color: '#64748b', callback: v => v.toFixed(2), font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' },
          title: { display: true, text: '净值（起点=1）', color: '#94a3b8', font: { size: 11 } },
        }
      }
    }
  });

  // Stats table
  const fmtRet = v => `<span style="color:${v >= 0 ? 'var(--red)' : 'var(--green)'};font-weight:600;">${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%</span>`;
  document.getElementById('navfit-stats-table').innerHTML = `
    <table>
      <thead><tr>
        <th>基金</th><th>净值点数</th><th>区间收益率</th><th>年化收益*</th><th>年化波动率</th><th>最大回撤</th><th>状态</th>
      </tr></thead>
      <tbody>
        ${fundStats.map(s => {
          const days = s.navCount > 1 ? Math.max(1, (new Date(s.series[s.series.length-1].date) - new Date(s.series[0].date)) / 86400000) : 1;
          const years = days / 365;
          const annualized = years > 0 ? Math.pow(1 + s.totalReturn, 1 / years) - 1 : 0;
          return `<tr>
            <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.color};margin-right:6px;"></span>${s.f.name}</td>
            <td>${s.navCount}</td>
            <td>${fmtRet(s.totalReturn)}</td>
            <td>${fmtRet(annualized)}</td>
            <td>${(s.std * Math.sqrt(252) * 100).toFixed(1)}%</td>
            <td style="color:var(--red);font-weight:600;">-${(s.maxDD * 100).toFixed(1)}%</td>
            <td><span class="tag-sm" style="background:${s.f.status === 'holding' ? '#3b82f622' : s.f.status === 'tracking' ? '#f59e0b22' : '#22c55e22'};color:${s.f.status === 'holding' ? 'var(--accent)' : s.f.status === 'tracking' ? 'var(--yellow)' : 'var(--green)'};">${s.f.status === 'holding' ? '🏦持仓' : s.f.status === 'tracking' ? '🔍跟踪' : '✅退出'}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="font-size:10px;color:var(--text3);margin-top:8px;">* 年化收益 = (1 + 区间收益)^(1/年数) - 1；波动率基于日收益率年化（×√252）</div>
  `;
}

// ============================================================
// INVESTMENT CALENDAR
// ============================================================
let calendarEvents = DB.load('calendar_events_v1', []);

function renderCalendar() {
  const today = new Date();
  renderCalendarMonth(today.getFullYear(), today.getMonth());
}

function getCalendarEvents(year, month) {
  const events = [...calendarEvents];
  // 自动加入基金分红登记日
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  funds.forEach(f => {
    (f.dividends || []).forEach(d => {
      if (d.date && d.date.startsWith(monthStr)) {
        events.push({
          id: 'div-' + d.id,
          date: d.date,
          title: `📋 ${f.name} 分红`,
          type: 'dividend',
          color: '#f59e0b',
        });
      }
    });
  });
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function switchCalendarMonth(delta) {
  const today = new Date();
  let year = today.getFullYear(), month = today.getMonth();
  month += delta;
  if (month < 0) { month = 11; year--; }
  if (month > 11) { month = 0; year++; }
  renderCalendarMonth(year, month);
}

function renderCalendarMonth(year, month) {
  const container = document.getElementById('page-calendar');
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const monthStr = `${year}年${String(month + 1).padStart(2, '0')}月`;
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const events = getCalendarEvents(year, month);

  let prevY = year, prevM = month - 1;
  if (prevM < 0) { prevM = 11; prevY--; }
  let nextY = year, nextM = month + 1;
  if (nextM > 11) { nextM = 0; nextY++; }

  let gridHtml = '';
  for (let i = 0; i < startPad; i++) gridHtml += '<div style="min-height:70px;"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayEvents = events.filter(e => e.date === dateStr);
    const isToday = isCurrentMonth && d === today.getDate();
    const isWeekend = (startPad + d - 1) % 7 >= 5;
    gridHtml += `<div style="min-height:70px;background:${isToday ? 'rgba(59,130,246,0.12)' : 'var(--bg3)'};border-radius:8px;padding:6px;${isToday ? 'border:1px solid rgba(59,130,246,0.4);' : ''}">
      <div style="font-size:12px;font-weight:${isToday ? '700' : '400'};color:${isToday ? 'var(--accent)' : isWeekend ? 'var(--text3)' : 'var(--text)'};margin-bottom:3px;">${d}</div>
      ${dayEvents.map(e => `<div data-action="cal-event-detail" data-event-id="${e.id}" onclick="event.stopPropagation();showCalEventDetail('${e.id}')" style="font-size:10px;background:${e.color || 'var(--accent)'};color:white;border-radius:3px;padding:2px 4px;margin-bottom:2px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${e.title}">${e.title}</div>`).join('')}
      <button data-action="add-cal-event" data-date="${dateStr}" onclick="openAddCalEvent('${dateStr}')" style="width:100%;margin-top:2px;background:none;border:1px dashed var(--border);border-radius:3px;color:var(--text3);font-size:10px;padding:1px 2px;cursor:pointer;opacity:0;">+</button>
    </div>`;
  }

  const upcomingEvents = events.filter(e => e.date >= today.toISOString().slice(0, 10)).slice(0, 5);
  let eventsListHtml = upcomingEvents.length > 0
    ? upcomingEvents.map(e => `<div data-action="cal-event-detail" data-event-id="${e.id}" onclick="showCalEventDetail('${e.id}')" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg3);border-radius:8px;margin-bottom:6px;cursor:pointer;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${e.color || 'var(--accent)'};flex-shrink:0;"></div>
          <div style="font-size:12px;">${e.title}</div>
        </div>
        <div style="font-size:11px;color:var(--text3);">${e.date}</div>
      </div>`).join('')
    : `<div style="color:var(--text3);font-size:12px;text-align:center;padding:16px;">暂无近期事件</div>`;

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <button class="btn btn-secondary btn-sm" onclick="renderCalendarMonth(${prevY},${prevM})">← 上月</button>
      <div style="font-size:16px;font-weight:700;">${monthStr}</div>
      <button class="btn btn-secondary btn-sm" onclick="renderCalendarMonth(${nextY},${nextM})">下月 →</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px;">
      ${['周一','周二','周三','周四','周五','周六','周日'].map(d => `<div style="text-align:center;font-size:11px;color:var(--text3);font-weight:600;padding:6px 0;">${d}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
      ${gridHtml}
    </div>
    <div style="margin-top:16px;">
      <button class="btn btn-secondary btn-sm" onclick="openAddCalEvent()">＋ 添加事件</button>
    </div>
    <div style="margin-top:16px;">
      <div class="section-title" style="margin-bottom:8px;">📌 近期事件</div>
      ${eventsListHtml}
    </div>
  `;

  container.querySelectorAll('[data-action="add-cal-event"]').forEach(btn => {
    btn.addEventListener('mouseenter', () => btn.style.opacity = '1');
    btn.addEventListener('mouseleave', () => btn.style.opacity = '0');
  });
}

function openAddCalEvent(prefillDate) {
  const title = prompt('📅 事件标题：');
  if (!title || !title.trim()) return;
  const date = prefillDate || prompt('📅 日期（YYYY-MM-DD）：');
  if (!date) return;
  const colorMap = { '分红': '#f59e0b', '财报': '#ef4444', '业绩': '#3b82f6', '重要': '#8b5cf6' };
  const color = colorMap[Object.keys(colorMap).find(k => title.includes(k))] || '#64748b';
  const event = { id: uuid(), title: title.trim(), date, color };
  calendarEvents.push(event);
  DB.save('calendar_events_v1', calendarEvents);
  renderCalendar();
}

function showCalEventDetail(eventId) {
  const ev = calendarEvents.find(e => e.id === eventId);
  if (!ev) {
    // 分红等自动生成事件只展示信息
    alert(`${ev?.title || '事件'}\n日期：${evId}`);
    return;
  }
  if (confirm(`📅 ${ev.title}\n📆 日期：${ev.date}\n\n删除此事件？`)) {
    calendarEvents = calendarEvents.filter(e => e.id !== eventId);
    DB.save('calendar_events_v1', calendarEvents);
    renderCalendar();
  }
}

// ============================================================
// VOTE ADVISOR — 大师投票席
// ============================================================

// 虚拟大师配置：每个大师有独特风格、关键词偏好、评分倾向
const INVESTORS = [
  {
    id: 'buffett',
    name: '沃伦·巴菲特',
    avatar: '👴',
    avatarBg: 'linear-gradient(135deg,#b91c1c,#7f1d1d)',
    style: '价值投资 · 护城河理论',
    // 决策框架：能力圈 → 内在价值 → 护城河 → 安全边际
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 能力圈判断 ──
      // 巴菲特明确说过不懂石油/大宗商品期货
      const outOfCircle = /原油|石油|期货|futures|大宗商品|commodit/i.test(text);
      if (outOfCircle && /能源|石油|原油|商品期货/i.test(text)) score -= 2;

      // ── 价值特征加分 ──
      const hasMoat = /护城河|垄断|龙头|定价权|品牌|网络效应|转换成本/i.test(text);
      const hasCashFlow = /现金流|分红|股息|永续|稳健|ROE\s*[>≥]/i.test(text);
      const hasValuation = /PE\s*[<≤]|PB\s*[<≤]|低估值|市盈率\s*[<≤]|市净率\s*[<≤]/i.test(text);

      if (hasMoat) score += 1.5;
      if (hasCashFlow) score += 1;
      if (hasValuation) score += 1;

      // ── 价值陷阱风险扣分 ──
      const isSpeculative = /战争|地缘|题材|概念|热点|情绪|庄家|游资|追涨/i.test(text);
      const isHighLeverage = /高杠杆|杠杆|futures|期货|保证金/i.test(text);
      const isShortTerm = horizon === 'short' || /短线|日内|追涨|杀跌/i.test(text);

      if (isSpeculative) score -= 1.5;
      if (isHighLeverage) score -= 1;
      if (isShortTerm) score -= 1.5;

      // ── 时间周期偏好 ──
      if (horizon === 'long') score += 0.5;

      // ── 绝对禁区 ──
      if (type === 'stock_short') score -= 2; // 巴菲特不做空
      if (/做空|short.*sell|put.*option/i.test(text)) score -= 2;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '强烈看多 · 符合价值投资框架';
      if (score >= 6) return '谨慎关注 · 需验证内在价值';
      if (score >= 4) return '超出能力圈 · 需极度谨慎';
      return '不符合投资原则 · 不参与';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const isCommodity = /原油|石油|期货|大宗商品|能源/i.test(text);
      const hasMoat = /护城河|垄断|品牌|定价权/i.test(text);
      const isSpeculative = /战争|地缘|题材|情绪/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isShort = type === 'stock_short' || type === 'futures_short';

      if (isCommodity) {
        return '巴菲特多次表示不投资自己不懂的大宗商品期货。"我不擅长预测石油价格，这不是我的能力圈。"如果标的能转化为有护城河的商业模式（如能源龙头公司股权），则是另一回事。' + (isFutures ? '\n\n期货合约没有永续现金流，只有到期日和移仓成本——这与巴菲特"买企业股权"的核心逻辑背道而驰。' : '');
      }
      if (isSpeculative && score < 6) {
        return '你描述的是事件驱动的投机逻辑，而非企业内在价值。巴菲特不会基于战争或地缘政治下注。他会问：10年后这家公司的现金流会是什么样子？' + (horizon === 'short' ? '\n\n短线视角下，巴菲特会特别警惕：短期事件驱动往往不可预测，"追涨杀跌"是他最反对的行为之一。' : '');
      }
      if (hasMoat && score >= 6) {
        return '该标的具备持久竞争优势特征。但我需要你能回答：能持续多少年？竞争对手复制它的难度有多大？管理层是否诚信、有能力？' + (horizon === 'short' ? '\n\n但短线视角下，巴菲特的护城河逻辑失效——短期股价由情绪和资金驱动，与护城河无关。' : '');
      }
      if (isShort) {
        return '巴菲特的信条是"做空有无限损失风险"。他不会做空——如果你相信某公司会倒闭，你需要的不只是做空，而是对做空的理由有极致的把握。';
      }
      return '核心问题：你能用一句话描述这家公司的商业模式吗？它的竞争对手为什么不能抢走它的客户？' + (horizon === 'long' ? '巴菲特要求这个答案能经受10年考验。' : horizon === 'short' ? '短线投资者不关心这个问题——但这恰恰是长期超额收益的来源。' : '') + '如果回答不了，巴菲特会说"看不懂就不投"。';
    }
  },
  {
    id: 'munger',
    name: '查理·芒格',
    avatar: '🧓',
    avatarBg: 'linear-gradient(135deg,#b45309,#92400e)',
    style: '逆向思维 · 多学科思维模型',
    // 决策框架：反过来想 → 多元思维模型 → 心理学偏见检测 → 耐心等待
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 逆向思维加分 ──
      const isContrarian = /别人恐惧|逆向|低估|冷门|无人问津|分歧/i.test(text);
      const mentionsWorst = /最坏|最差|极端|最悲观|最坏情况/i.test(text);
      if (isContrarian) score += 2;
      if (mentionsWorst) score += 1.5; // 芒格最爱问最坏情况

      // ── 多元思维模型检测 ──
      const hasLollapalooza = [
        /心理学|认知|偏差|行为|过度自信/i.test(text),   // 心理学模型
        /经济学|供需|边际|激励/i.test(text),            // 经济学模型
        /物理学|均衡|对称|临界/i.test(text),            // 物理学模型
        /历史|周期|重复|规律/i.test(text),              // 历史模型
      ].filter(Boolean).length;
      score += hasLollapalooza * 0.5; // 每个额外维度+0.5

      // ── 常见偏见扣分 ──
      const recencyBias = /最近|刚|刚刚|当前|近期/i.test(text) && /一定|肯定|必然/i.test(text);
      const authorityBias = /专家说|券商|研报|名人|大V/i.test(text) && !/验证|核实|批判/i.test(text);
      const groupthink = /大家都在|热门|赛道|都在买/i.test(text);

      if (recencyBias) score -= 1.5;
      if (authorityBias) score -= 1;
      if (groupthink) score -= 1;

      // ── 能力圈边界 ──
      const complexFinancial = /复杂期权|结构化|嵌套|高杠杆/i.test(text);
      if (complexFinancial) score -= 1;

      // ── 芒格耐心等待特质 ──
      if (/等待|耐心|不急|慢慢来|长期跟踪/i.test(text)) score += 1;

      if (type === 'stock_short') score -= 1;
      if (horizon === 'short') score -= 0.5;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '逆向+多模型 · 值得深入研究';
      if (score >= 6) return '有逻辑 · 需反向验证';
      if (score >= 4) return '需倒过来想 · 谨慎行事';
      return '存在明显认知偏见 · 不建议';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const isContrarian = /别人恐惧|逆向|低估|分歧/i.test(text);
      const mentionsWorst = /最坏|最差|极端|最悲观/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isShort = type === 'stock_short' || type === 'futures_short';
      const isMacro = type === 'macro';

      if (score >= 7) {
        if (isContrarian && mentionsWorst) {
          let reason = '这符合芒格的"逆向思维"：先问"这件事最坏能坏到什么程度？反过来成立的条件是什么？"加上你提到了多个思维维度，这正是芒格所倡导的lollapalooza效应。\n\n';
          if (isFutures) {
            reason += '在期货场景下，芒格会特别追问：这个头寸的最坏情形（价格归零/暴涨）是否有流动性保障？期货展期的成本是否在计算之内？';
          } else if (isShort) {
            reason += '芒格对做空极为谨慎：你是否计算了做空的最大损失（理论上无限）？有没有一个硬性的止损价格？';
          } else if (isMacro) {
            reason += '芒格会结合达里奥的经济机器框架：在衰退/危机情形下，这个宏观头寸的尾部风险有多大？';
          } else {
            reason += '建议用清单思维再过一遍所有可能出错的环节。';
          }
          return reason;
        }
        let reason = '芒格会认可这个逻辑。';
        if (horizon === 'short') {
          reason += '\n\n但短期视角下，他一定会追问：你是否在利用了别人的短期错误认知？这个错误能被快速证伪吗？持有时间越长，越需要基本面支撑。';
        } else if (horizon === 'long') {
          reason += '\n\n长线视角下，他追问的是：10年后这个逻辑还成立吗？是否有被颠覆的可能性（技术变革、监管政策）？';
        } else {
          reason += '\n\n他一定会追问：你是否在利用了别人的错误认知？错误的代价有多大？这个机会的持久性如何？';
        }
        return reason;
      }

      let reason = '按照芒格的方法论，先倒过来想："这个' + (isFutures ? '期货头寸' : isShort ? '做空交易' : '投资') + '最可能失败的10个原因是什么？"\n';
      if (horizon === 'short') {
        reason += '\n短线芒格关注：你是否因为"最近赚钱了"而产生了近因偏差？情绪化决策的可能性有多大？';
      } else {
        reason += '\n芒格曾说"告诉我我会死在哪里，我就不去那里"——这个逻辑能通过这个检验吗？';
      }
      return reason;
    }
  },
  {
    id: 'soros',
    name: '乔治·索罗斯',
    avatar: '🦊',
    avatarBg: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)',
    style: '反身性理论 · 宏观对冲',
    // 决策框架：反身性分析 → 认知偏差 → 趋势强化 → 临界点识别
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 反身性三要素检测 ──
      const hasTrend = /趋势|方向|预期|走势|方向性|上涨|下跌|升值|贬值/i.test(text);
      const hasBias = /市场预期|价格已反映|低估了|高估了|price.in|price is|预期差/i.test(text);
      const hasFeedback = /自我强化|正反馈|负反馈|循环|联动|传导|加剧/i.test(text);

      const reflexivityCount = [hasTrend, hasBias, hasFeedback].filter(Boolean).length;
      score += reflexivityCount * 1.5; // 反身性三要素齐备=满分

      // ── 宏观事件驱动 ──
      const macroEvents = /战争|制裁|政策|利率|汇率|央行|美联储|经济数据|GDP|CPI/i.test(text);
      if (macroEvents) score += 1.5;

      // ── 拐点识别 ──
      const hasPivot = /拐点|转折|临界|突破|崩溃|反转|失衡/i.test(text);
      if (hasPivot) score += 1;

      // ── 静态估值派扣分（与索罗斯相反） ──
      const isStaticAnalysis = /低估值|PE|PB|净资产|DCF|现金流折现/i.test(text) &&
                                !/动态|随|变化|调整/i.test(text);
      if (isStaticAnalysis) score -= 1;

      // ── 时间周期 ──
      if (type === 'macro') score += 1.5;
      if (type === 'arbitrage') score += 1;
      if (horizon === 'long') score -= 0.5; // 索罗斯更关注中期拐点

      // ── 持仓方向 ──
      // 索罗斯做期货/外汇/大宗商品比做股票更出名（1992年做空英镑）
      if (type === 'futures_long' || type === 'futures_short') score += 1;
      if (type === 'stock_long') score += 0.5;
      // ── 做空需要更严格的反身性条件 ──
      if (type === 'stock_short' || type === 'futures_short') {
        // 做空要求更明确的拐点信号
        const hasPivot = /拐点|转折|临界|崩溃|反转|失衡|窟窿|债务危机/i.test(text);
        if (!hasPivot) score -= 1;
      }

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '完美宏观机会 · 反身性逻辑清晰';
      if (score >= 6) return '存在预期差 · 值得检验';
      if (score >= 4) return '缺少反身性条件 · 观望';
      return '静态分析 · 不适合此框架';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const hasTrend = /趋势|预期|方向|上涨|下跌|升值|贬值/i.test(text);
      const hasBias = /低估|高估|price.in|已反映|错误定价|市场预期/i.test(text);
      const hasFeedback = /自我强化|正反馈|循环|联动|传导|加剧/i.test(text);
      const hasPivot = /拐点|转折|临界|突破|崩溃|反转/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isMacro = type === 'macro';
      const isStock = type === 'stock_long' || type === 'stock_short';

      const isFuturesShort = type === 'futures_short';
      const isFuturesLong = type === 'futures_long';
      if (score >= 7) {
        // 期货/宏观专属逻辑
        if (isFutures) {
          let reason = '索罗斯是宏观对冲大师，期货是他最擅长的武器（' + (isFuturesShort ? '1992年做空英镑' : '量子基金在大宗商品/外汇/利率期货上的经典战役') + '）。\n\n';
          reason += '他会问：\n';
          reason += '① 这份期货合约背后的"基本趋势"是什么？（供给/需求/政策/地缘）\n';
          reason += '② 市场当前的偏见是什么？多头还是空头过度乐观/悲观？\n';
          reason += '③ 什么事件会让偏见被纠正——触发临界点？\n\n';
          if (hasTrend && hasBias && hasFeedback) {
            reason += '你已识别反身性三要素（趋势+偏见+反馈）——这是索罗斯最完美的狩猎场。' + (isFuturesShort ? '\n\n做空期货时，临界点尤其重要：你的止损位在哪里？逼仓风险有多高？' : '');
          } else {
            reason += '完善反身性三要素分析：当前趋势、市场偏见、触发纠正的临界事件。';
          }
          return reason;
        }
        // 股票专属逻辑
        if (isStock) {
          let reason = '索罗斯做股票时同样用反身性框架。他会区分个股的"公司基本面"和"市场认知"之间的关系：\n\n';
          reason += '① 公司的"基本趋势"：业绩改善/市场份额扩大/行业整合\n';
          reason += '② 市场对它的"主流偏见"：过度悲观还是过度乐观？\n';
          reason += '③ 什么会让偏见纠正：财报？政策？竞争对手的黑天鹅？\n\n';
          if (hasPivot) {
            reason += '你提到了拐点——索罗斯的经典操作就是在"认知从错误走向正确"的拐点下重注。';
          } else {
            reason += '关注趋势的加速度，而非趋势本身。当市场一致看多时，往往是离场信号。';
          }
          if (horizon === 'long') {
            reason += '\n\n长期视角下，索罗斯的反身性在长期更稳定：企业业绩改善和偏见纠正都需要时间。但要警惕"假拐点"——真正的拐点需要被基本面数据验证。';
          } else if (horizon === 'short') {
            reason += '\n\n短线交易中，反身性窗口很短：市场偏见可能在几天内被纠正。索罗斯短线做的是"情绪拐点"而非"基本面拐点"——你对情绪转折的判断是否足够精准？';
          }
          return reason;
        }
        // 默认（宏观/套利）
        let reason = '索罗斯会问三个核心问题：\n';
        reason += '① 当前的"基本趋势"是什么？（' + (hasTrend ? '✓ 已识别' : '需明确') + '）\n';
        reason += '② 市场参与者的"主流偏见"是什么？（' + (hasBias ? '✓ 已识别' : '需明确') + '）\n';
        reason += '③ 这条偏见通过什么"反馈机制"自我强化或反转？（' + (hasFeedback ? '✓ 已识别' : '需明确') + '）\n\n';
        if (hasPivot) {
          reason += '你提到了拐点——索罗斯特别关注趋势从加速到减速的临界点。';
        } else {
          reason += '关注趋势的加速度，而非趋势本身。当所有人都相信同一个逻辑时，反身性往往接近顶峰。';
        }
      }
      // 低分原因
      if (isFuturesShort) {
        return '索罗斯做空期货要求更高的确定性：你的分析是否有明确的"崩溃触发条件"？没有明确拐点的做空是危险的——期货空头的损失可以是无限的（如果继续逼仓）。索罗斯经典做空案例都有：基本趋势恶化 + 市场偏见极端乐观 + 临界点清晰可识别。';
      }
      if (isFutures) {
        return '你的描述缺乏宏观视角。索罗斯做期货关注的是宏观事件如何改变供需预期，而非技术图形或短期波动。问自己：这个头寸在什么宏观场景下会自我强化？什么会让它反转？';
      }
      if (isStock) {
        return '你的描述缺少反身性视角——只关注了基本面，没有考虑市场认知的变化。问问：市场现在怎么看这家公司？这个看法可能在哪里被证伪？证伪的那一刻会发生什么？';
      }
      return '索罗斯认为"可被认知的真相"和"实际发生的结果"之间存在反身性差距。如果你的分析只看静态基本面（PE、PB），而不考虑市场认知的变化，则缺乏反身性视角。';
    }
  },
  {
    id: 'dalio',
    name: '瑞·达里奥',
    avatar: '🏛️',
    avatarBg: 'linear-gradient(135deg,#0891b2,#164e63)',
    style: '风险平价 · 全天候策略 · 债务周期',
    // 决策框架：经济机器 → 四大情境 → 风险贡献 → 去杠杆信号
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 四大经济情境匹配 ──
      // 上升 + 通胀下降 → 股票/公司债好；上升 + 通胀上升 → 大宗商品/黄金好
      // 下降 + 通胀下降 → 名义债券好；下降 + 通胀上升 → 黄金/通胀保护债券好
      const isRising = /增长|复苏|扩张|GDP上升|经济好转/i.test(text);
      const isFalling = /衰退|下滑|萎缩|放缓|疲软/i.test(text);
      const isInflationary = /通胀|物价|加息|缩表|货币紧缩/i.test(text);
      const isDeflationary = /通缩|降息|宽松|放水|量化宽松/i.test(text);

      const scenarioCount = [isRising, isFalling, isInflationary, isDeflationary].filter(Boolean).length;
      if (scenarioCount >= 2) score += 2; // 明确指定了情境组合
      else if (scenarioCount === 1) score += 1;

      // ── 分散配置加分 ──
      const diversification = /分散|配置|组合|对冲|多资产|风险平价|全天候/i.test(text);
      if (diversification) score += 1.5;

      // ── 黄金/债券（达里奥的最爱） ──
      if (/黄金|gold/i.test(text)) score += 1;
      if (/债券|bond/i.test(text) && !/违约/i.test(text)) score += 0.5;

      // ── 尾部风险意识 ──
      const tailRisk = /黑天鹅|尾部|极端|百年一遇|模型风险/i.test(text);
      if (tailRisk) score += 1;

      // ── 集中/高杠杆扣分 ──
      const isConcentrated = /重仓|all.in|全押|集中|单一/i.test(text) && !/分散/i.test(text);
      const isHighLeverage = /高杠杆|杠杆|futures|期货保证金/i.test(text);
      if (isConcentrated) score -= 1;
      if (isHighLeverage) score -= 1;

      if (type === 'macro') score += 1;
      if (type === 'arbitrage') score += 0.5;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '全天候友好 · 符合风险平价';
      if (score >= 6) return '可纳入组合 · 需评估相关性';
      if (score >= 4) return '风险贡献需评估 · 谨慎规模';
      return '不符合分散原则 · 集中风险过大';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const hasScenario = /上升|下降|通胀|通缩|增长|衰退|宽松|紧缩/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isStock = type === 'stock_long' || type === 'stock_short';
      const isMacro = type === 'macro';

      if (score >= 7) {
        let reason = '达里奥的"经济机器"会问：这个头寸在哪种经济情境下表现最好，在哪种情境下表现最差？\n\n';
        reason += '全天候策略的核心是：不要预测经济，而是为四种情境都做好准备。\n';
        reason += '  ① 上升+通胀↓ → 股票/公司债\n';
        reason += '  ② 上升+通胀↑ → 大宗商品/黄金（' + (isFutures ? '✓ 期货正适合' : '期货正适合') + '）\n';
        reason += '  ③ 下降+通胀↓ → 名义债券\n';
        reason += '  ④ 下降+通胀↑ → 黄金/通胀保护债券\n\n';

        if (isFutures) {
          reason += '你的期货头寸在②或④情境下最有优势：通胀上升期大宗商品走强（②），尾部风险期黄金对冲（④）。';
          if (/黄金|gold/i.test(text)) {
            reason += '\n\n黄金是达里奥"全天候"组合中的核心品种——它既是对冲通胀的工具，也是系统性风险（股市下跌）时的避风港。';
          }
        } else if (isStock) {
          reason += '股票在①情境（经济复苏）下表现最佳。如果你的持仓在衰退+通胀情境（④）下，你需要问自己：这只股票是否有定价权/品牌护城河，能转嫁通胀成本？';
        } else if (isMacro) {
          reason += '宏观策略在达里奥框架下是最高效的：直接押注经济机器的方向，而不是个股或单个资产。';
        }

        if (horizon === 'long') {
          reason += '\n\n长期来看，达里奥最关注的是"去杠杆信号"：债务增速是否超过收入增速？信贷利差是否扩大？这些信号出现时要及时再平衡组合。';
        } else {
          reason += '\n\n请评估：你的头寸在最坏情境下的最大回撤是多少？它对整体组合的风险贡献是否过高？';
        }
        return reason;
      }
      return '达里奥会说：投资的第一原则是"不要亏钱"。你需要系统性地思考：' + (isFutures ? '这个期货头寸在大萧条/流动性危机情形下会发生什么？期货的杠杆会放大损失。' : isStock ? '这个股票头寸在萧条/危机情景下会发生什么？股价往往与基本面脱钩下跌。' : '这个头寸在萧条/危机情景下会发生什么？') + '\n\n达里奥研究历史债务危机发现，大多数人低估了去杠杆时资产的相关性——看似分散的组合实际上高度相关。' + (horizon === 'short' ? '短期交易者往往低估尾部风险，因为你只关注近期数据。"' : '') + '这个分析能通过这个压力测试吗？';
    }
  },
  {
    id: 'simons',
    name: '吉姆·西蒙斯',
    avatar: '🔢',
    avatarBg: 'linear-gradient(135deg,#7c3aed,#4c1d95)',
    style: '量化交易 · 统计套利 · 因子模型',
    // 决策框架：数据检验 → 历史规律 → 因子暴露 → 夏普比率评估
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 可量化因子加分 ──
      const factors = {
        momentum: /动量|momentum|趋势|追涨|突破/i,
        meanReversion: /均值回归|回归|价值|反转|超跌/i,
        volatility: /波动|volatility|风险|波动率|VIX/i,
        carry: /carry|息差|利差|收益率差|carry/i,
        volume: /成交量|量能|换手|volume/i,
        liquidity: /流动性|liquidity|买卖价差|滑点/i,
      };

      let factorCount = 0;
      for (const [name, regex] of Object.entries(factors)) {
        if (regex.test(text)) factorCount++;
      }
      score += factorCount * 0.8;

      // ── 统计规律加分 ──
      const hasStatistics = /历史|统计|回测|样本|数据|规律|频率|概率|均值|分布/i.test(text);
      if (hasStatistics) score += 1.5;

      // ── 可回测性 ──
      const backtestable = /日线|分钟|收盘|开盘|技术指标|均线|MACD|RSI/i.test(text);
      if (backtestable) score += 1;

      // ── 套利机会加分 ──
      if (type === 'arbitrage') score += 1.5;

      // ── 多空方向区分 ──
      // 动量因子（追涨）→ 适合做多；均值回归因子（反转）→ 适合做空
      const hasMomentum = /动量|momentum|趋势|追涨|突破/i.test(text);
      const hasMeanReversion = /均值回归|回归|价值|反转|超跌/i.test(text);
      if (type === 'stock_long' || type === 'futures_long') {
        if (hasMomentum) score += 0.5;
        if (hasMeanReversion) score -= 0.5; // 做多时均值回归逻辑较弱
      }
      if (type === 'stock_short' || type === 'futures_short') {
        if (hasMeanReversion) score += 0.5;
        if (hasMomentum) score -= 0.5; // 做空时动量逻辑较弱
      }

      // ── 主观判断扣分 ──
      const isPureFundamental = /我认为|我觉得|相信|感觉|直觉|基本面改善/i.test(text) &&
                                  !/数据|统计|历史|验证/i.test(text);
      if (isPureFundamental) score -= 1;

      // ── 情绪驱动扣分 ──
      const isSentimentDriven = /情绪|热点|题材|庄家|游资|概念/i.test(text) && !/量化|统计/i.test(text);
      if (isSentimentDriven) score -= 1;

      if (horizon === 'short') score += 1;
      if (horizon === 'long') score -= 0.5;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '量化友好 · 因子逻辑清晰';
      if (score >= 6) return '可量化验证 · 建议回测';
      if (score >= 4) return '主观成分重 · 量化难验证';
      return '无统计规律 · 不适合量化';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const hasStatistics = /历史|统计|回测|样本|数据|规律/i.test(text);
      const hasFactors = /动量|均值|波动|carry|成交量|流动性/i.test(text);
      const hasMomentum = /动量|momentum|趋势|追涨|突破/i.test(text);
      const hasMeanReversion = /均值回归|回归|价值|反转|超跌/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isStock = type === 'stock_long' || type === 'stock_short';
      const isShort = type === 'stock_short' || type === 'futures_short';
      const isLong = type === 'stock_long' || type === 'futures_long';

      if (score >= 7) {
        let reason = '西蒙斯的文艺复兴科技公司依靠统计模型在毫秒级市场波动中获利。他的核心问题：\n\n';
        reason += '① 是否有足够的历史样本？（至少需要几百个独立观测点）\n';
        reason += '② 夏普比率够不够？（西蒙斯要求>1.5，理想>2.0）\n';
        reason += '③ 样本外表现是否与样本内一致？（过拟合是最大风险）\n';
        reason += '④ 相关性是否稳定？（很多"规律"只在特定市场状态下有效）\n\n';

        if (isFutures) {
          reason += '【期货量化要点】\n';
          reason += 'CTA策略（趋势跟随）：适合有明确方向的期货品种，关注商品期货的动量因子。\n';
          reason += '展期收益率（Roll Yield）：期货近月/远月价差也是可量化的收益来源。\n';
          reason += '库存周期：农产品/工业品库存数据是量化信号的重要来源。\n';
          if (hasMomentum) reason += '\n你提到了动量因子——这是期货量化最经典的方向。';
          if (hasMeanReversion) reason += '\n均值回归在期货跨品种套利中很有效（如螺纹钢/热卷价差）。';
        } else if (isStock) {
          if (hasFactors) {
            reason += '你提到了具体因子——这是量化策略的好苗头。但需要做完整的因子分析：IC序列、换手率成本、最大回撤。\n';
            if (isLong && hasMomentum) {
              reason += '\n做多时，动量因子最有效——追涨处于上升趋势的股票。';
            }
            if (isShort && hasMeanReversion) {
              reason += '\n做空时，均值回归因子最有效——做空那些严重超买的股票。';
            }
          }
        } else {
          reason += '你提到了具体因子——这是量化策略的好苗头。但需要做完整的因子分析：IC序列、换手率成本、最大回撤。';
        }
        return reason;
      }

      let reason = '西蒙斯曾说"有效市场假说是错的，但也没有那么错"。\n\n';
      if (isFutures) {
        reason += '期货市场有大量可量化的价格行为（持仓量变化、库存报告影响、跨期价差），但纯粹主观判断宏观事件对期货的影响，不构成量化优势。';
      } else if (isShort) {
        reason += '做空对量化模型的要求更高：做空收益来自下跌，但下跌的速度和幅度往往比上涨更难预测。';
      } else {
        reason += '如果你这个想法纯粹来自主观判断或新闻事件，而没有数据支撑，那对量化策略来说就是噪音。';
      }
      reason += '\n\n西蒙斯会问：你的edge（优势）在哪里？是可以被重复验证的吗？' + (horizon === 'short' ? '短周期量化更容易找到稳定规律，建议从高频数据入手做回测。' : horizon === 'long' ? '长周期量化面临样本稀少问题——历史上可能没有足够的独立事件来验证你的假设。' : '先做回测，让数据说话。');
      return reason;
    }
  },
  {
    id: 'lynch',
    name: '彼得·林奇',
    avatar: '🎸',
    avatarBg: 'linear-gradient(135deg,#be123c,#881337)',
    style: '成长股投资 · 身边机会 · PEG法则',
    // 决策框架：身边观察 → 渗透率 → PEG → 六种股票类型分类
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 身边观察加分 ──
      const fromLife = /我身边|我看到|我去|我朋友|我同事|我家人|生活中|身边|身边观察/i.test(text);
      if (fromLife) score += 2;

      // ── 渗透率思维（林奇核心） ──
      const penetrationThinking = /渗透率|刚开始|早期|导入期|成长期|渗透|占有率|市场份额/i.test(text);
      if (penetrationThinking) score += 1.5;

      // ── 成长性特征 ──
      const growthSignals = /营收增长|利润增|开店|扩张|连锁|渗透|用户增|复购/i.test(text);
      if (growthSignals) score += 1.5;

      // ── PEG合理性 ──
      const hasPEG = /peg|市盈率.*增长|PE.*增速|估值.*增速/i.test(text);
      if (hasPEG) score += 1;

      // ── 股票类型匹配 ──
      // 快速增长型：大行业小公司；稳定增长型：大公司稳健
      const fastGrower = /小店|小市值|新上市|连锁扩张|渗透率低/i.test(text);
      const stableGrower = /龙头|稳健|持续|成熟|蓝筹/i.test(text);
      if (fastGrower) score += 1;
      if (stableGrower) score += 0.5;

      // ── 林奇厌恶的类型 ──
      const isCyclicalTop = /周期顶部|产能过剩|夕阳|大宗|原材料|油价|大宗商品/i.test(text);
      const isAssetPlay = /土地|资产|拆迁|赔偿|一次性|账面/i.test(text);
      if (isCyclicalTop) score -= 2; // 林奇最讨厌周期股
      if (isAssetPlay) score -= 1;

      // ── 时间周期 ──
      if (horizon === 'long') score += 1;
      if (type === 'stock_long') score += 0.5;

      // ── 期货/大宗商品绝对禁区 ──
      if (/原油|石油|期货|futures|大宗商品|黄金.*期货/i.test(text)) score -= 3;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '绝佳成长机会 · 值得重仓';
      if (score >= 6) return '成长逻辑存在 · 需跟踪验证';
      if (score >= 4) return '成长性存疑 · 非此策略方向';
      return '不符合成长股框架 · 不参与';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const fromLife = /身边|生活中|我看到|我去/i.test(text);
      const penetration = /渗透率|早期|成长期|导入/i.test(text);
      const isCommodity = /原油|石油|期货|大宗|能源|商品/i.test(text);
      const isCyclical = /周期|产能|原材料/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isShort = type === 'stock_short' || type === 'futures_short';
      const isStock = type === 'stock_long' || type === 'stock_short';

      if (isCommodity) {
        let reason = '林奇曾直言不讳："大宗商品期货是投资者的坟墓。"他投资的是有血有肉的企业，而不是一堆会过期的合约。\n\n';
        if (isFutures) {
          reason += '他无法预测石油价格——但他可以理解一家连锁加油站的运营模式如何随油价波动而变化。';
        }
        reason += '\n如果你对能源行业有观点，林奇的方式是：\n';
        reason += '① 投资能源公司的股票（而非期货合约）——这样没有到期日，不需要移仓\n';
        reason += '② 找有品牌/特许经营权的能源下游企业（如管道、加油站网络）——它们能转嫁油价波动\n';
        reason += '③ 关注股息和现金流，而非期货合约的到期价差\n\n';
        reason += '期货合约有时间成本（移仓损耗），林奇关注的永续竞争优势在这里不存在。';
        return reason;
      }
      if (isCyclical && score < 5) {
        return '周期股在行业顶部时往往是最危险的——所有人都知道需求旺盛，所有人都扩张产能。林奇会问：现在行业产能利用率是多少？接下来3年有多少新增产能要投产？这个增长是真实的还是昙花一现？' + (isShort ? '\n\n做空周期股是林奇认可的策略——在产能扩张高峰期做空往往有安全边际。但需要严格止损，因为周期股的顶部往往比预期更久。' : '');
      }
      if (score >= 7) {
        let reason = '林奇最成功的投资来自他身边的生活观察。';
        if (fromLife) reason += '你提到从身边观察到，这一点完全符合林奇的方法论。';
        reason += '\n\n林奇会继续问：\n';
        reason += '① 你认识的使用这个产品/服务的人多吗？（渗透率判断）\n';
        reason += '② 公司是以什么速度在扩张？（开店速度、营收增速）\n';
        reason += '③ PEG是多少？（PE除以增速，越<1越有吸引力）\n';
        reason += '④ 这是什么类型的成长股？（6种分类：缓慢、稳定、快速、周期性、资产型、反转型）';

        if (isShort) {
          reason += '\n\n林奇对做空比较保守：做空意味着你相信某件事会让这家公司倒闭，这比买进要求更高的确定性。';
        } else if (horizon === 'short') {
          reason += '\n\n但短线和林奇格格不入——他的方法需要时间去验证渗透率和成长逻辑。短线投资者不给你这个时间。';
        }
        return reason;
      }
      return '林奇曾说："在你买股票之前，先问问自己：我能详细描述这家公司做什么吗？如果不能，就不要买。"' + (isFutures ? '\n\n期货合约更无法回答这个问题——你无法用一句话描述一桶原油的价值驱动因素。' : '') + '\n这个逻辑能否通过这个检验？';
    }
  },
  {
    id: 'zhang',
    name: '章盟主',
    avatar: '🐉',
    avatarBg: 'linear-gradient(135deg,#ea580c,#9a3412)',
    style: '顶级游资 · 龙头战法 · 情绪周期',
    // 决策框架：情绪周期定位 → 龙头识别 → 筹码结构 → 仓位管理
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 龙头战法核心 ──
      const isDragonHead = /龙头|龙一|市场龙头|板块龙头|灵魂股|情绪龙头/i.test(text);
      const isNotDragon = /跟风|补涨|后排|边缘|杂毛|蹭概念/i.test(text);
      if (isDragonHead) score += 2.5;
      if (isNotDragon) score -= 2;

      // ── 情绪周期定位 ──
      const emotionCycle = /情绪|赚钱效应|短线周期|情绪冰点|情绪高潮|回暖|退潮|分歧|一致/i.test(text);
      if (emotionCycle) score += 2;

      // ── 题材逻辑加分 ──
      const themeLogic = /题材|主题|板块|消息面|政策|事件驱动/i.test(text);
      if (themeLogic) score += 1.5;

      // ── 涨停板关注点 ──
      const boardSignals = /涨停|连板|一字板|换手板|缩量|放量|竞价|情绪共振/i.test(text);
      if (boardSignals) score += 1;

      // ── 筹码结构 ──
      const chipStructure = /筹码|抛压|套牢盘|解放|成本|均线|筹码峰/i.test(text);
      if (chipStructure) score += 1;

      // ── 基本面派扣分 ──
      const isValueInvestor = /低估值|PE|PB|分红|价值|内在价值|护城河/i.test(text) &&
                               !/情绪|题材|龙头/i.test(text);
      if (isValueInvestor) score -= 1.5;

      // ── 短线优势明显 ──
      if (horizon === 'short') score += 2;
      if (type === 'stock_short') score += 1; // 做空在短线中更常见
      if (type === 'stock_long') score -= 0.5; // 长线不符合龙头战法

      // ── 高风险警示 ──
      const isRisky = /重仓|满仓|all.in|梭哈|一把梭/i.test(text);
      if (isRisky) score -= 0.5;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '龙头机会！情绪到位可重仓';
      if (score >= 6) return '有戏！注意情绪周期节奏';
      if (score >= 4) return '题材一般，跟随为主不格局';
      return '无情绪驱动 · 不适合龙头战法';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const isDragon = /龙头|龙一|板块龙头|情绪龙头/i.test(text);
      const hasEmotion = /情绪|周期|赚钱效应|冰点|高潮|分歧/i.test(text);
      const hasChip = /筹码|抛压|换手|套牢盘/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isShort = type === 'stock_short' || type === 'futures_short';

      if (score >= 7) {
        let reason = '章盟主的核心战法是"看长做短"——看透资金博弈的本质，在情绪最激烈的阶段精准介入。\n\n';
        reason += '他会依次问：\n';
        reason += '① 现在处于情绪周期的哪个阶段？（' + (hasEmotion ? '✓ 已识别' : '需明确') + '）\n';
        reason += '② 龙头是谁？跟风是谁？（' + (isDragon ? '✓ 已识别龙头' : '需明确龙头') + '）\n';
        reason += '③ 筹码结构如何？（' + (hasChip ? '✓ 已关注' : '需关注') + '）\n';

        if (isFutures) {
          reason += '\n【期货短线要点】\n';
          reason += '期货和股票短线最大区别：期货有夜盘联动——外盘商品（黄金、原油、农产品）夜盘跳空是常见风险点。\n';
          reason += '多空主力博弈：关注期货公司席位净多头/净空头变化，以及升贴水结构（contango vs backwardation）的切换。\n';
          reason += 'COIN换手率：持仓量（OI）变化比成交量更重要——OI增加说明有新资金推动趋势；OI减少意味着趋势可能结束。\n';
          reason += isShort ? '做空在期货短线中很常见，但要注意：期货空头的最大风险是逼仓（short squeeze），尤其是流动性差的品种。' : '期货短线口诀：看外盘定价，看内盘情绪。';
        } else if (isShort) {
          reason += '\n做空在A股短线中较难——A股散户多、情绪化，做空机制不完善（融券成本高）。不建议散户短线做空。';
        } else {
          reason += '\n短线核心口诀：弱市不做连板，强市拥抱龙头。情绪高潮期不追，情绪冰点期不慌。';
        }
        return reason;
      }
      return '龙头战法讲究"只在最确定的时候下重注"。章盟主会问：这个位置追进去，止损设哪里？预期收益空间有多大？' + (isFutures ? '期货短线还要问：夜盘外盘跳空风险有多大？升贴水结构对持仓是否有利？' : '') + '如果情绪退潮，这个故事的逻辑能支撑几个板？短线交易的核心是风险收益比，不是方向对错。';
    }
  },
  {
    id: 'zuoxi',
    name: '作手新一',
    avatar: '⚡',
    avatarBg: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
    style: '新生代游资 · 情绪周期 · 主线思维',
    // 决策框架：主线确认 → 情绪节奏 → 预期差 → 止损纪律
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 主线思维（作手新一最强调的） ──
      const isMainLine = /主线|主升浪|主流|核心主线|资金主线/i.test(text);
      const notMainLine = /边缘|非主流|支线|一日游|快速轮动/i.test(text);
      if (isMainLine) score += 2.5;
      if (notMainLine) score -= 2;

      // ── 预期差（作手新一的核心词） ──
      const hasExpectDiff = /预期差|分歧|认知差|预期不同|市场低估|市场误解/i.test(text);
      if (hasExpectDiff) score += 2;

      // ── 情绪阶段判断 ──
      const emotionPhase = {
        start: /启动|初升|点火|开始|第一波|萌芽/i,
        peak: /高潮|加速|疯狂|一致|泡沫|顶部/i,
        decline: /退潮|回落|衰退|补跌|滞涨/i,
        bottom: /冰点|绝望|底部|超跌|反弹|回暖/i,
      };
      for (const [phase, regex] of Object.entries(emotionPhase)) {
        if (regex.test(text)) score += 1;
      }

      // ── 止损纪律加分（成熟的标志） ──
      const hasStopLoss = /止损|风控|控仓|分批|纪律|回撤控制|亏损|容错/i.test(text);
      if (hasStopLoss) score += 1;

      // ── 长线持有扣分 ──
      const isLongOnly = /长线|长期持有|价值投资|买了不动|等价值回归/i.test(text);
      if (isLongOnly) score -= 1.5;

      // ── 短线有利 ──
      if (horizon === 'short') score += 1.5;
      if (horizon === 'medium') score += 0.5;
      if (type === 'stock_short') score += 0.5;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '主线明确！情绪上升期积极参与';
      if (score >= 6) return '情绪逻辑存在，注意节奏';
      if (score >= 4) return '非主线方向，控仓观望';
      return '缺少主线逻辑，耐心等待';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const isMainLine = /主线|主流|核心主线/i.test(text);
      const hasExpDiff = /预期差|分歧|认知差|误解/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isShort = type === 'stock_short' || type === 'futures_short';
      const isMacro = type === 'macro';

      if (score >= 7) {
        let reason = '作手新一的核心理念："只在主线里操作，只在分歧时买入，在一致时卖出。"\n\n';
        reason += '他会依次判断：\n';
        reason += '① 这是不是当前市场的主线？（' + (isMainLine ? '✓ 符合' : '需确认') + '）\n';
        reason += '② 市场对它的预期差在哪里？（' + (hasExpDiff ? '✓ 已识别' : '需明确') + '）\n';
        reason += '③ 现在是情绪周期的哪个阶段？（启动/加速/高潮/退潮）\n';

        if (isFutures) {
          reason += '\n【期货作手要点】\n';
          reason += '宏观事件驱动的短期爆发：地缘/政策/数据公布后，等分歧出现（分歧越大预期差越大），在一致时离场。\n';
          reason += '库存周期：期货库存由增转减（基本面改善）往往对应价格拐点——这是期货主线的核心信号。\n';
          reason += isShort ? '做空期货时，关注供需拐点：库存积压+需求萎缩=做空安全边际更高。' : '做多期货时，关注库存去化和需求旺季叠加的时机。';
        } else if (isShort) {
          reason += '\n做空个股：基本面恶化是前提，但时机靠情绪——等"一致看多"的情绪顶点出现时做空，止损设在创新高的位置。';
        } else if (isMacro) {
          reason += '\n宏观机会：主线逻辑更强，关注全球资金流向的切换节点。';
        } else {
          reason += '\n短线核心口诀：弱市不做连板，强市拥抱龙头。情绪高潮期不追，情绪冰点期不慌。';
        }
        return reason;
      }
      return '作手新一会说：市场的主线只有一个。当前的方向是不是主线？不是主线就不值得重仓。其次，有没有预期差？预期差是超额收益的来源。' + (isFutures ? '期货没有基本面锚定，更依赖情绪周期——当所有资金都在一个方向时，反转风险急剧上升。' : '') + '如果市场已经充分认知这个机会，那它往往已经price in了。';
    }
  },
  {
    id: 'fang',
    name: '方新侠',
    avatar: '🦅',
    avatarBg: 'linear-gradient(135deg,#0369a1,#0c4a6e)',
    style: '价值游资 · 基本面+情绪共振 · 双击策略',
    // 决策框架：基本面验证 → 预期差识别 → 情绪共振确认 → 三击验证
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 基本面因子 ──
      const fundamentalFactors = {
        valuation: /估值|PE|PB|低估值|合理估值|便宜/i,
        earnings: /业绩|利润|营收|增长|超预期|财报/i,
        industry: /行业|赛道|景气度|政策支持|行业空间/i,
        quality: /ROE|毛利率|护城河|龙头|竞争力|壁垒/i,
      };

      let fundCount = 0;
      for (const [name, regex] of Object.entries(fundamentalFactors)) {
        if (regex.test(text)) fundCount++;
      }
      score += fundCount * 0.8;

      // ── 情绪因子 ──
      const emotionFactors = /题材|情绪|热点|龙头|连板|资金|换手/i.test(text);
      if (emotionFactors) score += 1.5;

      // ── 共振（方新侠的核心追求） ──
      const resonance = /共振|双击|基本面.*情绪|业绩.*题材|戴维斯双击|底部.*涨停/i.test(text);
      if (resonance) score += 2.5;

      // ── 预期差（基本面部分） ──
      const fundExpectDiff = /业绩超预期|行业反转|困境反转|底部反转|被错杀|预期修复/i.test(text);
      if (fundExpectDiff) score += 1.5;

      // ── 纯题材扣分（方新侠不喜欢） ──
      const pureMomentum = /纯题材|无业绩|亏损|垃圾股|讲故事|商誉/i.test(text) &&
                           !/困境反转|基本面改善|业绩修复/i.test(text);
      if (pureMomentum) score -= 2;

      // ── 短线 vs 长线 ──
      if (horizon === 'medium') score += 1;
      if (horizon === 'long') score += 0.5;
      if (type === 'stock_long') score += 0.5;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '双击机会！基本面+情绪完美共振';
      if (score >= 6) return '逻辑扎实，可适度参与';
      if (score >= 4) return '逻辑不够完整，需更多验证';
      return '缺基本面支撑，谨慎参与';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const hasFundamental = /业绩|估值|行业|ROE|护城河|基本面|供需|库存|宏观/i.test(text);
      const hasEmotion = /题材|情绪|热点|龙头|资金/i.test(text);
      // 期货共振：库存+供需+宏观三重共振
      const hasResonance = /共振|双击|基本面.*情绪|业绩.*题材|库存.*供需|供需.*宏观|库存.*宏观/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isStock = type === 'stock_long' || type === 'stock_short';
      const isShort = type === 'stock_short' || type === 'futures_short';

      if (score >= 7) {
        if (isFutures) {
          let reason = '方新侠的"基本面+情绪共振"框架同样适用于期货。期货的"基本面"是供需平衡表、库存周期、宏观驱动因素；"情绪"是资金对供需预期的认知偏差。\n\n';
          reason += '他会问：\n';
          reason += '① 基本面改善的驱动因素是什么？（供给收缩？需求爆发？政策干预？）\n';
          reason += '② 市场当前对供需的认知是否存在偏差？（' + (hasFundamental ? '✓ 你已识别' : '需明确') + '）\n';
          reason += '③ 情绪/资金是否认可这个逻辑？（' + (hasEmotion ? '✓ 已识别' : '需明确') + '）\n';
          reason += '④ 两者是否共振？（' + (hasResonance ? '✓ 已识别' : '需明确') + '）\n\n';
          reason += isShort
            ? '【做空共振】库存积压+需求萎缩+宏观看空=基本面超买+情绪高亢。做空安全边际：库存爆满+期货升水+投机多头持仓历史高位时，三者共振最明确。'
            : '期货双击：高库存+低价格+宏观利好预期 = 基本面超卖 + 情绪修复。';
          return reason;
        }
        if (isStock) {
          let reason = '方新侠追求的是"基本面+情绪双击"——这是A股最暴利的策略形态。\n\n';
          reason += '他会构建一个验证清单：\n';
          reason += '【基本面层】\n';
          reason += '  ① 业绩是否在趋势性改善？（' + (/业绩|利润|营收/i.test(text) ? '✓ 已识别' : '需补充') + '）\n';
          reason += '  ② 估值是否存在预期差？（' + (/估值|PE|低估值/i.test(text) ? '✓ 已识别' : '需补充') + '）\n';
          reason += '  ③ 行业/赛道景气度如何？（' + (/行业|赛道|政策/i.test(text) ? '✓ 已识别' : '需补充') + '）\n\n';
          reason += '【情绪层】\n';
          reason += '  ① 是否有题材催化剂？（' + (hasEmotion ? '✓ 已识别' : '需补充') + '）\n';
          reason += '  ② 资金认可度如何？（' + (/龙头|连板|换手|资金/i.test(text) ? '✓ 已识别' : '需补充') + '）\n\n';
          reason += '【共振检验】两个逻辑是否互相强化？（' + (hasResonance ? '✓ 已识别' : '需明确') + '）';

          if (isShort) {
            reason += '\n\n【做空逻辑】方新侠做空时：基本面恶化是前提（业绩下滑/行业景气度下降），情绪高点（所有人都在买）= 最佳做空时机。';
          } else if (horizon === 'long') {
            reason += '\n\n长线视角下，方新侠更关注：业绩改善趋势能否持续3-5年？管理层是否有执行力？估值扩张的空间有多大？';
          }
          return reason;
        }
        // 默认（宏观/套利/基金）
        let reason = '方新侠的方法论在宏观和套利场景下同样适用。核心是"找到被市场错误定价的认知差 + 等待情绪认可这个认知差被纠正"。\n\n';
        reason += '【共振检验】\n';
        reason += '  ① 基本面改善的逻辑是否清晰？（' + (hasFundamental ? '✓ 已识别' : '需补充') + '）\n';
        reason += '  ② 情绪/资金是否开始认可？（' + (hasEmotion ? '✓ 已识别' : '需补充') + '）\n';
        reason += '  ③ 两者是否共振？（' + (hasResonance ? '✓ 已识别' : '需明确') + '）';
        return reason;
      }
      if (isFutures) {
        return '方新侠做期货同样追求双击：期货的"基本面"是库存/供需/宏观，"情绪"是资金对预期的认知偏差。如果基本面没有改善预期，或情绪不认可这个逻辑，就缺少共振，机会有限。';
      }
      return '方新侠最不能接受的是"纯题材、无业绩"——这种标的缺乏基本面锚定，上涨逻辑脆弱，容易被证伪。他的理想标的是：① 基本面已经或即将改善 ② 市场情绪认可这个改善逻辑 ③ 估值存在预期差。如果缺少任何一个维度，都要降低预期。';
    }
  },
  // ============================================================
  // 第10位：我的知识库 — 基于用户个人知识库内容的虚拟分析师
  // ============================================================
  {
    id: 'mykb',
    name: '我的知识库',
    avatar: '📚',
    avatarBg: 'linear-gradient(135deg,#0ea5e9,#0369a1)',
    style: '个人知识库 · 基于历史积累的分析框架',
    // 决策框架：读取知识库 → 关键词匹配 → 分类加权 → 综合评分
    judge(text, type, horizon) {
      const knowledgeBase = DB.load('knowledge_v1', []);
      if (knowledgeBase.length === 0) return 5; // 知识库为空时给中性评分

      const lowerText = text.toLowerCase();
      let score = 5;
      let matchCount = 0;
      let totalRelevance = 0;

      // 从知识库中匹配相关条目
      knowledgeBase.forEach(entry => {
        const entryText = ((entry.title || '') + ' ' + (entry.content || '') + ' ' + (entry.tags || '').join(' ')).toLowerCase();
        let entryScore = 0;

        // 计算文本相似度（关键词匹配）
        const textWords = lowerText.split(/\s+|[,，。；;、]+/).filter(w => w.length >= 2);
        const entryWords = entryText.split(/\s+|[,，。；;、]+/).filter(w => w.length >= 2);

        // 计算共同关键词数量
        const commonWords = textWords.filter(w => entryWords.some(ew => ew.includes(w) || w.includes(ew)));
        const relevance = commonWords.length;

        if (relevance > 0) {
          matchCount++;
          totalRelevance += relevance;

          // 根据分类调整评分
          const category = (entry.category || '').toLowerCase();
          if (category.includes('投资理念') || category.includes('investment')) {
            // 投资理念类知识：如果文本符合理念，加分
            entryScore += relevance * 0.5;
          } else if (category.includes('技术分析') || category.includes('tech')) {
            // 技术分析类：如果文本中有技术词汇，加分
            const techWords = /突破|支撑|阻力|均线|MACD|KDJ|RSI|量能|金叉|死叉/i;
            if (techWords.test(text)) entryScore += relevance * 0.3;
          } else if (category.includes('宏观经济') || category.includes('macro')) {
            // 宏观类：如果文本涉及宏观因素，加分
            const macroWords = /利率|通胀|GDP|CPI|货币政策|美联储|央行|汇率/i;
            if (macroWords.test(text)) entryScore += relevance * 0.4;
          } else if (category.includes('心得体会') || category.includes('experience')) {
            // 心得体会：基于历史经验的警示
            entryScore += relevance * 0.3;
          }

          // 根据条目标签进一步调整
          if (entry.tags && Array.isArray(entry.tags)) {
            entry.tags.forEach(tag => {
              if (lowerText.includes(tag.toLowerCase())) {
                entryScore += 1;
              }
            });
          }
        }

        score += entryScore;
      });

      // 如果有匹配的知识点，根据匹配数量调整
      if (matchCount > 0) {
        const avgRelevance = totalRelevance / matchCount;
        // 匹配度越高，评分越有依据（偏离中性的幅度越大）
        const deviation = (score - 5) * Math.min(avgRelevance / 10, 1.5);
        score = 5 + deviation;
      } else {
        // 没有匹配的知识，给中性偏保守的评分
        score = 4.5;
      }

      // 类型调整
      if (type === 'stock_short' && !/做空|short/i.test(text)) score -= 1;
      if (type === 'futures_short' && !/做空|short/i.test(text)) score -= 1;

      // 时间周期调整
      if (horizon === 'short') score -= 0.5; // 知识库更适合长线
      if (horizon === 'long') score += 0.5;

      return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
    },
    getVerdict(score) {
      const knowledgeBase = DB.load('knowledge_v1', []);
      if (knowledgeBase.length === 0) return '知识库为空，暂无参考框架';
      if (score >= 8) return '高度吻合知识库积累 · 强烈推荐';
      if (score >= 6) return '符合知识库部分逻辑 · 可参考';
      if (score >= 4) return '与知识库积累偏离 · 需谨慎';
      return '与知识库逻辑相悖 · 建议回避';
    },
    getReason(text, score, type, horizon) {
      const knowledgeBase = DB.load('knowledge_v1', []);
      if (knowledgeBase.length === 0) {
        return '📚 您的知识库目前为空。\n\n建议：在"个人知识库"页面记录您的投资理念、成功经验、失败教训，这样"我的知识库"分析师可以基于您的积累给出更精准的建议。';
      }

      const lowerText = text.toLowerCase();
      let matchedEntries = [];

      // 找出最相关的知识条目（取前3条）
      const entryScores = knowledgeBase.map(entry => {
        const entryText = ((entry.title || '') + ' ' + (entry.content || '') + ' ' + (entry.tags || '').join(' ')).toLowerCase();
        let relevance = 0;
        const textWords = lowerText.split(/\s+|[,，。；;、]+/).filter(w => w.length >= 2);
        const entryWords = entryText.split(/\s+|[,，。；;、]+/).filter(w => w.length >= 2);
        textWords.forEach(w => {
          if (entryWords.some(ew => ew.includes(w) || w.includes(ew))) {
            relevance++;
          }
        });
        return { ...entry, relevance };
      }).filter(e => e.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 3);

      if (entryScores.length === 0) {
        return '📚 未找到与当前策略相关的知识库记录。\n\n这可能是您尚未记录相关领域的投资知识，建议：\n① 在"个人知识库"中添加相关主题的知识\n② 重新审视当前策略是否在有充分认知的领域内';
      }

      let reason = '📚 基于您的知识库分析：\n\n';
      reason += '【相关知识条目】\n';
      entryScores.forEach((entry, idx) => {
        reason += `${idx + 1}. 《${entry.title}》(${entry.category || '未分类'}) — 相关度：${entry.relevance}\n`;
        // 截取内容摘要
        const summary = (entry.content || '').slice(0, 80) + ((entry.content || '').length > 80 ? '...' : '');
        reason += `   ${summary}\n`;
      });

      reason += '\n【综合判断】\n';
      if (score >= 7) {
        reason += '当前策略与您的知识积累高度吻合，知识库中的相关经验支持这个方向。';
      } else if (score >= 5) {
        reason += '当前策略与知识库中的部分逻辑一致，但仍有需要验证的点。';
      } else {
        reason += '当前策略与您的知识积累存在偏离，建议参考知识库中的相关经验重新审视。';
      }

      if (horizon === 'short') {
        reason += '\n\n💡 短线视角：知识库中的经验多来自中长期实践，短线决策需额外关注市场情绪和资金流向。';
      }
      if (horizon === 'long') {
        reason += '\n\n💡 长线视角：这正是知识库经验最能发挥作用的场景，建议深入参考相关条目中的逻辑。';
      }

      return reason;
    }
  }
];

function renderVoteCardsPending() {
  const grid = document.getElementById('vote-investors-grid');
  grid.innerHTML = INVESTORS.map(inv => `
    <div class="vote-investor-card pending">
      <div class="vote-investor-header">
        <div class="vote-investor-avatar" style="background:${inv.avatarBg};">${inv.avatar}</div>
        <div>
          <div class="vote-investor-name">${inv.name}</div>
          <div class="vote-investor-style">${inv.style}</div>
        </div>
        <div style="margin-left:auto;">
          <span class="vote-investor-tag" style="background:rgba(148,163,184,0.15);color:var(--text3);">待分析</span>
        </div>
      </div>
      <div class="vote-investor-verdict" style="color:var(--text3);">等待输入头寸...</div>
      <div class="vote-investor-score-wrap">
        <div class="vote-investor-score-bar">
          <div class="vote-investor-score-fill" style="width:0%;background:var(--text3);"></div>
        </div>
        <div class="vote-investor-score-num" style="color:var(--text3);">--</div>
      </div>
      <div class="vote-investor-reason" style="color:var(--text3);">💬 请在上方输入头寸想法，点击按钮开始分析</div>
    </div>
  `).join('');
  document.getElementById('vote-summary-bar').style.display = 'none';
}

function runVote() {
  const text = document.getElementById('vote-position').value.trim();
  const type = document.getElementById('vote-type').value;
  const horizon = document.getElementById('vote-horizon').value;

  // 如果没有输入，显示待分析状态
  if (!text) {
    renderVoteCardsPending();
    return;
  }

  // 每个大师评分
  const results = INVESTORS.map(inv => {
    const score = inv.judge(text, type, horizon);
    const verdict = inv.getVerdict(score);
    const reason = inv.getReason(text, score, type, horizon);
    let sentiment;
    if (score >= 7) sentiment = 'bullish';
    else if (score <= 4) sentiment = 'bearish';
    else sentiment = 'neutral';
    return { ...inv, score, verdict, reason, sentiment };
  });

  // 汇总统计
  const avgScore = results.reduce((a, r) => a + r.score, 0) / results.length;
  const bullCount = results.filter(r => r.sentiment === 'bullish').length;
  const bearCount = results.filter(r => r.sentiment === 'bearish').length;
  const neutralCount = results.filter(r => r.sentiment === 'neutral').length;
  const consensus = avgScore >= 7 ? '强烈看多' : avgScore >= 5.5 ? '谨慎看多' : avgScore >= 4 ? '中性观望' : avgScore >= 2.5 ? '谨慎看空' : '强烈看空';
  const consensusColor = avgScore >= 7 ? 'var(--red)' : avgScore >= 4 ? 'var(--yellow)' : 'var(--green)';

  // 渲染汇总条
  const tiltBull = Math.round(bullCount / results.length * 5);
  const tiltBar = Array.from({length:5}, (_, i) => {
    if (i < tiltBull) return '<div class="vote-tilt-dot" style="background:var(--red);"></div>';
    return '<div class="vote-tilt-dot" style="background:var(--bg4);"></div>';
  }).join('');

  document.getElementById('vote-summary-bar').innerHTML = `
    <div class="vote-summary-bar" style="border-left:4px solid ${consensusColor};">
      <div class="vote-summary-score">
        <div class="vote-summary-score-num" style="color:${consensusColor};">${avgScore.toFixed(1)}</div>
        <div class="vote-summary-score-label">综合评分</div>
      </div>
      <div class="vote-summary-verdict" style="color:${consensusColor};">${consensus}</div>
      <div class="vote-tilt-indicator">
        <span style="color:var(--red);">${bullCount}多</span>
        ${tiltBar}
        <span style="color:var(--green);">${bearCount}空</span>
      </div>
      <div style="font-size:11px;color:var(--text3);min-width:60px;text-align:right;">${results.length}位大师投票</div>
    </div>
  `;

  // 渲染大师卡片（按评分排序）
  results.sort((a, b) => b.score - a.score);
  document.getElementById('vote-investors-grid').innerHTML = results.map(r => {
    const fillColor = r.sentiment === 'bullish' ? 'var(--red)' : r.sentiment === 'bearish' ? 'var(--green)' : 'var(--text3)';
    const sentimentLabel = r.sentiment === 'bullish' ? '看多' : r.sentiment === 'bearish' ? '看空' : '中性';
    const sentimentBg = r.sentiment === 'bullish' ? 'rgba(239,68,68,0.15)' : r.sentiment === 'bearish' ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)';
    return `<div class="vote-investor-card ${r.sentiment}">
      <div class="vote-investor-header">
        <div class="vote-investor-avatar" style="background:${r.avatarBg};">${r.avatar}</div>
        <div>
          <div class="vote-investor-name">${r.name}</div>
          <div class="vote-investor-style">${r.style}</div>
        </div>
        <div style="margin-left:auto;">
          <span class="vote-investor-tag" style="background:${sentimentBg};color:${fillColor};">${sentimentLabel}</span>
        </div>
      </div>
      <div class="vote-investor-verdict" style="color:${fillColor};">${r.verdict}</div>
      <div class="vote-investor-score-wrap">
        <div class="vote-investor-score-bar">
          <div class="vote-investor-score-fill" style="width:${r.score * 10}%;background:${fillColor};"></div>
        </div>
        <div class="vote-investor-score-num" style="color:${fillColor};">${r.score.toFixed(1)}</div>
      </div>
      <div class="vote-investor-reason">💬 ${r.reason}</div>
    </div>`;
  }).join('');

  document.getElementById('vote-result').style.display = '';
  document.getElementById('vote-history-panel').style.display = 'none';

  // 显示保存按钮
  document.getElementById('btn-save-vote').style.display = '';

  // 保存当前投票数据到全局变量，供保存函数使用
  window._currentVoteData = {
    text, type, horizon,
    results,
    avgScore, bullCount, bearCount, neutralCount
  };

  // 切换到当前投票 tab
  switchVoteTab('current');
}

// 保存当前投票到历史
function saveCurrentVote() {
  if (!window._currentVoteData) return;
  const data = window._currentVoteData;

  const record = {
    id: uuid(),
    text: data.text,
    type: data.type,
    horizon: data.horizon,
    createdAt: new Date().toISOString(),
    avgScore: data.avgScore,
    bullCount: data.bullCount,
    bearCount: data.bearCount,
    neutralCount: data.neutralCount,
    investors: data.results.map(r => ({
      id: r.id,
      name: r.name,
      avatar: r.avatar,
      avatarBg: r.avatarBg,
      style: r.style,
      score: r.score,
      verdict: r.verdict,
      sentiment: r.sentiment
    }))
  };

  voteHistory.unshift(record); // 最新在前
  DB.save('voteHistory_v1', voteHistory);

  // 隐藏保存按钮
  document.getElementById('btn-save-vote').style.display = 'none';

  // 更新历史计数
  updateVoteHistoryCount();

  // 提示
  showToast('投票已保存到历史记录');
}

// 切换投票 Tab
function switchVoteTab(tab) {
  currentVoteTab = tab;
  document.querySelectorAll('#vote-tabs .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.voteTab === tab);
  });

  if (tab === 'current') {
    document.getElementById('vote-result').style.display = '';
    document.getElementById('vote-history-panel').style.display = 'none';
  } else {
    document.getElementById('vote-result').style.display = 'none';
    document.getElementById('vote-history-panel').style.display = '';
    renderVoteHistory();
  }
}

// 更新历史记录计数
function updateVoteHistoryCount() {
  const count = voteHistory.length;
  document.getElementById('vote-history-count').textContent = count > 0 ? `(${count})` : '';
}

// 渲染历史记录
function renderVoteHistory() {
  const panel = document.getElementById('vote-history-panel');

  if (voteHistory.length === 0) {
    panel.innerHTML = `
      <div class="empty-state">
        <div class="icon">📜</div>
        <div class="title">暂无历史记录</div>
        <div class="desc">投票后点击「保存此投票」即可保存到历史记录</div>
      </div>
    `;
    return;
  }

  const typeMap = {
    stock_long: '📈 股票多头',
    stock_short: '📉 股票空头',
    futures_long: '📦 期货多头',
    futures_short: '📦 期货空头',
    fund_buy: '🏦 买入私募',
    fund_sell: '🏦 赎回私募',
    macro: '🌍 宏观/大类',
    arbitrage: '⚖️ 套利/对冲'
  };
  const horizonMap = {
    short: '⚡ 短线',
    medium: '📅 中线',
    long: '🏔️ 长线'
  };

  panel.innerHTML = voteHistory.map(record => {
    const consensusColor = record.avgScore >= 7 ? 'var(--red)' : record.avgScore >= 4 ? 'var(--yellow)' : 'var(--green)';
    const consensus = record.avgScore >= 7 ? '强烈看多' : record.avgScore >= 5.5 ? '谨慎看多' : record.avgScore >= 4 ? '中性观望' : record.avgScore >= 2.5 ? '谨慎看空' : '强烈看空';
    const date = new Date(record.createdAt).toLocaleString('zh-CN');

    return `
      <div class="vote-history-item" data-vote-id="${record.id}">
        <div class="vote-history-header">
          <div class="vote-history-score" style="color:${consensusColor};">${record.avgScore.toFixed(1)}</div>
          <div class="vote-history-info">
            <div class="vote-history-text">${escapeHtml(record.text.slice(0, 100))}${record.text.length > 100 ? '...' : ''}</div>
            <div class="vote-history-meta">
              <span>${typeMap[record.type] || record.type}</span>
              <span>·</span>
              <span>${horizonMap[record.horizon] || record.horizon}</span>
              <span>·</span>
              <span>${date}</span>
            </div>
          </div>
          <div class="vote-history-actions">
            <button class="btn btn-secondary btn-sm" onclick="loadVoteFromHistory('${record.id}')">查看详情</button>
            <button class="btn btn-secondary btn-sm" style="color:var(--red);" onclick="deleteVoteHistory('${record.id}')">删除</button>
          </div>
        </div>
        <div class="vote-history-summary">
          <span style="color:${consensusColor};font-weight:600;">${consensus}</span>
          <span style="color:var(--text3);margin-left:8px;">${record.bullCount}多 · ${record.neutralCount}中 · ${record.bearCount}空</span>
        </div>
      </div>
    `;
  }).join('');
}

// 从历史加载投票
function loadVoteFromHistory(id) {
  const record = voteHistory.find(r => r.id === id);
  if (!record) return;

  // 恢复输入
  document.getElementById('vote-position').value = record.text;
  document.getElementById('vote-type').value = record.type;
  document.getElementById('vote-horizon').value = record.horizon;

  // 渲染卡片
  renderVoteInvestorsFromHistory(record);

  // 切换到当前投票 tab
  switchVoteTab('current');

  // 隐藏保存按钮（已保存过的）
  document.getElementById('btn-save-vote').style.display = 'none';

  showToast('已加载历史投票');
}

// 渲染历史投票的大师卡片
function renderVoteInvestorsFromHistory(record) {
  const consensusColor = record.avgScore >= 7 ? 'var(--red)' : record.avgScore >= 4 ? 'var(--yellow)' : 'var(--green)';
  const consensus = record.avgScore >= 7 ? '强烈看多' : record.avgScore >= 5.5 ? '谨慎看多' : record.avgScore >= 4 ? '中性观望' : record.avgScore >= 2.5 ? '谨慎看空' : '强烈看空';

  const bullCount = record.bullCount;
  const bearCount = record.bearCount;
  const tiltBull = Math.round(bullCount / record.investors.length * 5);
  const tiltBar = Array.from({length:5}, (_, i) => {
    if (i < tiltBull) return '<div class="vote-tilt-dot" style="background:var(--red);"></div>';
    return '<div class="vote-tilt-dot" style="background:var(--bg4);"></div>';
  }).join('');

  document.getElementById('vote-summary-bar').innerHTML = `
    <div class="vote-summary-bar" style="border-left:4px solid ${consensusColor};">
      <div class="vote-summary-score">
        <div class="vote-summary-score-num" style="color:${consensusColor};">${record.avgScore.toFixed(1)}</div>
        <div class="vote-summary-score-label">综合评分</div>
      </div>
      <div class="vote-summary-verdict" style="color:${consensusColor};">${consensus}</div>
      <div class="vote-tilt-indicator">
        <span style="color:var(--red);">${bullCount}多</span>
        ${tiltBar}
        <span style="color:var(--green);">${bearCount}空</span>
      </div>
      <div style="font-size:11px;color:var(--text3);min-width:60px;text-align-right;">${record.investors.length}位大师投票</div>
    </div>
  `;
  document.getElementById('vote-summary-bar').style.display = '';

  document.getElementById('vote-investors-grid').innerHTML = record.investors.map(r => {
    const fillColor = r.sentiment === 'bullish' ? 'var(--red)' : r.sentiment === 'bearish' ? 'var(--green)' : 'var(--text3)';
    const sentimentLabel = r.sentiment === 'bullish' ? '看多' : r.sentiment === 'bearish' ? '看空' : '中性';
    const sentimentBg = r.sentiment === 'bullish' ? 'rgba(239,68,68,0.15)' : r.sentiment === 'bearish' ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)';
    return `<div class="vote-investor-card ${r.sentiment}">
      <div class="vote-investor-header">
        <div class="vote-investor-avatar" style="background:${r.avatarBg};">${r.avatar}</div>
        <div>
          <div class="vote-investor-name">${r.name}</div>
          <div class="vote-investor-style">${r.style}</div>
        </div>
        <div style="margin-left:auto;">
          <span class="vote-investor-tag" style="background:${sentimentBg};color:${fillColor};">${sentimentLabel}</span>
        </div>
      </div>
      <div class="vote-investor-verdict" style="color:${fillColor};">${r.verdict}</div>
      <div class="vote-investor-score-wrap">
        <div class="vote-investor-score-bar">
          <div class="vote-investor-score-fill" style="width:${r.score * 10}%;background:${fillColor};"></div>
        </div>
        <div class="vote-investor-score-num" style="color:${fillColor};">${r.score.toFixed(1)}</div>
      </div>
      <div class="vote-investor-reason" style="color:var(--text3);">💬 (历史记录)</div>
    </div>`;
  }).join('');

  document.getElementById('vote-result').style.display = '';
  document.getElementById('vote-history-panel').style.display = 'none';
}

// 删除历史记录
function deleteVoteHistory(id) {
  if (!confirm('确定删除这条历史记录？')) return;
  voteHistory = voteHistory.filter(r => r.id !== id);
  DB.save('voteHistory_v1', voteHistory);
  updateVoteHistoryCount();
  renderVoteHistory();
  showToast('已删除');
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Toast 提示
function showToast(msg) {
  const existing = document.getElementById('vote-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'vote-toast';
  toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:10000;opacity:0;transition:opacity 0.3s;';
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.style.opacity = '1');
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function refreshCurrentPage() {
  if (currentPage === 'pe-fund') renderPEFund();
  if (currentPage === 'stock') renderStock();
  if (currentPage === 'futures') renderFutures();
  if (currentPage === 'articles') renderArticles();
  if (currentPage === 'attribution') renderAttribution();
  if (currentPage === 'calendar') renderCalendar();
}

// ============================================================
// UTILS
// ============================================================
function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function fmt(num, digits = 2) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return Number(num).toFixed(digits);
}

function fmtWan(num) {
  if (!num && num !== 0) return '--';
  return fmt(num, 2) + '万';
}

function fmtPct(num) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  const sign = num >= 0 ? '+' : '';
  return sign + fmt(num * 100, 2) + '%';
}

function pnlClass(val) {
  if (!val && val !== 0) return '';
  if (val > 0) return 'pnl-positive'; // 正收益红色（A股惯例）
  if (val < 0) return 'pnl-negative'; // 负收益绿色
  return '';
}

// ============================================================
// PERFORMANCE CALC ENGINE（基于历史净值序列）
// ============================================================

/**
 * 计算绩效指标（基于净值序列）
 * navHistory: [{ date: '2024-01-01', nav: 1.0000 }, ...]
 * startNav: 起始净值（第一笔申购时的净值，用于计算相对收益）
 * rfRate: 无风险利率（年化，默认 0.03）
 */
function calcPerformance(fund, rfRate = 0.03) {
  const navs = (fund.navHistory || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (navs.length < 2) return null;

  const n = navs.length;
  const dividends = fund.dividends || [];

  // 计算每条记录的累计净值
  const cumulativeNavs = navs.map(p => {
    // 优先使用导入时存储的累计净值
    if (p.cumNav != null) {
      return { date: p.date, nav: p.nav, cumNav: p.cumNav };
    }
    if (p.type === 'cumulative') {
      return { date: p.date, nav: p.nav, cumNav: p.nav };
    }
    // 单位净值：加上该日期及之前已分红的复权收益
    let cumNav = p.nav;
    dividends.forEach(d => {
      if (d.date <= p.date) {
        cumNav += d.perShare;
      }
    });
    return { date: p.date, nav: p.nav, cumNav };
  });

  // 计算日收益率序列（使用累计净值）
  const dailyReturns = [];
  for (let i = 1; i < n; i++) {
    const r = (cumulativeNavs[i].cumNav - cumulativeNavs[i-1].cumNav) / cumulativeNavs[i-1].cumNav;
    dailyReturns.push(r);
  }

  if (dailyReturns.length < 2) return null;

  // 1. 总收益率（使用累计净值）
  const totalReturn = (cumulativeNavs[n-1].cumNav - cumulativeNavs[0].cumNav) / cumulativeNavs[0].cumNav;

  // 2. 年化收益率（按实际天数）
  const firstDate = new Date(navs[0].date);
  const lastDate = new Date(navs[n-1].date);
  const days = Math.max(1, (lastDate - firstDate) / 86400000);
  const years = days / 365;
  const annualizedReturn = years > 0 ? Math.pow(1 + totalReturn, 1/years) - 1 : 0;

  // 3. 波动率（年化）
  const meanDaily = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const varianceDaily = dailyReturns.reduce((a, r) => a + Math.pow(r - meanDaily, 2), 0) / dailyReturns.length;
  const volDaily = Math.sqrt(varianceDaily);
  const annualizedVol = volDaily * Math.sqrt(252);

  // 4. 夏普比率
  const sharpe = annualizedVol > 0 ? (annualizedReturn - rfRate) / annualizedVol : 0;

  // 5. 最大回撤（使用累计净值计算，结果为负数表示亏损）
  let peak = cumulativeNavs[0].cumNav;
  let maxDrawdown = 0;
  let maxDDDate = cumulativeNavs[0].date;
  cumulativeNavs.forEach(p => {
    if (p.cumNav >= peak) {
      peak = p.cumNav;
    } else {
      const dd = (p.cumNav - peak) / peak;
      if (dd < maxDrawdown) {
        maxDrawdown = dd;
        maxDDDate = p.date;
      }
    }
  });

  // 6. 卡玛比率 = 年化收益 / |最大回撤|（最大回撤是负数，所以用 annualizedReturn / -maxDrawdown）
  const calmar = maxDrawdown < 0 ? annualizedReturn / (-maxDrawdown) : 0;

  // 7. 信息比率（需要基准，这里简化用组合波动率代替）
  const excessReturn = annualizedReturn;
  const infoRatio = annualizedVol > 0 ? excessReturn / annualizedVol : 0;

  // 8. 计算年化分红收益率（如果有分红）
  const batches = fund.batches || [];
  const latestNav = fund.latestNav || cumulativeNavs[n-1].cumNav;
  let totalDivReceived = 0;
  batches.forEach(b => {
    const shares = Number(b.amount) / Number(b.costNav);
    dividends.forEach(d => {
      if (d.date >= (b.date || '')) totalDivReceived += Number(d.perShare) * shares;
    });
  });
  // 投入本金
  const totalCost = batches.reduce((a, b) => a + Number(b.amount), 0);
  const divYieldAnnual = totalCost > 0 && years > 0
    ? (totalDivReceived / totalCost) / years : 0;

  // 9. 正收益天数占比
  const positiveDays = dailyReturns.filter(r => r > 0).length;
  const positiveRate = dailyReturns.length > 0 ? positiveDays / dailyReturns.length : 0;

  return {
    totalReturn,
    annualizedReturn,
    annualizedVol,
    sharpe,
    maxDrawdown,
    maxDDDate,
    calmar,
    infoRatio,
    divYieldAnnual,
    positiveRate,
    navCount: n,
    startDate: navs[0].date,
    endDate: navs[n-1].date,
    years: years.toFixed(2),
  };
}

// ============================================================
// FUND CALC ENGINE
// ============================================================

/**
 * 计算某基金某批次的收益
 * 浮动盈亏 = 当前市值 - 成本市值（随净值变动，未结算）
 * 已实现盈亏 = 分红 + 退出时结算的盈亏（已兑现）
 * 业绩报酬 = 对浮动和已实现正收益部分均计提（持仓中也提，退出时结算）
 * 持仓份额 = 原始份额 - 已退出份额（仅对部分退出有效）
 */
function calcBatch(batch, latestNav, dividends, perfFeeRate = 0) {
  const amount = Number(batch.amount) || 0;       // 申购金额（万元）
  const costNav = Number(batch.costNav) || 1;     // 成本净值
  // 部分退出时，已退出份额单独记录；全额退出时 exitNav != null
  const exitShares = Number(batch.exitShares) || 0;
  const origShares = amount / costNav;
  const remainingShares = Math.max(0, origShares - exitShares);
  // 如果全部退出（exitNav != null 且已无剩余份额），则份额和成本为0
  // 是否完全退出（exitNav 存在则表示该批次已全部退出，份额归零）
  const isExited = batch.exitNav != null && batch.exitNav !== '';
  const shares = isExited ? 0 : remainingShares;
  const costTotal = isExited ? 0 : remainingShares * costNav;
  const evalNav = isExited ? Number(batch.exitNav) : (Number(latestNav) || costNav);

  // 浮动盈亏 = (当前净值 - 成本净值) × 剩余份额（只有未退出批次才算浮动）
  const floatingGain = isExited ? 0 : (evalNav - costNav) * shares;

  // 分红收益 = 仅统计申购日期之后发生的分红
  const batchDate = batch.date || '1900-01-01';
  let divGain = 0;
  (dividends || []).forEach(div => {
    if (div.date >= batchDate) {
      // 已退出：用原始份额计算历史分红（分红在退出前发生）
      // 未退出：用剩余份额计算
      const shares = isExited ? origShares : remainingShares;
      divGain += Number(div.perShare) * shares;
    }
  });

  // 退出时资本利得（用于计算已实现盈亏和业绩报酬）
  const exitCapitalGain = isExited ? (evalNav - costNav) * origShares : 0;

  // 已实现盈亏 = 退出时资本利得 + 分红（退出才计入；未退出只有分红）
  const realizedGain = isExited ? exitCapitalGain + divGain : divGain;

  // 业绩报酬：对已实现和浮动正收益均计提（退出时用退出净值算；持仓中用当前净值算）
  const capitalGain = isExited ? exitCapitalGain : floatingGain;
  const perfFee = Math.max(0, capitalGain) * perfFeeRate;

  // 总盈亏 = 浮动 + 已实现 - 业绩报酬
  const totalGain = floatingGain + realizedGain;
  const netGain = totalGain - perfFee;
  const totalGainPct = costTotal > 0 ? netGain / costTotal : 0;

  return {
    shares,
    costTotal,
    floatingGain,    // 浮动盈亏（万元）
    divGain,         // 分红收益（万元）
    realizedGain,    // 已实现盈亏（万元）
    perfFee,         // 业绩报酬（万元）
    totalGain,       // 总盈亏（万元，计提前）
    netGain,         // 净盈亏（万元，计提后）
    totalGainPct,
    evalNav,
    costNav,
    isExited
  };
}

/**
 * 计算整只基金汇总
 */
function calcFund(fund) {
  const batches = fund.batches || [];
  const dividends = fund.dividends || [];
  const latestNav = Number(fund.latestNav) || 0;
  const perfFeeRate = (Number(fund.perfFee) || 0) / 100;

  let totalCost = 0, totalShares = 0;
  let totalFloating = 0, totalDivGain = 0, totalRealized = 0;
  let totalPerfFee = 0, totalRealizedPerfFee = 0;

  batches.forEach(b => {
    const r = calcBatch(b, latestNav, dividends, perfFeeRate);
    console.log('批次计算:', b.id, '日期:', b.date, 'exitNav:', b.exitNav, 'exitNav!=null:', b.exitNav != null, 'isExited:', r.isExited, '浮动:', r.floatingGain, '分红:', r.divGain, '已实现:', r.realizedGain);
    totalCost += r.costTotal;
    totalShares += r.shares;
    totalFloating += r.floatingGain;
    totalDivGain += r.divGain;
    totalRealized += r.realizedGain;
    totalPerfFee += r.perfFee;
    // 仅已退出批次产生的业绩报酬（来自资本利得）
    if (r.isExited) totalRealizedPerfFee += r.perfFee;
  });

  const totalGain = totalFloating + totalRealized;  // 总盈亏（浮动+已实现）
  const netGain = totalGain - totalPerfFee;         // 计提后净收益
  const totalGainPct = totalCost > 0 ? netGain / totalCost : 0;
  const avgCostNav = totalShares > 0 ? totalCost / totalShares : 0;

  return {
    totalCost,
    totalShares,
    totalFloating,
    totalDivGain,
    totalRealized,
    totalGain,
    totalPerfFee,
    totalRealizedPerfFee,  // 仅来自已退出批次的业绩报酬
    netGain,
    totalGainPct,
    avgCostNav,
    latestNav
  };
}

// ============================================================
// STOCK — CALC
// ============================================================
function calcStock(stock) {
  const trades = stock.trades || [];
  if (trades.length === 0) return { qty: 0, avgCost: 0, avgCostTotal: 0, realizedGain: 0, currentValue: 0, floatingGain: 0, netGain: 0, buyQty: 0, sellQty: 0 };

  // 买入/卖出汇总
  let buyTotal = 0, buyQty = 0, sellTotal = 0, sellQty = 0;
  trades.forEach(t => {
    if (t.type === 'buy') { buyTotal += t.price * t.qty; buyQty += t.qty; }
    if (t.type === 'sell') { sellTotal += t.price * t.qty; sellQty += t.qty; }
  });
  const holdQty = buyQty - sellQty; // 持仓数量
  const avgCost = holdQty > 0 ? buyTotal / buyQty : 0; // 持仓成本均价
  const avgCostTotal = avgCost * holdQty;
  const currentPrice = Number(stock.price) || 0;
  const currentValue = holdQty * currentPrice; // 市值
  const floatingGain = currentValue - avgCostTotal; // 浮动盈亏
  const realizedGain = sellTotal - (sellQty * avgCost); // 已实现盈亏（卖出收益 - 卖出部分的成本）
  return { qty: holdQty, avgCost, avgCostTotal, realizedGain, currentValue, floatingGain, netGain: floatingGain + realizedGain, buyQty, sellQty };
}

function getStockStats() {
  const holding = stocks.filter(s => s.status === 'holding');
  const sold = stocks.filter(s => s.status === 'sold');
  const totalValue = holding.reduce((a, s) => a + (calcStock(s).currentValue || 0), 0);
  const totalFloat = holding.reduce((a, s) => a + (calcStock(s).floatingGain || 0), 0);
  const totalRealized = [...holding, ...sold].reduce((a, s) => a + (calcStock(s).realizedGain || 0), 0);
  return { totalValue, totalFloat, totalRealized, netGain: totalFloat + totalRealized };
}

function renderStockStats() {
  const stats = getStockStats();
  const pnlClass = n => n >= 0 ? 'profit-pos' : 'profit-neg';
  document.getElementById('stat-stock-value').textContent = fmtWan(stats.totalValue);
  document.getElementById('stat-stock-float').innerHTML = `<span class="${pnlClass(stats.totalFloat)}">${stats.totalFloat >= 0 ? '+' : ''}${fmtWan(stats.totalFloat)}</span>`;
  document.getElementById('stat-stock-realized').innerHTML = `<span class="${pnlClass(stats.totalRealized)}">${stats.totalRealized >= 0 ? '+' : ''}${fmtWan(stats.totalRealized)}</span>`;
  document.getElementById('stat-stock-pnl').innerHTML = `<span class="${pnlClass(stats.netGain)}">${stats.netGain >= 0 ? '+' : ''}${fmtWan(stats.netGain)}</span>`;
}

function renderStockList() {
  renderStockStats();
  const filtered = stocks.filter(s => s.status === currentStockTab);
  const area = document.getElementById('stock-list-area');
  if (filtered.length === 0) {
    const emptyText = currentStockTab === 'holding' ? '暂无持仓股票' : currentStockTab === 'watchlist' ? '暂无自选股票' : '暂无已卖出记录';
    area.innerHTML = `<div class="empty-state"><div class="icon">${currentStockTab === 'holding' ? '📈' : '⭐'}</div><div class="title">${emptyText}</div><div class="desc">点击右上角"新增"添加股票</div></div>`;
    return;
  }
  const pnlClass = n => n >= 0 ? 'profit-pos' : 'profit-neg';
  area.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">` +
    filtered.map(s => {
      const calc = calcStock(s);
      const marketVal = calc.currentValue;
      const floatGain = calc.floatingGain;
      const floatPct = calc.avgCostTotal > 0 ? (floatGain / calc.avgCostTotal * 100) : 0;
      return `<div class="card" data-stock-id="${s.id}" style="cursor:pointer;" onclick="openStockDetail('${s.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div>
            <div style="font-weight:700;font-size:14px;">${s.name}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">${s.code} · ${s.market}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px;font-weight:600;">¥${fmt(s.price, 2)}</div>
            <div style="font-size:11px;color:var(--text3);">成本 ¥${fmt(calc.avgCost, 2)}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px;">
          <div style="text-align:center;padding:6px;background:var(--bg3);border-radius:6px;">
            <div style="font-size:10px;color:var(--text3);">持仓</div>
            <div style="font-size:13px;font-weight:600;">${calc.qty}</div>
          </div>
          <div style="text-align:center;padding:6px;background:var(--bg3);border-radius:6px;">
            <div style="font-size:10px;color:var(--text3);">市值</div>
            <div style="font-size:13px;font-weight:600;">${fmtWan(marketVal)}</div>
          </div>
          <div style="text-align:center;padding:6px;background:var(--bg3);border-radius:6px;">
            <div style="font-size:10px;color:var(--text3);">浮动</div>
            <div style="font-size:13px;font-weight:600;" class="${pnlClass(floatGain)}">${floatGain >= 0 ? '+' : ''}${fmtWan(floatGain)}</div>
          </div>
        </div>
        ${calc.qty > 0 ? `<div style="font-size:11px;color:${floatGain >= 0 ? 'var(--red)' : 'var(--green)'};">${floatGain >= 0 ? '+' : ''}${fmtPct(floatPct)}</div>` : ''}
        <div style="display:flex;gap:6px;margin-top:8px;" onclick="event.stopPropagation()">
          <button class="btn btn-success btn-sm" style="flex:1;" data-action="stock-buy" data-stock-id="${s.id}">买入</button>
          <button class="btn btn-secondary btn-sm" style="flex:1;" data-action="stock-sell" data-stock-id="${s.id}" ${calc.qty <= 0 ? 'disabled' : ''}>卖出</button>
          <button class="btn btn-danger btn-sm" data-action="stock-delete" data-stock-id="${s.id}">删</button>
        </div>
      </div>`;
    }).join('') + '</div>';

  // 交易记录
  const allTrades = stocks.flatMap(s => (s.trades || []).map(t => ({ ...t, stockName: s.name, stockId: s.id })));
  allTrades.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const tradeArea = document.getElementById('stock-trade-list');
  if (allTrades.length === 0) {
    tradeArea.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0;">暂无交易记录</div>';
  } else {
    tradeArea.innerHTML = `<table class="batch-table"><thead><tr><th>日期</th><th>股票</th><th>方向</th><th>价格</th><th>数量</th><th>金额</th><th>备注</th></tr></thead><tbody>` +
      allTrades.slice(0, 30).map(t => `<tr>
        <td>${t.date || '--'}</td>
        <td>${t.stockName}</td>
        <td style="color:${t.type === 'buy' ? 'var(--green)' : 'var(--red)'};font-weight:600;">${t.type === 'buy' ? '买入' : '卖出'}</td>
        <td>¥${fmt(t.price, 2)}</td>
        <td>${t.qty}</td>
        <td>${fmtWan(t.price * t.qty)}</td>
        <td style="color:var(--text3);font-size:11px;">${t.note || '--'}</td>
      </tr>`).join('') + '</tbody></table>';
  }
}

// 股票卡片点击 → 打开详情面板（不再用 alert）
function openStockDetail(stockId) {
  openStockDetailPanel(stockId);
}

// STOCK CRUD
let currentStockId = null;
let currentStockTradeId = null;

function openAddStock() { currentStockId = null; document.getElementById('modal-stock-title').textContent = '📈 新增股票'; document.getElementById('stock-code').value = ''; document.getElementById('stock-name').value = ''; document.getElementById('stock-price').value = ''; document.getElementById('stock-cost').value = ''; document.getElementById('stock-quantity').value = ''; document.getElementById('stock-market').value = 'A股'; document.getElementById('stock-note').value = ''; document.getElementById('stock-edit-hint').style.display = 'none'; openModal('modal-stock'); }

function openEditStock(stockId) {
  const s = stocks.find(x => x.id === stockId);
  if (!s) return;
  currentStockId = stockId;
  document.getElementById('modal-stock-title').textContent = '✏️ 编辑股票';
  document.getElementById('stock-code').value = s.code || '';
  document.getElementById('stock-name').value = s.name || '';
  document.getElementById('stock-price').value = s.price || '';
  document.getElementById('stock-cost').value = '';
  document.getElementById('stock-quantity').value = '';
  document.getElementById('stock-market').value = s.market || 'A股';
  document.getElementById('stock-note').value = s.note || '';
  document.getElementById('stock-edit-hint').innerHTML = '💡 编辑基本信息不会影响交易记录，如需录入新交易请点击卡片内的"买入/卖出"按钮。';
  document.getElementById('stock-edit-hint').style.display = '';
  openModal('modal-stock');
}

function saveStock() {
  const code = document.getElementById('stock-code').value.trim();
  const name = document.getElementById('stock-name').value.trim();
  const price = parseFloat(document.getElementById('stock-price').value) || 0;
  const market = document.getElementById('stock-market').value;
  const note = document.getElementById('stock-note').value.trim();
  if (!code || !name) { alert('请填写股票代码和名称'); return; }

  if (currentStockId) {
    const idx = stocks.findIndex(x => x.id === currentStockId);
    if (idx >= 0) { stocks[idx] = { ...stocks[idx], code, name, price, market, note }; }
  } else {
    stocks.push({ id: uuid(), code, name, market, status: 'watchlist', price, note, trades: [], createdAt: new Date().toISOString() });
  }
  DB.save('stocks_v2', stocks);
  closeModal('modal-stock');
  renderStockList();
}

function deleteStock(stockId) {
  const s = stocks.find(x => x.id === stockId);
  if (!s || !confirm(`确定删除股票"${s.name}"？所有交易记录将一并删除。`)) return;
  stocks = stocks.filter(x => x.id !== stockId);
  DB.save('stocks_v2', stocks);
  renderStockList();
}

function openStockTrade(stockId, type) {
  const s = stocks.find(x => x.id === stockId);
  if (!s) return;
  currentStockTradeId = stockId;
  const t = type === 'buy' ? '买入' : '卖出';
  document.getElementById('modal-stock-trade-title').textContent = `📝 ${s.name} — ${t}`;
  document.getElementById('stock-trade-type').value = type;
  document.getElementById('stock-trade-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('stock-trade-price').value = s.price || '';
  document.getElementById('stock-trade-qty').value = '';
  document.getElementById('stock-trade-note').value = '';
  document.getElementById('stock-trade-preview').textContent = '';
  openModal('modal-stock-trade');
}

function updateStockTradePreview() {
  const price = parseFloat(document.getElementById('stock-trade-price').value) || 0;
  const qty = parseInt(document.getElementById('stock-trade-qty').value) || 0;
  const type = document.getElementById('stock-trade-type').value;
  const total = price * qty;
  const preview = document.getElementById('stock-trade-preview');
  if (!price || !qty) { preview.textContent = ''; return; }
  preview.innerHTML = `💡 ${type === 'buy' ? '买入' : '卖出'}成交额：<strong>¥${fmt(total, 2)}</strong>（${price}元 × ${qty}股）`;
}

function saveStockTrade() {
  const stock = stocks.find(x => x.id === currentStockTradeId);
  if (!stock) return;
  const type = document.getElementById('stock-trade-type').value;
  const date = document.getElementById('stock-trade-date').value;
  const price = parseFloat(document.getElementById('stock-trade-price').value);
  const qty = parseInt(document.getElementById('stock-trade-qty').value);
  const note = document.getElementById('stock-trade-note').value.trim();
  if (!date || isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) { alert('请填写完整的交易信息'); return; }

  stock.trades = stock.trades || [];
  stock.trades.push({ id: uuid(), type, date, price, qty, note });

  // 自动更新当前价
  if (type === 'buy') stock.price = price;

  // 自动判断状态
  const calc = calcStock(stock);
  if (calc.qty > 0) stock.status = 'holding';
  else if (stock.status === 'holding') stock.status = 'sold';

  DB.save('stocks_v2', stocks);
  closeModal('modal-stock-trade');
  renderStockList();
}

// ============================================================
// FUTURES — CALC
// ============================================================
function calcFutures(f) {
  const trades = f.trades || [];
  if (trades.length === 0) return { qty: 0, avgCost: 0, margin: 0, floatGain: 0, realizedGain: 0, netGain: 0, openQty: 0, closeQty: 0 };

  // 按时间排序后处理
  const sorted = [...trades].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let holdQty = 0, costAccum = 0, realizedGain = 0;
  const mult = Number(f.multiplier) || 1;
  const dir = f.direction || 'long';

  sorted.forEach(t => {
    if (t.type === 'open') {
      holdQty += t.qty;
      costAccum += t.price * t.qty * mult;
    } else {
      // 平仓
      const closeVal = t.price * t.qty * mult;
      const costVal = holdQty > 0 ? costAccum / holdQty * t.qty : 0;
      const gain = dir === 'long' ? closeVal - costVal : costVal - closeVal;
      realizedGain += gain;
      holdQty -= t.qty;
      if (holdQty > 0) costAccum = costAccum / (holdQty + t.qty) * holdQty;
      else costAccum = 0;
    }
  });

  const avgCost = holdQty > 0 ? costAccum / holdQty / mult : 0;
  const currentPrice = Number(f.price) || avgCost;
  const curVal = holdQty * currentPrice * mult;
  const costVal2 = holdQty * avgCost * mult;
  const floatGain = dir === 'long' ? curVal - costVal2 : costVal2 - curVal;
  const marginRate = (Number(f.marginRate) || 10) / 100;
  const margin = holdQty * currentPrice * mult * marginRate;
  return { qty: holdQty, avgCost, margin, floatGain, realizedGain, netGain: floatGain + realizedGain, openQty: trades.filter(t => t.type === 'open').reduce((a, t) => a + t.qty, 0), closeQty: trades.filter(t => t.type === 'close').reduce((a, t) => a + t.qty, 0) };
}

function getFuturesStats() {
  const holding = futures.filter(f => f.status === 'holding');
  const closed = futures.filter(f => f.status === 'closed');
  const totalMargin = holding.reduce((a, f) => a + (calcFutures(f).margin || 0), 0);
  const totalFloat = holding.reduce((a, f) => a + (calcFutures(f).floatGain || 0), 0);
  const totalRealized = [...holding, ...closed].reduce((a, f) => a + (calcFutures(f).realizedGain || 0), 0);
  return { totalMargin, totalFloat, totalRealized, netGain: totalFloat + totalRealized };
}

function renderFuturesStats() {
  const stats = getFuturesStats();
  const pnlClass = n => n >= 0 ? 'profit-pos' : 'profit-neg';
  document.getElementById('stat-futures-margin').textContent = fmtWan(stats.totalMargin);
  document.getElementById('stat-futures-float').innerHTML = `<span class="${pnlClass(stats.totalFloat)}">${stats.totalFloat >= 0 ? '+' : ''}${fmtWan(stats.totalFloat)}</span>`;
  document.getElementById('stat-futures-realized').innerHTML = `<span class="${pnlClass(stats.totalRealized)}">${stats.totalRealized >= 0 ? '+' : ''}${fmtWan(stats.totalRealized)}</span>`;
  document.getElementById('stat-futures-pnl').innerHTML = `<span class="${pnlClass(stats.netGain)}">${stats.netGain >= 0 ? '+' : ''}${fmtWan(stats.netGain)}</span>`;
}

function renderFuturesList() {
  renderFuturesStats();
  const filtered = futures.filter(f => f.status === currentFuturesTab);
  const area = document.getElementById('futures-list-area');
  if (filtered.length === 0) {
    const emptyText = currentFuturesTab === 'holding' ? '暂无持仓合约' : currentFuturesTab === 'watchlist' ? '暂无关注品种' : '暂无已平仓记录';
    area.innerHTML = `<div class="empty-state"><div class="icon">📦</div><div class="title">${emptyText}</div><div class="desc">点击右上角"新增"添加合约</div></div>`;
    return;
  }
  const pnlClass = n => n >= 0 ? 'profit-pos' : 'profit-neg';
  area.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">` +
    filtered.map(f => {
      const calc = calcFutures(f);
      const dirLabel = f.direction === 'long' ? '多' : '空';
      const dirColor = f.direction === 'long' ? 'var(--red)' : 'var(--green)';
      return `<div class="card" style="cursor:pointer;" onclick="openFuturesDetail('${f.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div>
            <div style="font-weight:700;font-size:14px;">${f.name}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">${f.code} · ×${f.multiplier || 1} · <span style="color:${dirColor};font-weight:600;">${dirLabel}</span></div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px;font-weight:600;">¥${fmt(f.price || 0, 2)}</div>
            <div style="font-size:11px;color:var(--text3);">保证金率 ${f.marginRate || 10}%</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px;">
          <div style="text-align:center;padding:6px;background:var(--bg3);border-radius:6px;">
            <div style="font-size:10px;color:var(--text3);">持仓</div>
            <div style="font-size:13px;font-weight:600;">${calc.qty}手</div>
          </div>
          <div style="text-align:center;padding:6px;background:var(--bg3);border-radius:6px;">
            <div style="font-size:10px;color:var(--text3);">保证金</div>
            <div style="font-size:13px;font-weight:600;">${fmtWan(calc.margin)}</div>
          </div>
          <div style="text-align:center;padding:6px;background:var(--bg3);border-radius:6px;">
            <div style="font-size:10px;color:var(--text3);">浮动</div>
            <div style="font-size:13px;font-weight:600;" class="${pnlClass(calc.floatGain)}">${calc.floatGain >= 0 ? '+' : ''}${fmtWan(calc.floatGain)}</div>
          </div>
        </div>
        ${calc.qty > 0 ? `<div style="font-size:11px;color:${calc.floatGain >= 0 ? 'var(--red)' : 'var(--green)'};">开仓均价 ¥${fmt(calc.avgCost, 2)}</div>` : ''}
        <div style="display:flex;gap:6px;margin-top:8px;" onclick="event.stopPropagation()">
          <button class="btn btn-success btn-sm" style="flex:1;" data-action="futures-open" data-futures-id="${f.id}">开仓</button>
          <button class="btn btn-secondary btn-sm" style="flex:1;" data-action="futures-close" data-futures-id="${f.id}" ${calc.qty <= 0 ? 'disabled' : ''}>平仓</button>
          <button class="btn btn-danger btn-sm" data-action="futures-delete" data-futures-id="${f.id}">删</button>
        </div>
      </div>`;
    }).join('') + '</div>';

  // 成交记录
  const allTrades = futures.flatMap(f => (f.trades || []).map(t => ({ ...t, futName: f.name, futId: f.id })));
  allTrades.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const tradeArea = document.getElementById('futures-trade-list');
  if (allTrades.length === 0) {
    tradeArea.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0;">暂无成交记录</div>';
  } else {
    const mult = Number(futures.find(x => x.id === allTrades[0]?.futId)?.multiplier) || 1;
    tradeArea.innerHTML = `<table class="batch-table"><thead><tr><th>日期</th><th>合约</th><th>方向</th><th>价格</th><th>手数</th><th>成交额</th><th>备注</th></tr></thead><tbody>` +
      allTrades.slice(0, 30).map(t => {
        const ft = futures.find(x => x.id === t.futId) || {};
        const m = Number(ft.multiplier) || 1;
        return `<tr>
          <td>${t.date || '--'}</td>
          <td>${t.futName}</td>
          <td style="color:${t.type === 'open' ? 'var(--red)' : 'var(--green)'};font-weight:600;">${t.type === 'open' ? '开仓' : '平仓'}</td>
          <td>¥${fmt(t.price, 2)}</td>
          <td>${t.qty}</td>
          <td>${fmtWan(t.price * t.qty * m)}</td>
          <td style="color:var(--text3);font-size:11px;">${t.note || '--'}</td>
        </tr>`;
      }).join('') + '</tbody></table>';
  }
}

// 期货卡片点击 → 打开详情面板（不再用 alert）
function openFuturesDetail(futuresId) {
  openFuturesDetailPanel(futuresId);
}

// FUTURES CRUD
let currentFuturesId = null;

function openAddFutures() { currentFuturesId = null; document.getElementById('modal-futures-title').textContent = '📦 新增期货合约'; document.getElementById('futures-code').value = ''; document.getElementById('futures-name').value = ''; document.getElementById('futures-multiplier').value = ''; document.getElementById('futures-price').value = ''; document.getElementById('futures-cost').value = ''; document.getElementById('futures-lots').value = ''; document.getElementById('futures-margin-rate').value = ''; document.getElementById('futures-direction').value = 'long'; document.getElementById('futures-note').value = ''; document.getElementById('futures-edit-hint').style.display = 'none'; openModal('modal-futures'); }

function openEditFutures(futuresId) {
  const f = futures.find(x => x.id === futuresId);
  if (!f) return;
  currentFuturesId = futuresId;
  document.getElementById('modal-futures-title').textContent = '✏️ 编辑期货合约';
  document.getElementById('futures-code').value = f.code || '';
  document.getElementById('futures-name').value = f.name || '';
  document.getElementById('futures-multiplier').value = f.multiplier || '';
  document.getElementById('futures-price').value = f.price || '';
  document.getElementById('futures-cost').value = '';
  document.getElementById('futures-lots').value = '';
  document.getElementById('futures-margin-rate').value = f.marginRate || '';
  document.getElementById('futures-direction').value = f.direction || 'long';
  document.getElementById('futures-note').value = f.note || '';
  document.getElementById('futures-edit-hint').innerHTML = '💡 编辑基本信息不影响成交记录，如需录入新成交请使用卡片内的"开仓/平仓"按钮。';
  document.getElementById('futures-edit-hint').style.display = '';
  openModal('modal-futures');
}

function saveFutures() {
  const code = document.getElementById('futures-code').value.trim();
  const name = document.getElementById('futures-name').value.trim();
  const multiplier = parseFloat(document.getElementById('futures-multiplier').value) || 1;
  const price = parseFloat(document.getElementById('futures-price').value) || 0;
  const marginRate = parseFloat(document.getElementById('futures-margin-rate').value) || 10;
  const direction = document.getElementById('futures-direction').value;
  const note = document.getElementById('futures-note').value.trim();
  if (!code || !name) { alert('请填写品种代码和名称'); return; }

  if (currentFuturesId) {
    const idx = futures.findIndex(x => x.id === currentFuturesId);
    if (idx >= 0) { futures[idx] = { ...futures[idx], code, name, multiplier, price, marginRate, direction, note }; }
  } else {
    futures.push({ id: uuid(), code, name, multiplier, direction, status: 'watchlist', marginRate, price, note, trades: [], createdAt: new Date().toISOString() });
  }
  DB.save('futures_v2', futures);
  closeModal('modal-futures');
  renderFuturesList();
}

function deleteFutures(futuresId) {
  const f = futures.find(x => x.id === futuresId);
  if (!f || !confirm(`确定删除合约"${f.name}"？所有成交记录将一并删除。`)) return;
  futures = futures.filter(x => x.id !== futuresId);
  DB.save('futures_v2', futures);
  renderFuturesList();
}

function openFuturesTrade(futuresId, type) {
  const f = futures.find(x => x.id === futuresId);
  if (!f) return;
  currentFuturesId = futuresId;
  document.getElementById('modal-futures-trade-title').textContent = `📝 ${f.name} — ${type === 'open' ? '开仓' : '平仓'}`;
  document.getElementById('futures-trade-type').value = type;
  document.getElementById('futures-trade-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('futures-trade-price').value = f.price || '';
  document.getElementById('futures-trade-qty').value = '';
  document.getElementById('futures-trade-note').value = '';
  document.getElementById('futures-trade-preview').textContent = '';
  openModal('modal-futures-trade');
}

function updateFuturesTradePreview() {
  const price = parseFloat(document.getElementById('futures-trade-price').value) || 0;
  const qty = parseInt(document.getElementById('futures-trade-qty').value) || 0;
  const type = document.getElementById('futures-trade-type').value;
  const f = futures.find(x => x.id === currentFuturesId);
  if (!f || !price || !qty) { document.getElementById('futures-trade-preview').textContent = ''; return; }
  const mult = Number(f.multiplier) || 1;
  const marginRate = (Number(f.marginRate) || 10) / 100;
  const totalVal = price * qty * mult;
  const margin = totalVal * marginRate;
  document.getElementById('futures-trade-preview').innerHTML = `💡 成交额：<strong>¥${fmt(totalVal, 2)}</strong> | 保证金占用：<strong>¥${fmt(margin, 2)}</strong>（${f.marginRate || 10}%）`;
}

function saveFuturesTrade() {
  const f = futures.find(x => x.id === currentFuturesId);
  if (!f) return;
  const type = document.getElementById('futures-trade-type').value;
  const date = document.getElementById('futures-trade-date').value;
  const price = parseFloat(document.getElementById('futures-trade-price').value);
  const qty = parseInt(document.getElementById('futures-trade-qty').value);
  const note = document.getElementById('futures-trade-note').value.trim();
  if (!date || isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) { alert('请填写完整的成交信息'); return; }

  f.trades = f.trades || [];
  f.trades.push({ id: uuid(), type, date, price, qty, note });

  if (type === 'open') f.price = price;

  const calc = calcFutures(f);
  if (calc.qty > 0) f.status = 'holding';
  else if (f.trades.some(t => t.type === 'close')) f.status = 'closed';

  DB.save('futures_v2', futures);
  closeModal('modal-futures-trade');
  renderFuturesList();
}

// ============================================================
// NAVIGATION
// ============================================================
const pageConfig = {
  'pe-fund':     { icon: '🏦', title: '私募基金',   sub: '全生命周期管理' },
  'stock':       { icon: '📈', title: '股票',       sub: '股票池 / 持仓 / 卖出复盘' },
  'futures':     { icon: '📦', title: '期货',       sub: '品种 / 持仓 / 平仓复盘' },
  'news':        { icon: '📰', title: '研报资讯', sub: '研报与公众号资讯收集分析' },
  'attribution': { icon: '🎯', title: '归因分析',   sub: '多维度收益归因' },
  'calendar':    { icon: '📅', title: '投资日历',   sub: '重要事件提醒' },
  'vote':        { icon: '🎭', title: '大师投票席', sub: '基于真实投资框架的决策模拟' },
  'knowledge':   { icon: '📚', title: '个人知识库', sub: '个人投资知识管理体系' },
};

let currentPage = 'pe-fund';
let currentPETab = 'holding';

function switchPage(pageId) {
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

  if (pageId === 'pe-fund') renderPEFund();
  if (pageId === 'stock') renderStockList();
  if (pageId === 'futures') renderFuturesList();
  if (pageId === 'news') initNewsPage();
  if (pageId === 'attribution') renderAttribution();
  if (pageId === 'calendar') renderCalendar();
  if (pageId === 'vote') { renderVoteCardsPending(); }
  if (pageId === 'knowledge') { initKnowledgePage(); renderKnowledgePage(); }
}

// ============================================================
// PE FUND - RENDER
// ============================================================
function renderPEFund() {
  const stats = getPEStats();
  document.getElementById('stat-fund-count').textContent = stats.count;
  document.getElementById('stat-total-cost').textContent = fmtWan(stats.totalCost);
  document.getElementById('stat-total-floating').innerHTML =
    `<span class="${pnlClass(stats.totalFloating)}">${stats.totalFloating >= 0 ? '+' : ''}${fmtWan(stats.totalFloating)}</span>`;
  document.getElementById('stat-total-realized').innerHTML =
    `<span class="${pnlClass(stats.totalRealized)}">${stats.totalRealized >= 0 ? '+' : ''}${fmtWan(stats.totalRealized)}</span>`;
  document.getElementById('stat-total-pnl').innerHTML =
    `<span class="${pnlClass(stats.netGain)}">${stats.netGain >= 0 ? '+' : ''}${fmtWan(stats.netGain)}</span>`;

  const list = document.getElementById('pe-fund-list');
  const filtered = funds.filter(f => f.status === currentPETab);

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="icon">${currentPETab === 'holding' ? '🏦' : currentPETab === 'tracking' ? '🔍' : '✅'}</div>
      <div class="title">${currentPETab === 'holding' ? '暂无持仓基金' : currentPETab === 'tracking' ? '暂无跟踪基金' : '暂无退出记录'}</div>
      <div class="desc">点击右上角"新增"添加基金</div>
    </div>`;
    return;
  }

  list.innerHTML = filtered.map(f => {
    const calc = calcFund(f);
    const batches = f.batches || [];
    const batchCount = batches.length;
    const statusTag = f.status === 'holding'
      ? '<span class="tag tag-blue">持仓中</span>'
      : f.status === 'tracking'
      ? '<span class="tag tag-yellow">跟踪中</span>'
      : '<span class="tag tag-gray">已退出</span>';

    return `<div class="fund-card" data-fund-id="${f.id}">
      <div class="fund-card-header">
        <div>
          <div class="fund-name">${f.name}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:4px;">${f.company || '未知机构'} · ${f.strategy || '其他'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${statusTag}
        </div>
      </div>
      <div class="fund-metrics">
        <div class="fund-metric">
          <div class="fund-metric-label">投入本金</div>
          <div class="fund-metric-value">${fmtWan(calc.totalCost)}</div>
        </div>
        <div class="fund-metric">
          <div class="fund-metric-label">持仓份额</div>
          <div class="fund-metric-value">${fmt(calc.totalShares, 2)}万份</div>
        </div>
        <div class="fund-metric">
          <div class="fund-metric-label">最新净值</div>
          <div class="fund-metric-value">${f.latestNav ? fmt(f.latestNav, 4) : '--'}</div>
        </div>
        <div class="fund-metric">
          <div class="fund-metric-label">总净盈亏</div>
          <div class="fund-metric-value ${pnlClass(calc.netGain)}">
            ${calc.netGain >= 0 ? '+' : ''}${fmtWan(calc.netGain)}
            <span style="font-size:11px;font-weight:400;">(${fmtPct(calc.totalGainPct)})</span>
          </div>
        </div>
        ${calc.totalFloating !== 0 ? `<div class="fund-metric">
          <div class="fund-metric-label">浮动盈亏</div>
          <div class="fund-metric-value ${pnlClass(calc.totalFloating)}">
            ${calc.totalFloating >= 0 ? '+' : ''}${fmtWan(calc.totalFloating)}
          </div>
        </div>` : ''}
        ${calc.totalRealized !== 0 ? `<div class="fund-metric">
          <div class="fund-metric-label">已实现盈亏</div>
          <div class="fund-metric-value ${pnlClass(calc.totalRealized)}">
            ${calc.totalRealized >= 0 ? '+' : ''}${fmtWan(calc.totalRealized)}
          </div>
        </div>` : ''}
        ${calc.totalPerfFee > 0 ? `<div class="fund-metric">
          <div class="fund-metric-label" style="color:var(--yellow);">业绩报酬</div>
          <div class="fund-metric-value" style="color:var(--yellow);">-${fmtWan(calc.totalPerfFee)}</div>
        </div>` : ''}
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center;">
        <span style="font-size:11px;color:var(--text3);">${batchCount}个申购批次</span>
        <span style="font-size:11px;color:var(--text3);">·</span>
        <span style="font-size:11px;color:var(--text3);">${(f.dividends||[]).length}次分红</span>
        ${f.latestNav ? `<span style="font-size:11px;color:var(--text3);">· 净值日期 ${f.navDate || '--'}</span>` : ''}
        <span style="font-size:11px;color:var(--accent);cursor:pointer;margin-left:auto;" data-action="open-detail" data-fund-id="${f.id}">查看详情 →</span>
      </div>
    </div>`;
  }).join('');

  updateStorageSize();
}

function getPEStats() {
  // 汇总包含所有基金（持仓中 + 已退出），全面反映投资总览
  const allFunds = funds;
  const holdingFunds = funds.filter(f => f.status === 'holding');
  let totalCost = 0, totalFloating = 0, totalRealized = 0, totalPerfFee = 0, totalRealizedPerfFee = 0;
  allFunds.forEach(f => {
    const c = calcFund(f);
    totalCost += c.totalCost;      // 累计投入本金（含已退出基金）
    totalFloating += c.totalFloating; // 浮动盈亏（仅持仓中基金有）
    totalRealized += c.totalRealized; // 已实现盈亏（含退出基金的分红+资本利得）
    totalPerfFee += c.totalPerfFee;   // 累计业绩报酬（含持仓浮动计提）
    totalRealizedPerfFee += c.totalRealizedPerfFee; // 仅来自已退出批次的业绩报酬
  });
  const netGain = totalFloating + totalRealized - totalPerfFee;
  return { count: allFunds.length, holdingCount: holdingFunds.length, totalCost, totalFloating, totalRealized, totalPerfFee, totalRealizedPerfFee, netGain };
}

// 渲染单个基金的批次明细（无表头，扁平紧凑）
function renderBatchRows(f, type) {
  const batches = f.batches || [];
  if (batches.length === 0) return '';
  const batchRows = batches.map(b => {
    const r = calcBatch(f, b);
    const grossVal = type === 'floating' ? r.floatingGain
                   : type === 'realized' ? r.realizedGain
                   : r.floatingGain + r.realizedGain;
    // 浮动视图用持仓计提（预估业报），其他用退出计提或合计
    const perfFeeVal = type === 'floating' ? r.perfFee
                     : type === 'realized' ? r.realizedPerfFee
                     : r.perfFee;
    const netVal = grossVal - perfFeeVal;
    const isExitedRow = b.exitNav != null;
    const shares = (b.amount / b.costNav).toFixed(2);
    // 浮动视图隐藏"业绩报酬"列标题，改为"预估业报"
    const perfHeader = type === 'floating' ? '预估业报' : '业绩报酬';
    return `<tr style="background:var(--bg2);font-size:11px;">
      <td style="padding:5px 8px 5px 24px;text-align:left;">
        <span style="color:var(--text3);font-size:10px;">${b.date}</span>
        ${isExitedRow
          ? `<span style="background:rgba(34,197,94,0.12);color:var(--green);padding:1px 5px;border-radius:3px;font-size:9px;margin-left:6px;">退出</span>`
          : `<span style="background:rgba(59,130,246,0.12);color:var(--blue);padding:1px 5px;border-radius:3px;font-size:9px;margin-left:6px;">持仓</span>`}
      </td>
      <td style="padding:5px 8px;text-align:right;color:var(--text2);">${fmtWan(b.amount)}万</td>
      <td style="padding:5px 8px;text-align:right;color:var(--text2);">${shares}份</td>
      <td style="padding:5px 8px;text-align:right;color:var(--text2);">${b.costNav.toFixed(3)}</td>
      <td style="padding:5px 8px;text-align:right;">${pnlSpan(grossVal)}</td>
      <td style="padding:5px 8px;text-align:right;color:var(--yellow);">${perfFeeVal > 0 ? '-' + fmtWan(perfFeeVal) : '-'}</td>
      <td style="padding:5px 8px;text-align:right;font-weight:600;">${pnlSpan(netVal)}</td>
    </tr>`;
  }).join('');
  return `<tr><td colspan="7" style="padding:0;">
    <table style="width:100%;border-collapse:collapse;margin-left:8px;border-left:2px solid rgba(59,130,246,0.3);">
      <tbody>${batchRows}</tbody>
    </table>
  </td></tr>`;
}

function openPnlDetail(type) {
  const stats = getPEStats();
  const allFunds = funds;

  let title = '', sub = '';
  if (type === 'floating') {
    title = '合计浮动盈亏';
    sub = '持仓中基金若此刻退出，预估将产生的业绩报酬';
  } else if (type === 'realized') {
    title = '合计已实现盈亏';
    sub = '已退出基金的分红 + 资本利得（费前）';
  } else {
    title = '合计净盈亏';
    sub = '浮动 + 已实现 - 业绩报酬 = 真实到手收益';
  }

  // 按基金拆解
  const fundRows = allFunds.map(f => {
    const c = calcFund(f);
    const rowPerfFee = type === 'floating' ? c.totalPerfFee
                     : type === 'realized' ? c.totalRealizedPerfFee
                     : c.totalPerfFee;
    const grossVal = type === 'floating' ? c.totalFloating
                   : type === 'realized' ? c.realizedGain
                   : c.totalFloating + c.realizedGain;
    const netVal = type === 'floating' ? c.totalFloating - rowPerfFee
                 : type === 'realized' ? c.realizedGain - rowPerfFee
                 : c.totalFloating + c.realizedGain - c.totalPerfFee;
    const statusLabel = f.status === 'holding' ? '🔵' : f.status === 'tracking' ? '🔍' : '✅';
    const hasData = grossVal !== 0 || rowPerfFee > 0;
    const showRow = type === 'floating' || hasData;
    if (!showRow) return '';
    const isExpanded = pnlDetailExpanded[f.id + '_' + type];
    const expandIcon = (f.batches && f.batches.length > 0) ? (isExpanded ? '▼' : '▶') : '';
    return `<tr style="cursor:pointer;">
      <td style="text-align:left;padding:8px 12px;" onclick="toggleFundBatches('${f.id}','${type}',this)">${statusLabel} ${f.name} <span style="color:var(--text3);font-size:10px;">${expandIcon}</span></td>
      <td style="text-align:right;padding:8px 12px;">${pnlSpan(grossVal)}</td>
      <td style="text-align:right;padding:8px 12px;color:var(--yellow);">${rowPerfFee > 0 ? '-' + fmtWan(rowPerfFee) : '-'}</td>
      <td style="text-align:right;padding:8px 12px;font-weight:600;">${pnlSpan(netVal)}</td>
    </tr>
    <tr id="batch-${f.id}-${type}" style="display:none;">${renderBatchRows(f, type)}</tr>`;
  }).join('');

  const body = document.getElementById('pnl-detail-body');
  const statsPerfFee = type === 'floating' ? stats.totalPerfFee
                     : type === 'realized' ? (stats.totalRealizedPerfFee || 0)
                     : stats.totalPerfFee;
  const topGross = type === 'floating' ? stats.totalFloating
                  : type === 'realized' ? stats.totalRealized
                  : stats.totalFloating + stats.totalRealized;
  const topNet = type === 'floating' ? stats.totalFloating - statsPerfFee
               : type === 'realized' ? stats.totalRealized - statsPerfFee
               : stats.netGain;
  const headerGrossLabel = type === 'floating' ? '浮动盈亏（费前）' : type === 'realized' ? '已实现盈亏（费前）' : '总费前收益';
  const headerNetLabel = type === 'floating' ? '扣业报' : '费后净收益';
  body.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-size:16px;font-weight:700;margin-bottom:4px;">${title}</div>
      <div style="font-size:12px;color:var(--text3);">${sub}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
      <div style="background:var(--bg3);border-radius:8px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">${type === 'floating' ? '浮动盈亏' : type === 'realized' ? '已实现盈亏' : '总费前收益'}</div>
        <div style="font-size:20px;font-weight:700;${pnlColor(topGross)}">${pnlSign(topGross)}${fmtWan(topGross)}</div>
      </div>
      <div style="background:var(--bg3);border-radius:8px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">${type === 'floating' ? '预估业绩报酬' : '业绩报酬'}</div>
        <div style="font-size:20px;font-weight:700;color:var(--yellow);">${statsPerfFee > 0 ? '-' + fmtWan(statsPerfFee) : '-'}</div>
      </div>
      <div style="background:rgba(59,130,246,0.08);border-radius:8px;padding:14px;text-align:center;border:1px solid rgba(59,130,246,0.15);">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">${type === 'floating' ? '扣业报后净值' : '费后净收益'}</div>
        <div style="font-size:20px;font-weight:700;${pnlColor(topNet)}">${pnlSign(topNet)}${fmtWan(topNet)}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="border-bottom:2px solid var(--border);">
          <th style="text-align:left;padding:6px 12px;color:var(--text3);font-weight:600;">基金名称</th>
          <th style="text-align:right;padding:6px 12px;color:var(--text3);font-weight:600;">${headerGrossLabel}</th>
          <th style="text-align:right;padding:6px 12px;color:var(--text3);font-weight:600;">${type === 'floating' ? '预估业报' : '业绩报酬'}</th>
          <th style="text-align:right;padding:6px 12px;color:var(--text3);font-weight:600;">${headerNetLabel}</th>
        </tr>
      </thead>
      <tbody>
        ${fundRows}
        <tr style="border-top:2px solid var(--border);font-weight:700;">
          <td style="padding:10px 12px;">合计</td>
          <td style="text-align:right;padding:10px 12px;">${pnlSpan(topGross)}</td>
          <td style="text-align:right;padding:10px 12px;color:var(--yellow);">${statsPerfFee > 0 ? '-' + fmtWan(statsPerfFee) : '-'}</td>
          <td style="text-align:right;padding:10px 12px;">${pnlSpan(topNet)}</td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:12px;font-size:11px;color:var(--text3);text-align:center;">
      💡 点击基金名称展开批次明细
    </div>
  `;

  openModal('modal-pnl-detail');
}

function toggleFundBatches(fundId, type, td) {
  const key = fundId + '_' + type;
  pnlDetailExpanded[key] = !pnlDetailExpanded[key];
  const row = document.getElementById('batch-' + fundId + '-' + type);
  if (row) {
    row.style.display = pnlDetailExpanded[key] ? 'table-row' : 'none';
  }
  const icon = td.querySelector('span');
  if (icon) icon.textContent = pnlDetailExpanded[key] ? '▼' : '▶';
}

function pnlSpan(val) {
  return `<span class="${pnlClass(val)}">${val >= 0 ? '+' : ''}${fmtWan(val)}</span>`;
}

function pnlColor(val) { return pnlClass(val).includes('text-red') ? 'color:var(--red);' : (pnlClass(val).includes('text-green') ? 'color:var(--green);' : 'color:var(--text);'); }
function pnlSign(val) { return val >= 0 ? '+' : ''; }

// ============================================================
// DETAIL PANEL — 统一支持基金 / 股票 / 期货
// ============================================================
let currentDetailFundId = null;
let currentDetailStockId = null;
let currentDetailFuturesId = null;

function openDetail(fundId) {
  const fund = funds.find(f => f.id === fundId);
  if (!fund) return;
  currentDetailFundId = fundId;
  currentDetailStockId = null;
  currentDetailFuturesId = null;

  document.getElementById('detail-fund-name').textContent = fund.name;
  document.getElementById('detail-fund-meta').textContent =
    `${fund.company || ''} · ${fund.strategy || ''}${fund.perfFee > 0 ? ` · 业绩报酬 ${fund.perfFee}%` : ''} · ${fund.status === 'holding' ? '持仓中' : fund.status === 'tracking' ? '跟踪中' : '已退出'}`;
  // 显示基金专用按钮
  document.getElementById('btn-detail-edit').style.display = '';
  document.getElementById('btn-detail-edit').dataset.fundId = fundId;
  document.getElementById('btn-detail-edit').dataset.action = 'edit-fund';
  document.getElementById('btn-detail-delete').style.display = '';
  document.getElementById('btn-detail-delete').dataset.fundId = fundId;
  document.getElementById('btn-detail-delete').dataset.action = 'delete-fund';

  renderFundDetailBody(fund);

  document.getElementById('detail-overlay').classList.add('open');
  document.getElementById('detail-panel').classList.add('open');
}

function openStockDetailPanel(stockId) {
  const stock = stocks.find(s => s.id === stockId);
  if (!stock) return;
  currentDetailFundId = null;
  currentDetailStockId = stockId;
  currentDetailFuturesId = null;

  document.getElementById('detail-fund-name').textContent = stock.name;
  document.getElementById('detail-fund-meta').textContent = `${stock.code} · ${stock.market || 'A股'} · ${stock.status === 'holding' ? '持仓中' : stock.status === 'watchlist' ? '自选池' : '已卖出'}`;
  // 显示股票操作按钮
  document.getElementById('btn-detail-edit').style.display = '';
  document.getElementById('btn-detail-edit').dataset.stockId = stockId;
  document.getElementById('btn-detail-edit').dataset.action = 'edit-stock';
  document.getElementById('btn-detail-delete').style.display = '';
  document.getElementById('btn-detail-delete').dataset.stockId = stockId;
  document.getElementById('btn-detail-delete').dataset.action = 'delete-stock';

  renderStockDetailBody(stock);

  document.getElementById('detail-overlay').classList.add('open');
  document.getElementById('detail-panel').classList.add('open');
}

function openFuturesDetailPanel(futuresId) {
  const f = futures.find(x => x.id === futuresId);
  if (!f) return;
  currentDetailFundId = null;
  currentDetailStockId = null;
  currentDetailFuturesId = futuresId;

  const dirLabel = f.direction === 'long' ? '做多' : '做空';
  const dirColor = f.direction === 'long' ? 'var(--red)' : 'var(--green)';
  document.getElementById('detail-fund-name').textContent = f.name;
  document.getElementById('detail-fund-meta').innerHTML = `${f.code || ''} · ×${f.multiplier || 1} · <span style="color:${dirColor};font-weight:600;">${dirLabel}</span> · ${f.status === 'holding' ? '持仓中' : f.status === 'watchlist' ? '关注中' : '已平仓'}`;
  // 显示期货操作按钮
  document.getElementById('btn-detail-edit').style.display = '';
  document.getElementById('btn-detail-edit').dataset.futuresId = futuresId;
  document.getElementById('btn-detail-edit').dataset.action = 'edit-futures';
  document.getElementById('btn-detail-delete').style.display = '';
  document.getElementById('btn-detail-delete').dataset.futuresId = futuresId;
  document.getElementById('btn-detail-delete').dataset.action = 'delete-futures';

  renderFuturesDetailBody(f);

  document.getElementById('detail-overlay').classList.add('open');
  document.getElementById('detail-panel').classList.add('open');
}

function closeDetail() {
  document.getElementById('detail-overlay').classList.remove('open');
  document.getElementById('detail-panel').classList.remove('open');
  currentDetailFundId = null;
  currentDetailStockId = null;
  currentDetailFuturesId = null;
}

function renderFundDetailBody(fund) {
  const calc = calcFund(fund);
  const batches = fund.batches || [];
  const dividends = fund.dividends || [];
  const latestNav = Number(fund.latestNav) || 0;

  const body = document.getElementById('detail-body');

  // 汇总信息
  const summaryHtml = `
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">合计投入本金</div>
        <div class="info-value big">${fmtWan(calc.totalCost)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">合计持仓份额</div>
        <div class="info-value big">${fmt(calc.totalShares, 4)} 万份</div>
      </div>
      <div class="info-item">
        <div class="info-label">加权平均成本净值</div>
        <div class="info-value">${fmt(calc.avgCostNav, 4)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">最新净值</div>
        <div class="info-value">${latestNav ? fmt(latestNav, 4) : '--'} <span style="font-size:11px;color:var(--text3);">${fund.navDate || ''}</span></div>
      </div>
      <div class="info-item">
        <div class="info-label">浮动盈亏</div>
        <div class="info-value ${pnlClass(calc.totalFloating)}">${calc.totalFloating >= 0 ? '+' : ''}${fmtWan(calc.totalFloating)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">已实现盈亏（分红+退出）</div>
        <div class="info-value ${pnlClass(calc.totalRealized)}">${calc.totalRealized >= 0 ? '+' : ''}${fmtWan(calc.totalRealized)}</div>
      </div>
      ${fund.perfFee > 0 ? `<div class="info-item">
        <div class="info-label">业绩报酬（${fund.perfFee}%）</div>
        <div class="info-value" style="color:var(--yellow);">-${fmtWan(calc.totalPerfFee)}</div>
      </div>` : ''}
      <div class="info-item">
        <div class="info-label">总净盈亏</div>
        <div class="info-value ${pnlClass(calc.netGain)}" style="font-size:18px;">${calc.netGain >= 0 ? '+' : ''}${fmtWan(calc.netGain)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">净收益率</div>
        <div class="info-value ${pnlClass(calc.totalGainPct)}" style="font-size:18px;">${fmtPct(calc.totalGainPct)}</div>
      </div>
    </div>
  `;

  // 操作按钮
  const actionsHtml = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
      <button class="btn btn-primary btn-sm" data-action="add-batch" data-fund-id="${fund.id}">＋ 新增申购批次</button>
      <button class="btn btn-success btn-sm" data-action="add-dividend" data-fund-id="${fund.id}">＋ 记录分红</button>
      <button class="btn btn-secondary btn-sm" data-action="nav-history" data-fund-id="${fund.id}">📊 净值历史</button>
      ${fund.status === 'tracking' ? `<button class="btn btn-secondary btn-sm" data-action="to-holding" data-fund-id="${fund.id}">→ 移入持仓</button>` : ''}
      ${fund.status === 'holding' ? `<button class="btn btn-secondary btn-sm" data-action="to-exited" data-fund-id="${fund.id}">→ 标记退出</button>` : ''}
    </div>
  `;

  // 绩效指标
  let perfHtml = '';
  const perf = calcPerformance(fund);
  if (perf) {
    perfHtml = `
    <div class="section-title">📈 绩效分析</div>
    <div class="info-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="info-item">
        <div class="info-label">夏普比率</div>
        <div class="info-value big ${perf.sharpe >= 0 ? 'text-green' : 'text-red'}">${fmt(perf.sharpe, 2)}</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">（>1 优秀，>2 极佳）</div>
      </div>
      <div class="info-item">
        <div class="info-label">卡玛比率</div>
        <div class="info-value big ${perf.calmar >= 0 ? 'text-green' : 'text-red'}">${fmt(perf.calmar, 2)}</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">（>1 优秀，>2 极佳）</div>
      </div>
      <div class="info-item">
        <div class="info-label">信息比率</div>
        <div class="info-value big">${fmt(perf.infoRatio, 2)}</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">年化收益/波动率</div>
      </div>
      <div class="info-item">
        <div class="info-label">年化收益率</div>
        <div class="info-value big ${perf.annualizedReturn >= 0 ? 'text-red' : 'text-green'}">${fmtPct(perf.annualizedReturn)}</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">区间 ${perf.years}年</div>
      </div>
      <div class="info-item">
        <div class="info-label">年化波动率</div>
        <div class="info-value big">${fmtPct(perf.annualizedVol)}</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">收益标准差</div>
      </div>
      <div class="info-item">
        <div class="info-label">最大回撤</div>
        <div class="info-value big text-red">${fmtPct(perf.maxDrawdown)}</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">${perf.maxDDDate}</div>
      </div>
      <div class="info-item">
        <div class="info-label">正收益天数占比</div>
        <div class="info-value big">${fmt(perf.positiveRate * 100, 1)}%</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">${perf.navCount}个净值点</div>
      </div>
      <div class="info-item">
        <div class="info-label">年化分红收益率</div>
        <div class="info-value big text-yellow">${fmtPct(perf.divYieldAnnual)}</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">含已兑现分红</div>
      </div>
      <div class="info-item">
        <div class="info-label">总收益率</div>
        <div class="info-value big ${perf.totalReturn >= 0 ? 'text-red' : 'text-green'}">${fmtPct(perf.totalReturn)}</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">${perf.startDate} → ${perf.endDate}</div>
      </div>
    </div>`;
  } else {
    const navCount = (fund.navHistory || []).length;
    perfHtml = `
    <div class="section-title">📈 绩效分析</div>
    <div class="alert-box" style="margin-bottom:0;">
      ${navCount === 0
        ? '📊 暂无净值历史记录。点击"净值历史"添加至少2条净值数据，即可计算夏普、卡玛、最大回撤等绩效指标。'
        : `📊 净值数据不足。当前 ${navCount} 条，需至少 2 条才能计算绩效指标。`}
    </div>`;
  }

  // 净值历史摘要
  const navSummary = (fund.navHistory || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  let navSummaryHtml = '';
  if (navSummary.length > 0) {
    const recentNav = navSummary[0];
    const oldestNav = navSummary[navSummary.length - 1];
    const navChange = oldestNav.nav > 0 ? (recentNav.nav - oldestNav.nav) / oldestNav.nav : 0;
    navSummaryHtml = `
    <div class="section-title">净值走势</div>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:10px;">
      <div style="text-align:center;">
        <div style="font-size:11px;color:var(--text3);">起始净值</div>
        <div style="font-size:14px;font-weight:700;">${fmt(oldestNav.nav, 4)}</div>
        <div style="font-size:11px;color:var(--text3);">${oldestNav.date}</div>
      </div>
      <div style="flex:1;display:flex;align-items:center;gap:8px;">
        <div style="flex:1;height:3px;background:var(--border);border-radius:2px;position:relative;">
          <div style="position:absolute;left:0;top:-3px;width:10px;height:10px;background:var(--accent);border-radius:50%;"></div>
          <div style="position:absolute;right:0;top:-3px;width:10px;height:10px;background:${navChange >= 0 ? 'var(--red)' : 'var(--green)'};border-radius:50%;"></div>
        </div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:11px;color:var(--text3);">最新净值</div>
        <div style="font-size:14px;font-weight:700;${navChange >= 0 ? 'color:var(--red)' : 'color:var(--green)'}">${fmt(recentNav.nav, 4)}</div>
        <div style="font-size:11px;color:var(--text3);">${recentNav.date}</div>
      </div>
      <div style="text-align:center;padding:8px 12px;background:var(--bg3);border-radius:8px;">
        <div style="font-size:11px;color:var(--text3);">区间涨跌</div>
        <div style="font-size:14px;font-weight:700;${navChange >= 0 ? 'color:var(--red)' : 'color:var(--green)'}">${fmtPct(navChange)}</div>
      </div>
      <button class="btn btn-secondary btn-sm" data-action="nav-history" data-fund-id="${fund.id}">管理净值</button>
    </div>`;
  } else {
    navSummaryHtml = `
    <div class="section-title">净值走势</div>
    <div style="color:var(--text3);font-size:12px;padding:12px 0;">
      暂无净值历史，点击"净值历史"按钮添加
    </div>`;
  }

  // 申购批次明细
  let batchHtml = '';
  if (batches.length === 0) {
    batchHtml = '<div style="color:var(--text3);font-size:12px;padding:12px 0;">暂无申购记录</div>';
  } else {
    const perfFeeRate = (Number(fund.perfFee) || 0) / 100;
    const isFundExited = fund.status === 'exited';
    const rows = batches.map(b => {
      const r = calcBatch(b, latestNav, dividends, perfFeeRate);
      const batchExited = r.isExited || (isFundExited && !b.exitNav);
      const exitTag = batchExited
        ? `<span class="tag tag-gray" style="margin-right:4px;">已退出</span><button class="btn btn-warning btn-sm" data-action="restore-batch" data-fund-id="${fund.id}" data-batch-id="${b.id}" title="撤销退出，恢复持仓">恢复</button>`
        : `<button class="btn btn-success btn-sm" data-action="exit-batch" data-fund-id="${fund.id}" data-batch-id="${b.id}">退出</button>`;
      const exitInfo = batchExited ? `<br><span style="font-size:10px;color:var(--text3);">退出净值:${fmt(b.exitNav || latestNav,4)} 资本利得:${fmtWan(r.realizedGain - r.divGain)}</span>` : '';
      const divInfo = r.divGain > 0 ? `<br><span style="font-size:10px;color:var(--green);">分红:${fmtWan(r.divGain)}</span>` : '';
      return `<tr data-batch-id="${b.id}">
        <td class="editable ${!b.date ? 'empty' : ''}" data-field="date" data-placeholder="日期" contenteditable="true">${b.date || ''}</td>
        <td class="editable" data-field="amount" contenteditable="true">${b.amount}</td>
        <td class="editable" data-field="costNav" contenteditable="true">${fmt(b.costNav, 4)}</td>
        <td class="readonly">${fmt(r.shares, 4)}万份</td>
        <td class="${pnlClass(r.floatingGain)}">${batchExited ? '-' : (r.floatingGain >= 0 ? '+' : '') + fmtWan(Math.abs(r.floatingGain))}</td>
        <td class="${pnlClass(r.realizedGain)}">${r.realizedGain >= 0 ? '+' : ''}${fmtWan(r.realizedGain)}${exitInfo}${divInfo}</td>
        ${fund.perfFee > 0 ? `<td style="color:var(--yellow);font-size:11px;">${r.perfFee > 0 ? '-' + fmtWan(r.perfFee) : '-'}</td>` : ''}
        <td class="${pnlClass(r.netGain)}">${r.netGain >= 0 ? '+' : ''}${fmtWan(r.netGain)}</td>
        <td class="${pnlClass(r.totalGainPct)}">${fmtPct(r.totalGainPct)}</td>
        <td>
          ${exitTag}
          <button class="btn btn-danger btn-sm" style="margin-left:4px;" data-action="del-batch" data-fund-id="${fund.id}" data-batch-id="${b.id}">删</button>
        </td>
      </tr>`;
    }).join('');

    batchHtml = `<div class="batch-table-wrap">
      <table class="batch-table">
        <thead>
          <tr>
            <th>申购日期</th><th>申购金额</th><th>成本净值</th><th>份额</th>
            <th>浮动盈亏</th><th>已实现盈亏</th>
            ${fund.perfFee > 0 ? '<th>业绩报酬</th>' : ''}
            <th>净盈亏</th><th>净收益率</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  // 分红明细
  let divHtml = '';
  if (dividends.length === 0) {
    divHtml = '<div style="color:var(--text3);font-size:12px;padding:12px 0;">暂无分红记录</div>';
  } else {
    divHtml = `<div class="dividend-list">${dividends.map(d => {
      // 计算本次分红的实际总金额（基于当前批次）
      let totalDiv = 0;
      const perfFeeRate = (Number(fund.perfFee) || 0) / 100;
      batches.forEach(b => {
        const shares = (Number(b.amount) / Number(b.costNav));
        if (d.date >= (b.date || '')) totalDiv += Number(d.perShare) * shares;
      });
      return `<div class="dividend-item" data-div-id="${d.id}">
        <div>
          <div class="dividend-date editable ${!d.date ? 'empty' : ''}" data-field="date" data-placeholder="日期" contenteditable="true">${d.date || ''}</div>
          <div class="dividend-note editable ${!d.note ? 'empty' : ''}" data-field="note" data-placeholder="备注" contenteditable="true" style="font-size:11px;color:var(--text3);margin-top:2px;outline:none;border-radius:3px;padding:2px 4px;">${d.note || ''}</div>
        </div>
        <div style="text-align:right;">
          <div class="dividend-amount editable" data-field="perShare" contenteditable="true">${fmt(d.perShare, 4)}</div>
          <div class="dividend-total">≈ ${fmtWan(totalDiv)}</div>
        </div>
        <button class="btn btn-danger btn-sm" style="margin-left:12px;" data-action="del-dividend" data-fund-id="${fund.id}" data-div-id="${d.id}">删</button>
      </div>`;
    }).join('')}</div>`;
  }

  body.innerHTML = `
    ${summaryHtml}
    ${actionsHtml}
    <div class="divider"></div>
    ${perfHtml}
    <div class="divider"></div>
    ${navSummaryHtml}
    <div class="divider"></div>
    <div class="section-title">申购批次明细</div>
    ${batchHtml}
    <div class="divider"></div>
    <div class="section-title">📋 分红记录（已实现盈亏来源之一）</div>
    ${divHtml}
    ${fund.note ? `<div class="divider"></div><div class="section-title">备注</div><div style="font-size:13px;color:var(--text2);line-height:1.6;">${fund.note}</div>` : ''}
  `;
}

// ============================================================
// STOCK DETAIL BODY
// ============================================================
function renderStockDetailBody(stock) {
  const calc = calcStock(stock);
  const trades = (stock.trades || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const floatPct = calc.avgCostTotal > 0 ? (calc.floatingGain / calc.avgCostTotal * 100) : 0;

  const body = document.getElementById('detail-body');

  const summaryHtml = `
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">当前价</div>
        <div class="info-value big">¥${fmt(stock.price || 0, 2)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">持仓数量</div>
        <div class="info-value big">${calc.qty} 股</div>
      </div>
      <div class="info-item">
        <div class="info-label">成本均价</div>
        <div class="info-value">¥${fmt(calc.avgCost, 3)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">持仓成本总额</div>
        <div class="info-value">${fmtWan(calc.avgCostTotal)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">当前市值</div>
        <div class="info-value big">${fmtWan(calc.currentValue)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">浮动盈亏</div>
        <div class="info-value big ${pnlClass(calc.floatingGain)}">${calc.floatingGain >= 0 ? '+' : ''}${fmtWan(calc.floatingGain)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">浮动收益率</div>
        <div class="info-value big ${pnlClass(floatPct)}">${floatPct >= 0 ? '+' : ''}${fmtPct(floatPct / 100)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">已实现盈亏</div>
        <div class="info-value ${pnlClass(calc.realizedGain)}">${calc.realizedGain >= 0 ? '+' : ''}${fmtWan(calc.realizedGain)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">净盈亏合计</div>
        <div class="info-value big ${pnlClass(calc.netGain)}" style="font-size:18px;">${calc.netGain >= 0 ? '+' : ''}${fmtWan(calc.netGain)}</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
      <button class="btn btn-success btn-sm" data-action="stock-buy" data-stock-id="${stock.id}">📈 买入</button>
      <button class="btn btn-secondary btn-sm" data-action="stock-sell" data-stock-id="${stock.id}" ${calc.qty <= 0 ? 'disabled' : ''}>📉 卖出</button>
      <button class="btn btn-secondary btn-sm" data-action="stock-history" data-stock-id="${stock.id}">📋 交易记录</button>
    </div>
  `;

  let tradesHtml = '';
  if (trades.length === 0) {
    tradesHtml = '<div style="color:var(--text3);font-size:12px;padding:12px 0;">暂无交易记录</div>';
  } else {
    tradesHtml = `<div class="batch-table-wrap">
      <table class="batch-table">
        <thead>
          <tr><th>日期</th><th>方向</th><th>价格</th><th>数量</th><th>金额</th><th>备注</th></tr>
        </thead>
        <tbody>${trades.map(t => `<tr>
          <td>${t.date || '--'}</td>
          <td style="color:${t.type === 'buy' ? 'var(--green)' : 'var(--red)'};font-weight:600;">${t.type === 'buy' ? '买入' : '卖出'}</td>
          <td>¥${fmt(t.price, 2)}</td>
          <td>${t.qty}</td>
          <td>${fmtWan(t.price * t.qty)}</td>
          <td style="color:var(--text3);font-size:11px;">${t.note || '--'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  }

  body.innerHTML = `
    ${summaryHtml}
    <div class="divider"></div>
    <div class="section-title">交易记录（${trades.length} 笔）</div>
    ${tradesHtml}
    ${stock.note ? `<div class="divider"></div><div class="section-title">备注</div><div style="font-size:13px;color:var(--text2);line-height:1.6;">${stock.note}</div>` : ''}
  `;
}

// ============================================================
// FUTURES DETAIL BODY
// ============================================================
function renderFuturesDetailBody(f) {
  const calc = calcFutures(f);
  const trades = ((f.trades || [])).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const dirLabel = f.direction === 'long' ? '做多' : '做空';
  const dirColor = f.direction === 'long' ? 'var(--red)' : 'var(--green)';
  const floatPct = calc.costAccum > 0 ? (calc.floatGain / calc.costAccum * 100) : 0;

  const body = document.getElementById('detail-body');

  const summaryHtml = `
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">当前价</div>
        <div class="info-value big">¥${fmt(f.price || 0, 2)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">持仓手数</div>
        <div class="info-value big">${calc.qty} 手</div>
      </div>
      <div class="info-item">
        <div class="info-label">开仓均价</div>
        <div class="info-value">¥${fmt(calc.avgCost, 3)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">保证金占用</div>
        <div class="info-value big">${fmtWan(calc.margin)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">浮动盈亏</div>
        <div class="info-value big ${pnlClass(calc.floatGain)}">${calc.floatGain >= 0 ? '+' : ''}${fmtWan(calc.floatGain)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">浮动收益率</div>
        <div class="info-value big ${pnlClass(floatPct)}">${floatPct >= 0 ? '+' : ''}${fmtPct(floatPct / 100)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">已平仓盈亏</div>
        <div class="info-value ${pnlClass(calc.realizedGain)}">${calc.realizedGain >= 0 ? '+' : ''}${fmtWan(calc.realizedGain)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">净盈亏合计</div>
        <div class="info-value big ${pnlClass(calc.netGain)}" style="font-size:18px;">${calc.netGain >= 0 ? '+' : ''}${fmtWan(calc.netGain)}</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
      <button class="btn btn-success btn-sm" data-action="futures-open" data-futures-id="${f.id}">📈 开仓</button>
      <button class="btn btn-secondary btn-sm" data-action="futures-close" data-futures-id="${f.id}" ${calc.qty <= 0 ? 'disabled' : ''}>📉 平仓</button>
      <button class="btn btn-secondary btn-sm" data-action="futures-history" data-futures-id="${f.id}">📋 成交记录</button>
    </div>
  `;

  let tradesHtml = '';
  if (trades.length === 0) {
    tradesHtml = '<div style="color:var(--text3);font-size:12px;padding:12px 0;">暂无成交记录</div>';
  } else {
    const m = Number(f.multiplier) || 1;
    tradesHtml = `<div class="batch-table-wrap">
      <table class="batch-table">
        <thead>
          <tr><th>日期</th><th>方向</th><th>价格</th><th>手数</th><th>成交额</th><th>备注</th></tr>
        </thead>
        <tbody>${trades.map(t => `<tr>
          <td>${t.date || '--'}</td>
          <td style="color:${t.type === 'open' ? 'var(--red)' : 'var(--green)'};font-weight:600;">${t.type === 'open' ? '开仓' : '平仓'}</td>
          <td>¥${fmt(t.price, 2)}</td>
          <td>${t.qty}</td>
          <td>${fmtWan(t.price * t.qty * m)}</td>
          <td style="color:var(--text3);font-size:11px;">${t.note || '--'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  }

  body.innerHTML = `
    ${summaryHtml}
    <div class="divider"></div>
    <div class="section-title">成交记录（${trades.length} 笔）</div>
    ${tradesHtml}
    ${f.note ? `<div class="divider"></div><div class="section-title">备注</div><div style="font-size:13px;color:var(--text2);line-height:1.6;">${f.note}</div>` : ''}
  `;
}

// ============================================================
// MODAL HELPERS
// ============================================================
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ============================================================
// FUND CRUD
// ============================================================
let editingFundId = null;

function openAddFund() {
  editingFundId = null;
  document.getElementById('modal-fund-title').textContent = '新增基金';
  document.getElementById('fund-name').value = '';
  document.getElementById('fund-company').value = '';
  document.getElementById('fund-strategy').value = '股票多头';
  document.getElementById('fund-perf-fee').value = '';
  document.getElementById('fund-status').value = 'holding';
  document.getElementById('fund-note').value = '';
  openModal('modal-fund');
}

function openEditFund(fundId) {
  const fund = funds.find(f => f.id === fundId);
  if (!fund) return;
  editingFundId = fundId;
  document.getElementById('modal-fund-title').textContent = '编辑基金';
  document.getElementById('fund-name').value = fund.name || '';
  document.getElementById('fund-company').value = fund.company || '';
  document.getElementById('fund-strategy').value = fund.strategy || '股票多头';
  document.getElementById('fund-perf-fee').value = fund.perfFee || '';
  document.getElementById('fund-status').value = fund.status || 'holding';
  document.getElementById('fund-note').value = fund.note || '';
  openModal('modal-fund');
}

function saveFund() {
  const name = document.getElementById('fund-name').value.trim();
  if (!name) { alert('请填写基金名称'); return; }

  if (editingFundId) {
    const idx = funds.findIndex(f => f.id === editingFundId);
    if (idx >= 0) {
      funds[idx] = {
        ...funds[idx],
        name,
        company: document.getElementById('fund-company').value.trim(),
        strategy: document.getElementById('fund-strategy').value,
        perfFee: parseFloat(document.getElementById('fund-perf-fee').value) || 0,
        status: document.getElementById('fund-status').value,
        note: document.getElementById('fund-note').value.trim(),
      };
    }
  } else {
    funds.push({
      id: uuid(),
      name,
      company: document.getElementById('fund-company').value.trim(),
      strategy: document.getElementById('fund-strategy').value,
      perfFee: parseFloat(document.getElementById('fund-perf-fee').value) || 0,
      status: document.getElementById('fund-status').value,
      note: document.getElementById('fund-note').value.trim(),
      createdAt: new Date().toISOString(),
      latestNav: null,
      navDate: null,
      batches: [],
      dividends: []
    });
  }

  DB.save('funds_v2', funds);
  closeModal('modal-fund');
  renderPEFund();
  if (currentDetailFundId) {
    const f = funds.find(x => x.id === currentDetailFundId);
    if (f) renderDetailBody(f);
  }
}

function deleteFund(fundId) {
  const fund = funds.find(f => f.id === fundId);
  if (!fund) return;
  if (!confirm(`确定删除基金"${fund.name}"？此操作不可撤销。`)) return;
  funds = funds.filter(f => f.id !== fundId);
  DB.save('funds_v2', funds);
  renderPEFund();
}

// ============================================================
// BATCH CRUD
// ============================================================
let currentBatchFundId = null;

// 标记退出
let currentExitBatchFundId = null;
let currentExitBatchId = null;
let currentExitAllBatches = false; // 是否批量退出所有批次

function openExitBatch(fundId, batchId) {
  currentExitBatchFundId = fundId;
  currentExitBatchId = batchId;
  currentExitAllBatches = false;
  const fund = funds.find(f => f.id === fundId);
  const batch = fund?.batches?.find(b => b.id === batchId);
  if (!batch) return;

  const totalShares = Number(batch.amount) / Number(batch.costNav);
  document.getElementById('exit-batch-mode-hint').innerHTML = '💡 填写退出时的净值和日期，系统将把该批次的浮盈浮亏结算为已实现盈亏，并计算业绩报酬（如有）。<br/>💡 支持部分退出：如果退出的份额小于总份额，原批次将保留剩余份额。';
  document.getElementById('exit-batch-current-shares').textContent = fmt(totalShares, 4);
  document.getElementById('exit-batch-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('exit-batch-nav').value = '';
  document.getElementById('exit-batch-shares').value = '';
  document.getElementById('exit-batch-preview').innerHTML = '';
  document.getElementById('exit-batch-list').style.display = 'none';
  openModal('modal-exit-batch');
}

// 批量退出所有未退出批次
function openExitAllBatches(fundId) {
  currentExitBatchFundId = fundId;
  currentExitBatchId = null;
  currentExitAllBatches = true;
  const fund = funds.find(f => f.id === fundId);
  if (!fund) return;

  const activeBatches = (fund.batches || []).filter(b => !b.exitNav && b.note !== '跟踪');
  if (activeBatches.length === 0) {
    alert('没有需要退出的实际持仓批次（跟踪记录除外）');
    return;
  }

  // 计算总份额
  let totalShares = 0;
  activeBatches.forEach(b => {
    totalShares += Number(b.amount) / Number(b.costNav);
  });

  document.getElementById('exit-batch-mode-hint').innerHTML = `<span style="color:var(--yellow);">⚠️ 批量退出模式：将一次性退出 ${activeBatches.length} 个未退出批次</span><br/>💡 填写统一的退出净值和日期，系统将批量标记退出。`;
  document.getElementById('exit-batch-current-shares').textContent = fmt(totalShares, 4);
  document.getElementById('exit-batch-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('exit-batch-nav').value = '';
  document.getElementById('exit-batch-shares').value = '0'; // 默认全部退出
  document.getElementById('exit-batch-preview').innerHTML = '';
  
  // 显示批次列表
  const listEl = document.getElementById('exit-batch-list');
  listEl.style.display = 'block';
  listEl.innerHTML = `
    <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:6px;">将退出以下批次：</div>
    <div style="background:var(--bg3);border-radius:6px;padding:8px;font-size:11px;">
      ${activeBatches.map(b => {
        const shares = Number(b.amount) / Number(b.costNav);
        return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border);">
          <span>${b.date} · ${b.amount}万 · 净值${fmt(b.costNav,4)}</span>
          <span>${fmt(shares,4)}万份</span>
        </div>`;
      }).join('')}
    </div>
  `;
  
  openModal('modal-exit-batch');
}

function updateExitPreview() {
  const fund = funds.find(f => f.id === currentExitBatchFundId);
  if (!fund || !currentExitBatchFundId) return;

  const exitNav = parseFloat(document.getElementById('exit-batch-nav').value);
  if (isNaN(exitNav) || exitNav <= 0) {
    document.getElementById('exit-batch-preview').innerHTML = '';
    return;
  }

  if (currentExitAllBatches) {
    // 批量退出预览
    const activeBatches = (fund.batches || []).filter(b => !b.exitNav && b.note !== '跟踪');
    let totalCostGain = 0, totalDivGain = 0, totalPerfFee = 0;
    
    activeBatches.forEach(batch => {
      const shares = Number(batch.amount) / Number(batch.costNav);
      const costGain = (exitNav - Number(batch.costNav)) * shares;
      totalCostGain += costGain;
      
      // 统计分红
      const batchDate = batch.date || '1900-01-01';
      (fund.dividends || []).forEach(d => {
        if (d.date >= batchDate) {
          totalDivGain += Number(d.perShare) * shares;
        }
      });
      
      // 业绩报酬
      const perfFeeRate = (Number(fund.perfFee) || 0) / 100;
      totalPerfFee += Math.max(0, costGain) * perfFeeRate;
    });
    
    const totalRealizedGain = totalCostGain + totalDivGain;
    const netGain = totalRealizedGain - totalPerfFee;
    const perfFeeRate = (Number(fund.perfFee) || 0) / 100;
    
    const preview = document.getElementById('exit-batch-preview');
    preview.innerHTML = `
      <div style="background:var(--bg3);border-radius:8px;padding:12px;font-size:12px;">
        <div style="color:var(--accent);margin-bottom:8px;">📊 批量退出预估（${activeBatches.length}个批次）</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>退出净值：<strong>${fmt(exitNav, 4)}</strong></div>
          <div>资本利得：<strong class="${pnlClass(totalCostGain)}">${totalCostGain >= 0 ? '+' : ''}${fmtWan(totalCostGain)}</strong></div>
          <div>历史分红：<strong style="color:var(--green);">+${fmtWan(totalDivGain)}</strong></div>
          ${fund.perfFee > 0 ? `<div>业绩报酬（${fund.perfFee}%）：<strong style="color:var(--yellow);">-${fmtWan(totalPerfFee)}</strong></div>` : '<div></div>'}
          <div>已实现盈亏：<strong class="${pnlClass(totalRealizedGain)}">${totalRealizedGain >= 0 ? '+' : ''}${fmtWan(totalRealizedGain)}</strong></div>
          <div>预计净盈亏：<strong class="${pnlClass(netGain)}">${netGain >= 0 ? '+' : ''}${fmtWan(netGain)}</strong></div>
        </div>
      </div>
    `;
    return;
  }

  // 单个批次退出预览
  const batch = fund?.batches?.find(b => b.id === currentExitBatchId);
  if (!batch) return;

  const origShares = Number(batch.amount) / Number(batch.costNav);
  const prevExitShares = Number(batch.exitShares) || 0;
  const currentShares = origShares - prevExitShares;
  const exitSharesInput = document.getElementById('exit-batch-shares').value;
  const exitShares = exitSharesInput ? parseFloat(exitSharesInput) : currentShares;
  const isPartial = exitSharesInput && exitShares > 0 && exitShares < currentShares;

  if (isNaN(exitShares) || exitShares <= 0) {
    document.getElementById('exit-batch-preview').innerHTML = '<span style="color:var(--red);font-size:12px;">退出份额必须大于0</span>';
    return;
  }
  if (exitShares > currentShares) {
    document.getElementById('exit-batch-preview').innerHTML = `<span style="color:var(--red);font-size:12px;">退出份额不能超过当前持有 ${fmt(currentShares, 4)} 万份</span>`;
    return;
  }

  const exitGain = (exitNav - Number(batch.costNav)) * exitShares;
  const perfFeeRate = (Number(fund.perfFee) || 0) / 100;
  const perfFee = Math.max(0, exitGain) * perfFeeRate;
  const netGain = exitGain - perfFee;

  const preview = document.getElementById('exit-batch-preview');
  if (isPartial) {
    const remainingShares = currentShares - exitShares;
    const remainingAmount = remainingShares * Number(batch.costNav);
    preview.innerHTML = `
      <div style="background:var(--bg3);border-radius:8px;padding:12px;font-size:12px;">
        <div style="color:var(--yellow);margin-bottom:8px;">⚠️ 部分退出</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>成本净值：<strong>${fmt(batch.costNav, 4)}</strong></div>
          <div>当前持有：<strong>${fmt(currentShares, 4)}万份</strong></div>
          <div>退出份额：<strong style="color:var(--red);">-${fmt(exitShares, 4)}万份</strong></div>
          <div>剩余份额：<strong style="color:var(--green);">${fmt(remainingShares, 4)}万份</strong></div>
          <div>退出净值：<strong style="color:var(--accent);">${fmt(exitNav, 4)}</strong></div>
          <div>退出金额：<strong>${fmtWan(exitShares * exitNav)}</strong></div>
          <div>退出时资本利得：<strong class="${pnlClass(exitGain)}">${exitGain >= 0 ? '+' : ''}${fmtWan(exitGain)}</strong></div>
          ${fund.perfFee > 0 ? `<div>业绩报酬（${fund.perfFee}%）：<strong style="color:var(--yellow);">-${fmtWan(perfFee)}</strong></div>` : ''}
          <div>预计净盈亏：<strong class="${pnlClass(netGain)}">${netGain >= 0 ? '+' : ''}${fmtWan(netGain)}</strong></div>
        </div>
      </div>
    `;
  } else {
    preview.innerHTML = `
      <div style="background:var(--bg3);border-radius:8px;padding:12px;font-size:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>成本净值：<strong>${fmt(batch.costNav, 4)}</strong></div>
          <div>当前持有：<strong>${fmt(currentShares, 4)}万份</strong></div>
          <div>退出净值：<strong style="color:var(--accent);">${fmt(exitNav, 4)}</strong></div>
          <div>退出时资本利得：<strong class="${pnlClass(exitGain)}">${exitGain >= 0 ? '+' : ''}${fmtWan(exitGain)}</strong></div>
          ${fund.perfFee > 0 ? `<div>业绩报酬（${fund.perfFee}%）：<strong style="color:var(--yellow);">-${fmtWan(perfFee)}</strong></div>` : ''}
          <div>预计净盈亏：<strong class="${pnlClass(netGain)}">${netGain >= 0 ? '+' : ''}${fmtWan(netGain)}</strong></div>
        </div>
      </div>
    `;
  }
}

function saveExitBatch() {
  const fund = funds.find(f => f.id === currentExitBatchFundId);
  if (!fund) return;

  const exitDate = document.getElementById('exit-batch-date').value;
  const exitNav = parseFloat(document.getElementById('exit-batch-nav').value);
  if (!exitDate || isNaN(exitNav) || exitNav <= 0) {
    alert('请填写退出日期和退出净值'); return;
  }

  if (currentExitAllBatches) {
    // 批量退出所有未退出批次
    const activeBatches = (fund.batches || []).filter(b => !b.exitNav && b.note !== '跟踪');
    if (activeBatches.length === 0) {
      alert('没有需要退出的批次');
      return;
    }
    
    // 批量设置退出信息
    activeBatches.forEach(batch => {
      batch.exitDate = exitDate;
      batch.exitNav = exitNav;
    });
    
    // 将基金状态改为已退出
    fund.status = 'exited';
    
    DB.save('funds_v2', funds);
    closeModal('modal-exit-batch');
    closeDetail();
    renderPEFund();
    alert(`已成功退出 ${activeBatches.length} 个批次！\n退出日期：${exitDate}\n退出净值：${exitNav}`);
  } else {
    // 单个批次退出
    const batch = fund?.batches?.find(b => b.id === currentExitBatchId);
    if (!batch) return;

    const exitSharesInput = document.getElementById('exit-batch-shares').value;
    const origShares = Number(batch.amount) / Number(batch.costNav);
    const prevExitShares = Number(batch.exitShares) || 0;
    const currentShares = origShares - prevExitShares;
    let exitShares = exitSharesInput ? parseFloat(exitSharesInput) : currentShares;

    if (isNaN(exitShares) || exitShares <= 0) {
      alert('退出份额必须大于0'); return;
    }
    if (exitShares > currentShares) {
      alert(`退出份额不能超过当前持有 ${fmt(currentShares, 4)} 万份`); return;
    }

    const isPartial = exitSharesInput && exitShares > 0 && exitShares < currentShares;

    if (isPartial) {
      // 部分退出：拆分批次
      const remainingShares = currentShares - exitShares;
      const remainingAmount = remainingShares * Number(batch.costNav);

      // 更新原批次为剩余份额
      batch.amount = remainingAmount;
      batch.exitShares = prevExitShares + exitShares;  // 累加历史退出份额

      // 创建新批次记录退出的份额
      fund.batches.push({
        id: uuid(),
        date: batch.date,
        amount: exitShares * Number(batch.costNav),  // 退出的本金（原始份额×成本净值）
        costNav: exitNav,                             // 退出净值作为成本，这样资本利得 = 0
        note: batch.note,
        exitDate: exitDate,
        exitNav: exitNav,
        partialExitFrom: currentExitBatchId,
        exitShares: exitShares
      });
    } else {
      // 全部退出
      batch.exitDate = exitDate;
      batch.exitNav = exitNav;
    }

    DB.save('funds_v2', funds);
    closeModal('modal-exit-batch');
    if (currentDetailFundId) renderDetailBody(fund);
    renderPEFund();
  }
}

function openAddBatch(fundId) {
  currentBatchFundId = fundId;
  document.getElementById('batch-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('batch-amount').value = '';
  document.getElementById('batch-nav').value = '';
  document.getElementById('batch-shares-preview').value = '';
  document.getElementById('batch-note').value = '';
  openModal('modal-batch');
}

function saveBatch() {
  const fund = funds.find(f => f.id === currentBatchFundId);
  if (!fund) return;
  const date = document.getElementById('batch-date').value;
  const amount = parseFloat(document.getElementById('batch-amount').value);
  const costNav = parseFloat(document.getElementById('batch-nav').value);
  if (!date || isNaN(amount) || amount <= 0) { alert('请填写申购日期和金额'); return; }
  if (isNaN(costNav) || costNav <= 0) { alert('请填写成本净值'); return; }

  fund.batches = fund.batches || [];
  fund.batches.push({
    id: uuid(),
    date,
    amount,
    costNav,
    note: document.getElementById('batch-note').value.trim()
  });

  // 如果基金还没有净值，默认用成本净值
  if (!fund.latestNav) {
    fund.latestNav = costNav;
    fund.navDate = date;
  }

  DB.save('funds_v2', funds);
  closeModal('modal-batch');
  if (currentDetailFundId) renderDetailBody(fund);
  renderPEFund();
}

function deleteBatch(fundId, batchId) {
  const fund = funds.find(f => f.id === fundId);
  if (!fund || !confirm('确定删除该申购批次？')) return;
  fund.batches = (fund.batches || []).filter(b => b.id !== batchId);
  DB.save('funds_v2', funds);
  if (currentDetailFundId) renderDetailBody(fund);
  renderPEFund();
}

function restoreBatch(fundId, batchId) {
  const fund = funds.find(f => f.id === fundId);
  if (!fund) return;
  const batch = (fund.batches || []).find(b => b.id === batchId);
  if (!batch) return;
  if (!confirm(`确定恢复该批次？\n\n将撤销退出日期（${batch.exitDate}）和退出净值（${batch.exitNav}），恢复为持仓状态。`)) return;
  batch.exitDate = null;
  batch.exitNav = null;
  batch.exitShares = null;
  // 如果是从部分退出恢复，把退出份额加回到本金
  if (batch.partialExitFrom) {
    const origBatch = (fund.batches || []).find(b => b.id === batch.partialExitFrom);
    if (origBatch) {
      origBatch.amount += Number(batch.amount);
      origBatch.exitShares = null;
      origBatch.exitDate = null;
      origBatch.exitNav = null;
      fund.batches = fund.batches.filter(b => b.id !== batch.id);
    }
  }
  // 恢复后检查：只要有任意批次未退出，基金状态就改回持仓
  const anyActive = (fund.batches || []).some(b => !b.exitNav);
  if (!anyActive) {
    fund.status = 'exited';
  } else if (fund.status === 'exited') {
    fund.status = 'holding';
  }
  DB.save('funds_v2', funds);
  if (currentDetailFundId) renderDetailBody(fund);
  renderPEFund();
}

// ============================================================
// NAV UPDATE
// ============================================================
let currentNavFundId = null;

function openUpdateNav(fundId) {
  currentNavFundId = fundId;
  const fund = funds.find(f => f.id === fundId);
  document.getElementById('nav-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('nav-unit-value').value = fund?.latestNav || '';
  document.getElementById('nav-cum-value').value = '';
  openModal('modal-nav');
}

function saveNav() {
  const fund = funds.find(f => f.id === currentNavFundId);
  if (!fund) return;
  const navDate = document.getElementById('nav-date').value;
  const unitNav = parseFloat(document.getElementById('nav-unit-value').value);
  const cumNav = parseFloat(document.getElementById('nav-cum-value').value);
  
  if (!navDate) { alert('请填写净值日期'); return; }
  if (isNaN(unitNav) && isNaN(cumNav)) { alert('请填写至少一个净值'); return; }
  
  // 优先使用单位净值
  const navValue = isNaN(unitNav) ? cumNav : unitNav;
  fund.latestNav = navValue;
  fund.navDate = navDate;
  // 存储累计净值
  if (!isNaN(cumNav)) {
    fund.latestCumNav = cumNav;
  }
  DB.save('funds_v2', funds);
  closeModal('modal-nav');
  if (currentDetailFundId) renderDetailBody(fund);
  renderPEFund();
}

// ============================================================
// NAV HISTORY CRUD
// ============================================================
let currentNavHistFundId = null;

function openNavHistory(fundId) {
  currentNavHistFundId = fundId;
  const fund = funds.find(f => f.id === fundId);
  if (!fund) return;

  document.getElementById('nav-h-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('nav-h-unit').value = '';
  document.getElementById('nav-h-cum').value = '';
  document.getElementById('nav-h-note').value = '';

  renderNavHistoryTable(fund);

  // 更新绩效提示
  const p = calcPerformance(fund);
  const hint = document.getElementById('nav-history-hint');
  if (hint) {
    if (!p) {
      hint.innerHTML = '💡 维护完整净值序列，系统自动计算夏普、卡玛、最大回撤等绩效指标（需至少2条记录）';
      hint.style.background = 'rgba(245,158,11,0.1)';
      hint.style.borderColor = 'rgba(245,158,11,0.3)';
    } else {
      hint.innerHTML = `✅ 绩效指标（基于累计净值）：夏普 ${fmt(p.sharpe,2)} | 卡玛 ${fmt(p.calmar,2)} | 最大回撤 <strong style="color:var(--red);">${fmtPct(p.maxDrawdown)}</strong> | 年化 ${fmtPct(p.annualizedReturn)}`;
      hint.style.background = 'rgba(16,185,129,0.1)';
      hint.style.borderColor = 'rgba(16,185,129,0.3)';
    }
  }

  openModal('modal-nav-history');
}

// 计算累计净值（考虑分红再投资）
function calcCumulativeNav(navRecord, fund, allNavsSorted) {
  const dividends = fund.dividends || [];
  // 优先使用导入时存储的累计净值
  if (navRecord.cumNav != null) return navRecord.cumNav;
  // 如果是累计净值类型，直接返回
  if (navRecord.type === 'cumulative') {
    return navRecord.nav;
  }
  // 如果是单位净值，加上该日期及之前已分红的复权收益
  let cumulativeNav = navRecord.nav;
  dividends.forEach(d => {
    if (d.date <= navRecord.date) {
      cumulativeNav += d.perShare;
    }
  });
  return cumulativeNav;
}

function renderNavHistoryTable(fund) {
  const navs = (fund.navHistory || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const dividends = fund.dividends || [];
  document.getElementById('nav-count').textContent = navs.length;
  const tbody = document.getElementById('nav-history-tbody');

  // 计算累计净值的辅助函数
  const calcCumNav = (navRec) => {
    // 优先使用手动填写的累计净值
    if (navRec.cumNav != null) return navRec.cumNav;
    // 其次用原始记录的累计净值类型
    if (navRec.type === 'cumulative') return navRec.nav;
    // 最后通过分红推算（单位净值 + 历史分红）
    let cumNav = navRec.nav;
    dividends.forEach(d => {
      if (d.date <= navRec.date) {
        cumNav += d.perShare;
      }
    });
    return cumNav;
  };
  
  // 计算单位净值的辅助函数
  const calcUnitNav = (navRec) => {
    if (navRec.type === 'unit') return navRec.nav;
    if (navRec.type === 'cumulative') {
      // 如果是累计净值，需要通过分红反推单位净值
      let unitNav = navRec.nav;
      dividends.forEach(d => {
        if (d.date <= navRec.date) {
          unitNav -= d.perShare;
        }
      });
      return unitNav;
    }
    return navRec.nav;
  };

  tbody.innerHTML = navs.map(n => {
    const cumNav = calcCumNav(n);
    const unitNav = calcUnitNav(n);
    const isCumulative = n.type === 'cumulative';
    return `<tr>
    <td>${n.date}</td>
    <td style="font-weight:600;">${isCumulative ? '<span style="color:var(--text3);font-size:10px;">-</span>' : fmt(unitNav, 4)}</td>
    <td style="color:${n.cumNav != null ? 'var(--accent)' : 'var(--text2)'};font-weight:600;">${fmt(cumNav, 4)}${n.cumNav != null ? '' : '<span style="color:var(--text3);font-size:10px;"> *</span>'}</td>
    <td style="color:var(--text3);font-size:11px;">${n.note || ''}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-secondary btn-sm" style="margin-right:4px;" onclick="openEditNavHistory('${fund.id}', '${n.id}')">编</button>
      <button class="btn btn-danger btn-sm" data-action="del-nav-hist" data-fund-id="${fund.id}" data-nav-id="${n.id}">删</button>
    </td>
  </tr>`;
  }).join('') || '<tr><td colspan="5" style="color:var(--text3);text-align:center;padding:16px;">暂无净值记录</td></tr>';
}

function saveNavHistory() {
  const fund = funds.find(f => f.id === currentNavHistFundId);
  if (!fund) return;
  const date = document.getElementById('nav-h-date').value;
  const unitNav = parseFloat(document.getElementById('nav-h-unit').value);
  const cumNav = parseFloat(document.getElementById('nav-h-cum').value);
  const note = document.getElementById('nav-h-note').value.trim();
  
  if (!date) { alert('请填写净值日期'); return; }
  if (isNaN(unitNav) && isNaN(cumNav)) { alert('请填写至少一个净值'); return; }
  
  // 优先使用单位净值，累计净值作为辅助
  const navValue = isNaN(unitNav) ? cumNav : unitNav;
  const navType = isNaN(unitNav) ? 'cumulative' : 'unit';

  // 检查该日期是否已有记录
  const exists = fund.navHistory?.find(h => h.date === date);
  if (exists) {
    alert(`已有 ${date} 的净值记录，请先删除后再添加。`);
    return;
  }

  fund.navHistory = fund.navHistory || [];
  fund.navHistory.push({
    id: uuid(),
    date,
    nav: navValue,
    type: navType,
    cumNav: isNaN(cumNav) ? null : cumNav, // 存储手动填写的累计净值
    note
  });
  fund.navHistory.sort((a, b) => a.date.localeCompare(b.date));

  // 更新最新净值
  const latest = fund.navHistory[fund.navHistory.length - 1];
  fund.latestNav = latest.nav;
  fund.navDate = latest.date;
  if (!isNaN(cumNav)) {
    fund.latestCumNav = cumNav;
  }

  DB.save('funds_v2', funds);
  renderNavHistoryTable(fund);

  // 更新提示
  openNavHistory(fund.id); // 刷新提示文字
  if (currentDetailFundId) renderDetailBody(fund);
  renderPEFund();
}

// 编辑净值
let currentEditNavFundId = null;
let currentEditNavId = null;

function openEditNavHistory(fundId, navId) {
  currentEditNavFundId = fundId;
  currentEditNavId = navId;
  
  const fund = funds.find(f => f.id === fundId);
  if (!fund) return;
  
  const navRecord = (fund.navHistory || []).find(n => n.id === navId);
  if (!navRecord) return;
  
  // 填充表单
  document.getElementById('edit-nav-date').value = navRecord.date;
  // 根据类型决定哪个输入框显示值
  if (navRecord.type === 'cumulative') {
    document.getElementById('edit-nav-unit').value = '';
    document.getElementById('edit-nav-cum').value = navRecord.nav;
  } else {
    document.getElementById('edit-nav-unit').value = navRecord.nav;
    document.getElementById('edit-nav-cum').value = navRecord.cumNav || '';
  }
  document.getElementById('edit-nav-note').value = navRecord.note || '';
  
  openModal('modal-edit-nav');
}

function saveEditedNavHistory() {
  if (!currentEditNavFundId || !currentEditNavId) return;
  
  const fund = funds.find(f => f.id === currentEditNavFundId);
  if (!fund) return;
  
  const navRecord = (fund.navHistory || []).find(n => n.id === currentEditNavId);
  if (!navRecord) return;
  
  const newDate = document.getElementById('edit-nav-date').value;
  const unitNav = parseFloat(document.getElementById('edit-nav-unit').value);
  const cumNav = parseFloat(document.getElementById('edit-nav-cum').value);
  const newNote = document.getElementById('edit-nav-note').value.trim();
  
  if (!newDate) { alert('请填写净值日期'); return; }
  if (isNaN(unitNav) && isNaN(cumNav)) { alert('请填写至少一个净值'); return; }
  
  // 如果日期改变了，检查是否与已有记录冲突（排除自己）
  if (newDate !== navRecord.date) {
    const exists = fund.navHistory?.find(h => h.date === newDate && h.id !== currentEditNavId);
    if (exists) {
      alert(`已有 ${newDate} 的净值记录，不能重复。`);
      return;
    }
  }
  
  // 优先使用单位净值
  const navValue = isNaN(unitNav) ? cumNav : unitNav;
  const navType = isNaN(unitNav) ? 'cumulative' : 'unit';
  
  // 更新记录
  navRecord.date = newDate;
  navRecord.nav = navValue;
  navRecord.type = navType;
  navRecord.cumNav = isNaN(cumNav) ? null : cumNav;
  navRecord.note = newNote;
  
  // 重新排序
  fund.navHistory.sort((a, b) => a.date.localeCompare(b.date));
  
  // 更新最新净值
  const latest = fund.navHistory[fund.navHistory.length - 1];
  fund.latestNav = latest.nav;
  fund.navDate = latest.date;
  
  DB.save('funds_v2', funds);
  closeModal('modal-edit-nav');
  renderNavHistoryTable(fund);
  
  // 更新提示
  openNavHistory(fund.id);
  if (currentDetailFundId) renderDetailBody(fund);
  renderPEFund();
}

function clearNavHistory() {
  if (!currentNavHistFundId) return;
  const fund = funds.find(f => f.id === currentNavHistFundId);
  if (!fund) return;
  const count = (fund.navHistory || []).length;
  if (count === 0) return;
  if (!confirm(`确定清空该基金全部 ${count} 条净值历史记录？此操作不可恢复。`)) return;
  fund.navHistory = [];
  fund.latestNav = null;
  fund.navDate = null;
  DB.save('funds_v2', funds);
  renderNavHistoryTable(fund);
  if (currentDetailFundId) renderDetailBody(fund);
  renderPEFund();
}

function deleteNavHistory(fundId, navId) {
  const fund = funds.find(f => f.id === fundId);
  if (!fund || !confirm('确定删除该条净值记录？')) return;
  fund.navHistory = (fund.navHistory || []).filter(n => n.id !== navId);
  // 重新更新最新净值
  if (fund.navHistory.length > 0) {
    const sorted = fund.navHistory.slice().sort((a, b) => b.date.localeCompare(a.date));
    fund.latestNav = sorted[0].nav;
    fund.navDate = sorted[0].date;
  } else {
    fund.latestNav = null;
    fund.navDate = null;
  }
  DB.save('funds_v2', funds);
  renderNavHistoryTable(fund);
  openNavHistory(fund.id);
  if (currentDetailFundId) renderDetailBody(fund);
  renderPEFund();
}

// ============================================================
// DIVIDEND CRUD
// ============================================================
let currentDivFundId = null;

function openAddDividend(fundId) {
  currentDivFundId = fundId;
  document.getElementById('div-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('div-per-share').value = '';
  document.getElementById('div-note').value = '';
  document.getElementById('div-preview').style.display = 'none';
  openModal('modal-dividend');
}

function saveDividend() {
  const fund = funds.find(f => f.id === currentDivFundId);
  if (!fund) return;
  const date = document.getElementById('div-date').value;
  const perShare = parseFloat(document.getElementById('div-per-share').value);
  if (!date || isNaN(perShare) || perShare <= 0) { alert('请填写分红日期和每份额分红金额'); return; }

  fund.dividends = fund.dividends || [];
  fund.dividends.push({
    id: uuid(),
    date,
    perShare,
    note: document.getElementById('div-note').value.trim()
  });
  fund.dividends.sort((a, b) => a.date.localeCompare(b.date));

  DB.save('funds_v2', funds);
  closeModal('modal-dividend');
  if (currentDetailFundId) renderDetailBody(fund);
  renderPEFund();
}

function deleteDividend(fundId, divId) {
  const fund = funds.find(f => f.id === fundId);
  if (!fund || !confirm('确定删除该分红记录？')) return;
  fund.dividends = (fund.dividends || []).filter(d => d.id !== divId);
  DB.save('funds_v2', funds);
  if (currentDetailFundId) renderDetailBody(fund);
  renderPEFund();
}

// 实时预览分红计算（与 calcBatch 逻辑保持一致）
function updateDivPreview() {
  const perShare = parseFloat(document.getElementById('div-per-share').value);
  const date = document.getElementById('div-date').value;
  if (!currentDivFundId || isNaN(perShare) || !date) {
    document.getElementById('div-preview').style.display = 'none';
    return;
  }
  const fund = funds.find(f => f.id === currentDivFundId);
  if (!fund || !fund.batches || fund.batches.length === 0) {
    document.getElementById('div-preview').style.display = 'none';
    return;
  }

  let html = '';
  let grandTotal = 0;
  fund.batches.forEach(b => {
    // 计算剩余份额（与 calcBatch 逻辑一致）
    const origShares = Number(b.amount) / Number(b.costNav);
    const exitShares = Number(b.exitShares) || 0;
    const remainingShares = Math.max(0, origShares - exitShares);
    const isFullyExited = b.exitNav != null && b.exitNav !== '';
    // 完全退出的批次不再享有分红；部分退出按剩余份额计算
    const divShares = isFullyExited ? 0 : remainingShares;
    const divAmount = perShare * divShares;
    grandTotal += divAmount;
    const statusTag = isFullyExited ? ' <span style="color:#666;font-size:11px;">[已退出]</span>' : (exitShares > 0 ? ' <span style="color:#888;font-size:11px;">[部分退出]</span>' : '');
    html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">
      <span style="color:var(--text2);">批次 ${b.date} · ${b.amount}万${statusTag}</span>
      <span style="color:var(--yellow);">+${fmtWan(divAmount)}</span>
    </div>`;
  });
  html += `<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:600;font-size:13px;">
    <span>合计分红收益</span>
    <span style="color:var(--yellow);">+${fmtWan(grandTotal)}</span>
  </div>`;

  document.getElementById('div-preview-content').innerHTML = html;
  document.getElementById('div-preview').style.display = 'block';
}

// ============================================================
// BATCH TABLE INLINE EDITING
// ============================================================
document.addEventListener('blur', function(e) {
  // 处理批次表格可编辑单元格失去焦点时保存
  const td = e.target.closest('.batch-table td.editable');
  if (!td) return;

  const tr = td.closest('tr');
  const batchId = tr?.dataset.batchId;
  const field = td.dataset.field;
  if (!batchId || !field || !currentDetailFundId) return;

  const fund = funds.find(f => f.id === currentDetailFundId);
  if (!fund) return;

  const batch = (fund.batches || []).find(b => b.id === batchId);
  if (!batch) return;

  // 获取编辑后的值
  let newValue = td.textContent.trim();

  // 根据字段类型转换和验证
  if (field === 'date') {
    // 日期格式验证
    if (newValue && !/^\d{4}-\d{2}-\d{2}$/.test(newValue)) {
      // 尝试自动补全格式
      if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(newValue)) {
        newValue = newValue.replace(/\//g, '-');
      } else {
        td.textContent = batch.date || '';
        return;
      }
    }
    if (newValue === batch.date) return;
    batch.date = newValue;
  } else if (field === 'amount') {
    const num = parseFloat(newValue);
    if (isNaN(num) || num <= 0) {
      td.textContent = batch.amount;
      return;
    }
    if (num === batch.amount) return;
    batch.amount = num;
  } else if (field === 'costNav') {
    const num = parseFloat(newValue);
    if (isNaN(num) || num <= 0) {
      td.textContent = fmt(batch.costNav, 4);
      return;
    }
    if (num === batch.costNav) return;
    batch.costNav = num;
  } else {
    return; // 其他字段不处理
  }

  // 保存并刷新
  DB.save('funds_v2', funds);
  renderDetailBody(fund);
  renderPEFund();
}, true); // 使用捕获阶段确保先触发

// ============================================================
// DIVIDEND INLINE EDITING
// ============================================================
document.addEventListener('blur', function(e) {
  // 处理分红记录可编辑单元格失去焦点时保存
  const el = e.target.closest('.dividend-item .editable');
  if (!el) return;

  const item = el.closest('.dividend-item');
  const divId = item?.dataset.divId;
  const field = el.dataset.field;
  if (!divId || !field || !currentDetailFundId) return;

  const fund = funds.find(f => f.id === currentDetailFundId);
  if (!fund) return;

  const dividend = (fund.dividends || []).find(d => d.id === divId);
  if (!dividend) return;

  // 获取编辑后的值
  let newValue = el.textContent.trim();

  // 根据字段类型转换和验证
  if (field === 'date') {
    if (newValue && !/^\d{4}-\d{2}-\d{2}$/.test(newValue)) {
      if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(newValue)) {
        newValue = newValue.replace(/\//g, '-');
      } else {
        el.textContent = dividend.date || '';
        return;
      }
    }
    if (newValue === dividend.date) return;
    dividend.date = newValue;
  } else if (field === 'perShare') {
    const num = parseFloat(newValue);
    if (isNaN(num) || num < 0) {
      el.textContent = fmt(dividend.perShare, 4);
      return;
    }
    if (num === dividend.perShare) return;
    dividend.perShare = num;
  } else if (field === 'note') {
    if (newValue === dividend.note) return;
    dividend.note = newValue;
  } else {
    return;
  }

  // 保存并刷新
  DB.save('funds_v2', funds);
  renderDetailBody(fund);
  renderPEFund();
}, true);

// ============================================================
// EVENT DELEGATION
// ============================================================
document.addEventListener('click', function(e) {
  const target = e.target;

  // 导航切换
  const navItem = target.closest('.nav-item[data-page]');
  if (navItem) {
    switchPage(navItem.dataset.page);
    return;
  }

  // Tab切换（PE基金阶段）
  const tab = target.closest('.tab');
  if (tab && tab.closest('#page-pe-fund')) {
    tab.closest('.tabs').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentPETab = tab.dataset.tab;
    renderPEFund();
    return;
  }

  // 顶部新增按钮
  if (target.id === 'btn-add-main' || target.closest('#btn-add-main')) {
    if (currentPage === 'pe-fund') openAddFund();
    if (currentPage === 'stock') openAddStock();
    if (currentPage === 'futures') openAddFutures();
    if (currentPage === 'news') document.getElementById('btn-add-article')?.click();
    if (currentPage === 'knowledge') document.getElementById('btn-add-knowledge')?.click();
    return;
  }

  // 导出数据按钮
  if (target.id === 'btn-export-data' || target.closest('#btn-export-data')) {
    exportAllData();
    return;
  }

  // 导入数据按钮
  if (target.id === 'btn-import-data' || target.closest('#btn-import-data')) {
    document.getElementById('import-file-input').click();
    return;
  }

  // Modal关闭按钮
  const closeBtn = target.closest('[data-close]');
  if (closeBtn) {
    closeModal(closeBtn.dataset.close);
    return;
  }

  // Modal遮罩点击关闭
  if (target.classList.contains('modal-overlay')) {
    target.classList.remove('open');
    return;
  }

  // 保存按钮
  if (target.id === 'btn-save-fund') { saveFund(); return; }
  if (target.id === 'btn-save-batch') { saveBatch(); return; }
  if (target.id === 'btn-save-nav') { saveNav(); return; }
  if (target.id === 'btn-save-dividend') { saveDividend(); return; }
  if (target.id === 'btn-save-nav-history') { saveNavHistory(); return; }
  if (target.id === 'btn-save-edit-nav') { saveEditedNavHistory(); return; }
  if (target.id === 'btn-clear-nav-history') { clearNavHistory(); return; }
  if (target.id === 'btn-confirm-exit-batch') { saveExitBatch(); return; }
  if (target.id === 'btn-save-stock') { saveStock(); return; }
  if (target.id === 'btn-save-stock-trade') { saveStockTrade(); return; }
  if (target.id === 'btn-save-futures') { saveFutures(); return; }
  if (target.id === 'btn-save-futures-trade') { saveFuturesTrade(); return; }

  // 详情面板关闭
  if (target.id === 'btn-detail-close') { closeDetail(); return; }
  const detailOverlay = target.closest('#detail-overlay');
  if (detailOverlay) { closeDetail(); return; }

  // data-action 处理
  const actionEl = target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    const fundId = actionEl.dataset.fundId;
    const batchId = actionEl.dataset.batchId;
    const divId = actionEl.dataset.divId;

    switch(action) {
      case 'edit-fund':       openEditFund(fundId); break;
      case 'delete-fund':     closeDetail(); setTimeout(() => deleteFund(fundId), 50); break;
      case 'open-detail':     openDetail(fundId); break;
      case 'add-batch':       openAddBatch(fundId); break;
      case 'add-dividend':    openAddDividend(fundId); break;
      case 'update-nav':      openUpdateNav(fundId); break;
      case 'del-batch':       deleteBatch(fundId, batchId); break;
      case 'restore-batch':   restoreBatch(fundId, batchId); break;
      case 'del-dividend':    deleteDividend(fundId, divId); break;
      case 'nav-history':     openNavHistory(fundId); break;
      case 'del-nav-hist':    deleteNavHistory(fundId, actionEl.dataset.navId); break;
      case 'exit-batch':      openExitBatch(fundId, batchId); break;
      case 'to-holding':
        const f1 = funds.find(f => f.id === fundId);
        if (f1) { f1.status = 'holding'; DB.save('funds_v2', funds); closeDetail(); renderPEFund(); }
        break;
      case 'to-exited':
        // 标记退出：需要填写退出净值，不能只改状态
        const f2 = funds.find(f => f.id === fundId);
        if (f2) {
          const activeBatches = (f2.batches || []).filter(b => !b.exitNav && b.note !== '跟踪');
          if (activeBatches.length === 0) {
            // 所有批次都已退出
            f2.status = 'exited';
            DB.save('funds_v2', funds);
            closeDetail();
            renderPEFund();
          } else {
            // 弹出退出窗口，填写退出净值
            openExitAllBatches(fundId);
          }
        }
        break;
    }
    return;
  }

  // 基金卡片点击（点击卡片主体打开详情）
  const fundCard = target.closest('.fund-card[data-fund-id]');
  if (fundCard && !target.closest('.btn') && !target.closest('[data-action]')) {
    openDetail(fundCard.dataset.fundId);
    return;
  }

  // ====== NEWS MODULE EVENTS ======

  // 资讯视图切换
  const newsViewTab = target.closest('#news-view-tabs .tab');
  if (newsViewTab) {
    switchNewsView(newsViewTab.dataset.newsView);
    return;
  }

  // 录入文章按钮
  if (target.id === 'btn-add-article' || target.closest('#btn-add-article')) {
    openAddArticle();
    return;
  }

  // 统计按钮
  if (target.id === 'btn-news-stats' || target.closest('#btn-news-stats')) {
    renderNewsStats();
    return;
  }

  // 保存文章按钮
  if (target.id === 'btn-save-article') {
    saveArticle();
    return;
  }

  // AI 分析按钮
  if (target.id === 'btn-ai-analyze') {
    updateStepIndicator(2);
    runAiAnalysis();
    return;
  }

  // URL 识别按钮
  if (target.id === 'btn-parse-url') {
    parseArticleUrl();
    return;
  }

  // 折叠 AI 区
  if (target.id === 'btn-toggle-ai-zone') {
    toggleAiZone();
    return;
  }

  // 保存验证按钮
  if (target.id === 'btn-save-verification') {
    saveVerification();
    return;
  }

  // 筛选联动
  if (target.closest('#news-filter-source') ||
      target.closest('#news-filter-tag') ||
      target.closest('#news-filter-verification')) {
    renderNewsView();
    return;
  }

  // 搜索输入
  if (target.id === 'news-search') {
    renderNewsView();
    return;
  }
});

// ============================================================
// EXCEL 导入净值历史
// ============================================================
let pendingNavImport = [];

// 确认导入
function initExcelImport() {
  document.getElementById('btn-import-nav-excel').addEventListener('click', function() {
    document.getElementById('nav-excel-file-input').click();
  });

  document.getElementById('nav-excel-file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const data = new Uint8Array(ev.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

        if (rows.length < 2) {
          alert('Excel文件内容为空或只有表头，请检查文件格式。');
          return;
        }

        pendingNavImport = [];
        const navType = document.getElementById('import-nav-type').value; // 'unit' or 'cumulative'
        const typeLabel = navType === 'cumulative' ? '累计净值' : '单位净值';

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          let dateStr = '';
          let navValue = null;
          let cumNavValue = null;  // 第三列的累计净值（如有）
          let note = '';

          // 第一列：日期
          const dateCell = row[0];
          if (dateCell instanceof Date) {
            dateStr = dateCell.toISOString().slice(0, 10);
          } else if (dateCell) {
            dateStr = String(dateCell).trim();
            const d = new Date(dateStr);
            if (!isNaN(d)) {
              dateStr = d.toISOString().slice(0, 10);
            }
          }

          if (!dateStr) continue;

          // 第二列：净值（根据下拉框类型统一处理）
          const navCell = row[1];
          if (navCell !== undefined && navCell !== null && navCell !== '') {
            const val = parseFloat(navCell);
            if (!isNaN(val) && val > 0) navValue = val;
          }

          // 第三列：累计净值（固定，如有则读）
          if (row[2] !== undefined && row[2] !== null && row[2] !== '') {
            const val = parseFloat(row[2]);
            if (!isNaN(val) && val > 0) cumNavValue = val;
          }

          // 第四列：备注（固定）
          if (row[3]) {
            note = String(row[3]).trim();
          }

          if (navValue !== null) {
            pendingNavImport.push({ date: dateStr, nav: navValue, cumNav: cumNavValue, type: navType, note, typeLabel });
          }
        }

        if (pendingNavImport.length === 0) {
          alert('未找到有效的净值数据，请确保第一列是日期、第二列是净值。');
          return;
        }

        pendingNavImport.sort((a, b) => a.date.localeCompare(b.date));

        const previewEl = document.getElementById('nav-import-preview');
        const tbody = document.getElementById('nav-import-tbody');
        tbody.innerHTML = pendingNavImport.map(n => {
          const label = n.type === 'cumulative'
            ? '<span style="color:var(--yellow);">累计净值</span>'
            : '<span style="color:var(--text3);">单位净值</span>';
          const cumDisplay = n.cumNav !== null
            ? fmt(n.cumNav, 4)
            : '<span style="color:var(--text3);font-size:11px;">-</span>';
          return `
          <tr>
            <td>${n.date}</td>
            <td style="font-weight:600;">${fmt(n.nav, 4)}</td>
            <td>${label}</td>
            <td style="color:var(--accent);font-weight:600;">${cumDisplay}</td>
            <td style="color:var(--text3);font-size:11px;">${n.note || '-'}</td>
          </tr>
        `}).join('');

        const summaryEl = document.getElementById('nav-import-summary');
        if (summaryEl) {
          summaryEl.innerHTML = `共 ${pendingNavImport.length} 条（${typeLabel}）`;
        }

        previewEl.style.display = 'block';
        document.getElementById('import-count').textContent = pendingNavImport.length;
        document.getElementById('btn-confirm-import-nav').style.display = 'inline-flex';
        document.getElementById('btn-cancel-import-nav').style.display = 'inline-flex';

      } catch (err) {
        console.error(err);
        alert('Excel解析失败：' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  });

  document.getElementById('btn-confirm-import-nav').addEventListener('click', function() {
    if (pendingNavImport.length === 0 || !currentNavHistFundId) return;

    const fund = funds.find(f => f.id === currentNavHistFundId);
    if (!fund) return;

    fund.navHistory = fund.navHistory || [];

    let added = 0, skipped = 0;
    pendingNavImport.forEach(nav => {
      // 同一天同类型不能重复
      const exists = fund.navHistory.some(h => h.date === nav.date && h.type === nav.type);
      if (exists) {
        skipped++;
        return;
      }
      fund.navHistory.push({
        id: uuid(),
        date: nav.date,
        nav: nav.nav,
        cumNav: nav.cumNav !== null ? nav.cumNav : undefined,
        type: nav.type,
        note: nav.note || '批量导入'
      });
      added++;
    });

    fund.navHistory.sort((a, b) => a.date.localeCompare(b.date));

    if (fund.navHistory.length > 0) {
      const latest = fund.navHistory[fund.navHistory.length - 1];
      fund.latestNav = latest.nav;
      fund.navDate = latest.date;
    }

    DB.save('funds_v2', funds);

    cancelNavImport();
    renderNavHistoryTable(fund);
    openNavHistory(fund.id);

    if (currentDetailFundId) renderDetailBody(fund);
    renderPEFund();

    const unitAdded = pendingNavImport.filter(n => n.type === 'unit').length;
    const cumAdded = pendingNavImport.filter(n => n.type === 'cumulative').length;
    let msg = `✅ 导入完成：`;
    if (unitAdded > 0) msg += `单位净值 ${unitAdded} 条`;
    if (unitAdded > 0 && cumAdded > 0) msg += `，`;
    if (cumAdded > 0) msg += `累计净值 ${cumAdded} 条`;
    if (skipped > 0) msg += `；跳过 ${skipped} 条重复`;
    alert(msg);
  });

  document.getElementById('btn-cancel-import-nav').addEventListener('click', function() {
    cancelNavImport();
  });
}

function cancelNavImport() {
  pendingNavImport = [];
  const previewEl = document.getElementById('nav-import-preview');
  if (previewEl) previewEl.style.display = 'none';
  const confirmBtn = document.getElementById('btn-confirm-import-nav');
  const cancelBtn = document.getElementById('btn-cancel-import-nav');
  if (confirmBtn) confirmBtn.style.display = 'none';
  if (cancelBtn) cancelBtn.style.display = 'none';
}

// 分红金额实时预览 + 申购份额预览 + 退出预览
document.addEventListener('input', function(e) {
  if (e.target.id === 'div-per-share' || e.target.id === 'div-date') {
    updateDivPreview();
  }
  if (e.target.id === 'batch-amount' || e.target.id === 'batch-nav') {
    const amount = parseFloat(document.getElementById('batch-amount').value);
    const nav = parseFloat(document.getElementById('batch-nav').value);
    if (!isNaN(amount) && !isNaN(nav) && nav > 0) {
      document.getElementById('batch-shares-preview').value = fmt(amount / nav, 4) + ' 万份';
    } else {
      document.getElementById('batch-shares-preview').value = '';
    }
  }
  if (e.target.id === 'exit-batch-nav') {
    updateExitPreview();
  }
  if (e.target.id === 'stock-trade-price' || e.target.id === 'stock-trade-qty') {
    updateStockTradePreview();
  }
  if (e.target.id === 'futures-trade-price' || e.target.id === 'futures-trade-qty') {
    updateFuturesTradePreview();
  }

  // ===== 股票 Tab 切换 =====
  const stockTab = e.target.closest('[data-stock-tab]');
  if (stockTab) {
    currentStockTab = stockTab.dataset.stockTab;
    document.querySelectorAll('#stock-tabs .tab').forEach(t => t.classList.remove('active'));
    stockTab.classList.add('active');
    renderStockList();
    return;
  }

  // ===== 期货 Tab 切换 =====
  const futuresTab = e.target.closest('[data-futures-tab]');
  if (futuresTab) {
    currentFuturesTab = futuresTab.dataset.futuresTab;
    document.querySelectorAll('#futures-tabs .tab').forEach(t => t.classList.remove('active'));
    futuresTab.classList.add('active');
    renderFuturesList();
    return;
  }

  // ===== 股票 / 期货 CRUD（合并处理）=====
  const actEl = e.target.closest('[data-action]');
  if (actEl) {
    const action = actEl.dataset.action;
    const sid = actEl.dataset.stockId;
    const fid = actEl.dataset.futuresId;
    if (action === 'stock-buy') { openStockTrade(sid, 'buy'); return; }
    if (action === 'stock-sell') { openStockTrade(sid, 'sell'); return; }
    if (action === 'stock-delete') { closeDetail(); setTimeout(() => deleteStock(sid), 50); return; }
    if (action === 'stock-history') { openStockDetailPanel(sid); return; }
    if (action === 'edit-stock') { closeDetail(); setTimeout(() => openEditStock(sid), 100); return; }
    if (action === 'futures-open') { openFuturesTrade(fid, 'open'); return; }
    if (action === 'futures-close') { openFuturesTrade(fid, 'close'); return; }
    if (action === 'futures-delete') { closeDetail(); setTimeout(() => deleteFutures(fid), 50); return; }
    if (action === 'futures-history') { openFuturesDetailPanel(fid); return; }
    if (action === 'edit-futures') { closeDetail(); setTimeout(() => openEditFutures(fid), 100); return; }
  }

  // ===== 资讯搜索 =
  if (e.target.id === 'news-search') {
    renderNewsView();
  }

  // URL 快速识别框（输入完成自动识别）
  if (e.target.id === 'article-url-quick') {
    const v = e.target.value.trim();
    if (v.startsWith('http')) {
      setTimeout(parseArticleUrl, 300);
    }
  }
});

// ============================================================
// UTILS
// ============================================================
function updateStorageSize() {
  let total = 0;
  for (let k in localStorage) {
    if (localStorage.hasOwnProperty(k)) {
      total += (localStorage.getItem(k) || '').length;
    }
  }
  const kb = (total / 1024).toFixed(1);
  const el = document.getElementById('storage-size');
  if (el) el.textContent = kb + 'KB';
}

function updateDate() {
  const now = new Date();
  const el = document.getElementById('today-date');
  if (el) {
    el.textContent = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  }
}

// ============================================================
// ARTICLE AI ANALYSIS ENGINE（前端金融NLP）
// ============================================================

const AI_ENGINE = {

  // ─── 金融词典：主题 → 关键词 ───
  TOPIC_KEYWORDS: {
    '宏观经济': ['GDP','CPI','PPI','通胀','通缩','利率','货币政策','财政政策','美联储','央行','降息','加息','流动性','经济复苏','经济下行','就业','PMI','库存周期'],
    '政策监管': ['政策','监管','改革','刺激','补贴','双碳','碳中和','国产替代','扶持','减税','降准','降息','专项债','地方债'],
    '私募基金': ['私募','净值','回撤','夏普','阿尔法','贝塔','对冲','量化','主观多头','CTA','套利','策略','管理人','年化'],
    'A股行情': ['大盘','指数','涨停','跌停','A股','沪深','创业板','科创板','北交所','主力','北向资金','南下资金','融资','融券','换手率','放量','缩量'],
    '港股美股': ['港股','美股','恒生','纳斯达克','道琼斯','标普','外资','QFII','互联互通'],
    '半导体芯片': ['半导体','芯片','晶圆','代工','设计','封装','EDA','光刻机','存储','DRAM','NAND','英伟达','台积电','华为','海光'],
    '新能源': ['新能源','光伏','风电','储能','锂电','电池','氢能','充电桩','特斯拉','比亚迪','宁德时代','隆基'],
    '人工智能': ['AI','人工智能','大模型','ChatGPT','GPT','深度学习','算力','算法','GPU','数字经济','自动驾驶'],
    '消费医药': ['消费','医药','医疗','白酒','食品','茅台','创新药','CXO','集采','器械'],
    '金融地产': ['地产','房地产','银行','保险','券商','利差','城投','REITs','债务','违约','暴雷'],
    '大宗商品': ['原油','黄金','铜','铁矿石','煤炭','农产品','大宗商品','期货','商品期货'],
    '技术分析': ['支撑位','压力位','突破','趋势','均线','金叉','死叉','量能','箱体','头肩顶','底部','顶部','波段'],
    '基本面': ['业绩','财报','营收','利润','ROE','PE','PB','估值','分红','现金流','毛利率','净利率'],
  },

  // ─── 情感词典 ───
  POSITIVE_WORDS: [
    '看多','看好','乐观','买入','增持','强烈推荐','超预期','上涨','突破','创新高',
    '大幅增长','利好','机会','拐点','复苏','反弹','回升','好于预期','超额收益',
    '盈利','高增速','强劲','优质','低估','配置机会','底部确认','右侧布局',
  ],
  NEGATIVE_WORDS: [
    '看空','看淡','悲观','卖出','减持','规避','风险','下跌','破位','跌破',
    '利空','亏损','违约','暴雷','危机','回调','下行','低于预期','承压','恶化',
    '泡沫','高估','估值偏高','谨慎','不确定性','黑天鹅','流动性危机','信用风险',
  ],

  // ─── 行情高关联词（命中越多关联度越高）───
  HIGH_RELEVANCE_WORDS: [
    '建议买入','建议减持','目标价','强烈推荐','重点关注','重仓','核心资产',
    '超配','低配','调整仓位','止损','止盈','布局','右侧','左侧',
    '关注下方支撑','突破关键位','量能放大','主力资金',
  ],

  /**
   * 主分析函数
   * @param {string} text  原始文章文本
   * @returns {{ summary, tags, sentiment, relevance, details }}
   */
  analyze(text) {
    if (!text || text.trim().length < 10) return null;

    const clean = text.replace(/\s+/g, ' ').trim();

    // 1. 摘要：取前3个完整句子（以句号/！/？结尾）
    const sentences = clean.split(/[。！？!?]/).map(s => s.trim()).filter(s => s.length > 10);
    const summaryParts = sentences.slice(0, 3);
    let summary = summaryParts.join('。');
    if (summary.length > 200) summary = summary.substring(0, 200) + '……';
    if (!summary && clean.length > 0) summary = clean.substring(0, 150) + '……';

    // 2. 标签：按主题词典匹配
    const hitTopics = {};
    for (const [topic, keywords] of Object.entries(this.TOPIC_KEYWORDS)) {
      let hits = 0;
      keywords.forEach(kw => {
        const count = (clean.match(new RegExp(kw, 'g')) || []).length;
        hits += count;
      });
      if (hits > 0) hitTopics[topic] = hits;
    }
    // 取命中最多的 TOP 5 话题作为标签
    const tags = Object.entries(hitTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    // 3. 情感分析
    let posScore = 0, negScore = 0;
    this.POSITIVE_WORDS.forEach(w => { if (clean.includes(w)) posScore++; });
    this.NEGATIVE_WORDS.forEach(w => { if (clean.includes(w)) negScore++; });
    let sentiment = 0;
    if (posScore > negScore + 1) sentiment = 1;
    else if (negScore > posScore + 1) sentiment = -1;

    // 4. 行情关联度（1-5）
    let relevanceScore = 0;
    const totalTopicHits = Object.values(hitTopics).reduce((a, b) => a + b, 0);
    relevanceScore += Math.min(2, Math.floor(totalTopicHits / 5));  // 词频越高关联度越高
    this.HIGH_RELEVANCE_WORDS.forEach(w => { if (clean.includes(w)) relevanceScore++; });
    if (hitTopics['A股行情'] || hitTopics['技术分析']) relevanceScore++;
    if (hitTopics['私募基金']) relevanceScore++;
    const relevance = Math.min(5, Math.max(1, relevanceScore));

    return {
      summary,
      tags,
      sentiment,
      relevance,
      details: {
        posScore,
        negScore,
        totalTopicHits,
        hitTopics,
      }
    };
  }
};

// AI 分析并填充表单
function runAiAnalysis() {
  const text = document.getElementById('article-rawtext').value.trim();
  const statusEl = document.getElementById('ai-analyze-status');
  const previewEl = document.getElementById('ai-result-preview');

  if (!text || text.length < 20) {
    statusEl.textContent = '⚠️ 请先粘贴文章内容（至少20个字）';
    statusEl.style.color = 'var(--yellow)';
    return;
  }

  statusEl.textContent = '⏳ 分析中...';
  statusEl.style.color = 'var(--text3)';

  // 用 setTimeout 模拟异步，避免界面卡顿
  setTimeout(() => {
    const result = AI_ENGINE.analyze(text);
    if (!result) {
      statusEl.textContent = '❌ 分析失败，请检查输入内容';
      return;
    }

    // 自动填充表单字段
    document.getElementById('article-summary').value = result.summary;
    document.getElementById('article-sentiment').value = result.sentiment;
    document.getElementById('article-relevance').value = result.relevance;
    document.getElementById('article-tags').value = result.tags.join(', ');

    // 情感标签文字
    const sentimentLabel = { '-1': '🔴 负面', '0': '⚪ 中性', '1': '🟢 正面' }[result.sentiment + ''];
    const relevanceStars = '⭐'.repeat(result.relevance);

    // 显示分析结果预览
    const topicsHtml = Object.entries(result.details.hitTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([topic, cnt]) =>
        `<span class="tag tag-blue" style="margin:2px;">${topic}<span style="opacity:0.6;margin-left:3px;">${cnt}</span></span>`
      ).join('');

    previewEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <span style="font-weight:600;color:var(--green);">✅ AI分析完成，已自动填入表单</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div><span style="color:var(--text3);">情感倾向：</span>${sentimentLabel}</div>
        <div><span style="color:var(--text3);">行情关联：</span>${relevanceStars}（${result.relevance}/5）</div>
        <div><span style="color:var(--text3);">正面信号：</span><span style="color:var(--red);">+${result.details.posScore}</span></div>
        <div><span style="color:var(--text3);">负面信号：</span><span style="color:var(--green);">-${result.details.negScore}</span></div>
      </div>
      <div style="margin-bottom:6px;"><span style="color:var(--text3);">识别主题：</span>${topicsHtml || '<span style="color:var(--text3);">无明显主题</span>'}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:8px;">💡 以上结果已填入下方表单，可以手动修改后保存</div>
    `;
    previewEl.style.display = 'block';
    statusEl.textContent = '✅ 分析完成';
    statusEl.style.color = 'var(--green)';
    // 步骤推进到第3步
    updateStepIndicator(3);
  }, 300);
}

// 折叠/展开 AI 分析区
function toggleAiZone() {
  const body = document.getElementById('ai-zone-body');
  const btn = document.getElementById('btn-toggle-ai-zone');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    btn.textContent = '收起';
  } else {
    body.style.display = 'none';
    btn.textContent = '展开';
  }
}

// ─── URL 智能识别 ───
// 从微信公众号链接中尝试提取公众号名称和日期（基于URL参数规律）
function parseArticleUrl() {
  const urlInput = document.getElementById('article-url-quick');
  const hintEl = document.getElementById('url-parse-hint');
  const url = urlInput.value.trim();

  if (!url) { hintEl.style.display = 'none'; return; }

  // 填入链接字段
  document.getElementById('article-url').value = url;

  // 识别微信公众号
  if (url.includes('mp.weixin.qq.com') || url.includes('weixin.qq.com')) {
    // 尝试从URL参数提取时间戳
    let detectedDate = '';
    const tsMatch = url.match(/[?&]__biz=([^&]+)/);
    // 微信文章 publish_time 或 sn 参数（无法直接解析日期，提示用户手动确认）
    detectedDate = new Date().toISOString().slice(0, 10); // 默认今天

    // 设置公众号名称提示
    hintEl.innerHTML = `✅ 已识别为<strong>微信公众号文章</strong>，链接已填入。请：<br>
      1. 填写公众号名称（如：雪球、格隆汇等）<br>
      2. 把文章正文粘贴到下方文本框，点击「✨ 一键AI分析」自动生成摘要`;
    hintEl.style.display = 'block';
    hintEl.style.color = 'var(--accent2)';

    // 自动设置日期为今天（用户手动改）
    document.getElementById('article-date').value = detectedDate;

    // 滚动到公众号名称输入框，提示用户填写
    setTimeout(() => {
      const srcInput = document.getElementById('article-source');
      srcInput.focus();
      srcInput.style.borderColor = 'var(--accent)';
      setTimeout(() => srcInput.style.borderColor = '', 2000);
    }, 200);

  } else if (url.startsWith('http')) {
    // 尝试从URL提取域名作为来源提示
    let domain = '';
    try { domain = new URL(url).hostname.replace('www.', ''); } catch(e) {}
    hintEl.innerHTML = `✅ 链接已填入。来源域名：${domain}`;
    hintEl.style.display = 'block';
    hintEl.style.color = 'var(--text3)';
    document.getElementById('article-date').value = new Date().toISOString().slice(0, 10);
  } else {
    hintEl.innerHTML = '⚠️ 请输入完整的 https:// 开头的链接';
    hintEl.style.display = 'block';
    hintEl.style.color = 'var(--yellow)';
  }
}

// 步骤指示器更新
function updateStepIndicator(step) {
  [1, 2, 3].forEach(i => {
    const el = document.getElementById('step-indicator-' + i);
    if (!el) return;
    if (i < step) {
      el.style.color = 'var(--green)';
      el.style.background = 'rgba(16,185,129,0.1)';
      el.style.borderColor = 'rgba(16,185,129,0.3)';
      el.querySelector('span').style.background = 'var(--green)';
    } else if (i === step) {
      el.style.color = 'var(--accent)';
      el.style.background = 'rgba(59,130,246,0.1)';
      el.style.borderColor = 'rgba(59,130,246,0.3)';
      el.querySelector('span').style.background = 'var(--accent)';
    } else {
      el.style.color = 'var(--text3)';
      el.style.background = 'var(--bg3)';
      el.style.borderColor = 'var(--border)';
      el.querySelector('span').style.background = 'var(--text3)';
    }
  });
}

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

// ============================================================
// INIT
// ============================================================
function init() {
  updateDate();
  renderPEFund();
  updateStorageSize();
  initExcelImport();
  initNewsPage();
  initKnowledgePage();
  renderVoteCardsPending();
  updateVoteHistoryCount();

  // 导入文件事件绑定
  document.getElementById('import-file-input').addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
      importAllData(e.target.files[0]);
      e.target.value = ''; // 重置以便下次选择同一文件
    }
  });

  // 大师投票按钮
  document.getElementById('btn-run-vote').addEventListener('click', runVote);

  // 投票页 Enter 快捷提交
  document.getElementById('vote-position').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runVote();
    }
  });

  // 保存投票按钮
  document.getElementById('btn-save-vote').addEventListener('click', saveCurrentVote);

  // 投票 Tab 切换
  document.getElementById('vote-tabs').addEventListener('click', function(e) {
    const tab = e.target.closest('[data-vote-tab]');
    if (tab) {
      switchVoteTab(tab.dataset.voteTab);
    }
  });
}

init();
