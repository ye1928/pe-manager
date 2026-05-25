// ==========================================================
// CONTRIBUTION ANALYSIS (组合贡献分析)
// ==========================================================
let contribHeld = new Set();   // held fund ids (portfolio base)
let contribCandidate = null; // single candidate fund id
let contribChart = null;

function renderContributionTab() {
  const heldDiv = document.getElementById('contrib-held-selector');
  const candDiv = document.getElementById('contrib-candidate-selector');
  if (!heldDiv || !candDiv) return;

  if (typeof funds === 'undefined' || !Array.isArray(funds)) {
    heldDiv.innerHTML = '<span style="color:var(--text3);font-size:12px;">数据加载中...</span>';
    candDiv.innerHTML = '';
    return;
  }

  const allFunds = funds.filter(f => (f.navHistory || []).length >= 10);
  if (allFunds.length === 0) {
    heldDiv.innerHTML = '<span style="color:var(--text3);font-size:12px;">暂无净值数据 ≥10 条的基金</span>';
    candDiv.innerHTML = '';
    return;
  }

  heldDiv.innerHTML = allFunds.map((f, i) => {
    const sel = contribHeld.has(String(f.id)) ? 'selected' : '';
    const color = CORR_COLORS[i % CORR_COLORS.length];
    return `<span class="corr-chip ${sel}" data-contrib-held="${f.id}" style="${sel ? `background:${color};border-color:${color};color:#fff;` : ''}">${f.name.length > 8 ? f.name.slice(0, 8) + '…' : f.name}</span>`;
  }).join('');

  candDiv.innerHTML = allFunds.map((f, i) => {
    const sel = contribCandidate === String(f.id) ? 'selected' : '';
    const color = CORR_COLORS[i % CORR_COLORS.length];
    return `<span class="corr-chip ${sel}" data-contrib-cand="${f.id}" style="${sel ? `background:${color};border-color:${color};color:#fff;` : ''}">${f.name.length > 8 ? f.name.slice(0, 8) + '…' : f.name}</span>`;
  }).join('');

  // Held chip click
  heldDiv.querySelectorAll('.corr-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = String(chip.dataset.contribHeld);
      if (contribHeld.has(id)) {
        contribHeld.delete(id);
      } else {
        contribHeld.add(id);
      }
      renderContributionTab();
    });
  });

  // Candidate chip click (single select)
  candDiv.querySelectorAll('.corr-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = String(chip.dataset.contribCand);
      if (contribCandidate === id) {
        contribCandidate = null;
      } else {
        contribCandidate = id;
      }
      renderContributionTab();
    });
  });
}

// 计算一组基金的平均 pairwise 相关性（绝对值）
function calcAvgCorrelation(fundIds) {
  if (fundIds.length < 2) return null;
  const result = calcCorrelationMatrix(new Set(fundIds));
  if (!result) return null;
  const { corr, ids } = result;
  const vals = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (corr[ids[i]][ids[j]] !== null) {
        vals.push(Math.abs(corr[ids[i]][ids[j]]));
      }
    }
  }
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// 计算组合归一化净值序列（等权平均）
function calcPortfolioNAV(fundIds) {
  if (fundIds.length === 0) return [];
  const fids = fundIds.map(id => String(id));
  const fundList = fids.map(id => funds.find(f => String(f.id) === id)).filter(Boolean);

  // 找共同日期交集
  const dateSets = fundList.map(f => {
    return new Set((f.navHistory || []).map(n => n.date).sort());
  });
  if (dateSets.length === 0) return [];

  let commonDates = [...dateSets[0]];
  for (let i = 1; i < dateSets.length; i++) {
    commonDates = commonDates.filter(d => dateSets[i].has(d));
  }
  commonDates.sort();

  if (commonDates.length < 2) return [];

  // 构建每只基金的 navMap（用 cumNav）
  const navMaps = {};
  fundList.forEach(f => {
    navMaps[f.id] = {};
    (f.navHistory || []).forEach(n => {
      navMaps[f.id][n.date] = Number(n.cumNav != null ? n.cumNav : n.nav);
    });
  });

  // 在共同日期上计算归一化净值
  const baseDates = {};
  fundList.forEach(f => {
    const d0 = commonDates[0];
    baseDates[f.id] = navMaps[f.id][d0];
  });

  const result = [];
  for (const d of commonDates) {
    let sum = 0;
    for (const f of fundList) {
      const base = baseDates[f.id];
      const nav = navMaps[f.id][d];
      if (base > 0 && nav !== undefined) sum += nav / base;
    }
    result.push({ date: d, nav: sum / fundList.length });
  }
  return result;
}

// 计算组合的夏普比率（简化版，无风险利率用0）
function calcPortfolioSharpe(fundIds) {
  const navSeries = calcPortfolioNAV(fundIds);
  if (navSeries.length < 5) return null;
  const rets = [];
  for (let i = 1; i < navSeries.length; i++) {
    const prev = navSeries[i - 1].nav;
    const curr = navSeries[i].nav;
    if (prev > 0) rets.push((curr - prev) / prev);
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const std = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1));
  if (std === 0) return null;
  const sharpe = mean / std * Math.sqrt(252); // 年化
  const totalReturn = (navSeries[navSeries.length - 1].nav - 1) * 100;
  const maxDD = calcMaxDrawdown(navSeries.map(p => p.nav));
  return { sharpe, totalReturn, maxDD, rets };
}

function calcMaxDrawdown(navSeries) {
  let peak = navSeries[0];
  let maxDD = 0;
  for (const v of navSeries) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function renderContribution() {
  const btn = document.getElementById('contrib-analyze-btn');
  if (!btn) return;

  btn.onclick = () => {
    const heldIds = [...contribHeld];
    if (heldIds.length < 2) {
      alert('请至少选择2只持仓基金作为组合基准');
      return;
    }
    if (!contribCandidate) {
      alert('请选择1只候选基金');
      return;
    }

    const heldIdsStr = heldIds.map(id => String(id));
    const candId = String(contribCandidate);

    // 1. 相关性变化
    const avgCorrBefore = calcAvgCorrelation(heldIdsStr);
    const avgCorrAfter = calcAvgCorrelation([...heldIdsStr, candId]);

    // 2. 绩效变化
    const perfBefore = calcPortfolioSharpe(heldIdsStr);
    const perfAfter = calcPortfolioSharpe([...heldIdsStr, candId]);

    // 3. 候选基金独立绩效
    const perfCandidate = calcPortfolioSharpe([candId]);

    // 渲染结果
    document.getElementById('contrib-result').style.display = '';
    document.getElementById('contrib-placeholder').style.display = 'none';

    // Summary cards
    const corrChange = avgCorrAfter - avgCorrBefore;
    const corrColor = corrChange < -0.05 ? 'var(--green)' : corrChange > 0.05 ? 'var(--red)' : 'var(--text2)';
    const corrArrow = corrChange < -0.05 ? '↓ 分散化' : corrChange > 0.05 ? '↑ 集中度增加' : '→ 基本不变';

    const sharpeChange = perfAfter && perfBefore ? perfAfter.sharpe - perfBefore.sharpe : null;
    const sharpeColor = sharpeChange > 0.1 ? 'var(--green)' : sharpeChange < -0.1 ? 'var(--red)' : 'var(--text2)';

    document.getElementById('contrib-summary').innerHTML = `
      <div class="card" style="text-align:center;padding:14px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">加入前平均相关</div>
        <div style="font-size:18px;font-weight:700;color:var(--text1);">${avgCorrBefore !== null ? avgCorrBefore.toFixed(3) : '—'}</div>
      </div>
      <div class="card" style="text-align:center;padding:14px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">加入后平均相关</div>
        <div style="font-size:18px;font-weight:700;color:var(--text1);">${avgCorrAfter !== null ? avgCorrAfter.toFixed(3) : '—'}</div>
      </div>
      <div class="card" style="text-align:center;padding:14px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">相关性变化</div>
        <div style="font-size:18px;font-weight:700;color:${corrColor};">${corrArrow} ${corrChange >= 0 ? '+' : ''}${corrChange.toFixed(3)}</div>
      </div>
      <div class="card" style="text-align:center;padding:14px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">夏普变化</div>
        <div style="font-size:18px;font-weight:700;color:${sharpeColor};">${sharpeChange !== null ? (sharpeChange >= 0 ? '+' : '') + sharpeChange.toFixed(3) : '—'}</div>
      </div>
    `;

    // 相关性详情
    const candFund = funds.find(f => String(f.id) === candId);
    let corrDetail = `<div style="margin-bottom:8px;font-weight:600;color:var(--text2);">候选基金「${candFund?.name || candId}」与各持仓基金的相关性：</div>`;
    heldIdsStr.forEach(hid => {
      const hf = funds.find(f => String(f.id) === hid);
      const result = calcCorrelationMatrix(new Set([hid, candId]));
      if (result) {
        const v = result.corr[hid][candId];
        const disp = v !== null ? v.toFixed(3) : '—';
        const c = v !== null ? (v > 0 ? 'var(--red)' : 'var(--green)') : 'var(--text3)';
        corrDetail += `<div>📌 ${hf?.name || hid}：<b style="color:${c};">${disp}</b>${v !== null ? (Math.abs(v) > 0.7 ? ' <span style="color:var(--orange);font-size:11px;">⚠️ 高相关</span>' : '') : ''}</div>`;
      }
    });
    corrDetail += `<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);">💡 相关性越低，分散化效果越好。建议候选基金与持仓平均相关 < 0.5。</div>`;
    document.getElementById('contrib-corr-detail').innerHTML = corrDetail;

    // 绩效详情
    let perfDetail = '';
    if (perfBefore && perfAfter && perfCandidate) {
      const candName = candFund?.name || candId;
      perfDetail = `
        <table style="width:100%;font-size:12px;border-collapse:collapse;">
          <tr style="color:var(--text3);font-size:11px;">
            <th style="text-align:left;padding:4px 8px;">指标</th>
            <th style="text-align:center;padding:4px 8px;">原组合</th>
            <th style="text-align:center;padding:4px 8px;">+ ${candName}</th>
            <th style="text-align:center;padding:4px 8px;">${candName} 独立</th>
          </tr>
          <tr>
            <td style="padding:4px 8px;color:var(--text2);">夏普比率</td>
            <td style="text-align:center;padding:4px 8px;font-weight:600;">${perfBefore.sharpe.toFixed(3)}</td>
            <td style="text-align:center;padding:4px 8px;font-weight:700;color:${perfAfter.sharpe > perfBefore.sharpe ? 'var(--green)' : 'var(--red)'};">${perfAfter.sharpe.toFixed(3)}</td>
            <td style="text-align:center;padding:4px 8px;color:var(--text3);">${perfCandidate.sharpe.toFixed(3)}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;color:var(--text2);">总回报</td>
            <td style="text-align:center;padding:4px 8px;">${perfBefore.totalReturn.toFixed(1)}%</td>
            <td style="text-align:center;padding:4px 8px;">${perfAfter.totalReturn.toFixed(1)}%</td>
            <td style="text-align:center;padding:4px 8px;color:var(--text3);">${perfCandidate.totalReturn.toFixed(1)}%</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;color:var(--text2);">最大回撤</td>
            <td style="text-align:center;padding:4px 8px;color:var(--red);">${(perfBefore.maxDD * 100).toFixed(1)}%</td>
            <td style="text-align:center;padding:4px 8px;color:var(--red);">${(perfAfter.maxDD * 100).toFixed(1)}%</td>
            <td style="text-align:center;padding:4px 8px;color:var(--text3);">${(perfCandidate.maxDD * 100).toFixed(1)}%</td>
          </tr>
        </table>
        <div style="margin-top:10px;padding:8px;background:var(--bg2);border-radius:6px;font-size:11px;color:var(--text3);line-height:1.6;">
          💡 解读：夏普比率上升 = 风险调整后收益改善；最大回撤下降 = 组合更稳健。
          ${perfAfter.sharpe > perfBefore.sharpe ? '✅ 加入后夏普上升，建议纳入组合。' : '⚠️ 加入后夏普下降，需谨慎评估。'}
        </div>
      `;
    } else {
      perfDetail = '<div style="color:var(--text3);font-size:12px;">数据不足，无法计算绩效指标。</div>';
    }
    document.getElementById('contrib-perf-detail').innerHTML = perfDetail;

    // 图表：原组合 vs 新组合 归一化对比
    const navBefore = calcPortfolioNAV(heldIdsStr);
    const navAfter = calcPortfolioNAV([...heldIdsStr, candId]);

    const ctx = document.getElementById('contrib-chart').getContext('2d');
    if (contribChart) contribChart.destroy();

    const labels = navAfter.map(p => p.date);
    const dataBefore = navAfter.map(p => {
      const item = navBefore.find(b => b.date === p.date);
      return item ? item.nav : null;
    });

    contribChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '原组合',
            data: dataBefore,
            borderColor: 'var(--accent)',
            backgroundColor: 'rgba(59,130,246,0.08)',
            fill: true,
            tension: 0.3,
            pointRadius: 0
          },
          {
            label: '加入后组合',
            data: navAfter.map(p => p.nav),
            borderColor: 'var(--red)',
            backgroundColor: 'rgba(239,68,68,0.08)',
            fill: true,
            tension: 0.3,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }
        },
        scales: {
          x: { ticks: { maxTicksLimit: 8, font: { size: 10 } } },
          y: { ticks: { font: { size: 10 } } }
        }
      }
    });
  };
}
