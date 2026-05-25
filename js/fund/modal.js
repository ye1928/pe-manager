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
  document.getElementById('nav-h-unit').oninput = () => previewAutoCumNav();
  document.getElementById('nav-h-date').oninput = () => previewAutoCumNav();
  document.getElementById('nav-h-unit').value = '';
  document.getElementById('nav-h-cum').value = '';
  document.getElementById('nav-h-note').value = '';
  document.getElementById('nav-cum-hint').textContent = '';

  renderNavHistoryTable(fund);

  // 更新绩效提示
  const p = calcPerformance(fund);
  const hint = document.getElementById('nav-history-hint');
  if (hint) {
    if (!p) {
      hint.innerHTML = '💡 维护完整净值序列，系统自动计算夏普、卡玛、最大回撤等绩效指标（需至少2条记录）。波动率采用日历天数法，支持日频/周频/月频/断点数据。';
      hint.style.background = 'rgba(245,158,11,0.1)';
      hint.style.borderColor = 'rgba(245,158,11,0.3)';
    } else {
      hint.innerHTML = `✅ 绩效指标（基于累计净值）：夏普 ${p.sharpe == null ? 'N/A' : fmt(p.sharpe,2)} | 卡玛 ${fmt(p.calmar,2)} | 最大回撤 <strong style="color:var(--red);">${fmtPct(p.maxDrawdown)}</strong> | 年化 ${fmtPct(p.annualizedReturn)}`;
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

// 实时预览自动推算的累计净值
function previewAutoCumNav() {
  const fund = funds.find(f => f.id === currentNavHistFundId);
  if (!fund) return;
  const date = document.getElementById('nav-h-date').value;
  const unitNav = parseFloat(document.getElementById('nav-h-unit').value);
  const hint = document.getElementById('nav-cum-hint');
  if (!hint) return;
  if (!date || isNaN(unitNav)) { hint.textContent = ''; return; }
  const prevRec = [...(fund.navHistory || [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .find(h => h.date < date);
  if (!prevRec) { hint.textContent = ''; return; }
  const prevUnitNav = Number(prevRec.nav);
  const prevCumNav = prevRec.cumNav != null ? Number(prevRec.cumNav) : prevUnitNav;
  const autoCumNav = prevCumNav + (unitNav - prevUnitNav);
  const change = unitNav - prevUnitNav;
  hint.textContent = `📌 将自动推算：${autoCumNav.toFixed(4)}（单位净值${change >= 0 ? '+' : ''}${(change).toFixed(4)}）`;
  hint.style.color = 'var(--accent)';
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

  // 自动推算累计净值：仅录入了单位净值时，用前一条记录推算
  // 公式：本期累计净值 = 上期累计净值 + (本期单位净值 - 上期单位净值)
  let autoCumNav = null;
  if (!isNaN(unitNav) && isNaN(cumNav)) {
    const prevRec = fund.navHistory
      ? [...fund.navHistory].sort((a, b) => a.date.localeCompare(b.date)).find(h => h.date < date)
      : null;
    if (prevRec) {
      const prevUnitNav = Number(prevRec.nav);
      const prevCumNav = prevRec.cumNav != null ? Number(prevRec.cumNav) : prevUnitNav;
      autoCumNav = prevCumNav + (unitNav - prevUnitNav);
    }
  }

  fund.navHistory = fund.navHistory || [];
  fund.navHistory.push({
    id: uuid(),
    date,
    nav: navValue,
    type: navType,
    cumNav: isNaN(cumNav) ? (autoCumNav != null ? autoCumNav : null) : cumNav,
    note,
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

