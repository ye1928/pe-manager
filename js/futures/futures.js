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
