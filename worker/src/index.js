const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

const SYSTEM_PROMPT = `你是一位资深股票投资分析师，采用"四维分析师团队"框架对持仓股票进行分析。请对用户提供的股票数据给出专业、客观的分析报告。

## 分析框架

### 1. 基本面分析
- 从持仓成本、盈亏幅度、建仓节奏等维度评估
- 判断当前估值水平是否合理
- 分析交易记录的买卖节奏是否健康

### 2. 技术面分析
- 基于价格变动趋势判断短期方向
- 分析持仓收益率的历史轨迹
- 给出短期技术面评分（1-10分）

### 3. 情绪与事件面
- 如果用户提供了相关资讯，结合情绪标签分析
- 判断当前市场对这只股票的关注度和情绪偏向
- 分析可能的催化剂或风险事件

### 4. 风险评估
- 评估当前仓位对组合的影响
- 分析最大回撤风险
- 给出止损和加仓建议

## 输出格式
请使用 Markdown 标题格式，按以上四个维度分段输出，最后给出**综合评分**（1-100分）和**操作建议**（持有/加仓/减仓/观望）。
直接输出分析报告，无需额外解释。`;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function jsonResponse(data, status, extraHeaders) {
  const body = JSON.stringify(data);
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

async function callDeepSeek(messages, apiKey) {
  const resp = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Health check
    if (url.pathname === "/" && request.method === "GET") {
      return jsonResponse({ status: "ok", service: "stock-api-worker" }, 200, corsHeaders());
    }

    // Stock analysis endpoint
    if (url.pathname === "/api/analyze" && request.method === "POST") {
      try {
        // Validate auth token (simple shared secret)
        const authToken = request.headers.get("X-Auth-Token");
        if (env.AUTH_TOKEN && authToken !== env.AUTH_TOKEN) {
          return jsonResponse({ error: "未授权的请求" }, 401, corsHeaders());
        }

        const apiKey = env.DEEPSEEK_API_KEY;
        if (!apiKey) {
          return jsonResponse({ error: "API Key 未配置，请联系管理员" }, 500, corsHeaders());
        }

        const body = await request.json();

        // Validate required fields
        if (!body.code && !body.name) {
          return jsonResponse({ error: "缺少股票代码或名称" }, 400, corsHeaders());
        }

        // Build user message with stock data
        let userMsg = `请分析以下股票持仓：\n\n`;
        userMsg += `- 股票：${body.name || "未知"}（${body.code || "无代码"}）\n`;
        userMsg += `- 市场：${body.market || "未知"}\n`;
        userMsg += `- 当前价：¥${body.currentPrice || "未知"}\n`;

        if (body.avgCost != null) {
          userMsg += `- 成本均价：¥${body.avgCost.toFixed(3)}\n`;
          userMsg += `- 持仓数量：${body.qty || 0}股\n`;
          if (body.floatingGain != null) {
            userMsg += `- 浮动盈亏：¥${body.floatingGain >= 0 ? "+" : ""}${(body.floatingGain / 10000).toFixed(2)}万`;
            if (body.floatingReturn != null) {
              userMsg += `（${(body.floatingReturn * 100).toFixed(2)}%）`;
            }
            userMsg += `\n`;
          }
        }

        if (body.realizedGain != null && body.realizedGain !== 0) {
          userMsg += `- 已实现盈亏：¥${body.realizedGain >= 0 ? "+" : ""}${(body.realizedGain / 10000).toFixed(2)}万\n`;
        }

        if (body.trades && body.trades.length > 0) {
          userMsg += `\n交易记录（${body.trades.length}笔）：\n`;
          body.trades.slice(0, 20).forEach((t, i) => {
            userMsg += `  ${t.date} | ${t.type === "buy" ? "买入" : "卖出"} | ¥${t.price} | ${t.qty}股\n`;
          });
          if (body.trades.length > 20) {
            userMsg += `  ...（共${body.trades.length}笔，仅展示前20笔）\n`;
          }
        }

        if (body.note) {
          userMsg += `\n投资备注：${body.note}\n`;
        }

        if (body.hasNews && body.newsTags) {
          userMsg += `\n相关资讯标签：${body.newsTags.join("、")}\n`;
        }

        // Call DeepSeek
        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ];

        const analysis = await callDeepSeek(messages, apiKey);

        return jsonResponse(
          {
            success: true,
            code: body.code,
            name: body.name,
            analysis,
            model: DEEPSEEK_MODEL,
            timestamp: new Date().toISOString(),
          },
          200,
          corsHeaders()
        );
      } catch (err) {
        console.error("Analysis error:", err.message);
        return jsonResponse(
          { error: err.message || "分析服务出错" },
          500,
          corsHeaders()
        );
      }
    }

    // 404
    return jsonResponse({ error: "Not found" }, 404, corsHeaders());
  },
};
