// ============================================================
// BATCH TABLE INLINE EDITING
// ============================================================
document.addEventListener('blur', function(e) {
  // 处理批次表格可编辑单元格失去焦点时保存
  const td = e.target.closest('.batch-table td.editable');
  if (!td) return;

  const tr = td.closest('tr');
  const batchId = tr?.dataset.batchId;
  const field = td.dataset.field;
  if (!batchId || !field || !currentDetailFundId) return;

  const fund = funds.find(f => f.id === currentDetailFundId);
  if (!fund) return;

  const batch = (fund.batches || []).find(b => b.id === batchId);
  if (!batch) return;

  // 获取编辑后的值
  let newValue = td.textContent.trim();

  // 根据字段类型转换和验证
  if (field === 'date') {
    // 日期格式验证
    if (newValue && !/^\d{4}-\d{2}-\d{2}$/.test(newValue)) {
      // 尝试自动补全格式
      if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(newValue)) {
        newValue = newValue.replace(/\//g, '-');
      } else {
        td.textContent = batch.date || '';
        return;
      }
    }
    if (newValue === batch.date) return;
    batch.date = newValue;
  } else if (field === 'amount') {
    const num = parseFloat(newValue);
    if (isNaN(num) || num <= 0) {
      td.textContent = batch.amount;
      return;
    }
    if (num === batch.amount) return;
    batch.amount = num;
  } else if (field === 'costNav') {
    const num = parseFloat(newValue);
    if (isNaN(num) || num <= 0) {
      td.textContent = fmt(batch.costNav, 4);
      return;
    }
    if (num === batch.costNav) return;
    batch.costNav = num;
  } else {
    return; // 其他字段不处理
  }

  // 保存并刷新
  DB.save('funds_v2', funds);
  renderDetailBody(fund);
  renderPEFund();
}, true); // 使用捕获阶段确保先触发

// ============================================================
// DIVIDEND INLINE EDITING
// ============================================================
document.addEventListener('blur', function(e) {
  // 处理分红记录可编辑单元格失去焦点时保存
  const el = e.target.closest('.dividend-item .editable');
  if (!el) return;

  const item = el.closest('.dividend-item');
  const divId = item?.dataset.divId;
  const field = el.dataset.field;
  if (!divId || !field || !currentDetailFundId) return;

  const fund = funds.find(f => f.id === currentDetailFundId);
  if (!fund) return;

  const dividend = (fund.dividends || []).find(d => d.id === divId);
  if (!dividend) return;

  // 获取编辑后的值
  let newValue = el.textContent.trim();

  // 根据字段类型转换和验证
  if (field === 'date') {
    if (newValue && !/^\d{4}-\d{2}-\d{2}$/.test(newValue)) {
      if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(newValue)) {
        newValue = newValue.replace(/\//g, '-');
      } else {
        el.textContent = dividend.date || '';
        return;
      }
    }
    if (newValue === dividend.date) return;
    dividend.date = newValue;
  } else if (field === 'perShare') {
    const num = parseFloat(newValue);
    if (isNaN(num) || num < 0) {
      el.textContent = fmt(dividend.perShare, 4);
      return;
    }
    if (num === dividend.perShare) return;
    dividend.perShare = num;
  } else if (field === 'note') {
    if (newValue === dividend.note) return;
    dividend.note = newValue;
  } else {
    return;
  }

  // 保存并刷新
  DB.save('funds_v2', funds);
  renderDetailBody(fund);
  renderPEFund();
}, true);

// ============================================================
// EVENT DELEGATION
// ============================================================
document.addEventListener('click', function(e) {
  const target = e.target;

  // 导航切换
  const navItem = target.closest('.nav-item[data-page]');
  if (navItem) {
    switchPage(navItem.dataset.page);
    return;
  }

  // Tab切换（PE基金阶段）
  const tab = target.closest('.tab');
  if (tab && tab.closest('#page-pe-fund')) {
    tab.closest('.tabs').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentPETab = tab.dataset.tab;
    renderPEFund();
    return;
  }

  // 顶部新增按钮
  if (target.id === 'btn-add-main' || target.closest('#btn-add-main')) {
    if (currentPage === 'pe-fund') openAddFund();
    if (currentPage === 'stock') openAddStock();
    if (currentPage === 'futures') openAddFutures();
    if (currentPage === 'news') document.getElementById('btn-add-article')?.click();
    if (currentPage === 'knowledge') document.getElementById('btn-add-knowledge')?.click();
    return;
  }

  // 导出数据按钮
  if (target.id === 'btn-export-data' || target.closest('#btn-export-data')) {
    exportAllData();
    return;
  }

  // 导入数据按钮
  if (target.id === 'btn-import-data' || target.closest('#btn-import-data')) {
    document.getElementById('import-file-input').click();
    return;
  }

  // Modal关闭按钮
  const closeBtn = target.closest('[data-close]');
  if (closeBtn) {
    closeModal(closeBtn.dataset.close);
    return;
  }

  // Modal遮罩点击关闭
  if (target.classList.contains('modal-overlay')) {
    target.classList.remove('open');
    return;
  }

  // 保存按钮
  if (target.id === 'btn-save-fund') { saveFund(); return; }
  if (target.id === 'btn-save-batch') { saveBatch(); return; }
  if (target.id === 'btn-save-nav') { saveNav(); return; }
  if (target.id === 'btn-save-dividend') { saveDividend(); return; }
  if (target.id === 'btn-save-nav-history') { saveNavHistory(); return; }
  if (target.id === 'btn-save-edit-nav') { saveEditedNavHistory(); return; }
  if (target.id === 'btn-clear-nav-history') { clearNavHistory(); return; }
  if (target.id === 'btn-confirm-exit-batch') { saveExitBatch(); return; }
  if (target.id === 'btn-save-stock') { saveStock(); return; }
  if (target.id === 'btn-save-stock-trade') { saveStockTrade(); return; }
  if (target.id === 'btn-save-futures') { saveFutures(); return; }
  if (target.id === 'btn-save-futures-trade') { saveFuturesTrade(); return; }

  // 详情面板关闭
  if (target.id === 'btn-detail-close') { closeDetail(); return; }
  const detailOverlay = target.closest('#detail-overlay');
  if (detailOverlay) { closeDetail(); return; }

  // data-action 处理
  const actionEl = target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    const fundId = actionEl.dataset.fundId;
    const batchId = actionEl.dataset.batchId;
    const divId = actionEl.dataset.divId;

    switch(action) {
      case 'edit-fund':       openEditFund(fundId); break;
      case 'delete-fund':     closeDetail(); setTimeout(() => deleteFund(fundId), 50); break;
      case 'open-detail':     openDetail(fundId); break;
      case 'add-batch':       openAddBatch(fundId); break;
      case 'add-dividend':    openAddDividend(fundId); break;
      case 'update-nav':      openUpdateNav(fundId); break;
      case 'del-batch':       deleteBatch(fundId, batchId); break;
      case 'restore-batch':   restoreBatch(fundId, batchId); break;
      case 'del-dividend':    deleteDividend(fundId, divId); break;
      case 'nav-history':     openNavHistory(fundId); break;
      case 'del-nav-hist':    deleteNavHistory(fundId, actionEl.dataset.navId); break;
      case 'exit-batch':      openExitBatch(fundId, batchId); break;
      case 'to-holding':
        const f1 = funds.find(f => f.id === fundId);
        if (f1) { f1.status = 'holding'; DB.save('funds_v2', funds); closeDetail(); renderPEFund(); }
        break;
      case 'to-exited':
        // 标记退出：需要填写退出净值，不能只改状态
        const f2 = funds.find(f => f.id === fundId);
        if (f2) {
          const activeBatches = (f2.batches || []).filter(b => !b.exitNav && b.note !== '跟踪');
          if (activeBatches.length === 0) {
            // 所有批次都已退出
            f2.status = 'exited';
            DB.save('funds_v2', funds);
            closeDetail();
            renderPEFund();
          } else {
            // 弹出退出窗口，填写退出净值
            openExitAllBatches(fundId);
          }
        }
        break;
    }
    return;
  }

  // 基金卡片点击（点击卡片主体打开详情）
  const fundCard = target.closest('.fund-card[data-fund-id]');
  if (fundCard && !target.closest('.btn') && !target.closest('[data-action]')) {
    openDetail(fundCard.dataset.fundId);
    return;
  }

  // ====== NEWS MODULE EVENTS ======

  // 资讯视图切换
  const newsViewTab = target.closest('#news-view-tabs .tab');
  if (newsViewTab) {
    switchNewsView(newsViewTab.dataset.newsView);
    return;
  }

  // 录入文章按钮
  if (target.id === 'btn-add-article' || target.closest('#btn-add-article')) {
    openAddArticle();
    return;
  }

  // 统计按钮
  if (target.id === 'btn-news-stats' || target.closest('#btn-news-stats')) {
    renderNewsStats();
    return;
  }

  // 保存文章按钮
  if (target.id === 'btn-save-article') {
    saveArticle();
    return;
  }

  // AI 分析按钮
  if (target.id === 'btn-ai-analyze') {
    updateStepIndicator(2);
    runAiAnalysis();
    return;
  }

  // URL 识别按钮
  if (target.id === 'btn-parse-url') {
    parseArticleUrl();
    return;
  }

  // 折叠 AI 区
  if (target.id === 'btn-toggle-ai-zone') {
    toggleAiZone();
    return;
  }

  // 保存验证按钮
  if (target.id === 'btn-save-verification') {
    saveVerification();
    return;
  }

  // 筛选联动
  if (target.closest('#news-filter-source') ||
      target.closest('#news-filter-tag') ||
      target.closest('#news-filter-verification')) {
    renderNewsView();
    return;
  }

  // 搜索输入
  if (target.id === 'news-search') {
    renderNewsView();
    return;
  }
});

// ============================================================
// EXCEL 导入净值历史
// ============================================================
let pendingNavImport = [];

// 确认导入
function initExcelImport() {
  document.getElementById('btn-import-nav-excel').addEventListener('click', function() {
    document.getElementById('nav-excel-file-input').click();
  });

  document.getElementById('nav-excel-file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const data = new Uint8Array(ev.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

        if (rows.length < 2) {
          alert('Excel文件内容为空或只有表头，请检查文件格式。');
          return;
        }

        pendingNavImport = [];
        const navType = document.getElementById('import-nav-type').value; // 'unit' or 'cumulative'
        const typeLabel = navType === 'cumulative' ? '累计净值' : '单位净值';

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          let dateStr = '';
          let navValue = null;
          let cumNavValue = null;  // 第三列的累计净值（如有）
          let note = '';

          // 第一列：日期
          const dateCell = row[0];
          if (dateCell instanceof Date) {
            dateStr = dateCell.toISOString().slice(0, 10);
          } else if (dateCell) {
            dateStr = String(dateCell).trim();
            const d = new Date(dateStr);
            if (!isNaN(d)) {
              dateStr = d.toISOString().slice(0, 10);
            }
          }

          if (!dateStr) continue;

          // 第二列：净值（根据下拉框类型统一处理）
          const navCell = row[1];
          if (navCell !== undefined && navCell !== null && navCell !== '') {
            const val = parseFloat(navCell);
            if (!isNaN(val) && val > 0) navValue = val;
          }

          // 第三列：累计净值（固定，如有则读）
          if (row[2] !== undefined && row[2] !== null && row[2] !== '') {
            const val = parseFloat(row[2]);
            if (!isNaN(val) && val > 0) cumNavValue = val;
          }

          // 第四列：备注（固定）
          if (row[3]) {
            note = String(row[3]).trim();
          }

          if (navValue !== null) {
            pendingNavImport.push({ date: dateStr, nav: navValue, cumNav: cumNavValue, type: navType, note, typeLabel });
          }
        }

        if (pendingNavImport.length === 0) {
          alert('未找到有效的净值数据，请确保第一列是日期、第二列是净值。');
          return;
        }

        pendingNavImport.sort((a, b) => a.date.localeCompare(b.date));

        const previewEl = document.getElementById('nav-import-preview');
        const tbody = document.getElementById('nav-import-tbody');
        tbody.innerHTML = pendingNavImport.map(n => {
          const label = n.type === 'cumulative'
            ? '<span style="color:var(--yellow);">累计净值</span>'
            : '<span style="color:var(--text3);">单位净值</span>';
          const cumDisplay = n.cumNav !== null
            ? fmt(n.cumNav, 4)
            : '<span style="color:var(--text3);font-size:11px;">-</span>';
          return `
          <tr>
            <td>${n.date}</td>
            <td style="font-weight:600;">${fmt(n.nav, 4)}</td>
            <td>${label}</td>
            <td style="color:var(--accent);font-weight:600;">${cumDisplay}</td>
            <td style="color:var(--text3);font-size:11px;">${n.note || '-'}</td>
          </tr>
        `}).join('');

        const summaryEl = document.getElementById('nav-import-summary');
        if (summaryEl) {
          summaryEl.innerHTML = `共 ${pendingNavImport.length} 条（${typeLabel}）`;
        }

        previewEl.style.display = 'block';
        document.getElementById('import-count').textContent = pendingNavImport.length;
        document.getElementById('btn-confirm-import-nav').style.display = 'inline-flex';
        document.getElementById('btn-cancel-import-nav').style.display = 'inline-flex';

      } catch (err) {
        console.error(err);
        alert('Excel解析失败：' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  });

  document.getElementById('btn-confirm-import-nav').addEventListener('click', function() {
    if (pendingNavImport.length === 0 || !currentNavHistFundId) return;

    const fund = funds.find(f => f.id === currentNavHistFundId);
    if (!fund) return;

    fund.navHistory = fund.navHistory || [];

    let added = 0, skipped = 0;
    pendingNavImport.forEach(nav => {
      // 同一天同类型不能重复
      const exists = fund.navHistory.some(h => h.date === nav.date && h.type === nav.type);
      if (exists) {
        skipped++;
        return;
      }
      fund.navHistory.push({
        id: uuid(),
        date: nav.date,
        nav: nav.nav,
        cumNav: nav.cumNav !== null ? nav.cumNav : undefined,
        type: nav.type,
        note: nav.note || '批量导入'
      });
      added++;
    });

    fund.navHistory.sort((a, b) => a.date.localeCompare(b.date));

    if (fund.navHistory.length > 0) {
      const latest = fund.navHistory[fund.navHistory.length - 1];
      fund.latestNav = latest.nav;
      fund.navDate = latest.date;
    }

    DB.save('funds_v2', funds);

    cancelNavImport();
    renderNavHistoryTable(fund);
    openNavHistory(fund.id);

    if (currentDetailFundId) renderDetailBody(fund);
    renderPEFund();

    const unitAdded = pendingNavImport.filter(n => n.type === 'unit').length;
    const cumAdded = pendingNavImport.filter(n => n.type === 'cumulative').length;
    let msg = `✅ 导入完成：`;
    if (unitAdded > 0) msg += `单位净值 ${unitAdded} 条`;
    if (unitAdded > 0 && cumAdded > 0) msg += `，`;
    if (cumAdded > 0) msg += `累计净值 ${cumAdded} 条`;
    if (skipped > 0) msg += `；跳过 ${skipped} 条重复`;
    alert(msg);
  });

  document.getElementById('btn-cancel-import-nav').addEventListener('click', function() {
    cancelNavImport();
  });
}

function cancelNavImport() {
  pendingNavImport = [];
  const previewEl = document.getElementById('nav-import-preview');
  if (previewEl) previewEl.style.display = 'none';
  const confirmBtn = document.getElementById('btn-confirm-import-nav');
  const cancelBtn = document.getElementById('btn-cancel-import-nav');
  if (confirmBtn) confirmBtn.style.display = 'none';
  if (cancelBtn) cancelBtn.style.display = 'none';
}

// 分红金额实时预览 + 申购份额预览 + 退出预览
document.addEventListener('input', function(e) {
  if (e.target.id === 'div-per-share' || e.target.id === 'div-date') {
    updateDivPreview();
  }
  if (e.target.id === 'batch-amount' || e.target.id === 'batch-nav') {
    const amount = parseFloat(document.getElementById('batch-amount').value);
    const nav = parseFloat(document.getElementById('batch-nav').value);
    if (!isNaN(amount) && !isNaN(nav) && nav > 0) {
      document.getElementById('batch-shares-preview').value = fmt(amount / nav, 4) + ' 万份';
    } else {
      document.getElementById('batch-shares-preview').value = '';
    }
  }
  if (e.target.id === 'exit-batch-nav') {
    updateExitPreview();
  }
  if (e.target.id === 'stock-trade-price' || e.target.id === 'stock-trade-qty') {
    updateStockTradePreview();
  }
  if (e.target.id === 'futures-trade-price' || e.target.id === 'futures-trade-qty') {
    updateFuturesTradePreview();
  }

  // ===== 股票 Tab 切换 =====
  const stockTab = e.target.closest('[data-stock-tab]');
  if (stockTab) {
    currentStockTab = stockTab.dataset.stockTab;
    document.querySelectorAll('#stock-tabs .tab').forEach(t => t.classList.remove('active'));
    stockTab.classList.add('active');
    renderStockList();
    return;
  }

  // ===== 期货 Tab 切换 =====
  const futuresTab = e.target.closest('[data-futures-tab]');
  if (futuresTab) {
    currentFuturesTab = futuresTab.dataset.futuresTab;
    document.querySelectorAll('#futures-tabs .tab').forEach(t => t.classList.remove('active'));
    futuresTab.classList.add('active');
    renderFuturesList();
    return;
  }

  // ===== 股票 / 期货 CRUD（合并处理）=====
  const actEl = e.target.closest('[data-action]');
  if (actEl) {
    const action = actEl.dataset.action;
    const sid = actEl.dataset.stockId;
    const fid = actEl.dataset.futuresId;
    if (action === 'stock-buy') { openStockTrade(sid, 'buy'); return; }
    if (action === 'stock-sell') { openStockTrade(sid, 'sell'); return; }
    if (action === 'stock-delete') { closeDetail(); setTimeout(() => deleteStock(sid), 50); return; }
    if (action === 'stock-history') { openStockDetailPanel(sid); return; }
    if (action === 'edit-stock') { closeDetail(); setTimeout(() => openEditStock(sid), 100); return; }
    if (action === 'futures-open') { openFuturesTrade(fid, 'open'); return; }
    if (action === 'futures-close') { openFuturesTrade(fid, 'close'); return; }
    if (action === 'futures-delete') { closeDetail(); setTimeout(() => deleteFutures(fid), 50); return; }
    if (action === 'futures-history') { openFuturesDetailPanel(fid); return; }
    if (action === 'edit-futures') { closeDetail(); setTimeout(() => openEditFutures(fid), 100); return; }
  }

  // ===== 资讯搜索 =
  if (e.target.id === 'news-search') {
    renderNewsView();
  }

  // URL 快速识别框（输入完成自动识别）
  if (e.target.id === 'article-url-quick') {
    const v = e.target.value.trim();
    if (v.startsWith('http')) {
      setTimeout(parseArticleUrl, 300);
    }
  }
});

// ============================================================
// IMPORT FILE INPUT CHANGE EVENT
// ============================================================
document.getElementById('import-file-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  importAllData(file);
  e.target.value = '';
});

