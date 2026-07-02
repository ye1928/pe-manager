// ============================================================
// AI 组合分析（问AI）
// ============================================================

const PORTFOLIO_AI_URL = "http://localhost:8787/api/analyze-portfolio";

function openPortfolioAI() {
  document.getElementById("modal-portfolio-ai").classList.add("open");
}

async function startPortfolioAI() {
  const content = document.getElementById("portfolio-ai-content");

  // 收集持仓数据
  const activeFunds = currentCustomerId
    ? funds.filter(f => f.customers?.[currentCustomerId])
    : funds;
  const activeStocks = stocks;
  const activeFutures = futures;

  // 构建概要
  const fundItems = activeFunds.map(f => {
    const calc = calcFund(f, currentCustomerId);
    const cd = currentCustomerId ? (f.customers?.[currentCustomerId] || f) : f;
    return {
      name: f.name, company: f.company, strategy: f.strategy,
      status: (cd.status || f.status),
      nav: f.latestNav, navDate: f.navDate,
      cost: calc.totalCost, shares: calc.totalShares,
      floating: calc.totalFloating, realized: calc.totalRealized,
      netGain: calc.netGain, totalGainPct: calc.totalGainPct,
      batchCount: (cd.batches || []).length,
      dividendCount: (cd.dividends || []).length,
    };
  });

  const stockItems = activeStocks.map(s => {
    const calc = calcStock(s);
    return {
      code: s.code, name: s.name, market: s.market,
      status: s.status, price: s.price,
      qty: calc.qty, avgCost: calc.avgCost,
      floatingGain: calc.floatingGain, realizedGain: calc.realizedGain,
      netGain: calc.netGain, tradeCount: (s.trades || []).length,
    };
  });

  const futuresItems = activeFutures.map(f => {
    const calc = calcFutures(f);
    return {
      code: f.code, name: f.name, multiplier: f.multiplier,
      direction: f.direction, status: f.status,
      price: f.price, qty: calc.qty,
      avgCost: calc.avgCost, floatGain: calc.floatGain,
      realizedGain: calc.realizedGain,
    };
  });

  const fundStats = fundItems.reduce((a, f) => ({
    cost: a.cost + f.cost, floating: a.floating + f.floating,
    realized: a.realized + f.realized, count: a.count + 1,
  }), { cost: 0, floating: 0, realized: 0, count: 0 });

  const stockStats = stockItems.reduce((a, s) => ({
    value: a.value + (s.qty * s.price || 0) / 10000,
    floating: a.floating + s.floatingGain,
    count: a.count + 1,
  }), { value: 0, floating: 0, count: 0 });

  const futuresStats = futuresItems.reduce((a, f) => ({
    margin: a.margin + (f.qty * f.price * f.multiplier * 0.1 || 0) / 10000,
    floatGain: a.floatGain + f.floatGain,
    count: a.count + 1,
  }), { margin: 0, floatGain: 0, count: 0 });

  // 显示 loading
  content.innerHTML = `
    <div style="text-align:center;padding:40px 20px;">
      <div style="font-size:32px;margin-bottom:12px;">🧠</div>
      <div style="font-size:14px;font-weight:500;margin-bottom:6px;">AI 正在分析组合...</div>
      <div style="font-size:12px;color:var(--text3);">基金${fundItems.length}只 · 股票${stockItems.length}只 · 期货${futuresItems.length}只</div>
      <div class="loading-bar" style="margin-top:16px;"><div class="loading-bar-inner"></div></div>
    </div>
  `;

  try {
    const resp = await fetch(PORTFOLIO_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        funds: fundItems,
        stocks: stockItems,
        futures: futuresItems,
        summary: { fundStats, stockStats, futuresStats },
        customerName: currentCustomerId
          ? (customers.find(c => c.id === currentCustomerId)?.name || "当前客户")
          : "全部客户",
      }),
    });

    const data = await resp.json();
    if (!data.success) throw new Error(data.error || "分析失败");

    // 渲染 Markdown 为 HTML
    let html = data.analysis
      .replace(/^###\s+(.+)/gm, '<div class="ai-h3">$1</div>')
      .replace(/^##\s+(.+)/gm, '<div class="ai-h2">$1</div>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
      .replace(/<br>\s*[-•]/g, '<br>•');

    html += `
      <div style="margin-top:20px;padding:12px;background:var(--bg2);border-radius:8px;font-size:11px;color:var(--text3);text-align:center;">
        模型：${data.model} · ${new Date(data.timestamp).toLocaleString("zh-CN")}
      </div>
    `;

    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:32px;margin-bottom:12px;">⚠️</div>
        <div style="font-size:14px;font-weight:500;color:var(--red);margin-bottom:6px;">分析失败</div>
        <div style="font-size:12px;color:var(--text3);">${err.message}</div>
      </div>
    `;
  }
}
