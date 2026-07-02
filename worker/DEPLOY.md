# Cloudflare Worker 部署指南

## 1. 准备

```bash
# 安装 Wrangler CLI（如果还没有）
npm install -g wrangler

# 登录 Cloudflare
wrangler login
```

## 2. 配置 API Key

```bash
# 设置 DeepSeek API Key（作为 Worker Secret）
wrangler secret put DEEPSEEK_API_KEY

# （可选）设置鉴权 Token，防止开放调用
wrangler secret put AUTH_TOKEN
```

## 3. 部署

```bash
cd worker
wrangler deploy
```

部署成功后你会得到一个 Worker URL，例如：
`https://stock-api-worker.你的用户名.workers.dev`

## 4. 配置前端

打开 `js/stock/analyze.js`，修改第 6 行：

```javascript
const WORKER_URL = "https://stock-api-worker.你的用户名.workers.dev";
const AUTH_TOKEN = "你设置的AUTH_TOKEN";
```

如果没设置 AUTH_TOKEN，Worker 会跳过鉴权检查（生产环境建议设置）。

## 5. API 说明

### POST /api/analyze

请求体：
```json
{
  "code": "000001",
  "name": "平安银行",
  "market": "A股",
  "currentPrice": 12.50,
  "avgCost": 11.20,
  "qty": 1000,
  "floatingGain": 1300,
  "floatingReturn": 0.116,
  "realizedGain": 0,
  "trades": [...],
  "note": "...",
  "hasNews": false
}
```

响应：
```json
{
  "success": true,
  "code": "000001",
  "name": "平安银行",
  "analysis": "## 基本面分析\n...",
  "model": "deepseek-chat",
  "timestamp": "2025-06-19T..."
}
```

## 费用说明

- Cloudflare Workers：免费套餐 10万次请求/天
- DeepSeek API：约 ¥1/百万 token，每次分析消耗约 2000 token
