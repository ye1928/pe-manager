// ============================================================
// AI 股票分析前端逻辑（调用本地代理 → DeepSeek）
// ============================================================

const WORKER_URL = "http://localhost:8787";
const AUTH_TOKEN = "";

async function analyzeStock(stockId) {
  const stock = stocks.find(s => s.id === stockId);
  if (!stock) return;

  const modal = document.getElementById("modal-ai-analysis");
  const content = document.getElementById("ai-analysis-content");

  // 显示 loading
  modal.classList.add("open");
  content.innerHTML = `
    <div style="text-align:center;padding:40px 20px;">
      <div style="font-size:32px;margin-bottom:12px;">🧠</div>
      <div style="font-size:14px;font-weight:500;color:var(--text);margin-bottom:6px;">AI 正在分析 ${stock.name}...</div>
      <div style="font-size:12px;color:var(--text3);">预计等待 10-30 秒</div>
      <div class="loading-bar" style="margin-top:16px;">
        <div class="loading-bar-inner"></div>
      </div>
    </div>
  `;

  // 构建请求数据
  const calc = calcStock(stock);
  const floatReturn = calc.avgCostTotal > 0 ? calc.floatingGain / calc.avgCostTotal : 0;

  const payload = {
    code: stock.code,
    name: stock.name,
    market: stock.market || "A股",
    currentPrice: stock.price,
    avgCost: calc.avgCost,
    qty: calc.qty,
    floatingGain: calc.floatingGain,
    floatingReturn: floatReturn,
    realizedGain: calc.realizedGain,
    trades: (stock.trades || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    note: stock.note || "",
    hasNews: false,
  };

  // 检查是否有相关资讯
  const articles = DB.load("articles_v1", []);
  const stockKeywords = [stock.code, stock.name, stock.note || ""];
  const relatedNews = articles.filter(a =>
    (a.tags || []).some(tag =>
      stockKeywords.some(kw => tag && kw && tag.includes(kw))
    ) ||
    (a.title || "").includes(stock.name) ||
    (a.summary || "").includes(stock.name)
  );
  if (relatedNews.length > 0) {
    payload.hasNews = true;
    payload.newsTags = [...new Set(relatedNews.flatMap(a => a.tags || []))];
    payload.newsSummary = relatedNews.slice(0, 3).map(a =>
      `[${a.sentiment === 1 ? "正面" : a.sentiment === -1 ? "负面" : "中性"}] ${a.title}`
    ).join("\n");
  }

  try {
    const resp = await fetch(`${WORKER_URL}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": AUTH_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok || !data.success) {
      throw new Error(data.error || "分析请求失败");
    }

    // 渲染结果
    renderAnalysisResult(stock, data);
  } catch (err) {
    content.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:32px;margin-bottom:12px;">⚠️</div>
        <div style="font-size:14px;font-weight:500;color:var(--red);margin-bottom:6px;">分析失败</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:16px;">${err.message}</div>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('modal-ai-analysis').classList.remove('open')">关闭</button>
      </div>
    `;
  }
}

function renderAnalysisResult(stock, result) {
  const content = document.getElementById("ai-analysis-content");
  const title = document.getElementById("ai-analysis-title");

  title.textContent = `🧠 AI分析 · ${stock.name}`;

  // 将 Markdown 转换为 HTML（简单转换）
  let html = result.analysis
    .replace(/^###\s+(.+)/gm, '<div class="ai-h3">$1</div>')
    .replace(/^##\s+(.+)/gm, '<div class="ai-h2">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/<br>\s*-/g, '<br>•');

  html += `
    <div style="margin-top:20px;padding:12px;background:var(--bg2);border-radius:8px;font-size:11px;color:var(--text3);display:flex;justify-content:space-between;align-items:center;">
      <span>模型：${result.model} · ${new Date(result.timestamp).toLocaleString("zh-CN")}</span>
      <button class="btn btn-secondary btn-sm" onclick="closeAIAnalysis()">关闭</button>
    </div>
  `;

  content.innerHTML = html;
}

function closeAIAnalysis() {
  document.getElementById("modal-ai-analysis").classList.remove("open");
}
