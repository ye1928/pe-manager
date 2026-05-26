// ============================================================
// ATTRIBUTION ANALYSIS
// ============================================================
let attrSourceChart = null;
let attrRankChart = null;
let attrAllocationChart = null;
let attrPnlChart = null;
let currentPortfolioSubTab = 'build';

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
    { label: '基金', value: totalFundGain, color: '#3b82f6' },
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
    { label: '基金', value: totalFundCost, color: '#3b82f6' },
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
let corrSkipAutoSelect = false;
let selectedNavFitFunds = new Set();
let navFitChart = null;
let navFitNavMode = 'unit'; // 'unit' = 单位净值, 'cum' = 累计净值
let navFitStartDate = null; // 净值拟合开始日期
let navFitEndDate = null;   // 净值拟合结束日期
let periodMode = 'all'; // 'all' | 'year' | 'custom'
let periodChart = null;

function switchNavFitMode(mode) {
  navFitNavMode = mode;
  document.getElementById('navfit-mode-unit').classList.toggle('active', mode === 'unit');
  document.getElementById('navfit-mode-cum').classList.toggle('active', mode === 'cum');
  renderNavFit();
}

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
    if (currentAttrTab === 'portfolio') switchPortfolioSubTab(currentPortfolioSubTab);
    if (currentAttrTab === 'period') renderPeriodAnalysis();
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
  const selFunds = funds.filter(f => selectedIds.has(String(f.id)));

  // Pearson correlation - 每对基金严格按共同日期对齐
  const ids = selFunds.map(f => f.id);
  const n = ids.length;
  const corr = {};
  const nullReason = {}; // 记录 null 原因
  for (let i = 0; i < n; i++) {
    corr[ids[i]] = {};
    nullReason[ids[i]] = {};
    for (let j = 0; j < n; j++) {
      if (i === j) { corr[ids[i]][ids[j]] = 1; continue; }

      const fundI = funds.find(f => f.id === ids[i]);
      const fundJ = funds.find(f => f.id === ids[j]);
      const datesI = (fundI?.navHistory || []).map(n => n.date).sort();
      const datesJ = (fundJ?.navHistory || []).map(n => n.date).sort();
      const navMapI = {};
      const navMapJ = {};
      (fundI?.navHistory || []).forEach(n => {
        navMapI[n.date] = Number(n.cumNav != null ? n.cumNav : n.nav);
      });
      (fundJ?.navHistory || []).forEach(n => {
        navMapJ[n.date] = Number(n.cumNav != null ? n.cumNav : n.nav);
      });

      const commonDates = datesI.filter(d => navMapJ[d] !== undefined);
      if (commonDates.length < 6) {
        corr[ids[i]][ids[j]] = null;
        nullReason[ids[i]][ids[j]] = `共同日期仅 ${commonDates.length} 天（需 ≥6）`;
        continue;
      }

      const ri = [], rj = [];
      for (let k = 1; k < commonDates.length; k++) {
        const prevDate = commonDates[k - 1];
        const currDate = commonDates[k];
        const prevI = navMapI[prevDate], currI = navMapI[currDate];
        const prevJ = navMapJ[prevDate], currJ = navMapJ[currDate];
        if (prevI > 0 && prevJ > 0) {
          ri.push((currI - prevI) / prevI);
          rj.push((currJ - prevJ) / prevJ);
        }
      }

      const len = ri.length;
      if (len < 5) {
        corr[ids[i]][ids[j]] = null;
        nullReason[ids[i]][ids[j]] = `收益率样本仅 ${len} 个（需 ≥5）`;
        continue;
      }

      const meanI = ri.reduce((a, b) => a + b, 0) / len;
      const meanJ = rj.reduce((a, b) => a + b, 0) / len;
      const cov = ri.reduce((s, v, k) => s + (v - meanI) * (rj[k] - meanJ), 0);
      const stdI = Math.sqrt(ri.reduce((s, v) => s + (v - meanI) ** 2, 0));
      const stdJ = Math.sqrt(rj.reduce((s, v) => s + (v - meanJ) ** 2, 0));
      corr[ids[i]][ids[j]] = stdI > 0 && stdJ > 0 ? cov / (stdI * stdJ) : null;
      if (corr[ids[i]][ids[j]] === null) {
        nullReason[ids[i]][ids[j]] = '收益率标准差为0（无波动）';
      }
    }
  }
  return { corr, ids, funds: selFunds, nullReason };
}

// 诊断：获取两只基金的相关性计算详情（用于调试）
function getCorrelationDiag(fundA, fundB) {
  const datesA = (fundA.navHistory || []).map(n => n.date).sort();
  const datesB = (fundB.navHistory || []).map(n => n.date).sort();
  const navMapA = {};
  const navMapB = {};
  (fundA.navHistory || []).forEach(n => { navMapA[n.date] = Number(n.cumNav != null ? n.cumNav : n.nav); });
  (fundB.navHistory || []).forEach(n => { navMapB[n.date] = Number(n.cumNav != null ? n.cumNav : n.nav); });

  const commonDates = datesA.filter(d => navMapB[d] !== undefined);

  const ri = [], rj = [];
  for (let k = 1; k < commonDates.length; k++) {
    const prevDate = commonDates[k - 1];
    const currDate = commonDates[k];
    const prevA = navMapA[prevDate];
    const currA = navMapA[currDate];
    const prevB = navMapB[prevDate];
    const currB = navMapB[currDate];
    if (prevA > 0 && prevB > 0) {
      ri.push((currA - prevA) / prevA);
      rj.push((currB - prevB) / prevB);
    }
  }

  return {
    commonDatesCount: commonDates.length,
    returnPoints: ri.length,
    dateRange: commonDates.length >= 2 ? `${commonDates[0]} ~ ${commonDates[commonDates.length - 1]}` : '-',
    fundADates: datesA.length,
    fundBDates: datesB.length,
    meanReturnA: ri.length > 0 ? ri.reduce((a, b) => a + b, 0) / ri.length : null,
    meanReturnB: rj.length > 0 ? rj.reduce((a, b) => a + b, 0) / rj.length : null,
    sample: ri.length >= 5 ? ri.slice(0, 3).map((v, i) => ({
      date: commonDates[i + 1],
      retA: (v * 100).toFixed(2) + '%',
      retB: (rj[i] * 100).toFixed(2) + '%'
    })) : []
  };
}

function corrColor(val) {
  if (val === null) return '#e2e8f0';
  const abs = Math.abs(val);
  // 弱相关不染色（|r| < 0.3 保持白/浅灰）
  if (abs < 0.3) {
    return '#f8fafc';
  }
  // 0.3..1.0 映射到 0..1，用于控制饱和度
  const s = (abs - 0.3) / 0.7;
  if (val >= 0) {
    // 正相关：浅红 → 深红（#fef2f2 → #ef4444）
    const r = Math.round(254 - (254 - 239) * s);
    const g = Math.round(242 - (242 - 68) * s);
    const b = Math.round(242 - (242 - 68) * s);
    return `rgb(${r},${g},${b})`;
  } else {
    // 负相关：浅绿 → 深绿（#f0fdf4 → #22c55e）
    const r = Math.round(240 - (240 - 34) * s);
    const g = Math.round(253 - (253 - 197) * s);
    const b = Math.round(244 - (244 - 94) * s);
    return `rgb(${r},${g},${b})`;
  }
}

function corrTextColor(val) {
  if (val === null) return '#94a3b8';
  // 强相关（|r|>0.7）用白色文字，其余用深色
  return Math.abs(val) > 0.7 ? '#fff' : '#475569';
}

function renderCorrelation() {
  const allCorrFunds = getCorrelationFunds();
  if (allCorrFunds.length === 0) {
    document.getElementById('corr-heatmap').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text3);">至少需要2只以上有10条以上净值数据的基金才能计算相关性</div>';
    document.getElementById('corr-summary').innerHTML = '';
    document.getElementById('corr-pairs-list').innerHTML = '';
    const diagPanel = document.querySelector('.corr-diag-panel');
    if (diagPanel) diagPanel.remove();
    return;
  }

  // Render fund chips (selector)
  const selDiv = document.getElementById('corr-fund-selector');
  // Default: select all (unless user explicitly cleared)
  if (selectedCorrFunds.size === 0 && !corrSkipAutoSelect) {
    allCorrFunds.forEach(f => selectedCorrFunds.add(String(f.id)));
  }
  corrSkipAutoSelect = false;
  selDiv.innerHTML = allCorrFunds.map((f, i) => {
    const sel = selectedCorrFunds.has(String(f.id)) ? 'selected' : '';
    const color = CORR_COLORS[i % CORR_COLORS.length];
    return `<span class="corr-chip ${sel}" data-corr-id="${f.id}" data-corr-idx="${i}" style="${sel ? `background:${color};border-color:${color};` : ''}">
      <span class="chip-dot" style="background:${color}"></span>${f.name.length > 8 ? f.name.slice(0, 8) + '…' : f.name}
    </span>`;
  }).join('');

  // Chip click
  selDiv.querySelectorAll('.corr-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = String(chip.dataset.corrId);
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

  const btnAll = document.getElementById('corr-select-all');
  const btnClear = document.getElementById('corr-select-clear');
  if (btnAll) {
    btnAll.onclick = () => {
      getCorrelationFunds().forEach(f => selectedCorrFunds.add(String(f.id)));
      renderCorrelation();
    };
  }
  if (btnClear) {
    btnClear.onclick = () => {
      selectedCorrFunds.clear();
      corrSkipAutoSelect = true;
      renderCorrelation();
    };
  }

  if (selectedCorrFunds.size < 2) {
    document.getElementById('corr-heatmap').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text3);">请选择至少2只基金以计算相关性</div>';
    document.getElementById('corr-summary').innerHTML = '';
    document.getElementById('corr-pairs-list').innerHTML = '';
    const diagPanel = document.querySelector('.corr-diag-panel');
    if (diagPanel) diagPanel.remove();
    return;
  }

  const result = calcCorrelationMatrix(selectedCorrFunds);
  if (!result) {
    document.getElementById('corr-heatmap').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text3);">净值数据不足以计算相关性（需至少5个共同交易日）</div>';
    document.getElementById('corr-summary').innerHTML = '';
    document.getElementById('corr-pairs-list').innerHTML = '';
    const diagPanel = document.querySelector('.corr-diag-panel');
    if (diagPanel) diagPanel.remove();
    return;
  }
  const { corr, ids, funds: selFunds, nullReason } = result;

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
      if (v === null) {
        const reason = nullReason?.[rowId]?.[colId] || '数据不足';
        return `<td><div class="corr-cell" style="background:#e2e8f0;color:#94a3b8;cursor:help;" title="${nameMap[rowId]} vs ${nameMap[colId]}：${reason}">—</div></td>`;
      }
      const bg = corrColor(v);
      const tc = corrTextColor(v);
      return `<td><div class="corr-cell" style="background:${bg};color:${tc};" title="${nameMap[rowId]} vs ${nameMap[colId]}: ${v.toFixed(3)}">${v.toFixed(2)}</div></td>`;
    }).join('');
    return `<tr><th title="${nameMap[rowId]}" style="color:${CORR_COLORS[selFunds.findIndex(f=>f.id===rowId) % CORR_COLORS.length]};">${displayNames[i]}</th>${cells}</tr>`;
  }).join('');

  document.getElementById('corr-heatmap').innerHTML =
    `<table class="corr-heatmap-table"><thead><tr><th></th>${headerTh}</tr></thead><tbody>${rows}</tbody></table>`;

  // 诊断信息：显示选中基金的相关性计算详情
  const diagPairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const fi = selFunds.find(f => f.id === ids[i]);
      const fj = selFunds.find(f => f.id === ids[j]);
      const v = corr[ids[i]][ids[j]];
      if (fi && fj) {
        const diag = getCorrelationDiag(fi, fj);
        diagPairs.push({ fi, fj, v, diag });
      }
    }
  }
  diagPairs.sort((a, b) => Math.abs(b.v || 0) - Math.abs(a.v || 0));

  // 诊断信息：默认折叠，点击展开
  let diagHtml = '';
  diagHtml += '<div class="card" style="margin-top:16px;padding:0;overflow:hidden;">';
  diagHtml += '<div id="corr-diag-toggle" style="padding:12px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:var(--bg2);border-bottom:1px solid transparent;transition:border-color 0.2s;" onclick="toggleCorrDiag()">';
  diagHtml += '<div><span style="font-size:13px;font-weight:600;color:var(--text);">📊 相关性诊断</span><span style="font-size:11px;color:var(--text3);margin-left:8px;">以下信息帮助你判断相关性低是「样本不足」还是「走势确实不同」</span></div>';
  diagHtml += '<span id="corr-diag-arrow" style="font-size:14px;color:var(--text3);transition:transform 0.2s;">▶</span>';
  diagHtml += '</div>';
  diagHtml += '<div id="corr-diag-content" style="display:none;padding:12px;">';
  diagHtml += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;">';
  diagPairs.forEach(p => {
    const vStr = p.v === null ? '—' : (p.v >= 0 ? '+' : '') + p.v.toFixed(3);
    const color = p.v === null ? '#94a3b8' : (p.v >= 0 ? 'var(--red)' : 'var(--green)');
    diagHtml += `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-weight:600;color:var(--accent);">${p.fi.name} vs ${p.fj.name}</span>
          <span style="font-weight:700;color:${color};">${vStr}</span>
        </div>
        <div style="color:var(--text3);line-height:1.6;">
          <div>📅 共同日期：<b style="color:var(--text2);">${p.diag.commonDatesCount}</b> 天（${p.fi.name} ${p.diag.fundADates} 天 / ${p.fj.name} ${p.diag.fundBDates} 天）</div>
          <div>📈 收益率样本：<b style="color:var(--text2);">${p.diag.returnPoints}</b> 个点</div>
          <div>🗓️ 日期范围：${p.diag.dateRange}</div>
          ${p.diag.returnPoints >= 5 ? `
          <div>📊 平均日收益：${p.fi.name} ${(p.diag.meanReturnA * 100).toFixed(3)}% / ${p.fj.name} ${(p.diag.meanReturnB * 100).toFixed(3)}%</div>
          ` : '<div style="color:var(--red);">⚠️ 样本量不足，无法可靠计算相关</div>'}
        </div>
      </div>
    `;
  });
  diagHtml += '</div></div></div>';

  // 把诊断信息插入到热力图容器末尾
  const heatmapContainer = document.getElementById('corr-heatmap-container');
  let existingDiag = heatmapContainer.querySelector('.corr-diag-panel');
  if (existingDiag) existingDiag.remove();
  const diagDiv = document.createElement('div');
  diagDiv.className = 'corr-diag-panel';
  diagDiv.innerHTML = diagHtml;
  heatmapContainer.appendChild(diagDiv);

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

function toggleCorrDiag() {
  const content = document.getElementById('corr-diag-content');
  const arrow = document.getElementById('corr-diag-arrow');
  const toggle = document.getElementById('corr-diag-toggle');
  if (!content) return;
  if (content.style.display === 'none') {
    content.style.display = 'block';
    if (arrow) arrow.style.transform = 'rotate(90deg)';
    if (toggle) toggle.style.borderBottomColor = 'var(--border)';
  } else {
    content.style.display = 'none';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
    if (toggle) toggle.style.borderBottomColor = 'transparent';
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
  // 清理之前残留的 date-range-hint div
  document.querySelectorAll('.date-range-hint').forEach(el => el.remove());

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

  // Build NAV maps (use cumulative NAV for accurate return calculation)
  const navMaps = {};
  allocFunds.forEach(f => {
    navMaps[f.id] = {};
    (f.navHistory || []).forEach(n => { navMaps[f.id][n.date] = Number(n.cumNav != null ? n.cumNav : n.nav); });
  });

  // 取各基金数据区间的交集：最晚起始日 → 最早结束日
  let maxStart = null, minEnd = null;
  allocFunds.forEach(f => {
    const dates = Object.keys(navMaps[f.id]).sort();
    if (dates.length === 0) return;
    if (!maxStart || dates[0] > maxStart) maxStart = dates[0];
    if (!minEnd || dates[dates.length - 1] < minEnd) minEnd = dates[dates.length - 1];
  });

  if (!maxStart || !minEnd || maxStart >= minEnd) {
    document.getElementById('portfolio-chart').parentElement.innerHTML =
      '<div style="text-align:center;padding:60px;color:var(--text3);">所选基金净值数据日期区间无交集，无法计算组合走势</div>';
    document.getElementById('portfolio-summary').innerHTML = '';
    document.getElementById('portfolio-stats').innerHTML = '';
    if (portfolioChart) { portfolioChart.destroy(); portfolioChart = null; }
    return;
  }

  // 在交集区间内生成所有日期，缺失净值用前值填充
  const commonDates = [];
  const cur = new Date(maxStart);
  const end = new Date(minEnd);
  while (cur <= end) {
    commonDates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }

  // 每只基金在交集区间内归一化到 1.0（起点对齐），缺失值前向填充
  const normNavMaps = {};
  allocFunds.forEach(f => {
    const base = navMaps[f.id][maxStart];
    normNavMaps[f.id] = {};
    let lastNav = base;
    commonDates.forEach(d => {
      if (navMaps[f.id][d] !== undefined) lastNav = navMaps[f.id][d];
      normNavMaps[f.id][d] = lastNav / base;
    });
  });

  // Compute weighted portfolio NAV at each date
  const portfolioSeries = [];
  const fundSeriesMap = {};
  allocFunds.forEach(f => { fundSeriesMap[f.id] = []; });

  for (const d of commonDates) {
    let weightedNav = 0;
    allocFunds.forEach(f => {
      const nav = normNavMaps[f.id][d];
      weightedNav += nav * (portfolioAlloc[f.id] / totalAmt);
      fundSeriesMap[f.id].push({ date: d, nav });
    });
    portfolioSeries.push({ date: d, nav: weightedNav });
  }

  // 组合已归一化到 1.0
  const normPortfolio = portfolioSeries;

  // Summary cards
  const finalNav = normPortfolio.length > 0 ? normPortfolio[normPortfolio.length - 1].nav : 1;
  const totalReturn = finalNav - 1;
  const firstDate = normPortfolio.length > 0 ? normPortfolio[0].date : '-';
  const lastDate = normPortfolio.length > 0 ? normPortfolio[normPortfolio.length - 1].date : '-';

  // Compute max drawdown
  let peak = 1, maxDD = 0;
  normPortfolio.forEach(p => { if (p.nav > peak) peak = p.nav; const dd = (peak - p.nav) / peak; if (dd > maxDD) maxDD = dd; });

  // Annualized return: CAGR（供风险指标）+ 单利（供UI展示）
  const days = normPortfolio.length > 1
    ? Math.max(1, (new Date(normPortfolio[normPortfolio.length - 1].date) - new Date(normPortfolio[0].date)) / 86400000)
    : 1;
  const years = days / 365;
  const annualizedCAGR = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
  const annualizedSimple = years > 0 ? totalReturn / years : 0;

  document.getElementById('portfolio-summary').innerHTML = `
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">区间收益率</div>
      <div style="font-size:18px;font-weight:700;color:${totalReturn >= 0 ? 'var(--red)' : 'var(--green)'};">${totalReturn >= 0 ? '+' : ''}${(totalReturn * 100).toFixed(1)}%</div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">复利年化（CAGR）</div>
      <div style="font-size:18px;font-weight:700;color:${annualizedCAGR >= 0 ? 'var(--red)' : 'var(--green)'};">${annualizedCAGR >= 0 ? '+' : ''}${(annualizedCAGR * 100).toFixed(1)}%</div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">单利年化</div>
      <div style="font-size:28px;font-weight:700;color:${annualizedSimple >= 0 ? 'var(--red)' : 'var(--green)'};">${annualizedSimple >= 0 ? '+' : ''}${(annualizedSimple * 100).toFixed(1)}%</div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">最大回撤</div>
      <div style="font-size:18px;font-weight:700;color:var(--red);">-${(maxDD * 100).toFixed(1)}%</div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px;">组合净值最低 ${(1 - maxDD).toFixed(3)}</div>
    </div>
    <div style="grid-column:1/-1;text-align:center;font-size:11px;color:var(--text3);padding-top:4px;">📅 计算区间：${firstDate} 至 ${lastDate}（共 ${days.toFixed(0)} 天）</div>
  `;

  // Stats table
  const fmtRet = v => `<span style="color:${v >= 0 ? 'var(--red)' : 'var(--green)'};font-weight:600;">${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%</span>`;
  document.getElementById('portfolio-stats').innerHTML = `
    <table>
      <thead><tr><th>基金</th><th>配置（万）</th><th>权重</th><th>区间收益</th><th>复利年化</th><th>单利年化</th><th>最大回撤</th></tr></thead>
      <tbody>
        ${allocFunds.map((f, i) => {
          const amt = portfolioAlloc[f.id] || 0;
          const w = totalAmt > 0 ? ((amt / totalAmt) * 100).toFixed(1) : '0.0';
          const fBase = navMaps[f.id][commonDates[0]];
          const fNorm = commonDates.map(d => ({ date: d, nav: navMaps[f.id][d] / fBase }));
          const fFinal = fNorm.length > 0 ? fNorm[fNorm.length - 1].nav : 1;
          const fRet = fFinal - 1;
          const fDays = commonDates.length > 1 ? Math.max(1, (new Date(commonDates[commonDates.length-1]) - new Date(commonDates[0])) / 86400000) : 1;
          const fYears = fDays / 365;
          const fAnnCAGR = fYears > 0 ? Math.pow(1 + fRet, 1 / fYears) - 1 : 0;
          const fAnnSimple = fYears > 0 ? fRet / fYears : 0;
          let fPeak = 1, fDD = 0;
          fNorm.forEach(p => { if (p.nav > fPeak) fPeak = p.nav; const dd = (fPeak - p.nav) / fPeak; if (dd > fDD) fDD = dd; });
          const color = CORR_COLORS[allFunds.findIndex(x => x.id === f.id) % CORR_COLORS.length];
          return `<tr>
            <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:5px;"></span>${f.name}</td>
            <td>${amt.toFixed(0)}</td>
            <td>${w}%</td>
            <td>${fmtRet(fRet)}</td>
            <td>${fmtRet(fAnnCAGR)}</td>
            <td>${fmtRet(fAnnSimple)}</td>
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
    // Individual funds as background（已归一化到1.0起点）
    ...allocFunds.map((f, i) => {
      const fSeries = fundSeriesMap[f.id];
      const color = CORR_COLORS[allFunds.findIndex(x => x.id === f.id) % CORR_COLORS.length];
      return {
        label: f.name + '（单只）',
        data: fSeries.map(p => ({ x: p.date, y: p.nav })),
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
    const chartWrap = document.getElementById('navfit-chart').parentElement;
    document.getElementById('navfit-chart').style.display = 'none';
    let emptyMsg = chartWrap.querySelector('#navfit-empty-msg');
    if (!emptyMsg) {
      emptyMsg = document.createElement('div');
      emptyMsg.id = 'navfit-empty-msg';
      emptyMsg.style.cssText = 'text-align:center;padding:60px;color:var(--text3);';
      emptyMsg.textContent = '暂无净值数据，请先为基金录入净值历史';
      chartWrap.appendChild(emptyMsg);
    }
    document.getElementById('navfit-summary').innerHTML = '';
    document.getElementById('navfit-stats-table').innerHTML = '';
    return;
  }

  // Selector chips
  const selDiv = document.getElementById('navfit-fund-selector');
  selDiv.innerHTML = allNavFitFunds.map((f, i) => {
    const sel = selectedNavFitFunds.has(String(f.id)) ? 'selected' : '';
    const color = CORR_COLORS[i % CORR_COLORS.length];
    return `<span class="navfit-chip ${sel}" data-navfit-id="${f.id}" style="${sel ? `color:${color};border-color:${color};background:color-mix(in srgb,${color} 12%,transparent);` : ''}">
      <span class="chip-dot" style="background:${color}"></span>${f.name.length > 8 ? f.name.slice(0, 8) + '…' : f.name}
    </span>`;
  }).join('');

  selDiv.querySelectorAll('.navfit-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = String(chip.dataset.navfitId);
      const idx = allNavFitFunds.findIndex(f => String(f.id) === id);
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
    allNavFitFunds.forEach(f => selectedNavFitFunds.add(String(f.id)));
    renderNavFit();
  };
  document.getElementById('navfit-select-clear').onclick = () => {
    selectedNavFitFunds.clear();
    renderNavFit();
  };
  document.getElementById('navfit-compare-mode').onchange = () => renderNavFit();

  // 日期范围选择器
  const startDateInput = document.getElementById('navfit-start-date');
  const endDateInput = document.getElementById('navfit-end-date');
  if (startDateInput && endDateInput) {
    startDateInput.onchange = () => { navFitStartDate = startDateInput.value || null; renderNavFit(); };
    endDateInput.onchange = () => { navFitEndDate = endDateInput.value || null; renderNavFit(); };
    document.getElementById('navfit-date-clear').onclick = () => {
      startDateInput.value = '';
      endDateInput.value = '';
      navFitStartDate = null;
      navFitEndDate = null;
      renderNavFit();
    };
  }

  // 基准基金下拉框
  const benchSel = document.getElementById('navfit-benchmark');
  if (benchSel) {
    const currentVal = benchSel.value;
    benchSel.innerHTML = '<option value="">-- 请选择基准基金 --</option>';
    allNavFitFunds.forEach(f => {
      const opt = document.createElement('option');
      opt.value = String(f.id);
      opt.textContent = f.name;
      if (String(f.id) === currentVal) opt.selected = true;
      benchSel.appendChild(opt);
    });
    benchSel.onchange = () => { renderNavFit(); };
  }


  const selFunds = allNavFitFunds.filter(f => selectedNavFitFunds.has(String(f.id)));

  // 如果勾了横向对比且没选区间起点，计算共同起点（所有基金中最晚的第一个日期）
  let commonStartDate = null;
  if (navFitCompareMode && !navFitStartDate) {
    selFunds.forEach(f => {
      let navs = (f.navHistory || []).slice().sort((a, b) => a.date.localeCompare(b.date));
      if (navFitEndDate) navs = navs.filter(n => n.date <= navFitEndDate);
      if (navs.length > 0) {
        if (!commonStartDate || navs[0].date > commonStartDate) {
          commonStartDate = navs[0].date;
        }
      }
    });
  }

  // ========================================
  // 统计表格 & 汇总卡片：始终显示全部基金
  // ========================================
  const fmtRet = v => `<span style="color:${v >= 0 ? 'var(--red)' : 'var(--green)'};font-weight:600;">${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%</span>`;
  const fmtVal = (v, decimals) => (v == null || isNaN(v)) ? '--' : v.toFixed(decimals);
  const fmtPerf = p => {
    if (!p) {
      return `<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>`;
    }
    const fmtRecovery = d => (d == null) ? '--' : `${d}天`;
    const fmtWinLose = (w, l) => (w == null && l == null) ? '--' : `${Math.round(w || 0)}天/${Math.round(l || 0)}天`;
    return `
    <td>${fmtRet(p.totalReturn)}</td>
    <td>${fmtRet(p.annualizedReturn)}</td>
    <td style="font-size:13px;color:var(--text3);">${p.annualizedReturnSimple != null ? fmtRet(p.annualizedReturnSimple) : '--'}</td>
    <td>${p.annualizedVol != null ? fmtVal(p.annualizedVol * 100, 1) + '%' : '--'}</td>
    <td style="color:${p.maxDrawdown >= 0 ? 'var(--red)' : 'var(--green)'};font-weight:600;">${fmtVal(p.maxDrawdown * 100, 1)}%</td>
    <td style="color:${p.sharpe == null ? 'var(--text3)' : (p.sharpe >= 0 ? 'var(--red)' : 'var(--green)')};font-weight:600;">${fmtVal(p.sharpe, 2)}</td>
    <td style="color:${p.calmar >= 0 ? 'var(--red)' : 'var(--green)'};font-weight:600;">${fmtVal(p.calmar, 2)}</td>
    <td style="color:${p.infoRatio == null ? 'var(--text3)' : (p.infoRatio >= 0 ? 'var(--red)' : 'var(--green)')};font-weight:600;">${fmtVal(p.infoRatio, 2)}</td>
    <td style="color:var(--text2);font-weight:600;">${fmtVal(p.positiveRate * 100, 0)}%</td>
    <td style="color:${p.sortino == null ? 'var(--text3)' : (p.sortino >= 0 ? 'var(--red)' : 'var(--green)')};font-weight:600;">${fmtVal(p.sortino, 2)}</td>
    <td style="color:${p.profitLossRatio == null ? 'var(--text3)' : (Math.round(p.profitLossRatio * 100) / 100 >= 1 ? 'var(--red)' : 'var(--green)')};font-weight:600;">${p.profitLossRatio != null ? fmtVal(p.profitLossRatio, 2) : '--'}</td>
    <td style="color:var(--text2);font-weight:600;">${fmtRecovery(p.ddRecoveryDays)}</td>
    <td style="color:var(--text2);font-weight:600;">${fmtWinLose(p.maxWinDays, p.maxLoseDays)}</td>
    <td style="color:${p.var95 == null ? 'var(--text3)' : (p.var95 >= 0 ? 'var(--red)' : 'var(--green)')};font-weight:600;">${p.var95 != null ? fmtVal(p.var95 * 100, 1) + '%' : '--'}</td>
    <td style="color:${p.omegaRatio == null ? 'var(--text3)' : (p.omegaRatio >= 1 ? 'var(--red)' : 'var(--green)')};font-weight:600;">${p.omegaRatio != null ? fmtVal(p.omegaRatio, 2) : '--'}</td>
  `;
  };

  // 只计算选中基金的绩效数据（支持日期范围）
  const selFundStats = selFunds.map((f, i) => {
    const allIdx = allNavFitFunds.findIndex(x => String(x.id) === String(f.id));
    const color = CORR_COLORS[allIdx % CORR_COLORS.length];
    // 获取基准基金数据
    let benchNavs = null;
    const benchId = document.getElementById('navfit-benchmark')?.value;
    if (benchId) {
      const benchFund = allNavFitFunds.find(f => String(f.id) === benchId);
      if (benchFund) benchNavs = benchFund.navHistory || [];
    }
    const effectiveStartDate = navFitStartDate || commonStartDate;
    const perf = calcPerformance(f, effectiveStartDate, navFitEndDate, benchNavs);
    return { f, color, perf, hasPerf: perf != null };
  });

  // Summary cards — 基于选中的基金
  const validPerfs = selFundStats.filter(s => s.hasPerf);
  let maxReturnPerf = null, minReturnPerf = null, bestMaxDD = 0, hasValid = false;
  if (validPerfs.length > 0) {
    hasValid = true;
    maxReturnPerf = validPerfs.reduce((best, s) => (s.perf.annualizedReturn > (best?.perf.annualizedReturn ?? -Infinity)) ? s : best, null);
    minReturnPerf = validPerfs.reduce((worst, s) => (s.perf.annualizedReturn < (worst?.perf.annualizedReturn ?? Infinity)) ? s : worst, null);
    bestMaxDD = Math.max(...validPerfs.map(s => s.perf.maxDrawdown));
  }
  const fmtSign = (v, simple) => {
    if (v == null) return '--';
    const cagrStr = v >= 0 ? `+${(v * 100).toFixed(1)}%` : `${(v * 100).toFixed(1)}%`;
    if (simple != null) {
      const simStr = simple >= 0 ? `+${(simple * 100).toFixed(1)}%` : `${(simple * 100).toFixed(1)}%`;
      return `${cagrStr}<br><span style="font-size:10px;color:var(--text3);">单利:${simStr}</span>`;
    }
    return cagrStr;
  };
  document.getElementById('navfit-summary').innerHTML = `
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">最优年化收益</div>
      <div style="font-size:18px;font-weight:700;color:${hasValid ? (maxReturnPerf.perf.annualizedReturn >= 0 ? 'var(--red)' : 'var(--green)') : 'var(--text3)'};">${hasValid ? fmtSign(maxReturnPerf.perf.annualizedReturn, maxReturnPerf.perf.annualizedReturnSimple) : '--'}</div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">最差年化收益</div>
      <div style="font-size:18px;font-weight:700;color:${hasValid ? (minReturnPerf.perf.annualizedReturn >= 0 ? 'var(--red)' : 'var(--green)') : 'var(--text3)'};">${hasValid ? fmtSign(minReturnPerf.perf.annualizedReturn, minReturnPerf.perf.annualizedReturnSimple) : '--'}</div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">最大回撤控制最优</div>
      <div style="font-size:18px;font-weight:700;color:var(--red);">${hasValid ? fmtSign(bestMaxDD) : '--'}</div>
    </div>
  `;

  // 深度分析报告
  const benchId = document.getElementById('navfit-benchmark')?.value;
  const benchFund = benchId ? allNavFitFunds.find(f => String(f.id) === benchId) : null;
  const analysisHtml = generateNavFitAnalysis(selFundStats, benchFund);
  document.getElementById('navfit-analysis').innerHTML = analysisHtml || '';

  // Stats table — 只显示选中的基金
  if (selFundStats.length === 0) {
    document.getElementById('navfit-stats-table').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text3);font-size:13px;">请在上方选择至少1只基金以查看拟合统计</div>';
  } else {
    document.getElementById('navfit-stats-table').innerHTML = `
      <div style="overflow-x:auto;">
      <table style="min-width:900px;">
        <thead><tr>
          <th>基金</th><th>净值<br>点数</th><th>区间<br>收益率</th><th>复利<br>年化</th><th>单利<br>年化</th><th>年化<br>波动率</th><th>最大<br>回撤</th><th>夏普<br>比率</th><th>卡玛<br>比率</th><th>信息<br>比率</th><th>正收益<br>占比</th><th>索提诺<br>比率</th><th>盈亏比</th><th>回撤<br>修复</th><th>连盈/连亏<br>(天数)</th><th>95%<br>VaR</th><th>Omega<br>比率</th><th>状态</th>
        </tr></thead>
        <tbody>
          ${selFundStats.map(s => `<tr>
            <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.color};margin-right:6px;"></span>${s.f.name}</td>
            <td>${(s.f.navHistory || []).length}</td>
            ${fmtPerf(s.perf)}
            <td><span class="tag-sm" style="background:${s.f.status === 'holding' ? '#3b82f622' : s.f.status === 'tracking' ? '#f59e0b22' : '#22c55e22'};color:${s.f.status === 'holding' ? 'var(--accent)' : s.f.status === 'tracking' ? 'var(--yellow)' : 'var(--green)'}">${s.f.status === 'holding' ? '🏦持仓' : s.f.status === 'tracking' ? '🔍跟踪' : '✅退出'}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:8px;line-height:1.6;">
        * 绩效基于累计净值计算（含分红再投资）${navFitStartDate || navFitEndDate ? `，区间：${navFitStartDate || '最早'} ~ ${navFitEndDate || '最新'}` : ''}。夏普比率假设无风险利率为 ${((parseFloat(localStorage.getItem('perf_rf_rate')) || 0.03) * 100).toFixed(1)}%。
        <br>
        <b>指标释义：</b><br>
        <b>区间收益率</b>=整体涨跌幅；<b>复利年化(CAGR)</b>=复利折算到一年的收益率（供夏普/卡玛等风险指标使用）；<b>单利年化</b>=总收益/持有年数，与Excel计算一致；<b>年化波动率</b>=收益波动程度；<br>
        <b>最大回撤</b>=从峰值到谷底的最大亏损；<b>回撤修复</b>=从底部涨回原高点的天数；<br>
        <b>夏普比率</b>=(年化收益-无风险利率)/波动率，越大越好；<b>索提诺比率</b>=夏普的变种，只看下行波动；<br>
        <b>卡玛比率</b>=年化收益/最大回撤绝对值；<b>信息比率</b>=超额收益相对于基准的信息效率；<br>
        <b>正收益占比</b>=正收益段数/总段数；<b>盈亏比</b>=平均正收益/平均负收益绝对值，>1 赚多亏少；<br>
        <b>连盈/连亏</b>=连续盈利/亏损的最长天数；<b>95% VaR</b>=95%置信度下的最大可能单日损失；<br>
        <b>信息比率</b>=需选择基准基金，(年化收益-基准收益)/跟踪误差，越大越好；<b>Omega 比率</b>=上行收益总和/下行损失总和(绝对值)，>1 说明上行多于下行。
      </div>
    `;
  }

  // ========================================
  // 净值曲线图：仅显示勾选的基金
  // ========================================
  if (selFunds.length === 0) {
    const chartWrap = document.getElementById('navfit-chart').parentElement;
    document.getElementById('navfit-chart').style.display = 'none';
    let emptyMsg = chartWrap.querySelector('#navfit-empty-msg');
    if (!emptyMsg) {
      emptyMsg = document.createElement('div');
      emptyMsg.id = 'navfit-empty-msg';
      emptyMsg.style.cssText = 'text-align:center;padding:60px;color:var(--text3);';
      emptyMsg.textContent = '请选择至少1只基金以显示净值曲线';
      chartWrap.appendChild(emptyMsg);
    }
    return;
  }

  // Collect all dates（支持日期范围过滤）
  const allDates = new Set();
  selFunds.forEach(f => {
    (f.navHistory || []).forEach(n => {
      if (navFitStartDate && n.date < navFitStartDate) return;
      if (navFitEndDate && n.date > navFitEndDate) return;
      allDates.add(n.date);
    });
  });
  const sortedDates = [...allDates].sort();

  // Build NAV maps: unit NAV or cumulative NAV (with dividends reinvested)
  const navMaps = {};
  selFunds.forEach(f => {
    navMaps[f.id] = {};
    let navs = (f.navHistory || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    // 日期范围过滤
    if (navFitStartDate) navs = navs.filter(n => n.date >= navFitStartDate);
    if (navFitEndDate) navs = navs.filter(n => n.date <= navFitEndDate);
    const allDividends = f.dividends || [];
    if (navFitNavMode === 'cum') {
      // Compute cumulative NAV for each date
      navs.forEach(n => {
        let cumNav = Number(n.nav);
        if (n.cumNav != null) {
          cumNav = n.cumNav;
        } else if (n.type === 'cumulative') {
          cumNav = n.nav;
        } else {
          allDividends.forEach(d => {
            if (d.date <= n.date) cumNav += Number(d.perShare);
          });
        }
        navMaps[f.id][n.date] = cumNav;
      });
    } else {
      // Unit NAV
      navs.forEach(n => { navMaps[f.id][n.date] = Number(n.nav); });
    }
  });

  // Update chart description
  const descEl = document.getElementById('navfit-chart-desc');
  const modeText = navFitNavMode === 'cum' ? '（累计净值，分红复权）' : '（单位净值）';
  const rangeText = navFitStartDate || navFitEndDate
    ? `【${navFitStartDate || '最早'} ~ ${navFitEndDate || '最新'}】`
    : '';
  if (descEl) {
    const effectiveCompare = navFitCompareMode && !navFitStartDate;
    descEl.textContent = (effectiveCompare
      ? '以所有基金中最晚的开始日期为共同起点进行归一化，适合比较"从买入时点起"的相对表现'
      : '以区间起点（或各基金最早可用日期）归一化至 1.0，曲线起点与区间一致') + rangeText + modeText;
  }

  // Compute normalized series
  // 默认模式：每只基金用自己最早的净值归一化到1.0（各自起点=1.0，观察相对走势）
  // 横向对比模式：找所有基金中最晚的开始日期作为共同起点，只取共同起点之后的日期进行归一化
  const normalizedSeries = {};

  // commonStartDate 已在 selFundStats 之前计算（如果勾了横向对比且没选区间起点）
  const effectiveCompareMode = navFitCompareMode && !navFitStartDate;

  selFunds.forEach(f => {
    const navMap = navMaps[f.id];
    // 默认：全部日期；横向对比（且无区间起点）：只取共同起点及之后的日期
    const allSeries = [];
    for (const d of sortedDates) {
      if (navMap[d]) {
        if (!effectiveCompareMode || d >= commonStartDate) {
          allSeries.push({ date: d, nav: navMap[d] });
        }
      }
    }
    if (allSeries.length >= 2) {
      let baseNav;
      if (effectiveCompareMode && commonStartDate) {
        // 横向对比（无区间起点）：用共同起点日期的净值作为base
        baseNav = allSeries[0].nav;
      } else {
        // 默认 或 选了区间起点：以各基金在区间内第一个可用日期归一化
        baseNav = allSeries[0].nav;
      }
      normalizedSeries[f.id] = allSeries.map(p => ({ date: p.date, nav: p.nav / baseNav }));
    }
  });

  // Build chart datasets — 仅基于勾选的基金
  const chartDatasets = selFunds.map((f, i) => {
    const series = normalizedSeries[f.id] || [];
    const color = CORR_COLORS[i % CORR_COLORS.length];
    return {
      label: f.name,
      data: series.map(p => ({ x: new Date(p.date + 'T00:00:00Z').getTime(), y: p.nav })),
      borderColor: color,
      backgroundColor: color + '22',
      tension: 0.2,
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 1.5,
      spanGaps: true,
      fill: false,
    };
  });

  // 确保 canvas 可见并移除空消息
  const chartCanvas = document.getElementById('navfit-chart');
  if (chartCanvas) {
    chartCanvas.style.display = '';
    const emptyMsg = chartCanvas.parentElement.querySelector('#navfit-empty-msg');
    if (emptyMsg) emptyMsg.remove();
  }

  // Destroy old chart
  if (navFitChart) { navFitChart.destroy(); navFitChart = null; }

  navFitChart = new Chart(document.getElementById('navfit-chart'), {
    type: 'line',
    data: { datasets: chartDatasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 12 }, boxWidth: 16 } },
        tooltip: {
          callbacks: {
            title: items => {
              if (!items.length) return '';
              return new Date(items[0].parsed.x).toLocaleDateString('zh-CN');
            },
            label: ctx => {
              const date = new Date(ctx.parsed.x).toLocaleDateString('zh-CN');
              return ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(4)} (${date})`;
            },
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
}

// ============================================================
// PERIOD ANALYSIS — 按年度/自定义周期计算基金收益
// ============================================================

function setPeriodMode(mode) {
  periodMode = mode;
  const allBtn = document.getElementById('period-mode-all');
  const yearBtn = document.getElementById('period-mode-year');
  const customBtn = document.getElementById('period-mode-custom');
  const customRange = document.getElementById('period-custom-range');
  // 重置所有按钮样式
  [allBtn, yearBtn, customBtn].forEach(btn => {
    if (btn) { btn.style.background = ''; btn.style.color = ''; }
  });
  if (mode === 'all') {
    allBtn.style.background = 'var(--accent)';
    allBtn.style.color = '#fff';
    customRange.style.display = 'none';
  } else if (mode === 'year') {
    yearBtn.style.background = 'var(--accent)';
    yearBtn.style.color = '#fff';
    customRange.style.display = 'none';
  } else {
    customBtn.style.background = 'var(--accent)';
    customBtn.style.color = '#fff';
    customRange.style.display = 'flex';
  }
  renderPeriodAnalysis();
}

function renderPeriodAnalysis() {
  // 显示所有基金（含已退出），与总览页保持一致
  const allFunds = funds;
  // 有净值数据的基金（用于计算周期列表）
  const fundsWithNav = allFunds.filter(f => (f.navHistory || []).length > 0);

  // 初始化按钮样式
  const allBtn = document.getElementById('period-mode-all');
  const yearBtn = document.getElementById('period-mode-year');
  const customBtn = document.getElementById('period-mode-custom');
  [allBtn, yearBtn, customBtn].forEach(btn => {
    if (btn) { btn.style.background = ''; btn.style.color = ''; }
  });
  if (periodMode === 'all') {
    if (allBtn) { allBtn.style.background = 'var(--accent)'; allBtn.style.color = '#fff'; }
  } else if (periodMode === 'year') {
    if (yearBtn) { yearBtn.style.background = 'var(--accent)'; yearBtn.style.color = '#fff'; }
  } else {
    if (customBtn) { customBtn.style.background = 'var(--accent)'; customBtn.style.color = '#fff'; }
  }

  if (fundsWithNav.length === 0) {
    document.getElementById('period-summary').innerHTML = '';
    document.getElementById('period-table-wrap').innerHTML =
      '<div style="text-align:center;padding:30px;color:var(--text3);font-size:12px;">暂无符合条件的基金数据</div>';
    if (periodChart) { periodChart.destroy(); periodChart = null; }
    return;
  }

  // 确定要分析的区间列表（基于有净值数据的基金）
  let periods = [];
  if (periodMode === 'all') {
    periods = ['__ALL__'];
  } else if (periodMode === 'year') {
    const yearSet = new Set();
    fundsWithNav.forEach(f => {
      (f.navHistory || []).forEach(n => yearSet.add(n.date.substring(0, 4)));
    });
    periods = [...yearSet].sort();
  } else {
    const startVal = document.getElementById('period-start').value;
    const endVal = document.getElementById('period-end').value;
    if (startVal && endVal) {
      periods = [startVal + '|' + endVal];
    } else {
      const yearSet = new Set();
      fundsWithNav.forEach(f => {
        (f.navHistory || []).forEach(n => yearSet.add(n.date.substring(0, 4)));
      });
      periods = [...yearSet].sort();
    }
  }

  const periodLabels = periods.map(p => periodMode === 'year' ? p + '年' : (periodMode === 'all' ? '全部历史' : p.replace('|', ' ~ ')));
  document.getElementById('period-chart-desc').textContent =
    periodMode === 'all' ? '全部历史周期内收益（相当于当前持仓视角）' :
    (periodMode === 'year' ? `按年度查看每只基金收益，共 ${periods.length} 个年度` : '自定义区间内的基金收益对比');

  // 辅助函数：计算某个基金在某个周期的收益数据（与 calcFund 逻辑一致）
  function calcFundPeriod(f, period) {
    let startDate, endDate, label;
    // 'all' 模式：直接使用 calcFund 的结果，保证与总览口径完全一致
    if (period === '__ALL__') {
      const c = calcFund(f);
      const batches = f.batches || [];
      const dividends = f.dividends || [];
      // 当年新增投入（所有批次的原始申购金额）
      const newInvest = batches.reduce((a, b) => a + Number(b.amount), 0);
      return {
        label: '全部历史',
        period: '__ALL__',
        navReturn: c.totalGainPct,
        divReturn: c.totalDivGain / (c.totalCost || 1),
        exitReturn: (c.totalRealized - c.totalDivGain) / (c.totalCost || 1),
        totalReturn: c.totalGainPct,
        annualized: 0, // 全部历史不计算年化
        days: 0,
        activeCost: c.totalCost,
        newInvest,
        pnlAmount: c.netGain,
        navPnlAmount: c.totalFloating,
        divPnlAmount: c.totalDivGain,
        exitPnlAmount: c.totalRealized - c.totalDivGain
      };
    }
    if (periodMode === 'year') {
      startDate = period + '-01-01';
      endDate = period + '-12-31';
      label = period + '年';
    } else {
      const parts = period.split('|');
      startDate = parts[0];
      endDate = parts[1];
      label = startDate + ' 至 ' + endDate;
    }
    const navs = (f.navHistory || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const dividends = f.dividends || [];
    const batches = f.batches || [];
    const perfFeeRate = (Number(f.perfFee) || 0) / 100;
    // 找周期内的净值数据点（用于获取期初期末时间戳）
    const yearNavs = navs.filter(n => n.date >= startDate && n.date <= endDate);
    if (yearNavs.length === 0) return null;
    // 期初净值和期末净值对象
    const startNavObj = yearNavs[0];
    const endNavObj = yearNavs[yearNavs.length - 1];
    // 累计本金（未退出批次 = 剩余份额 × 成本净值，与 calcBatch 口径一致：用 exitNav 判断）
    const totalPrincipal = batches.reduce((a, b) => {
      const isExited = b.exitNav != null && b.exitNav !== '';
      if (isExited) return a;
      const costNav = Number(b.costNav) || 1;
      const origShares = Number(b.amount) / costNav;
      const exitShares = Number(b.exitShares) || 0;
      const remainingShares = Math.max(0, origShares - exitShares);
      return a + remainingShares * costNav;
    }, 0);
    // 当年新增投入（原始申购金额，只要申购日在周期内就计入）
    const newInvest = batches.reduce((a, b) => {
      const bDate = b.date || '';
      return (bDate >= startDate && bDate <= endDate) ? a + Number(b.amount) : a;
    }, 0);
    // 计算周期内收益
    // 浮动盈亏 = (期末单位净值 - 期初单位净值) × 剩余份额（不含分红，避免重复）
    // 分红收益 = 期内收到的所有分红 × 剩余份额
    let periodNavPnl = 0, periodDivGain = 0, periodExitPnl = 0, periodPerfFee = 0;
    const startUnitNav = Number(startNavObj.nav) || 0;
    const endUnitNav = Number(endNavObj.nav) || 0;
    batches.forEach(b => {
      const costNav = Number(b.costNav) || 1;
      const origShares = Number(b.amount) / costNav;
      const exitShares = Number(b.exitShares) || 0;
      const isExited = b.exitNav != null && b.exitNav !== '';
      const remainingShares = isExited ? 0 : Math.max(0, origShares - exitShares);
      const batchDate = b.date || '';
      if (remainingShares > 0) {
        // 未退出批次：净值变动 × 剩余份额（不含分红，因为分红单独计算）
        const navChange = endUnitNav - startUnitNav;
        periodNavPnl += navChange * remainingShares;
        // 业绩报酬（按浮动正收益计提）
        const perfFee = Math.max(0, navChange * remainingShares) * perfFeeRate;
        periodPerfFee += perfFee;
        // 分红收益（期内收到的所有分红）
        dividends.forEach(d => {
          if (d.date >= batchDate && d.date >= startDate && d.date <= endDate) {
            periodDivGain += Number(d.perShare) * remainingShares;
          }
        });
      } else if (isExited && b.exitDate && b.exitDate >= startDate && b.exitDate <= endDate) {
        // 本周期内退出：资本利得 - 业绩报酬
        const exitNavVal = Number(b.exitNav) || costNav;
        const exitPnl = (exitNavVal - costNav) * origShares;
        const perfFee2 = Math.max(0, exitPnl) * perfFeeRate;
        periodExitPnl += exitPnl - perfFee2;
        periodPerfFee += perfFee2;
        // 分红（退出前收到的所有分红）
        dividends.forEach(d => {
          if (d.date >= batchDate && d.date <= b.exitDate) {
            periodDivGain += Number(d.perShare) * origShares;
          }
        });
      }
    });
    // 收益率
    const navReturnRate = totalPrincipal > 0 ? periodNavPnl / totalPrincipal : 0;
    const divReturn = totalPrincipal > 0 ? periodDivGain / totalPrincipal : 0;
    const exitReturn = totalPrincipal > 0 ? periodExitPnl / totalPrincipal : 0;
    const perfFeeReturn = totalPrincipal > 0 ? periodPerfFee / totalPrincipal : 0;
    const totalReturn = navReturnRate + divReturn + exitReturn;
    const pnlAmount = periodNavPnl + periodDivGain + periodExitPnl - periodPerfFee;
    const days = Math.max(1, (new Date(endNavObj.date) - new Date(startNavObj.date)) / 86400000);
    const years = days / 365;
    const annualizedCAGR = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
    const annualizedSimple = years > 0 ? totalReturn / years : 0;
    return { label, period, navReturn: navReturnRate, divReturn, exitReturn, totalReturn, annualized: annualizedCAGR, annualizedCAGR, annualizedSimple, days, activeCost: totalPrincipal, newInvest, pnlAmount, navPnlAmount: periodNavPnl, divPnlAmount: periodDivGain, exitPnlAmount: periodExitPnl };
  }

  // 每只基金用 Map<period, result> 存储，避免索引错位
  // 基于 allFunds（所有持有基金），无数据的周期 resultMap 为空
  const fundPeriodData = allFunds.map((f, fi) => {
    const color = CORR_COLORS[fi % CORR_COLORS.length];
    const resultMap = new Map();
    periods.forEach(period => {
      const r = calcFundPeriod(f, period);
      if (r) resultMap.set(period, r);
    });
    return { fund: f, color, resultMap };
  });

  // ---- 组合级汇总卡片 ----
  // 基金资产（持仓市值 = 本金+浮动盈亏，仅持有中基金，与总览页完全一致）
  const fundAssets = allFunds.filter(f => f.status === 'holding').reduce((s, f) => {
    const r = calcFund(f);
    return s + r.totalCost + r.totalFloating;
  }, 0);
  // 综合收益（净盈亏，与总览页完全一致）
  const netGainAll = allFunds.reduce((s, f) => {
    const r = calcFund(f);
    return s + r.netGain;
  }, 0);

  // 找最优/最差年度收益率
  let bestYearReturn = null, worstYearReturn = null;
  fundPeriodData.forEach(fd => {
    fd.resultMap.forEach(r => {
      if (bestYearReturn === null || r.totalReturn > bestYearReturn) bestYearReturn = r.totalReturn;
      if (worstYearReturn === null || r.totalReturn < worstYearReturn) worstYearReturn = r.totalReturn;
    });
  });

  const fmtSign = v => v >= 0 ? `+${(v * 100).toFixed(2)}%` : `${(v * 100).toFixed(2)}%`;
  const fmtAmt = v => {
    if (v == null || isNaN(v)) return '--';
    return `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}万`;
  };

  document.getElementById('period-summary').innerHTML = `
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">分析基金数</div>
      <div style="font-size:18px;font-weight:700;color:var(--accent);">${allFunds.length}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px;">共 ${allFunds.length} 只基金</div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">基金资产</div>
      <div style="font-size:18px;font-weight:700;color:var(--text);">${fmtWan(fundAssets)}<span style="font-size:12px;font-weight:400;"> 万</span></div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">综合收益</div>
      <div style="font-size:18px;font-weight:700;color:${netGainAll >= 0 ? 'var(--red)' : 'var(--green)'};">${(netGainAll >= 0 ? '+' : '') + fmtWan(netGainAll)}<span style="font-size:12px;font-weight:400;"> 万</span></div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">最优年度收益</div>
      <div style="font-size:18px;font-weight:700;color:var(--red);">${bestYearReturn != null ? fmtSign(bestYearReturn) : '--'}</div>
    </div>
  `;

  // ---- 计算组合年度汇总数据（图表和表格都需要）----
  const fmtRet2 = v => `<span style="color:${v >= 0 ? 'var(--red)' : 'var(--green)'};font-weight:500;">${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%</span>`;
  const fmtMoney = v => {
    if (v == null || isNaN(v)) return '<span style="color:var(--text3);">--</span>';
    return `<span style="color:${v >= 0 ? 'var(--red)' : 'var(--green)'};font-weight:500;">${fmtAmt(v)}</span>`;
  };

  const comboRows = periods.map((period, pi) => {
    let startDate, endDate, label;
    if (periodMode === 'year') {
      startDate = period + '-01-01';
      endDate = period + '-12-31';
      label = period + '年';
    } else {
      const parts = period.split('|');
      startDate = parts[0];
      endDate = parts[1];
      label = startDate + ' 至 ' + endDate;
    }

    let totalCost = 0, totalPnl = 0, totalDiv = 0, totalExit = 0, totalNavPnl = 0, totalNewInvest = 0;
    fundPeriodData.forEach(fd => {
      const r = fd.resultMap.get(period);
      if (!r) return;
      totalCost += r.activeCost;
      totalPnl += r.pnlAmount;
      totalDiv += r.divPnlAmount;
      totalExit += r.exitPnlAmount;
      totalNavPnl += r.navPnlAmount;
      totalNewInvest += r.newInvest;
    });
    const weightedReturn = totalCost > 0 ? totalPnl / totalCost : 0;

    return { label, totalCost, totalPnl, totalDiv, totalExit, totalNavPnl, totalNewInvest, weightedReturn };
  });

  // ---- 渲染柱状图 ----
  if (periodChart) { periodChart.destroy(); periodChart = null; }
  periodChart = new Chart(document.getElementById('period-chart'), {
    type: 'bar',
    data: {
      labels: periodLabels,
      datasets: [
        // 组合加权收益率（深色，不透明度高）
        {
          label: '组合加权',
          data: periodLabels.map((_, pi) => {
            const cr = comboRows[pi];
            return cr && cr.totalCost > 0 ? cr.weightedReturn * 100 : null;
          }),
          backgroundColor: '#8b5cf688',
          borderColor: '#8b5cf6',
          borderWidth: 2,
          borderRadius: 3,
        },
        // 各基金分项
        ...fundPeriodData
          .filter(fd => fd.resultMap.size > 0)
          .map(fd => ({
            label: fd.fund.name,
            data: periods.map(period => {
              const r = fd.resultMap.get(period);
              return r ? r.totalReturn * 100 : null;
            }),
            backgroundColor: fd.color + '66',
            borderColor: fd.color,
            borderWidth: 1,
            borderRadius: 3,
          }))
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 14 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y;
              return v != null ? ` ${ctx.dataset.label}: ${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '';
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 11 } },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: '#64748b', font: { size: 11 },
            callback: v => v.toFixed(0) + '%',
          },
          grid: { color: 'rgba(255,255,255,0.05)' },
          title: { display: true, text: '总收益率', color: '#94a3b8', font: { size: 11 } },
        }
      }
    }
  });

  // ---- 渲染组合年度汇总表 ----
  let comboHtml = `<div style="padding:12px 0 4px;font-size:12px;font-weight:600;color:var(--text2);">🏆 组合年度汇总</div>`;
  comboHtml += `<table style="width:100%;font-size:12px;border-collapse:collapse;">
    <thead><tr style="border-bottom:2px solid var(--border);">
      <th style="text-align:left;padding:6px 8px;">年度</th>
      <th style="text-align:right;padding:6px 8px;">累计本金</th>
      <th style="text-align:right;padding:6px 8px;">当年新增</th>
      <th style="text-align:right;padding:6px 8px;">净值盈亏</th>
      <th style="text-align:right;padding:6px 8px;">分红收益</th>
      <th style="text-align:right;padding:6px 8px;">退出利得</th>
      <th style="text-align:right;padding:6px 8px;">总盈亏</th>
      <th style="text-align:right;padding:6px 8px;">累计收益率</th>
    </tr></thead><tbody>`;
  comboRows.forEach((row, ri) => {
    comboHtml += `<tr style="${ri % 2 === 0 ? '' : 'background:rgba(255,255,255,0.02);'};font-weight:${ri === comboRows.length - 1 ? '700' : '400'};">
      <td style="padding:6px 8px;white-space:nowrap;">${row.label}</td>
      <td style="padding:6px 8px;text-align:right;color:var(--text2);">${row.totalCost.toFixed(2)}</td>
      <td style="padding:6px 8px;text-align:right;color:var(--accent);">${row.totalNewInvest > 0 ? '+' + row.totalNewInvest.toFixed(2) : '--'}</td>
      <td style="padding:6px 8px;text-align:right;">${fmtMoney(row.totalNavPnl)}</td>
      <td style="padding:6px 8px;text-align:right;">${fmtMoney(row.totalDiv)}</td>
      <td style="padding:6px 8px;text-align:right;">${fmtMoney(row.totalExit)}</td>
      <td style="padding:6px 8px;text-align:right;font-weight:600;">${fmtMoney(row.totalPnl)}</td>
      <td style="padding:6px 8px;text-align:right;">${fmtRet2(row.weightedReturn)}</td>
    </tr>`;
  });
  comboHtml += '</tbody></table>';
  document.getElementById('period-combo-summary').innerHTML = comboHtml;

  // ---- 渲染各基金明细表格 ----
  let tableHtml = `<div style="padding-top:4px;font-size:12px;font-weight:600;color:var(--text2);">📋 各基金明细</div>`;
  tableHtml += `<div style="overflow-x:auto;"><table style="min-width:950px;font-size:11px;">
    <thead><tr>
      <th>基金</th><th>周期</th><th style="text-align:right;">累计本金</th><th style="text-align:right;">当年新增</th><th>净值收益</th><th>分红收益</th><th>退出利得</th><th>总收益率</th><th style="text-align:right;">盈亏金额</th><th>复利年化</th><th>单利年化</th>
    </tr></thead><tbody>`;
  fundPeriodData.forEach(fd => {
    const fundPeriods = periods.filter(p => fd.resultMap.has(p));
    fundPeriods.forEach((period, ri) => {
      const r = fd.resultMap.get(period);
      tableHtml += `<tr style="${ri % 2 === 0 ? '' : 'background:rgba(255,255,255,0.02);'}">
        ${ri === 0 ? `<td rowspan="${fundPeriods.length}" style="font-weight:500;vertical-align:middle;max-width:140px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${fd.color};margin-right:4px;"></span>${fd.fund.name}
        </td>` : ''}
        <td style="white-space:nowrap;">${r.label}</td>
        <td style="text-align:right;color:var(--text2);">${r.activeCost.toFixed(2)}</td>
        <td style="text-align:right;color:var(--accent);">${r.newInvest > 0 ? '+' + r.newInvest.toFixed(2) : '--'}</td>
        <td>${fmtRet2(r.navReturn)}</td>
        <td>${fmtRet2(r.divReturn)}</td>
        <td>${fmtRet2(r.exitReturn)}</td>
        <td style="font-weight:600;">${fmtRet2(r.totalReturn)}</td>
        <td style="text-align:right;font-weight:600;">${fmtMoney(r.pnlAmount)}</td>
        <td>${fmtRet2(r.annualizedCAGR)}</td>
        <td>${fmtRet2(r.annualizedSimple)}</td>
      </tr>`;
    });
  });
  tableHtml += '</tbody></table></div>';
  tableHtml += '<div style="font-size:10px;color:var(--text3);margin-top:6px;">* 累计本金=截止该周期所有未退出批次的总投入；当年新增=该周期内建仓的批次投入；净值收益基于单位净值涨跌；分红收益按持仓份额计算；退出利得为期间退出批次的资本利得</div>';
  document.getElementById('period-table-wrap').innerHTML = tableHtml;
}

// ============================================================
// PORTFOLIO SUB-TAB SWITCHING
// ============================================================
function switchPortfolioSubTab(tab) {
  currentPortfolioSubTab = tab;
  document.querySelectorAll('.portfolio-sub-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.portfolioSubtab === tab);
  });
  document.getElementById('portfolio-subtab-build').style.display = tab === 'build' ? '' : 'none';
  document.getElementById('portfolio-subtab-contrib').style.display = tab === 'contrib' ? '' : 'none';
  if (tab === 'build') renderPortfolioSim();
  if (tab === 'contrib') { renderContributionTab(); renderContribution(); }
}

