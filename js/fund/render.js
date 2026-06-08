// ============================================================
// PE FUND - RENDER
// ============================================================
let fundGroupCollapsed = {};

function toggleFundGroup(company) {
  fundGroupCollapsed[company] = !fundGroupCollapsed[company];
  // 直接操作 DOM，不整列表重绘
  const body = document.querySelector(`.fund-group-body[data-company="${company}"]`);
  const arrow = document.querySelector(`.fund-group[data-company="${company}"] .fund-group-arrow`);
  if (body) body.classList.toggle('collapsed');
  if (arrow) arrow.classList.toggle('expanded');
}

function renderPEFund() {
  const stats = getPEStats();
  document.getElementById('stat-fund-count').textContent = stats.holdingCount;
  document.getElementById('stat-total-cost').textContent = fmtWan(stats.totalCost);
  document.getElementById('stat-total-pnl').innerHTML =
    `<span class="${pnlClass(stats.netGain)}">${stats.netGain >= 0 ? '+' : ''}${fmtWan(stats.netGain)}</span>`;
  document.getElementById('stat-pnl-breakdown').innerHTML =
    `浮动 <span class="${pnlClass(stats.totalFloating)}">${stats.totalFloating >= 0 ? '+' : ''}${fmtWan(stats.totalFloating)}</span>` +
    ` / 已实现 <span class="${pnlClass(stats.totalRealized)}">${stats.totalRealized >= 0 ? '+' : ''}${fmtWan(stats.totalRealized)}</span>`;

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

  // 按管理人（company）分组
  const groups = {};
  filtered.forEach(f => {
    const company = f.company || '未分类';
    if (!groups[company]) groups[company] = [];
    groups[company].push(f);
  });
  const groupNames = Object.keys(groups).sort((a, b) => {
    // 持仓数量多的组排前面
    return groups[b].length - groups[a].length;
  });

  list.innerHTML = groupNames.map(company => {
    const groupFunds = groups[company];
    const isCollapsed = !!fundGroupCollapsed[company];
    const groupNetGain = groupFunds.reduce((s, f) => s + calcFund(f).netGain, 0);
    const groupCount = groupFunds.length;

    return `<div class="fund-group" data-company="${company}">
      <div class="fund-group-header" onclick="toggleFundGroup('${company.replace(/'/g, "\\'")}')">
        <div class="fund-group-left">
          <span class="fund-group-arrow ${isCollapsed ? '' : 'expanded'}"></span>
          <span class="fund-group-name">${company}</span>
          <span class="fund-group-count">${groupCount}只</span>
        </div>
        <div class="fund-group-pnl ${groupNetGain >= 0 ? 'pnl-positive' : 'pnl-negative'}" style="color:${groupNetGain >= 0 ? 'var(--red)' : 'var(--green)'};">
          ${groupNetGain >= 0 ? '+' : ''}${fmtWan(groupNetGain)}
        </div>
      </div>
      <div class="fund-group-body ${isCollapsed ? 'collapsed' : ''}" data-company="${company}">
        ${groupFunds.map(f => {
          const calc = calcFund(f);
          const batches = f.batches || [];
          const batchCount = batches.length;
          const statusTag = f.status === 'holding'
            ? '<span class="tag tag-blue">持仓中</span>'
            : f.status === 'tracking'
            ? '<span class="tag tag-yellow">跟踪中</span>'
            : '<span class="tag tag-gray">已退出</span>';

          const strategyTags = (f.strategy || '其他').split('|').map(s => `<span style="font-size:11px;color:var(--text3);background:var(--bg3);padding:1px 6px;border-radius:4px;">${s.trim()}</span>`).join('');

          return `<div class="fund-card" data-fund-id="${f.id}">
            <div class="fund-card-header">
              <div>
                <div class="fund-name">${f.name}</div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">${strategyTags}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">${statusTag}</div>
            </div>
            <div class="fund-card-body">
              <div class="fund-card-main">
                <div class="fund-card-main-label">总净盈亏</div>
                <div class="fund-card-main-value ${pnlClass(calc.netGain)}">
                  ${calc.netGain >= 0 ? '+' : ''}${fmtWan(calc.netGain)}
                </div>
                <div class="fund-card-main-pct ${pnlClass(calc.totalGainPct)}">${fmtPct(calc.totalGainPct)}</div>
              </div>
              <div class="fund-card-sub">
                <div class="fund-card-sub-item">
                  <div class="fund-card-sub-label">最新净值</div>
                  <div class="fund-card-sub-value">${f.latestNav ? fmt(f.latestNav, 4) : '--'}</div>
                </div>
                ${calc.totalFloating !== 0 ? `<div class="fund-card-sub-item">
                  <div class="fund-card-sub-label">浮动盈亏</div>
                  <div class="fund-card-sub-value ${pnlClass(calc.totalFloating)}">
                    ${calc.totalFloating >= 0 ? '+' : ''}${fmtWan(calc.totalFloating)}
                  </div>
                </div>` : ''}
              </div>
            </div>
            <div class="fund-card-footer">
              <span>${f.company || '未知机构'}</span>
              <span>·</span>
              <span>${batchCount > 0 ? batches[batches.length - 1].date : '--'} 申购</span>
              ${f.latestNav ? `<span>·</span><span>净值 ${f.navDate || '--'}</span>` : ''}
              <span style="margin-left:auto;color:var(--accent);cursor:pointer;" data-action="open-detail" data-fund-id="${f.id}">详情 →</span>
            </div>
          </div>`;
        }).join('')}
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
  const latestNav = Number(f.latestNav) || 0;
  const dividends = f.dividends || [];
  const perfFeeRate = (Number(f.perfFee) || 0) / 100;
  const batchRows = batches.map(b => {
    const r = calcBatch(b, latestNav, dividends, perfFeeRate);
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
  return `<td colspan="4" style="padding:0;">
    <table style="width:100%;border-collapse:collapse;margin-left:8px;border-left:2px solid rgba(59,130,246,0.3);">
      <tbody>${batchRows}</tbody>
    </table>
  </td>`;
}

let pnlDetailExpanded = {};

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
                   : type === 'realized' ? c.totalRealized
                   : c.totalGain;
    const netVal = type === 'floating' ? c.totalFloating - rowPerfFee
                 : type === 'realized' ? c.totalRealized - rowPerfFee
                 : c.netGain;
    const statusLabel = f.status === 'holding' ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--blue);margin-right:6px;vertical-align:middle;"></span>` : f.status === 'tracking' ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;border:1.5px solid var(--text3);margin-right:6px;vertical-align:middle;"></span>` : `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green);margin-right:6px;vertical-align:middle;"></span>`;
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
    const rfRate = parseFloat(localStorage.getItem('perf_rf_rate')) || 0.03;
    perfHtml = `
    <div class="section-title">📈 绩效分析</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <label style="font-size:12px;color:var(--text3);">无风险利率：</label>
      <input type="number" id="rf-rate-input" value="${(rfRate * 100).toFixed(2)}" min="0" max="20" step="0.1"
             style="width:68px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px;text-align:center;"
             onchange="onRfRateChange(this.value)" />
      <span style="font-size:11px;color:var(--text3);">%（用于夏普比率计算，默认 3%）</span>
    </div>
    <div class="info-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="info-item">
        <div class="info-label">夏普比率</div>
        <div class="info-value big ${perf.sharpe == null ? 'text-gray' : (perf.sharpe >= 0 ? 'text-green' : 'text-red')}">${perf.sharpe == null ? 'N/A' : fmt(perf.sharpe, 2)}</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">${perf.sharpe == null ? '波动率为0，无法计算' : '（>1 优秀，>2 极佳）'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">卡玛比率</div>
        <div class="info-value big ${perf.calmar >= 0 ? 'text-green' : 'text-red'}">${fmt(perf.calmar, 2)}</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">（>1 优秀，>2 极佳）</div>
      </div>
      <div class="info-item">
        <div class="info-label">信息比率</div>
        <div class="info-value big ${perf.infoRatio == null ? 'text-gray' : ''}">${perf.infoRatio == null ? 'N/A' : fmt(perf.infoRatio, 2)}</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">${perf.infoRatio == null ? '波动率为0，无法计算' : '年化收益/波动率'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">年化收益率</div>
        <div class="info-value big ${perf.annualizedReturn >= 0 ? 'text-red' : 'text-green'}">${fmtPct(perf.annualizedReturn)}</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">区间 ${perf.years}年</div>
      </div>
      <div class="info-item">
        <div class="info-label">年化波动率</div>
        <div class="info-value big">${fmtPct(perf.annualizedVol)}</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">日历天数标准化</div>
      </div>
      <div class="info-item">
        <div class="info-label">最大回撤</div>
        <div class="info-value big text-red">${fmtPct(perf.maxDrawdown)}</div>
        <div class="info-label" style="margin-top:4px;font-size:10px;">${perf.maxDDDate}</div>
      </div>
      <div class="info-item">
        <div class="info-label">正收益段占比</div>
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

  // 基金评价说明（自动生成）
  let commentaryHtml = '';
  const commentary = generateFundCommentary(fund);
  if (commentary) {
    commentaryHtml = commentary;
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
    ${commentaryHtml}
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

