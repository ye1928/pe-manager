import { createServer } from "http";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const PORT = process.env.PORT || 8787;

if (!DEEPSEEK_KEY) {
  console.error("Error: DEEPSEEK_API_KEY environment variable is required.");
  console.error("Please copy .env.example to .env and set your API key.");
  process.exit(1);
}

const SYSTEM_PROMPT = `你是一位资深股票投资分析师，采用"四维分析师团队"框架对持仓股票进行分析。

用户会提供两部分数据：
1. 【实时行情数据】从腾讯证券抓取的最新市场数据（当前价、涨跌幅、PE、PB、市值、换手率等）
2. 【持仓与交易数据】用户手动维护的持仓成本、交易记录、盈亏等

请基于以上两类数据，给出专业、客观的分析报告。

## 分析框架
### 1. 基本面分析
结合实时PE/PB/市值等市场数据，从估值水平、行业对比、成长性等角度评估。重点分析PE是否处于合理区间，PB反映的资产质量。

### 2. 技术面分析
基于实时价格变动、涨跌幅、成交量等判断短期趋势，结合持仓收益率轨迹分析，给出短期技术面评分（1-10分）。

### 3. 情绪与事件面
如果用户提供了相关资讯，结合情绪标签分析市场关注度和情绪偏向。

### 4. 风险评估
评估当前仓位对组合的影响，分析最大回撤风险，给出止损和加仓建议。

## 输出格式
使用 Markdown 标题格式，按以上四个维度分段。最后给出**综合评分**（1-100分）和**操作建议**（持有/加仓/减仓/观望）。
直接输出分析报告，无需额外解释。`;

/* ===== 实时行情：东方财富(优先,PE可靠) + 腾讯证券(fallback) ===== */
function eastmoneySecid(code) {
  const c = String(code).trim();
  if (c.startsWith("6") || c.startsWith("9")) return `1.${c}`;
  return `0.${c}`;
}

async function fetchEastmoneyQuote(code) {
  try {
    const secid = eastmoneySecid(code);
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f57,f58,f115,f162,f116,f117,f167,f170,f48,f50,f44,f45,f46,f47,f60`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://quote.eastmoney.com/" }
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const d = json.data;
    if (!d || !d.f43) return null;
    return {
      price: d.f43 / 100,                    // 价格，单位：分→元
      changePct: (d.f170 || 0) / 100,        // 涨跌幅
      high: (d.f44 || 0) / 100,
      low: (d.f45 || 0) / 100,
      volume: d.f47 || 0,                    // 成交量(手)
      turnover: (d.f168 || 0) / 100,         // 换手率%
      pe: d.f115 != null ? d.f115 / 100 : null,    // PE，单位需除以100
      pb: d.f162 != null ? d.f162 / 100 : null,    // PB
      mcap: d.f116 || d.f117 || null,        // 总市值(元)
      source: "东方财富(实时)",
    };
  } catch (e) {
    return null;
  }
}

function resolveTencentCode(code, market) {
  if (!code) return null;
  const c = String(code).trim();
  if (!c) return null;
  // 港股
  if (market === "港股") return `hk${c.padStart(5, "0")}`;
  // 美股
  if (market === "美股") return `us${c.toUpperCase().replace(".", "__")}`;
  // A股：根据代码前缀判断交易所
  if (c.startsWith("6") || c.startsWith("9")) return `sh${c}`;
  return `sz${c}`;
}

async function fetchTencentQuote(code, market) {
  const tcCode = resolveTencentCode(code, market);
  if (!tcCode) return null;
  try {
    const url = `https://qt.gtimg.cn/q=${tcCode}`;
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) return null;
    const raw = await resp.text();
    const start = raw.indexOf('"');
    const end = raw.lastIndexOf('"');
    if (start < 0 || end <= start) return null;
    const fields = raw.slice(start + 1, end).split("~");
    if (fields.length < 35) return null;
    const price = parseFloat(fields[3]);
    if (isNaN(price) || price <= 0) return null;
    return {
      price,
      changePct: parseFloat(fields[32]) || null,
      high: parseFloat(fields[33]) || null,
      low: parseFloat(fields[34]) || null,
      volume: parseInt(fields[6]) || 0,
      turnover: parseFloat(fields[38]) || null,
      pe: null, pb: null, mcap: null,  // 腾讯API PE不可靠，不用
      source: "腾讯证券(实时)",
    };
  } catch (e) { return null; }
}

async function fetchStockQuote(code, market) {
  // 优先用东方财富（PE/PB准确），腾讯做 fallback
  let q = await fetchEastmoneyQuote(code);
  if (q) return q;
  return await fetchTencentQuote(code, market);
}

async function callDeepSeek(messages) {
  const resp = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`DeepSeek API error ${resp.status}: ${err}`);
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content || "";
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "stock-api-local" }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/analyze") {
    try {
      let body = "";
      for await (const chunk of req) body += chunk;
      const data = JSON.parse(body);

      if (!data.code && !data.name) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "缺少股票代码或名称" }));
        return;
      }

      // 1. 抓取实时行情
      let quote = await fetchStockQuote(data.code, data.market);

      // 2. 构建分析 prompt
      let userMsg = "";

      if (quote) {
        userMsg += "【实时行情数据——来自腾讯证券】\n";
        userMsg += `- 最新价：¥${quote.price.toFixed(2)}（${quote.changePct != null ? (quote.changePct >= 0 ? "+" : "") + quote.changePct.toFixed(2) + "%" : "未知"}）\n`;
        userMsg += `- 今日最高：¥${quote.high?.toFixed(2) || "N/A"}  最低：¥${quote.low?.toFixed(2) || "N/A"}\n`;
        userMsg += `- 成交量：${(quote.volume / 10000).toFixed(1)}万手  换手率：${quote.turnover != null ? quote.turnover.toFixed(2) + "%" : "N/A"}\n`;
        if (quote.pe) userMsg += `- 市盈率(PE)：${quote.pe.toFixed(2)}\n`;
        if (quote.pb) userMsg += `- 市净率(PB)：${quote.pb.toFixed(2)}\n`;
        if (quote.mcap) {
          const mcapYi = quote.mcap > 1e8 ? (quote.mcap / 1e8).toFixed(2) + "亿" : (quote.mcap / 1e4).toFixed(2) + "万";
          userMsg += `- 总市值：${mcapYi}\n`;
        }
        userMsg += "\n";
      } else {
        userMsg += "【注意：未能获取实时行情，以下分析基于用户提供的静态价格数据】\n\n";
      }

      userMsg += "【持仓与交易数据】\n";
      userMsg += `- 股票：${data.name || "未知"}（${data.code || "无代码"}）\n`;
      userMsg += `- 市场：${data.market || "未知"}\n`;
      userMsg += `- 用户录入价格：¥${data.currentPrice || "未知"}`;
      if (quote && Math.abs(quote.price - data.currentPrice) > data.currentPrice * 0.01) {
        userMsg += `（⚠️ 与实时价 ¥${quote.price.toFixed(2)} 有差异，请优先使用实时价）`;
      }
      userMsg += `\n`;

      if (data.avgCost != null) {
        userMsg += `- 成本均价：¥${data.avgCost.toFixed(3)}\n`;
        userMsg += `- 持仓数量：${data.qty || 0}股\n`;
        if (data.floatingGain != null) {
          userMsg += `- 浮动盈亏：¥${data.floatingGain >= 0 ? "+" : ""}${(data.floatingGain / 10000).toFixed(2)}万`;
          if (data.floatingReturn != null) userMsg += `（${(data.floatingReturn * 100).toFixed(2)}%）`;
          userMsg += `\n`;
        }
      }

      if (data.realizedGain != null && data.realizedGain !== 0) {
        userMsg += `- 已实现盈亏：¥${data.realizedGain >= 0 ? "+" : ""}${(data.realizedGain / 10000).toFixed(2)}万\n`;
      }

      if (data.trades && data.trades.length > 0) {
        userMsg += `\n交易记录（${data.trades.length}笔）：\n`;
        data.trades.slice(0, 20).forEach(t => {
          userMsg += `  ${t.date} | ${t.type === "buy" ? "买入" : "卖出"} | ¥${t.price} | ${t.qty}股\n`;
        });
      }

      if (data.note) userMsg += `\n投资备注：${data.note}\n`;
      if (data.newsSummary) userMsg += `\n相关资讯：\n${data.newsSummary}\n`;

      console.log("Asking DeepSeek with", userMsg.length, "chars of data");
      const analysis = await callDeepSeek([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ]);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        code: data.code,
        name: data.name,
        quote: quote ? {
          price: quote.price,
          changePct: quote.changePct,
          pe: quote.pe,
          pb: quote.pb,
          mcap: quote.mcap,
        } : null,
        analysis,
        model: "deepseek-chat",
        timestamp: new Date().toISOString(),
      }));
    } catch (err) {
      console.error("Analysis error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ===== 组合分析端点 =====
  if (req.method === "POST" && req.url === "/api/analyze-portfolio") {
    try {
      let body = "";
      for await (const chunk of req) body += chunk;
      const data = JSON.parse(body);

      let msg = `你是一位资深投资顾问。请对以下投资组合进行全面诊断分析。\n\n`;
      msg += `客户：${data.customerName || "全部"}\n\n`;

      const fs = data.summary?.fundStats;
      const ss = data.summary?.stockStats;
      const fts = data.summary?.futuresStats;

      msg += `【组合总览】\n`;
      if (fs) msg += `- 基金：${fs.count}只，投入成本¥${(fs.cost || 0).toFixed(2)}万，浮动盈亏¥${(fs.floating || 0).toFixed(2)}万，已实现盈亏¥${(fs.realized || 0).toFixed(2)}万\n`;
      if (ss) msg += `- 股票：${ss.count}只，持仓市值¥${(ss.value || 0).toFixed(2)}万，浮动盈亏¥${(ss.floating || 0).toFixed(2)}万\n`;
      if (fts) msg += `- 期货：${fts.count}只，占用保证金约¥${(fts.margin || 0).toFixed(2)}万，浮动盈亏¥${(fts.floatGain || 0).toFixed(2)}万\n`;
      msg += `\n`;

      if (data.funds?.length > 0) {
        msg += `【基金持仓明细】（共${data.funds.length}只）\n`;
        data.funds.forEach(f => {
          msg += `- ${f.name}（${f.company || ""}）状态:${f.status} 净值:${f.nav || "--"} 投入¥${(f.cost || 0).toFixed(2)}万 持仓${(f.shares || 0).toFixed(4)}万份 浮盈¥${(f.floating || 0).toFixed(2)}万 总收益${(f.totalGainPct * 100 || 0).toFixed(2)}%\n`;
        });
        msg += `\n`;
      }

      if (data.stocks?.length > 0) {
        msg += `【股票持仓明细】（共${data.stocks.length}只）\n`;
        data.stocks.forEach(s => {
          msg += `- ${s.name}（${s.code}）状态:${s.status} 当前价¥${s.price || "--"} 持仓${s.qty || 0}股 成本¥${(s.avgCost || 0).toFixed(2)} 浮盈¥${(s.floatingGain || 0).toFixed(2)} 净盈亏¥${(s.netGain || 0).toFixed(2)}\n`;
        });
        msg += `\n`;
      }

      if (data.futures?.length > 0) {
        msg += `【期货持仓明细】（共${data.futures.length}只）\n`;
        data.futures.forEach(ff => {
          msg += `- ${ff.name}（${ff.code}）方向:${ff.direction} 持仓${ff.qty || 0}手 开仓均价¥${(ff.avgCost || 0).toFixed(2)} 浮盈¥${(ff.floatGain || 0).toFixed(2)}\n`;
        });
        msg += `\n`;
      }

      msg += `请从以下维度分析：\n`;
      msg += `1. 资产配置合理性（基金/股票/期货比例是否合理）\n`;
      msg += `2. 各品类内部风险分散情况（集中度分析）\n`;
      msg += `3. 收益来源分析（哪些品种贡献了主要收益/亏损）\n`;
      msg += `4. 风险预警（回撤过大、仓位过重、流动性风险等）\n`;
      msg += `5. 优化建议（调仓方向、加仓/减仓建议）\n`;

      msg += `\n请用 Markdown 标题格式，按以上五个维度分段输出。最后给出**综合评分**（1-100分）和**行动建议**。直接输出诊断报告，无需额外解释。`;

      const analysis = await callDeepSeek([
        { role: "system", content: "你是一位经验丰富的私人银行投资顾问，专注于组合管理和资产配置。" },
        { role: "user", content: msg },
      ]);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        analysis,
        model: "deepseek-chat",
        timestamp: new Date().toISOString(),
      }));
    } catch (err) {
      console.error("Portfolio AI error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`API proxy ready → http://localhost:${PORT}`);
  console.log(`Stock data: Tencent qt.gtimg.cn → DeepSeek`);
});
