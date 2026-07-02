// ============================================================
// DATA STORE
// ============================================================
const DB = {
  load(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; }
  },
  save(key, data) {
    // 保存 funds_v2 前，自动把 fund 层级的 batches/dividends 同步回当前客户
    if (key === 'funds_v2' && currentCustomerId && Array.isArray(data)) {
      data.forEach(f => {
        const cd = f.customers?.[currentCustomerId];
        if (cd) {
          cd.batches = f._savedKeep ? (f.batches || []) : (f.batches || []);
          cd.dividends = f.dividends || [];
          cd.perfFee = f.perfFee;
          cd.status = f.status;
          // 同步后恢复原字段（如果有备份）
          if (f._savedBatches !== undefined) {
            f.batches = f._savedBatches;
            delete f._savedBatches;
          }
          if (f._savedDividends !== undefined) {
            f.dividends = f._savedDividends;
            delete f._savedDividends;
          }
          if (f._savedStatus !== undefined) {
            f.status = f._savedStatus;
            delete f._savedStatus;
          }
          if (f._savedPerfFee !== undefined) {
            f.perfFee = f._savedPerfFee;
            delete f._savedPerfFee;
          }
        }
      });
    }
    localStorage.setItem(key, JSON.stringify(data));
  }
};

// 数据结构
// funds: [{
//   id, name, company, strategy, perfFee（业绩报酬比例0-100）, status, note, createdAt,
//   latestNav, navDate,
//   batches: [{ id, date, amount(万), costNav, note }],
//   dividends: [{ id, date, perShare, note }],
//   navHistory: [{ id, date, nav, cumNav?, type, note }]  // 历史净值序列，cumNav=导入的累计净值
// }]

// 研报资讯数据结构
// articles: [{
//   id, type(report/wechat), source(来源名称), title, url, date, summary,
//   tags[], sentiment(-1/0/1), relevance(1-5),
//   related(关联的基金/股票), verification({verified, result, date, notes}),
//   createdAt
// }]

let funds = DB.load('funds_v2', []);
let articles = DB.load('articles_v1', []);

// ============================================================
// VOTE HISTORY DATA
// ============================================================
// voteHistory_v1: [{ id, text, type, horizon, createdAt,
//                    avgScore, bullCount, bearCount, neutralCount,
//                    investors: [{ id, name, avatar, avatarBg, style, score, verdict, sentiment }] }]
let voteHistory = DB.load('voteHistory_v1', []);
let currentVoteTab = 'current'; // 'current' | 'history'

// ============================================================
// DECISION ADVISOR DATA
// ============================================================
// decisionHistory_v1: [{ id, question, category, createdAt,
//                        relatedKnowledge: [{ id, title, category, relevance, content }],
//                        analysis: String,
//                        decision: String }]
let decisionHistory = DB.load('decisionHistory_v1', []);

// ============================================================
// STOCK DATA
// ============================================================
// stocks_v2: [{ id, code, name, market, status(holding/watchlist/sold), note,
//               trades: [{ id, type(buy/sell), date, price, qty, note }],
//               createdAt }]
let stocks = DB.load('stocks_v2', []);
let currentStockTab = 'holding';

// ============================================================
// FUTURES DATA
// ============================================================
// futures_v2: [{ id, code, name, multiplier, direction(long/short),
//               status(holding/watchlist/closed), marginRate,
//               trades: [{ id, type(open/close), date, price, qty, note }],
//               createdAt }]
let futures = DB.load('futures_v2', []);
let currentFuturesTab = 'holding';

// ============================================================
// CUSTOMER DATA（客户账套）
// ============================================================
// customers_v1: [{ id, name, note, createdAt }]
let customers = DB.load('customers_v1', []);
let currentCustomerId = null;

// ============================================================
// 数据迁移：现有 fund.batches/dividends → fund.customers
// ============================================================
(function migrateFundCustomers() {
  // 如果已有 customers 记录，说明已迁移
  if (!customers || customers.length === 0) {
    // 创建默认客户
    const defaultId = 'default-' + Date.now();
    customers = [{ id: defaultId, name: '默认客户', note: '自动创建的默认客户', createdAt: new Date().toISOString() }];
    DB.save('customers_v1', customers);
    // 迁移现有基金数据
    funds.forEach(f => {
      if (!f.customers) {
        f.customers = {};
        f.customers[defaultId] = {
          batches:   f.batches || [],
          dividends: f.dividends || [],
          perfFee:   f.perfFee,
          status:    f.status || 'holding',
        };
      }
    });
    DB.save('funds_v2', funds);
  }
  // 即使已有客户，也检查每个基金是否有 customers 字段（兼容旧导入数据）
  funds.forEach(f => {
    if (!f.customers || Object.keys(f.customers).length === 0) {
      if (!f.customers) f.customers = {};
      const firstCid = customers[0]?.id;
      if (firstCid) {
        f.customers[firstCid] = {
          batches:   f.batches || [],
          dividends: f.dividends || [],
          perfFee:   f.perfFee,
          status:    f.status || 'holding',
        };
      }
    }
  });
  DB.save('funds_v2', funds);
})();

// ============================================================
// DATA EXPORT / IMPORT (选择性导出/导入)
// ============================================================

// 导出：显示选择模态框
function exportAllData() {
  document.getElementById('modal-export-select').classList.add('open');
}

// 执行选择性导出
function doSelectiveExport() {
  const checkboxes = document.querySelectorAll('.export-cb');
  const selected = {};
  let hasSelection = false;
  checkboxes.forEach(cb => {
    if (cb.checked) { selected[cb.value] = true; hasSelection = true; }
  });
  if (!hasSelection) { alert('请至少选择一个数据类别！'); return; }

  const data = { version: 2, exportedAt: new Date().toISOString(), data: {} };
  if (selected.funds)      data.data.funds       = DB.load('funds_v2', []);
  if (selected.articles)   data.data.articles    = DB.load('articles_v1', []);
  if (selected.stocks)     data.data.stocks      = DB.load('stocks_v2', []);
  if (selected.futures)    data.data.futures     = DB.load('futures_v2', []);
  if (selected.knowledgeBase) data.data.knowledgeBase = DB.load('knowledge_v1', []);
  if (selected.funds)      data.data.customers   = DB.load('customers_v1', []); // 客户数据随基金一起

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `投资数据_选择性_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  closeModal('modal-export-select');
  alert('✅ 选择性导出完成！\n已导出：' + Object.keys(selected).join('、'));
}

// 导入：存储文件并显示选择模态框
let _pendingImportFile = null;
function importAllData(file) {
  // 确定要读取的文件
  const f = file || (() => {
    const inp = document.getElementById('import-file-input');
    return inp && inp.files.length ? inp.files[0] : null;
  })();
  if (!f) return;
  _pendingImportFile = f;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.data) throw new Error('无效的数据格式');
      document.getElementById('import-file-name').textContent = '📁 ' + _pendingImportFile.name;
      ['funds','articles','stocks','futures','knowledgeBase'].forEach(key => {
        const cb = document.querySelector(`.import-cb[value="${key}"]`);
        if (cb) cb.checked = (data.data[key] != null);
      });
      document.getElementById('modal-import-select').classList.add('open');
    } catch(err) { alert('文件读取失败：' + err.message); _pendingImportFile = null; }
  };
  reader.readAsText(_pendingImportFile);
}


// 执行选择性导入（合并，不覆盖未选类别）
function doSelectiveImport() {
  if (!_pendingImportFile) { alert('没有待导入的文件！'); return; }
  const checkboxes = document.querySelectorAll('.import-cb');
  const selected = {};
  checkboxes.forEach(cb => { if (cb.checked) selected[cb.value] = true; });
  if (!Object.keys(selected).length) { alert('请至少选择一个数据类别！'); return; }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.data) throw new Error('无效的数据格式');

      // 导入前自动备份（保留最近3份）
      const backupKey = 'backup_' + Date.now();
      const backupData = {
        funds: DB.load('funds_v2', []),
        articles: DB.load('articles_v1', []),
        stocks: DB.load('stocks_v2', []),
        futures: DB.load('futures_v2', []),
        knowledgeBase: DB.load('knowledge_v1', []),
        customers: DB.load('customers_v1', []),
        backupTime: new Date().toLocaleString()
      };
      DB.save(backupKey, backupData);
      cleanupOldBackups(3);

      // 合并导入（只合并选中的类别）
      if (selected.funds && data.data.funds) {
        mergeById('funds_v2', data.data.funds);
        if (data.data.customers) mergeById('customers_v1', data.data.customers);
      }
      if (selected.articles && data.data.articles) {
        mergeById('articles_v1', data.data.articles);
      }
      if (selected.stocks && data.data.stocks) {
        mergeById('stocks_v2', data.data.stocks);
      }
      if (selected.futures && data.data.futures) {
        mergeById('futures_v2', data.data.futures);
      }
      if (selected.knowledgeBase && data.data.knowledgeBase) {
        mergeById('knowledge_v1', data.data.knowledgeBase);
      }

      // 重新加载
      funds = DB.load('funds_v2', []);
      articles = DB.load('articles_v1', []);
      stocks = DB.load('stocks_v2', []);
      futures = DB.load('futures_v2', []);
      knowledgeBase = DB.load('knowledge_v1', []);
      customers = DB.load('customers_v1', []);

      closeModal('modal-import-select');
      _pendingImportFile = null;
      refreshCurrentPage();
      alert('✅ 选择性导入完成！\n已合并：' + Object.keys(selected).join('、') + '\n💡 如需恢复，请在浏览器开发者工具中查找 backup_ 开头的键。');
    } catch (err) {
      alert('导入失败：' + err.message);
    }
  };
  reader.readAsText(_pendingImportFile);
}

// 按 id 合并辅助函数（不存在的新增，存在的跳过）
function mergeById(key, incoming) {
  const existing = DB.load(key, []);
  const idSet = new Set(existing.map(item => item.id));
  incoming.forEach(item => {
    if (!item.id || !idSet.has(item.id)) {
      existing.push(item);
      if (item.id) idSet.add(item.id);
    }
  });
  DB.save(key, existing);
}

function cleanupOldBackups(keep) {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('backup_')).sort().reverse();
  keys.slice(keep).forEach(k => localStorage.removeItem(k));
}

// ============================================================
// 客户账套辅助函数
// ============================================================

/** 获取当前选中客户下的基金列表 */
function getActiveFunds() {
  if (!currentCustomerId) return funds; // 全部模式
  return funds.filter(f => f.customers?.[currentCustomerId]);
}

/** 获取当前客户对某只基金的持仓数据（batches, dividends 等） */
function getCustomerData(fund) {
  if (!currentCustomerId) return fund; // 全部模式：返回 fund 本身，兼容旧字段
  const cd = fund.customers?.[currentCustomerId];
  if (cd) return cd;
  return fund; // fallback
}

/** 获取当前客户对某只基金的占位状态 */
function getCustomerStatus(fund) {
  if (!currentCustomerId) return fund.status || 'holding';
  return fund.customers?.[currentCustomerId]?.status || fund.status || 'holding';
}

/** 获取当前客户可用的所有基金 status 列表（用于筛选） */
function getActiveStatuses() {
  if (!currentCustomerId) return ['holding', 'tracking', 'exited'];
  const statuses = new Set();
  funds.forEach(f => {
    const s = f.customers?.[currentCustomerId]?.status || f.status;
    if (s) statuses.add(s);
  });
  return [...statuses];
}
