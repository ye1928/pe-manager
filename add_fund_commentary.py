#!/usr/bin/env python3
"""
为基金详情面板添加自动评价说明功能
- 新增 generateFundCommentary(fund) 函数
- 在 renderFundDetailBody 中插入评语区块
- 添加"查看完整分析"按钮跳转到归因分析页
"""

import re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def patch_1_add_generateCommentary(html):
    """
    在 calcPerformance 函数结束后的下一行（约6012行之后）
    插入 generateFundCommentary 函数
    """
    # 在 return { ... } 结束后的下一行插入新函数
    # calcPerformance 的 return 语句在 5988-6011 行，函数结束在 6012 行
    # 在 "} // calcPerformance" 或 "}" (函数结束) 之后插入
    
    marker = '// 无风险利率改变时保存并刷新'
    
    func_code = '''
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
  // 切换页面
  switchPage('attribution');
  // 渲染净值拟合
  if (typeof renderNavFit === 'function') renderNavFit();
}
'''

    marker_idx = html.find(marker)
    if marker_idx == -1:
        print("ERROR: 找不到插入点 marker")
        return html
    
    # 在 marker 之前插入（即 calcPerformance 结束后）
    new_html = html[:marker_idx] + func_code + '\n\n' + html[marker_idx:]
    print(f"  ✅ 在 '{marker}' 之前插入了 generateFundCommentary 函数")
    return new_html


def patch_2_add_commentary_to_detail(html):
    """
    在 renderFundDetailBody 函数中，
    在绩效分析区块（perfHtml）之后、净值走势（navSummaryHtml）之前
    插入基金评价说明区块
    """
    # 找到 perfHtml 结束后的 navSummaryHtml 定义
    # 在 `let navSummary =` 之前插入评语 HTML
    
    target = "  // 净值历史摘要\n  const navSummary = (fund.navHistory || []).slice().sort"
    
    commentary_code = '''  // 基金评价说明（自动生成）
  let commentaryHtml = '';
  const commentary = generateFundCommentary(fund);
  if (commentary) {
    commentaryHtml = commentary;
  }

'''
    
    if target in html:
        html = html.replace(target, commentary_code + target, 1)
        print("  ✅ 在净值历史摘要前插入了评价说明区块")
        return html
    else:
        print("ERROR: 找不到目标位置 '净值历史摘要'")
        return html


def patch_3_add_commentary_css(html):
    """
    在 <style> 标签内添加 .commentary-box 样式
    """
    css = '''
    /* ========== 基金评价说明 ========== */
    .commentary-box {
      background: linear-gradient(135deg, #f0f9ff 0%, #f0fdf4 100%);
      border: 1px solid #e0f2fe;
      border-radius: 12px;
      padding: 16px 20px;
      margin: 16px 0;
      line-height: 1.8;
      font-size: 13px;
      color: var(--text);
    }
    .commentary-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 8px;
      color: var(--accent);
    }
    .commentary-body {
      text-indent: 0;
    }
    .commentary-body span {
      font-weight: 700;
    }
'''
    
    # 在 </style> 前插入
    marker = '</style>'
    if marker in html:
        html = html.replace(marker, css + '\n' + marker, 1)
        print("  ✅ 添加了 .commentary-box CSS 样式")
        return html
    else:
        print("ERROR: 找不到 </style>")
        return html


def patch_4_fix_openFullAnalysis(html):
    """
    确保 openFullAnalysis 正确渲染 navfit 的基金选择器
    renderNavFit 内部会读取 selectedNavFitFunds 并更新 UI
    """
    # 这个函数已经在 patch_1 中定义了，不需要额外修改
    # 但需要确保 renderNavFit 存在且正确
    print("  ℹ️  openFullAnalysis 已在 patch_1 中定义")
    return html


def main():
    path = r'c:/Users/52706/WorkBuddy/20260425195840/investment-manager.html'
    
    print("=" * 60)
    print("开始添加基金评价说明功能")
    print("=" * 60)
    
    html = read_file(path)
    print(f"原始文件大小: {len(html)} 字符")
    
    # Patch 1: 添加 generateFundCommentary 函数
    print("\n[1/4] 添加 generateFundCommentary 函数...")
    html = patch_1_add_generateCommentary(html)
    
    # Patch 2: 在详情面板插入评语区块
    print("\n[2/4] 在基金详情面板插入评语区块...")
    html = patch_2_add_commentary_to_detail(html)
    
    # Patch 3: 添加 CSS 样式
    print("\n[3/4] 添加 CSS 样式...")
    html = patch_3_add_commentary_css(html)
    
    # Patch 4: 验证 openFullAnalysis
    print("\n[4/4] 验证 openFullAnalysis...")
    html = patch_4_fix_openFullAnalysis(html)
    
    # 写入文件
    write_file(path, html)
    print(f"\n✅ 完成！新文件大小: {len(html)} 字符")
    
    # 验证关键函数存在
    print("\n" + "=" * 60)
    print("验证结果：")
    checks = [
        ('generateFundCommentary', 'function generateFundCommentary'),
        ('openFullAnalysis', 'function openFullAnalysis'),
        ('commentary-box CSS', '.commentary-box {'),
        ('评语插入点', 'commentaryHtml = generateFundCommentary'),
    ]
    for name, pattern in checks:
        found = pattern in html
        print(f"  {'✅' if found else '❌'} {name}: {'存在' if found else '未找到'}")
    
    print("=" * 60)


if __name__ == '__main__':
    main()
