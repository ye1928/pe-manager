// ============================================================
// PERFORMANCE CALC ENGINE（基于历史净值序列）
// ============================================================

/**
 * 计算绩效指标（基于净值序列）
 * navHistory: [{ date: '2024-01-01', nav: 1.0000 }, ...]
 * startNav: 起始净值（第一笔申购时的净值，用于计算相对收益）
 * rfRate: 无风险利率（年化，默认 0.03）
 */
function calcPerformance(fund, startDate = null, endDate = null, benchmarkNavs = null) {
  const rfRate = parseFloat(localStorage.getItem('perf_rf_rate')) || 0.03;
  let navs = (fund.navHistory || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (navs.length < 2) return null;

  // 日期范围过滤
  if (startDate) {
    navs = navs.filter(p => p.date >= startDate);
  }
  if (endDate) {
    navs = navs.filter(p => p.date <= endDate);
  }
  if (navs.length < 2) return null;

  const n = navs.length;
  const allDividends = fund.dividends || [];
  // 只统计区间内的分红（用于计算区间内的分红收益率）
  const dividends = startDate || endDate
    ? allDividends.filter(d => {
        if (startDate && d.date < startDate) return false;
        if (endDate && d.date > endDate) return false;
        return true;
      })
    : allDividends;

  // 计算每条记录的累计净值
  const cumulativeNavs = navs.map(p => {
    // 优先使用导入时存储的累计净值
    if (p.cumNav != null) {
      return { date: p.date, nav: p.nav, cumNav: p.cumNav };
    }
    if (p.type === 'cumulative') {
      return { date: p.date, nav: p.nav, cumNav: p.nav };
    }
    // 单位净值：加上该日期及之前已分红的复权收益
    let cumNav = p.nav;
    allDividends.forEach(d => {
      if (d.date <= p.date) {
        cumNav += d.perShare;
      }
    });
    return { date: p.date, nav: p.nav, cumNav };
  });

  // 计算每段收益率和实际天数间隔（支持日频/周频/月频/断点数据）
  // 同时记录日期，用于回撤修复时间计算
  const segments = [];
  for (let i = 1; i < n; i++) {
    const prevDate = new Date(navs[i-1].date);
    const currDate = new Date(navs[i].date);
    const days = Math.max(1, (currDate - prevDate) / 86400000); // 实际日历天数
    const prevCum = cumulativeNavs[i-1].cumNav;
    const currCum = cumulativeNavs[i].cumNav;
    // 跳过无效数据点（cumNav 为 0、null、undefined 或非数值）
    if (!prevCum || !currCum || !isFinite(prevCum) || !isFinite(currCum)) continue;
    const r = (currCum - prevCum) / prevCum;
    if (!isFinite(r)) continue; // 跳过异常收益率（如 Infinity）
    segments.push({ days, r, date: navs[i].date, prevDate: navs[i-1].date });
  }

  if (segments.length < 2) return null;

  // 1. 总收益率（使用累计净值）
  const totalReturn = (cumulativeNavs[n-1].cumNav - cumulativeNavs[0].cumNav) / cumulativeNavs[0].cumNav;

  // 2. 年化收益率：复利（CAGR，供夏普/索提诺等风险指标使用）+ 单利（供UI展示）
  const firstDate = new Date(navs[0].date);
  const lastDate = new Date(navs[n-1].date);
  const days = Math.max(1, (lastDate - firstDate) / 86400000);
  const years = days / 365;
  const annualizedReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0; // CAGR
  const annualizedReturnSimple = years > 0 ? totalReturn / years : 0; // 单利

  // 3. 年化波动率（基于对数收益率 + 频率自适应年化）
  // 根据数据实际频率确定年化因子（Wind/同花顺行业惯例）
  //   avgDays < 3  → 日频，年化因子 = 252（年交易日数）
  //   avgDays < 10 → 周频，年化因子 = 52
  //   avgDays < 45 → 月频，年化因子 = 12
  //   其他        → 兜底：用实际年观测次数
  const avgDays = segments.reduce((a, s) => a + s.days, 0) / segments.length;
  let annFactor;
  if (avgDays < 3) annFactor = 252;
  else if (avgDays < 10) annFactor = 52;
  else if (avgDays < 45) annFactor = 12;
  else annFactor = Math.max(1, Math.floor(segments.length / years));
  const logReturns = segments.map(s => {
    const r = s.r;
    if (r <= -1 || !isFinite(r)) return 0;
    return Math.log(1 + r);
  });
  const meanLog = logReturns.reduce((a, v) => a + v, 0) / logReturns.length;
  const varianceLog = logReturns.reduce((a, v) => a + Math.pow(v - meanLog, 2), 0) / (logReturns.length - 1);
  const annualizedVol = Math.sqrt(varianceLog * annFactor);
  // 最终防护：如果计算结果异常（NaN/Infinity/负数），回退为 null
  const safeVol = (isFinite(annualizedVol) && annualizedVol >= 0) ? annualizedVol : null;

  // 4. 夏普比率 = (年化收益 - 无风险利率) / 年化波动率
  const sharpe = (safeVol != null && safeVol > 0) ? (annualizedReturn - rfRate) / safeVol : null;

  // 5. 信息比率 = (基金年化收益 - 基准年化收益) / 跟踪误差
  //    需要基准数据；无基准时返回 null
  let infoRatio = null;
  if (benchmarkNavs && benchmarkNavs.length >= 2 && safeVol != null && safeVol > 0) {
    // 计算基准在同期的年化收益
    let bNavs = benchmarkNavs.slice().sort((a, b) => a.date.localeCompare(b.date));
    if (startDate) bNavs = bNavs.filter(p => p.date >= startDate);
    if (endDate) bNavs = bNavs.filter(p => p.date <= endDate);
    if (bNavs.length >= 2) {
      const bStart = bNavs[0].nav;
      const bEnd = bNavs[bNavs.length - 1].nav;
      const bTotalRet = (bEnd - bStart) / bStart;
      const bDays = Math.max(1, (new Date(bNavs[bNavs.length-1].date) - new Date(bNavs[0].date)) / 86400000);
      const bAnnRet = bDays > 0 ? Math.pow(1 + bTotalRet, 365/bDays) - 1 : 0;
      // 跟踪误差 = 基金与基准收益率差异的标准差（年化）
      const excessReturns = [];
      for (let i = 1; i < bNavs.length && i < segments.length; i++) {
        const bPrev = bNavs[i-1].nav;
        const bCurr = bNavs[i].nav;
        const bR = (bCurr - bPrev) / bPrev;
        if (isFinite(bR) && i - 1 < segments.length) {
          excessReturns.push(logReturns[i-1] - Math.log(1 + bR));
        }
      }
      if (excessReturns.length >= 2) {
        const meanER = excessReturns.reduce((a, v) => a + v, 0) / excessReturns.length;
        const teVar = excessReturns.reduce((a, v) => a + Math.pow(v - meanER, 2), 0) / (excessReturns.length - 1);
        const trackingError = Math.sqrt(teVar * annFactor);
        if (trackingError > 0) {
          infoRatio = (annualizedReturn - bAnnRet) / trackingError;
        }
      }
    }
  }

  // 6. Omega 比率 = 上行收益总和(阈值以上) / 下行损失总和(阈值以下,绝对值)
  //    阈值设为 0（即区分正负收益），Omega > 1 说明上行多于下行
  let omegaRatio = null;
  if (logReturns.length >= 10) {
    const upSum = logReturns.filter(r => r > 0).reduce((a, r) => a + Math.exp(r) - 1, 0);
    const downSum = logReturns.filter(r => r <= 0).reduce((a, r) => a + Math.abs(Math.exp(r) - 1), 0);
    if (downSum > 0) {
      omegaRatio = upSum / downSum;
    } else if (upSum > 0) {
      omegaRatio = 999; // 全是正收益
    }
  }

  // 5. 最大回撤（使用累计净值计算，结果为负数表示亏损）
  // 同时记录回撤的峰值日期，用于计算修复时间
  let peak = cumulativeNavs[0].cumNav;
  let peakDate = cumulativeNavs[0].date;
  let maxDrawdown = 0;
  let maxDDDate = cumulativeNavs[0].date;
  let maxDDPeakDate = cumulativeNavs[0].date;
  cumulativeNavs.forEach(p => {
    if (p.cumNav >= peak) {
      peak = p.cumNav;
      peakDate = p.date;
    } else {
      const dd = (p.cumNav - peak) / peak;
      if (dd < maxDrawdown) {
        maxDrawdown = dd;
        maxDDDate = p.date;
        maxDDPeakDate = peakDate;
      }
    }
  });

  // 计算最大回撤修复时间：从底部日期找到之后首次净值 >= 峰值净值的日期
  let ddRecoveryDays = null;
  if (maxDrawdown < 0) {
    const peakVal = cumulativeNavs.find(p => p.date === maxDDPeakDate);
    if (peakVal) {
      for (let i = 0; i < cumulativeNavs.length; i++) {
        if (cumulativeNavs[i].date <= maxDDDate) continue;
        if (cumulativeNavs[i].cumNav >= peakVal.cumNav) {
          ddRecoveryDays = Math.round((new Date(cumulativeNavs[i].date) - new Date(maxDDDate)) / 86400000);
          break;
        }
      }
    }
  }

  // 6. 卡玛比率 = 年化收益 / |最大回撤|
  const calmar = maxDrawdown < 0 ? annualizedReturn / (-maxDrawdown) : 0;

  // 7. 计算年化分红收益率（如果有分红）
  const batches = fund.batches || [];
  let totalDivReceived = 0;
  batches.forEach(b => {
    const shares = Number(b.amount) / Number(b.costNav);
    dividends.forEach(d => {
      if (d.date >= (b.date || '')) totalDivReceived += Number(d.perShare) * shares;
    });
  });
  const totalCost = batches.reduce((a, b) => a + Number(b.amount), 0);
  const divYieldAnnual = totalCost > 0 && years > 0
    ? (totalDivReceived / totalCost) / years : 0;

  // 9. 正收益段占比（每段不论天数，正收益即计入）
  const positiveSegments = segments.filter(s => s.r > 0).length;
  const positiveRate = segments.length > 0 ? positiveSegments / segments.length : 0;

  // ========== 新增：5个高级绩效指标 ==========

  // 1. 索提诺比率（Sortino Ratio）：只用下行对数收益率
  const downLogReturns = [];
  for (let i = 0; i < logReturns.length; i++) {
    if (logReturns[i] < 0) downLogReturns.push(logReturns[i]);
  }
  const downVariance = downLogReturns.length > 1
    ? downLogReturns.reduce((a, v) => a + v * v, 0) / (downLogReturns.length - 1)
    : 0;
  const downAnnualizedVol = downVariance > 0 ? Math.sqrt(downVariance * annFactor) : 0;
  const sortino = downAnnualizedVol > 0 ? (annualizedReturn - rfRate) / downAnnualizedVol : null;

  // 2. 盈亏比：平均正收益段 / 平均负收益段（绝对值）
  const posSeg = segments.filter(s => s.r > 0);
  const negSeg = segments.filter(s => s.r < 0);
  const avgPos = posSeg.length > 0 ? posSeg.reduce((a, s) => a + s.r, 0) / posSeg.length : 0;
  const avgNeg = negSeg.length > 0 ? Math.abs(negSeg.reduce((a, s) => a + s.r, 0) / negSeg.length) : 0;
  const profitLossRatio = avgNeg > 0 ? avgPos / avgNeg : (avgPos > 0 ? 999 : null);

  // 3. 最长连盈/连亏天数（按净值序列的日历天数累计）
  let curWin = 0, curLose = 0, maxWinDays = 0, maxLoseDays = 0;
  for (let i = 1; i < cumulativeNavs.length; i++) {
    const r = (cumulativeNavs[i].cumNav - cumulativeNavs[i-1].cumNav) / cumulativeNavs[i-1].cumNav;
    const dy = Math.max(1, (new Date(cumulativeNavs[i].date) - new Date(cumulativeNavs[i-1].date)) / 86400000);
    if (r > 0) {
      curWin += dy;
      maxLoseDays = Math.max(maxLoseDays, curLose);
      curLose = 0;
    } else if (r < 0) {
      curLose += dy;
      maxWinDays = Math.max(maxWinDays, curWin);
      curWin = 0;
    } else {
      maxWinDays = Math.max(maxWinDays, curWin);
      maxLoseDays = Math.max(maxLoseDays, curLose);
      curWin = 0;
      curLose = 0;
    }
  }
  maxWinDays = Math.max(maxWinDays, curWin);
  maxLoseDays = Math.max(maxLoseDays, curLose);

  // 4. 95% VaR（在险价值）：95%置信度下的最大损失比例
  let var95 = null;
  if (logReturns.length >= 20) {
    const sortedLog = [...logReturns].sort((a, b) => a - b);
    const idx95 = Math.max(0, Math.floor(sortedLog.length * 0.05));
    var95 = Math.exp(sortedLog[idx95]) - 1;
  }

  return {
    totalReturn,
    annualizedReturn,
    annualizedReturnSimple,
    omegaRatio,
    annualizedVol: safeVol,
    sharpe,
    maxDrawdown,
    maxDDDate,
    calmar,
    infoRatio,
    divYieldAnnual,
    positiveRate,
    // 新增5个指标
    sortino,
    profitLossRatio,
    ddRecoveryDays,
    maxWinDays,
    maxLoseDays,
    var95,
    navCount: n,
    startDate: navs[0].date,
    endDate: navs[n-1].date,
    years: years.toFixed(2),
  };
}


// ============================================================
// 基金评价说明自动生成
// ============================================================
function generateFundCommentary(fund) {
  const perf = calcPerformance(fund);
  if (!perf) return null;

  const parts = [];
  const annRet = perf.annualizedReturn || 0;
  const sharpe = perf.sharpe;
  const maxDD = perf.maxDrawdown || 0;
  const var95 = perf.var95;
  const calmar = perf.calmar || 0;
  const omega = perf.omegaRatio;
  const positiveRate = perf.positiveRate || 0;
  const years = parseFloat(perf.years) || 0;

  // 第1句：年化收益评价
  let retLevel = '';
  if (annRet > 0.20) retLevel = '表现优异';
  else if (annRet > 0.10) retLevel = '表现良好';
  else if (annRet > 0) retLevel = '略有正收益';
  else if (annRet > -0.10) retLevel = '略有亏损';
  else retLevel = '亏损较大';
  
  const retColor = annRet >= 0 ? 'red' : 'green';
  parts.push(`该基金${years > 0 ? '近' + perf.years + '年' : ''}年化收益为 <span style="color:var(--red);font-weight:700;">${(annRet * 100).toFixed(2)}%</span>，${retLevel}。`);

  // 第2句：夏普比率 + 卡玛比率
  let riskParts = [];
  if (sharpe != null) {
    let sharpeLevel = '';
    if (sharpe > 2) sharpeLevel = '极佳';
    else if (sharpe > 1) sharpeLevel = '优秀';
    else if (sharpe > 0) sharpeLevel = '一般';
    else sharpeLevel = '较差';
    riskParts.push(`夏普比率 ${sharpe.toFixed(2)}（${sharpeLevel}）`);
  }
  if (calmar > 0) {
    riskParts.push(`卡玛比率 ${calmar.toFixed(2)}`);
  }
  if (riskParts.length > 0) {
    parts.push(`风险调整后收益：${riskParts.join('，')}。`);
  }

  // 第3句：最大回撤
  if (maxDD < 0) {
    let ddLevel = '';
    if (maxDD > -0.05) ddLevel = '回撤控制非常好';
    else if (maxDD > -0.10) ddLevel = '回撤控制较好';
    else if (maxDD > -0.20) ddLevel = '回撤较大';
    else ddLevel = '回撤非常大';
    let ddRecovery = '';
    if (perf.ddRecoveryDays != null) {
      ddRecovery = `，耗时${perf.ddRecoveryDays}天修复`;
    }
    parts.push(`最大回撤 <span style="color:var(--green);font-weight:700;">${(maxDD * 100).toFixed(2)}%</span>，${ddLevel}${ddRecovery}。`);
  }

  // 第4句：VaR + Omega
  let tailParts = [];
  if (var95 != null) {
    tailParts.push(`VaR(95%) 为 <span style="color:var(--green);font-weight:700;">${(var95 * 100).toFixed(2)}%</span>`);
  }
  if (omega != null && omega !== 999) {
    let omegaLevel = omega > 1.5 ? '上行收益明显优于下行' : omega > 1 ? '上行略优于下行' : '下行风险较高';
    tailParts.push(`Omega比率 ${omega.toFixed(2)}（${omegaLevel}）`);
  }
  if (tailParts.length > 0) {
    parts.push(`尾部风险：${tailParts.join('，')}。`);
  }

  // 第5句：正收益占比
  if (perf.navCount >= 10) {
    let posLevel = '';
    if (positiveRate > 0.6) posLevel = '趋势性较强';
    else if (positiveRate > 0.4) posLevel = '涨跌参半';
    else posLevel = '波动较大';
    parts.push(`净值正收益段占比 ${(positiveRate * 100).toFixed(0)}%，${posLevel}（共${perf.navCount}个观测点）。`);
  }

  return `<div class="commentary-box">
    <div class="commentary-title">📝 基金评价</div>
    <div class="commentary-body">${parts.join('')}</div>
    <button class="btn btn-sm btn-secondary" onclick="openFullAnalysis('${fund.id}')" style="margin-top:10px;">📈 查看完整分析</button>
  </div>`;
}

// 跳转到归因分析页（净值拟合Tab）并选中该基金
function openFullAnalysis(fundId) {
  // 设置归因分析页切换到净值拟合Tab
  currentAttrTab = 'navfit';
  // 选中该基金
  selectedNavFitFunds.clear();
  const fund = funds.find(f => f.id === fundId);
  if (fund) selectedNavFitFunds.add(fundId);
  // 切换页面（会调用 renderAttribution，显示概览Tab）
  switchPage('attribution');
  // 手动完成 Tab 切换（模拟点击逻辑，不触发实际点击）
  document.querySelectorAll('.attr-tab').forEach(t => t.classList.remove('active'));
  const btn = document.querySelector('.attr-tab[data-attr-tab="navfit"]');
  if (btn) btn.classList.add('active');
  document.querySelectorAll('[id^="attr-tab-"]').forEach(el => el.style.display = 'none');
  const tabContent = document.getElementById('attr-tab-navfit');
  if (tabContent) tabContent.style.display = '';
  // 渲染净值拟合
  if (typeof renderNavFit === 'function') renderNavFit();
}

// ============================================================
// 净值拟合深度分析报告
// ============================================================
function generateNavFitAnalysis(selFundStats, benchFund) {
  const validStats = selFundStats.filter(s => s.hasPerf);
  if (validStats.length === 0) return null;

  const parts = [];
  const fundCount = validStats.length;
  const rfRate = parseFloat(localStorage.getItem('perf_rf_rate')) || 0.03;

  // ===== 1. 总体概况 =====
  const dateRange = validStats[0].perf;
  const startD = dateRange.startDate;
  const endD = dateRange.endDate;
  parts.push(`<div style="font-size:14px;font-weight:700;color:var(--accent);margin-bottom:8px;">📊 深度分析报告</div>`);
  parts.push(`<div style="font-size:12px;color:var(--text3);margin-bottom:12px;">分析区间：${startD} ~ ${endD}，共${fundCount}只基金${benchFund ? '，基准：' + benchFund.name : ''}。</div>`);

  // ===== 2. 单只基金深度分析 =====
  if (fundCount === 1) {
    const s = validStats[0];
    const p = s.perf;
    const name = s.f.name;

    // 业绩评价
    let retComment = '';
    const annRet = p.annualizedReturn || 0;
    if (annRet > 0.20) retComment = '表现极为出色，远超市场平均水平';
    else if (annRet > 0.10) retComment = '表现优秀，具备较强的盈利能力';
    else if (annRet > 0.03) retComment = '表现尚可，略高于无风险收益';
    else if (annRet > 0) retComment = '收益微薄， barely 跑赢通胀';
    else if (annRet > -0.05) retComment = '略有亏损，需要关注后续走势';
    else retComment = '亏损明显，需审慎评估持有价值';
    parts.push(`<div style="margin-bottom:8px;"><b style="color:var(--text);">1. 业绩表现：</b>该基金年化收益 <span style="color:${annRet >= 0 ? 'var(--red)' : 'var(--green)'};font-weight:700;">${(annRet * 100).toFixed(2)}%</span>，${retComment}。区间总收益 ${(p.totalReturn * 100).toFixed(1)}%。</div>`);

    // 风险评价
    const maxDD = p.maxDrawdown || 0;
    const vol = p.annualizedVol;
    let riskComment = '';
    if (maxDD > -0.05 && vol && vol < 0.10) riskComment = '风险控制极佳，波动温和';
    else if (maxDD > -0.10 && vol && vol < 0.15) riskComment = '风险控制较好，回撤在可接受范围';
    else if (maxDD > -0.15) riskComment = '风险适中，需有一定承受能力';
    else riskComment = '风险较高，波动剧烈，需密切监控';
    parts.push(`<div style="margin-bottom:8px;"><b style="color:var(--text);">2. 风险特征：</b>最大回撤 <span style="color:var(--green);font-weight:700;">${(maxDD * 100).toFixed(1)}%</span>，年化波动率 ${vol != null ? (vol * 100).toFixed(1) + '%' : '--'}，${riskComment}。${p.ddRecoveryDays != null ? `回撤修复耗时${p.ddRecoveryDays}天。` : ''}</div>`);

    // 收益风险比
    let ratioComment = '';
    const sharpe = p.sharpe;
    const calmar = p.calmar;
    if (sharpe != null) {
      if (sharpe > 1.5) ratioComment = '单位风险带来的超额收益非常丰厚';
      else if (sharpe > 1) ratioComment = '风险调整后收益良好，性价比较高';
      else if (sharpe > 0) ratioComment = '风险补偿一般，勉强覆盖波动成本';
      else ratioComment = '风险补偿不足，波动侵蚀了收益';
    }
    parts.push(`<div style="margin-bottom:8px;"><b style="color:var(--text);">3. 收益风险比：</b>夏普比率 ${sharpe != null ? sharpe.toFixed(2) : '--'}，${ratioComment}。卡玛比率 ${calmar > 0 ? calmar.toFixed(2) : '--'}${calmar > 1 ? '，说明每承受1%回撤可获得超过1%的年化收益' : calmar > 0 ? '，收益与回撤的比例一般' : ''}。</div>`);

    // 索提诺 vs 夏普对比
    if (p.sortino != null && sharpe != null) {
      let sortinoComment = '';
      if (p.sortino > sharpe * 1.2) sortinoComment = '下行波动控制明显优于整体波动，尾部风险管理优秀';
      else if (p.sortino > sharpe) sortinoComment = '下行波动控制优于整体波动，尾部风险较小';
      else if (p.sortino < sharpe * 0.8) sortinoComment = '下行波动偏大，需关注极端行情下的应对';
      else sortinoComment = '下行波动与整体波动基本一致';
      parts.push(`<div style="margin-bottom:8px;"><b style="color:var(--text);">3b. 下行风险（索提诺）：</b>索提诺比率 ${(p.sortino * 100).toFixed(2)}%，\${sortinoComment}。（夏普 \${(sharpe * 100).toFixed(2)}%）</div>`);
    }

    // 收益质量
    const posRate = (p.positiveRate || 0) * 100;
    const plRatio = p.profitLossRatio;
    const omega = p.omegaRatio;
    let qualityComment = '';
    if (plRatio != null && plRatio > 1.5) qualityComment = '赚钱时的平均幅度远大于亏钱时，收益质量很高';
    else if (plRatio != null && plRatio > 1) qualityComment = '赚钱幅度大于亏钱幅度，收益质量尚可';
    else if (plRatio != null) qualityComment = '亏钱幅度偏大，需要优化止损策略';
    parts.push(`<div style="margin-bottom:8px;"><b style="color:var(--text);">4. 收益质量：</b>正收益段占比 ${posRate.toFixed(0)}%，盈亏比 ${plRatio != null ? plRatio.toFixed(2) : '--'}，${qualityComment}。Omega比率 ${omega != null ? omega.toFixed(2) : '--'}${omega != null ? (omega > 1.5 ? '，上行收益显著占优' : omega > 1 ? '，上行略占优' : '，下行风险不容忽视') : ''}。</div>`);

    // 尾部风险
    const var95 = p.var95;
    if (var95 != null) {
      parts.push(`<div style="margin-bottom:8px;"><b style="color:var(--text);">5. 尾部风险：</b>95% VaR 为 <span style="color:var(--green);font-weight:700;">${(var95 * 100).toFixed(2)}%</span>，意味着在95%的交易日里，单日损失不会超过此数值。${var95 < -0.05 ? '极端波动风险较高，建议控制仓位。' : '尾部风险可控。'}</div>`);
    }

    // 多维评级 + 综合评价
    const getRating = (val, sTh, aTh, bTh, cTh) => {
      if (val == null) return 'C';
      if (val >= sTh) return 'S';
      if (val >= aTh) return 'A';
      if (val >= bTh) return 'B';
      if (val >= cTh) return 'C';
      return 'D';
    };
    const rR = getRating(annRet, 0.20, 0.10, 0.03, 0);
    const rkR = getRating(-maxDD, 0.05, 0.10, 0.15, 0.20);
    const spR = getRating(sharpe, 2, 1, 0.5, 0);
    const posRateRaw = (p.positiveRate || 0) * 100;
    const stR = getRating(posRateRaw, 55, 50, 45, 30);
    const ratingColor = { S: "#10b981", A: "#3b82f6", B: "#f59e0b", C: "#6b7280", D: "#ef4444" };
    const badge = (lbl, r) => `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;color:#fff;background:${ratingColor[r]};margin-right:5px;">${lbl}:${r}</span>`;
    parts.push(`<div style="margin-top:10px;padding:10px;background:var(--bg2);border-radius:8px;font-size:13px;">
      <div style="margin-bottom:8px;font-weight:700;color:var(--text);">📊 多维评级</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
        ${badge("收益力", rR)}${badge("抗风险", rkR)}${badge("性价比", spR)}${badge("稳定性", stR)}
      </div>
    </div>`);

    // 持有建议（根据基金状态）
    let holdSuggestion = '';
    const fStatus = s.f.status || 'holding';
    if (fStatus === 'holding') {
      if (sharpe != null && sharpe > 1 && annRet > 0.10 && maxDD > -0.15) holdSuggestion = '🟢 <b>建议继续持有</b>，业绩优秀、风险可控。';
      else if (annRet < 0 || (sharpe != null && sharpe < 0)) holdSuggestion = '🔴 <b>建议审慎评估</b>，当前亏损或风险补偿不足。';
      else holdSuggestion = '🟡 <b>可继续观察</b>，暂不加仓。';
    } else if (fStatus === 'tracking') {
      if (sharpe != null && sharpe > 1.5 && maxDD > -0.10) holdSuggestion = '🟢 <b>可择机建仓</b>，性价比优秀、回撤可控。';
      else if (annRet < 0 || maxDD < -0.20) holdSuggestion = '🔴 <b>暂不建议入手</b>，业绩或风险特征不佳。';
      else holdSuggestion = '🟡 <b>继续观望</b>，等待更好入场时机。';
    } else if (fStatus === 'exited') {
      holdSuggestion = '⚪ <b>该基金已退出</b>，可关注未来是否重新具备投资价值。';
    }
    parts.push(`<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:13px;">${holdSuggestion}</div>`);
    parts.push(`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:13px;">${overall}</div>`);
  }

  // ===== 3. 多只基金横向对比 =====
  else {
    parts.push(`<div style="margin-bottom:8px;"><b style="color:var(--text);">横向对比（${fundCount}只基金）：</b></div>`);

    // 按年化收益排序
    const byReturn = [...validStats].sort((a, b) => b.perf.annualizedReturn - a.perf.annualizedReturn);
    const best = byReturn[0];
    const worst = byReturn[byReturn.length - 1];
    parts.push(`<div style="margin-bottom:6px;">• <b>收益排名：</b>最优为 <span style="color:${best.perf.annualizedReturn >= 0 ? 'var(--red)' : 'var(--green)'};font-weight:600;">${best.f.name}</span>（年化${(best.perf.annualizedReturn * 100).toFixed(1)}%），最差为 <span style="color:${worst.perf.annualizedReturn >= 0 ? 'var(--red)' : 'var(--green)'};font-weight:600;">${worst.f.name}</span>（年化${(worst.perf.annualizedReturn * 100).toFixed(1)}%）。</div>`);

    // 按夏普排序
    const bySharpe = [...validStats].filter(s => s.perf.sharpe != null).sort((a, b) => b.perf.sharpe - a.perf.sharpe);
    if (bySharpe.length > 0) {
      parts.push(`<div style="margin-bottom:6px;">• <b>性价比排名（夏普）：</b>最佳为 <span style="color:var(--accent);font-weight:600;">${bySharpe[0].f.name}</span>（${bySharpe[0].perf.sharpe.toFixed(2)}），最差为 <span style="color:var(--text3);font-weight:600;">${bySharpe[bySharpe.length - 1].f.name}</span>（${bySharpe[bySharpe.length - 1].perf.sharpe.toFixed(2)}）。</div>`);
    }

    // 按最大回撤排序（从好到坏，即回撤小的排前面）
    const byDD = [...validStats].sort((a, b) => b.perf.maxDrawdown - a.perf.maxDrawdown);
    parts.push(`<div style="margin-bottom:6px;">• <b>风控排名（回撤）：</b>最优为 <span style="color:var(--accent);font-weight:600;">${byDD[0].f.name}</span>（${(byDD[0].perf.maxDrawdown * 100).toFixed(1)}%），最差为 <span style="color:var(--text3);font-weight:600;">${byDD[byDD.length - 1].f.name}</span>（${(byDD[byDD.length - 1].perf.maxDrawdown * 100).toFixed(1)}%）。</div>`);

    // 综合推荐
    const topSharpe = bySharpe.length > 0 ? bySharpe[0] : null;
    const topReturn = byReturn[0];
    if (topSharpe && topSharpe.f.id === topReturn.f.id) {
      parts.push(`<div style="margin-top:8px;"><b>综合推荐：</b><span style="color:var(--red);font-weight:700;">${topReturn.f.name}</span> 在收益和性价比两方面均表现最佳，是当前组合中的<span style="color:var(--red);font-weight:700;">核心标的</span>。</div>`);
    } else if (topSharpe) {
      parts.push(`<div style="margin-top:8px;"><b>综合推荐：</b>追求收益可选 <span style="color:var(--red);font-weight:700;">${topReturn.f.name}</span>（年化${(topReturn.perf.annualizedReturn * 100).toFixed(1)}%），追求稳健可选 <span style="color:var(--accent);font-weight:700;">${topSharpe.f.name}</span>（夏普${topSharpe.perf.sharpe.toFixed(2)}）。</div>`);
    }
  }

  // ===== 4. 基准对比（如有） =====
  if (benchFund && validStats.length > 0) {
    const s = validStats[0];
    const p = s.perf;
    if (p.infoRatio != null) {
      const irComment = p.infoRatio > 1 ? '信息比率优秀，超额收益稳定' : p.infoRatio > 0.5 ? '有一定超额收益能力' : p.infoRatio > 0 ? '超额收益微弱' : '跑输基准';
      parts.push(`<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);"><b>基准对比（vs ${benchFund.name}）：</b>信息比率 ${p.infoRatio.toFixed(2)}，${irComment}。</div>`);
    }
  }

  return `<div class="commentary-box" style="background:linear-gradient(135deg,#f8fafc 0%,#f0f9ff 100%);border-color:#e0f2fe;">
    ${parts.join('')}
  </div>`;
}


// 无风险利率改变时保存并刷新
function onRfRateChange(val) {
  const v = parseFloat(val);
  if (!isNaN(v)) {
    localStorage.setItem('perf_rf_rate', (v / 100).toFixed(4));
    if (typeof renderApp === 'function') renderApp();
  }
}

// ============================================================
// FUND CALC ENGINE
// ============================================================

/**
 * 计算某基金某批次的收益
 * 浮动盈亏 = 当前市值 - 成本市值（随净值变动，未结算）
 * 已实现盈亏 = 分红 + 退出时结算的盈亏（已兑现）
 * 业绩报酬 = 对浮动和已实现正收益部分均计提（持仓中也提，退出时结算）
 * 持仓份额 = 原始份额 - 已退出份额（仅对部分退出有效）
 */
function calcBatch(batch, latestNav, dividends, perfFeeRate = 0) {
  const amount = Number(batch.amount) || 0;       // 申购金额（万元）
  const costNav = Number(batch.costNav) || 1;     // 成本净值
  // 部分退出时，已退出份额单独记录；全额退出时 exitNav != null
  const exitShares = Number(batch.exitShares) || 0;
  const origShares = amount / costNav;
  const remainingShares = Math.max(0, origShares - exitShares);
  // 如果全部退出（exitNav != null 且已无剩余份额），则份额和成本为0
  // 是否完全退出（exitNav 存在则表示该批次已全部退出，份额归零）
  const isExited = batch.exitNav != null && batch.exitNav !== '';
  const shares = isExited ? 0 : remainingShares;
  const costTotal = isExited ? 0 : remainingShares * costNav;
  const evalNav = isExited ? Number(batch.exitNav) : (Number(latestNav) || costNav);

  // 浮动盈亏 = (当前净值 - 成本净值) × 剩余份额（只有未退出批次才算浮动）
  const floatingGain = isExited ? 0 : (evalNav - costNav) * shares;

  // 分红收益 = 仅统计申购日期之后发生的分红
  const batchDate = batch.date || '1900-01-01';
  let divGain = 0;
  (dividends || []).forEach(div => {
    if (div.date >= batchDate) {
      // 已退出：用原始份额计算历史分红（分红在退出前发生）
      // 未退出：用剩余份额计算
      const shares = isExited ? origShares : remainingShares;
      divGain += Number(div.perShare) * shares;
    }
  });

  // 退出时资本利得（用于计算已实现盈亏和业绩报酬）
  const exitCapitalGain = isExited ? (evalNav - costNav) * origShares : 0;

  // 已实现盈亏 = 退出时资本利得 + 分红（退出才计入；未退出只有分红）
  const realizedGain = isExited ? exitCapitalGain + divGain : divGain;

  // 业绩报酬：对已实现和浮动正收益均计提（退出时用退出净值算；持仓中用当前净值算）
  const capitalGain = isExited ? exitCapitalGain : floatingGain;
  const perfFee = Math.max(0, capitalGain) * perfFeeRate;

  // 总盈亏 = 浮动 + 已实现 - 业绩报酬
  const totalGain = floatingGain + realizedGain;
  const netGain = totalGain - perfFee;
  const totalGainPct = costTotal > 0 ? netGain / costTotal : 0;

  return {
    shares,
    costTotal,
    floatingGain,    // 浮动盈亏（万元）
    divGain,         // 分红收益（万元）
    realizedGain,    // 已实现盈亏（万元）
    perfFee,         // 业绩报酬（万元）
    totalGain,       // 总盈亏（万元，计提前）
    netGain,         // 净盈亏（万元，计提后）
    totalGainPct,
    evalNav,
    costNav,
    isExited
  };
}

/**
 * 计算整只基金汇总
 */
function calcFund(fund) {
  const batches = fund.batches || [];
  const dividends = fund.dividends || [];
  const latestNav = Number(fund.latestNav) || 0;
  const perfFeeRate = (Number(fund.perfFee) || 0) / 100;

  let totalCost = 0, totalShares = 0;
  let totalFloating = 0, totalDivGain = 0, totalRealized = 0;
  let totalPerfFee = 0, totalRealizedPerfFee = 0;

  batches.forEach(b => {
    const r = calcBatch(b, latestNav, dividends, perfFeeRate);
    console.log('批次计算:', b.id, '日期:', b.date, 'exitNav:', b.exitNav, 'exitNav!=null:', b.exitNav != null, 'isExited:', r.isExited, '浮动:', r.floatingGain, '分红:', r.divGain, '已实现:', r.realizedGain);
    totalCost += r.costTotal;
    totalShares += r.shares;
    totalFloating += r.floatingGain;
    totalDivGain += r.divGain;
    totalRealized += r.realizedGain;
    totalPerfFee += r.perfFee;
    // 仅已退出批次产生的业绩报酬（来自资本利得）
    if (r.isExited) totalRealizedPerfFee += r.perfFee;
  });

  const totalGain = totalFloating + totalRealized;  // 总盈亏（浮动+已实现）
  const netGain = totalGain - totalPerfFee;         // 计提后净收益
  const totalGainPct = totalCost > 0 ? netGain / totalCost : 0;
  const avgCostNav = totalShares > 0 ? totalCost / totalShares : 0;

  return {
    totalCost,
    totalShares,
    totalFloating,
    totalDivGain,
    totalRealized,
    totalGain,
    totalPerfFee,
    totalRealizedPerfFee,  // 仅来自已退出批次的业绩报酬
    netGain,
    totalGainPct,
    avgCostNav,
    latestNav
  };
}



