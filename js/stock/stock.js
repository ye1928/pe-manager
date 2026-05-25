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
