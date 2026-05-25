// ============================================================
// DATA STORE
// ============================================================
const DB = {
  load(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; }
  },
  save(key, data) {
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
        backupTime: new Date().toLocaleString()
      };
      DB.save(backupKey, backupData);
      cleanupOldBackups(3);

      // 合并导入（只合并选中的类别）
      if (selected.funds && data.data.funds) {
        mergeById('funds_v2', data.data.funds);
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
