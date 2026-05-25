function init() {
  updateDate();
  renderPEFund();
  updateStorageSize();
  initExcelImport();
  initNewsPage();
  initKnowledgePage();
  renderVoteCardsPending();
  updateVoteHistoryCount();

  // 大师投票按钮
  document.getElementById('btn-run-vote').addEventListener('click', runVote);

  // 投票页 Enter 快捷提交
  document.getElementById('vote-position').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runVote();
    }
  });

  // 保存投票按钮
  document.getElementById('btn-save-vote').addEventListener('click', saveCurrentVote);

  // 投票 Tab 切换
  document.getElementById('vote-tabs').addEventListener('click', function(e) {
    const tab = e.target.closest('[data-vote-tab]');
    if (tab) {
      switchVoteTab(tab.dataset.voteTab);
    }
  });

  // 初始加载总览仪表盘
  switchPage('overview');
}

init();
