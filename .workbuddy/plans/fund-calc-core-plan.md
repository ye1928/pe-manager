# 基金模块计算核心分析与改造计划

## 项目概况

路径: `C:/Users/52706/WorkBuddy/20260425195840-split/`

### 核心文件:
- `js/fund/calc.js` — 计算引擎
- `js/fund/modal.js` — CRUD 操作（批次、分红、净值）
- `js/fund/render.js` — UI 渲染
- `js/store.js` — 数据存储与导入导出
- `js/events.js` — 事件处理（内联编辑、按钮点击）

---

## 1. calcBatch 函数 (calc.js:652-710)

**参数**: `(batch, latestNav, dividends, perfFeeRate)`
- 从 `batch.amount`、`batch.costNav` 读取申购金额和成本净值
- `batch.exitShares`: 已退出份额(部分退出)
- `batch.exitNav`: 完全退出标记
- 用 `dividends` 参数计算分红收益
- 返回: `{ shares, costTotal, floatingGain, divGain, realizedGain, perfFee, totalGain, netGain, totalGainPct, evalNav, costNav, isExited }`

**关键**: 该函数不直接访问 `fund`，而是通过参数接收数据，改造影响小。

## 2. calcFund 函数 (calc.js:715-757)

```js
// line 716-717
const batches = fund.batches || [];
const dividends = fund.dividends || [];
```
- 遍历 `batches` 调 `calcBatch`
- **直接读 `fund.batches` 和 `fund.dividends`**

## 3. calcPerformance 函数 (calc.js:11-315)

```js
// line 222-229 — 计算分红收益率时
const batches = fund.batches || [];
batches.forEach(b => {
  const shares = Number(b.amount) / Number(b.costNav);
  dividends.forEach(d => {
    if (d.date >= (b.date || '')) totalDivReceived += Number(d.perShare) * shares;
  });
});
```
- **也直接读 `fund.batches` (line 222)** — 仅用于计算分红收益率
- **直接读 `fund.dividends` (line 26)**

## 4. fund 对象数据结构 (store.js:14-20 / modal.js:60-73)

```js
fund = {
  id, name, company, strategy,
  perfFee,         // 业绩报酬比例 0-100
  status,          // 'holding' | 'tracking' | 'exited'
  note, createdAt,
  latestNav, navDate, latestCumNav,
  batches: [{       // ★ 需要改造的字段
    id, date, amount(万), costNav, note,
    exitDate?, exitNav?, exitShares?, partialExitFrom?
  }],
  dividends: [{     // ★ 需要改造的字段
    id, date, perShare, note
  }],
  navHistory: [{ id, date, nav, cumNav?, type, note }]
}
```

改造目标：`batches` 和 `dividends` 改为 `fund.customers[customerId].batches` 嵌套结构。

---

## 5. 所有直接读写 `fund.batches` 的位置

### calc.js (计算引擎)
| 行号 | 代码 | 说明 |
|------|------|------|
| 222 | `const batches = fund.batches \|\| []` | calcPerformance 中计算分红收益率 |
| 716 | `const batches = fund.batches \|\| []` | calcFund 中遍历批次 |

### modal.js (CRUD)
| 行号 | 代码 | 说明 |
|------|------|------|
| 109 | `fund?.batches?.find(b => b.id === batchId)` | openExitBatch |
| 131 | `(fund.batches \|\| [])` | openExitAllBatches: 筛选未退出批次 |
| 181 | `(fund.batches \|\| [])` | updateExitPreview: 批量退出预览 |
| 224 | `fund?.batches?.find(b => b.id === currentExitBatchId)` | updateExitPreview: 单个退出预览 |
| 296 | `(fund.batches \|\| [])` | saveExitBatch: 批量退出 |
| 318 | `fund?.batches?.find(b => b.id === currentExitBatchId)` | saveExitBatch: 单个退出 |
| 346 | `fund.batches.push({...})` | saveExitBatch: 部分退出创建新批次 |
| 389-390 | `fund.batches = fund.batches \|\| []` / `fund.batches.push({...})` | saveBatch: 新增批次 |
| 413 | `fund.batches = (fund.batches \|\| []).filter(...)` | deleteBatch: 删除批次 |
| 422 | `(fund.batches \|\| []).find(b => b.id === batchId)` | restoreBatch: 查找批次 |
| 430 | `(fund.batches \|\| []).find(b => b.id === batch.partialExitFrom)` | restoreBatch: 查找原批次 |
| 436 | `fund.batches.filter(b => b.id !== batch.id)` | restoreBatch: 删除拆分出的批次 |
| 440 | `(fund.batches \|\| []).some(b => !b.exitNav)` | restoreBatch: 检查是否有未退出批次 |
| 860 | `!fund.batches \|\| fund.batches.length === 0` | updateDivPreview: 判断空 |
| 867 | `fund.batches.forEach(b => {...})` | updateDivPreview: 遍历批次 |

### render.js (渲染)
| 行号 | 代码 | 说明 |
|------|------|------|
| 69 | `f.batches \|\| []` | renderPEFund: 获取批次计数 |
| 111 | `batches[batches.length - 1].date` | renderPEFund: 显示最新批次日 |
| 143 | `f.batches \|\| []` | renderBatchRows |
| 217 | `f.batches && f.batches.length > 0` | openPnlDetail: 展开判断 |
| 392 | `fund.batches \|\| []` | renderFundDetailBody |
| 578 | `calcBatch(...)` 内用到 | renderFundDetailBody 构建表行 |

### events.js (事件)
| 行号 | 代码 | 说明 |
|------|------|------|
| 17 | `(fund.batches \|\| []).find(b => b.id === batchId)` | 内联编辑批次 |
| 243 | `(f2.batches \|\| []).filter(b => !b.exitNav ...)` | to-exited 动作 |

---

## 6. 所有直接读写 `fund.dividends` 的位置

### calc.js
| 行号 | 代码 | 说明 |
|------|------|------|
| 26 | `const allDividends = fund.dividends \|\| []` | calcPerformance 中过滤分红 |
| 717 | `const dividends = fund.dividends \|\| []` | calcFund |

### modal.js
| 行号 | 代码 | 说明 |
|------|------|------|
| 191 | `(fund.dividends \|\| []).forEach(d => {...})` | updateExitPreview: 统计分红 |
| 529 | `const dividends = fund.dividends \|\| []` | calcCumulativeNav |
| 548 | `const dividends = fund.dividends \|\| []` | renderNavHistoryTable |
| 560, 574 | `dividends.forEach(d => {...})` | renderNavHistoryTable: 计算累计/单位净值 |
| 827-828 | `fund.dividends = fund.dividends \|\| []` / `fund.dividends.push({...})` | saveDividend |
| 834 | `fund.dividends.sort(...)` | saveDividend |
| 845 | `fund.dividends = (fund.dividends \|\| []).filter(...)` | deleteDividend |

### render.js
| 行号 | 代码 | 说明 |
|------|------|------|
| 393 | `const dividends = fund.dividends \|\| []` | renderFundDetailBody |

### events.js
| 行号 | 代码 | 说明 |
|------|------|------|
| 79 | `(fund.dividends \|\| []).find(d => d.id === divId)` | 内联编辑分红 |

---

## 7. 导出/导入代码 (store.js)

- `exportAllData()` → `doSelectiveExport()` (line 80): 直接 `DB.load('funds_v2', [])` 导出原始数组
- `importAllData(file)` → `doSelectiveImport()` (line 137): 用 `mergeById('funds_v2', data.data.funds)` 合并
- `mergeById(key, incoming)` (line 199): 按 id 合并

改造影响：导出/导入直接序列化整个 `funds` 数组，改造数据结构后导出格式自动变化，导入需考虑向前兼容。

---

## 8. 分红相关函数

- `openAddDividend(fundId)` — modal.js:811
- `saveDividend()` — modal.js:820
- `deleteDividend(fundId, divId)` — modal.js:842
- `updateDivPreview()` — modal.js:852: 实时预览分红影响（读 `fund.batches`）

## 9. 退出批次相关函数

- `openExitBatch(fundId, batchId)` — modal.js:104
- `openExitAllBatches(fundId)` — modal.js:124
- `updateExitPreview()` — modal.js:169
- `saveExitBatch()` — modal.js:284

---

## 改造建议（从 fund.batches/dividends → fund.customers[customerId].batches 嵌套结构）

### 影响范围汇总

需要修改的函数共约 **40+ 处**，分布在 4 个文件中：

| 文件 | 涉及行数 | 改造难度 |
|------|----------|----------|
| `calc.js` | 3 处（lines 26, 222, 716-717） | 低 — 加一层间接访问 |
| `modal.js` | ~20 处 | **高** — CRUD 核心逻辑需重写函数签名 |
| `render.js` | ~8 处 | 中 — 渲染时多做一层查找 |
| `events.js` | 2 处 | 低 |
| `store.js` | 0 处直接相关（数据格式自然变化） | 中 — 需导入兼容层 |

### 改造策略

**方案A（推荐）：加一层适配器，不动消费者逻辑**
- 在 `store.js` 或 `calc.js` 顶部加工具函数：
  ```js
  function getBatches(fund, customerId) {
    if (fund.batches) return fund.batches; // 旧格式兼容
    return (fund.customers?.[customerId]?.batches) || [];
  }
  function getDividends(fund, customerId) {
    if (fund.dividends) return fund.dividends;
    return (fund.customers?.[customerId]?.dividends) || [];
  }
  ```
- 逐步将所有 `fund.batches` → `getBatches(fund, ...)` 替换
- 优点：渐进式改造，向后兼容

**方案B（全量改造）：统一数据格式后一次性替换**
- 转换 `funds` 数据：`fund.batches` → `fund.customers['default'].batches`
- 替换所有引用
- 优点：干净；缺点：破坏性大，需一次性完成
