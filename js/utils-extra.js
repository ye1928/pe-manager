// ============================================================
// UTILS
// ============================================================
function updateStorageSize() {
  let total = 0;
  for (let k in localStorage) {
    if (localStorage.hasOwnProperty(k)) {
      total += (localStorage.getItem(k) || '').length;
    }
  }
  const kb = (total / 1024).toFixed(1);
  const el = document.getElementById('storage-size');
  if (el) el.textContent = kb + 'KB';
}

function updateDate() {
  const now = new Date();
  const el = document.getElementById('today-date');
  if (el) {
    el.textContent = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  }
}

// ============================================================
// ARTICLE AI ANALYSIS ENGINE（前端金融NLP）
// ============================================================

const AI_ENGINE = {

  // ─── 金融词典：主题 → 关键词 ───
  TOPIC_KEYWORDS: {
    '宏观经济': ['GDP','CPI','PPI','通胀','通缩','利率','货币政策','财政政策','美联储','央行','降息','加息','流动性','经济复苏','经济下行','就业','PMI','库存周期'],
    '政策监管': ['政策','监管','改革','刺激','补贴','双碳','碳中和','国产替代','扶持','减税','降准','降息','专项债','地方债'],
    '基金': ['私募','基金','净值','回撤','夏普','阿尔法','贝塔','对冲','量化','主观多头','CTA','套利','策略','管理人','年化'],
    'A股行情': ['大盘','指数','涨停','跌停','A股','沪深','创业板','科创板','北交所','主力','北向资金','南下资金','融资','融券','换手率','放量','缩量'],
    '港股美股': ['港股','美股','恒生','纳斯达克','道琼斯','标普','外资','QFII','互联互通'],
    '半导体芯片': ['半导体','芯片','晶圆','代工','设计','封装','EDA','光刻机','存储','DRAM','NAND','英伟达','台积电','华为','海光'],
    '新能源': ['新能源','光伏','风电','储能','锂电','电池','氢能','充电桩','特斯拉','比亚迪','宁德时代','隆基'],
    '人工智能': ['AI','人工智能','大模型','ChatGPT','GPT','深度学习','算力','算法','GPU','数字经济','自动驾驶'],
    '消费医药': ['消费','医药','医疗','白酒','食品','茅台','创新药','CXO','集采','器械'],
    '金融地产': ['地产','房地产','银行','保险','券商','利差','城投','REITs','债务','违约','暴雷'],
    '大宗商品': ['原油','黄金','铜','铁矿石','煤炭','农产品','大宗商品','期货','商品期货'],
    '技术分析': ['支撑位','压力位','突破','趋势','均线','金叉','死叉','量能','箱体','头肩顶','底部','顶部','波段'],
    '基本面': ['业绩','财报','营收','利润','ROE','PE','PB','估值','分红','现金流','毛利率','净利率'],
  },

  // ─── 情感词典 ───
  POSITIVE_WORDS: [
    '看多','看好','乐观','买入','增持','强烈推荐','超预期','上涨','突破','创新高',
    '大幅增长','利好','机会','拐点','复苏','反弹','回升','好于预期','超额收益',
    '盈利','高增速','强劲','优质','低估','配置机会','底部确认','右侧布局',
  ],
  NEGATIVE_WORDS: [
    '看空','看淡','悲观','卖出','减持','规避','风险','下跌','破位','跌破',
    '利空','亏损','违约','暴雷','危机','回调','下行','低于预期','承压','恶化',
    '泡沫','高估','估值偏高','谨慎','不确定性','黑天鹅','流动性危机','信用风险',
  ],

  // ─── 行情高关联词（命中越多关联度越高）───
  HIGH_RELEVANCE_WORDS: [
    '建议买入','建议减持','目标价','强烈推荐','重点关注','重仓','核心资产',
    '超配','低配','调整仓位','止损','止盈','布局','右侧','左侧',
    '关注下方支撑','突破关键位','量能放大','主力资金',
  ],

  /**
   * 主分析函数
   * @param {string} text  原始文章文本
   * @returns {{ summary, tags, sentiment, relevance, details }}
   */
  analyze(text) {
    if (!text || text.trim().length < 10) return null;

    const clean = text.replace(/\s+/g, ' ').trim();

    // 1. 摘要：取前3个完整句子（以句号/！/？结尾）
    const sentences = clean.split(/[。！？!?]/).map(s => s.trim()).filter(s => s.length > 10);
    const summaryParts = sentences.slice(0, 3);
    let summary = summaryParts.join('。');
    if (summary.length > 200) summary = summary.substring(0, 200) + '……';
    if (!summary && clean.length > 0) summary = clean.substring(0, 150) + '……';

    // 2. 标签：按主题词典匹配
    const hitTopics = {};
    for (const [topic, keywords] of Object.entries(this.TOPIC_KEYWORDS)) {
      let hits = 0;
      keywords.forEach(kw => {
        const count = (clean.match(new RegExp(kw, 'g')) || []).length;
        hits += count;
      });
      if (hits > 0) hitTopics[topic] = hits;
    }
    // 取命中最多的 TOP 5 话题作为标签
    const tags = Object.entries(hitTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    // 3. 情感分析
    let posScore = 0, negScore = 0;
    this.POSITIVE_WORDS.forEach(w => { if (clean.includes(w)) posScore++; });
    this.NEGATIVE_WORDS.forEach(w => { if (clean.includes(w)) negScore++; });
    let sentiment = 0;
    if (posScore > negScore + 1) sentiment = 1;
    else if (negScore > posScore + 1) sentiment = -1;

    // 4. 行情关联度（1-5）
    let relevanceScore = 0;
    const totalTopicHits = Object.values(hitTopics).reduce((a, b) => a + b, 0);
    relevanceScore += Math.min(2, Math.floor(totalTopicHits / 5));  // 词频越高关联度越高
    this.HIGH_RELEVANCE_WORDS.forEach(w => { if (clean.includes(w)) relevanceScore++; });
    if (hitTopics['A股行情'] || hitTopics['技术分析']) relevanceScore++;
    if (hitTopics['基金']) relevanceScore++;
    const relevance = Math.min(5, Math.max(1, relevanceScore));

    return {
      summary,
      tags,
      sentiment,
      relevance,
      details: {
        posScore,
        negScore,
        totalTopicHits,
        hitTopics,
      }
    };
  }
};

// AI 分析并填充表单
function runAiAnalysis() {
  const text = document.getElementById('article-rawtext').value.trim();
  const statusEl = document.getElementById('ai-analyze-status');
  const previewEl = document.getElementById('ai-result-preview');

  if (!text || text.length < 20) {
    statusEl.textContent = '⚠️ 请先粘贴文章内容（至少20个字）';
    statusEl.style.color = 'var(--yellow)';
    return;
  }

  statusEl.textContent = '⏳ 分析中...';
  statusEl.style.color = 'var(--text3)';

  // 用 setTimeout 模拟异步，避免界面卡顿
  setTimeout(() => {
    const result = AI_ENGINE.analyze(text);
    if (!result) {
      statusEl.textContent = '❌ 分析失败，请检查输入内容';
      return;
    }

    // 自动填充表单字段
    document.getElementById('article-summary').value = result.summary;
    document.getElementById('article-sentiment').value = result.sentiment;
    document.getElementById('article-relevance').value = result.relevance;
    document.getElementById('article-tags').value = result.tags.join(', ');

    // 情感标签文字
    const sentimentLabel = { '-1': '🔴 负面', '0': '⚪ 中性', '1': '🟢 正面' }[result.sentiment + ''];
    const relevanceStars = '⭐'.repeat(result.relevance);

    // 显示分析结果预览
    const topicsHtml = Object.entries(result.details.hitTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([topic, cnt]) =>
        `<span class="tag tag-blue" style="margin:2px;">${topic}<span style="opacity:0.6;margin-left:3px;">${cnt}</span></span>`
      ).join('');

    previewEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <span style="font-weight:600;color:var(--green);">✅ AI分析完成，已自动填入表单</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div><span style="color:var(--text3);">情感倾向：</span>${sentimentLabel}</div>
        <div><span style="color:var(--text3);">行情关联：</span>${relevanceStars}（${result.relevance}/5）</div>
        <div><span style="color:var(--text3);">正面信号：</span><span style="color:var(--red);">+${result.details.posScore}</span></div>
        <div><span style="color:var(--text3);">负面信号：</span><span style="color:var(--green);">-${result.details.negScore}</span></div>
      </div>
      <div style="margin-bottom:6px;"><span style="color:var(--text3);">识别主题：</span>${topicsHtml || '<span style="color:var(--text3);">无明显主题</span>'}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:8px;">💡 以上结果已填入下方表单，可以手动修改后保存</div>
    `;
    previewEl.style.display = 'block';
    statusEl.textContent = '✅ 分析完成';
    statusEl.style.color = 'var(--green)';
    // 步骤推进到第3步
    updateStepIndicator(3);
  }, 300);
}

// 折叠/展开 AI 分析区
function toggleAiZone() {
  const body = document.getElementById('ai-zone-body');
  const btn = document.getElementById('btn-toggle-ai-zone');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    btn.textContent = '收起';
  } else {
    body.style.display = 'none';
    btn.textContent = '展开';
  }
}

// ─── URL 智能识别 ───
// 从微信公众号链接中尝试提取公众号名称和日期（基于URL参数规律）
function parseArticleUrl() {
  const urlInput = document.getElementById('article-url-quick');
  const hintEl = document.getElementById('url-parse-hint');
  const url = urlInput.value.trim();

  if (!url) { hintEl.style.display = 'none'; return; }

  // 填入链接字段
  document.getElementById('article-url').value = url;

  // 识别微信公众号
  if (url.includes('mp.weixin.qq.com') || url.includes('weixin.qq.com')) {
    // 尝试从URL参数提取时间戳
    let detectedDate = '';
    const tsMatch = url.match(/[?&]__biz=([^&]+)/);
    // 微信文章 publish_time 或 sn 参数（无法直接解析日期，提示用户手动确认）
    detectedDate = new Date().toISOString().slice(0, 10); // 默认今天

    // 设置公众号名称提示
    hintEl.innerHTML = `✅ 已识别为<strong>微信公众号文章</strong>，链接已填入。请：<br>
      1. 填写公众号名称（如：雪球、格隆汇等）<br>
      2. 把文章正文粘贴到下方文本框，点击「✨ 一键AI分析」自动生成摘要`;
    hintEl.style.display = 'block';
    hintEl.style.color = 'var(--accent2)';

    // 自动设置日期为今天（用户手动改）
    document.getElementById('article-date').value = detectedDate;

    // 滚动到公众号名称输入框，提示用户填写
    setTimeout(() => {
      const srcInput = document.getElementById('article-source');
      srcInput.focus();
      srcInput.style.borderColor = 'var(--accent)';
      setTimeout(() => srcInput.style.borderColor = '', 2000);
    }, 200);

  } else if (url.startsWith('http')) {
    // 尝试从URL提取域名作为来源提示
    let domain = '';
    try { domain = new URL(url).hostname.replace('www.', ''); } catch(e) {}
    hintEl.innerHTML = `✅ 链接已填入。来源域名：${domain}`;
    hintEl.style.display = 'block';
    hintEl.style.color = 'var(--text3)';
    document.getElementById('article-date').value = new Date().toISOString().slice(0, 10);
  } else {
    hintEl.innerHTML = '⚠️ 请输入完整的 https:// 开头的链接';
    hintEl.style.display = 'block';
    hintEl.style.color = 'var(--yellow)';
  }
}

// 步骤指示器更新
function updateStepIndicator(step) {
  [1, 2, 3].forEach(i => {
    const el = document.getElementById('step-indicator-' + i);
    if (!el) return;
    if (i < step) {
      el.style.color = 'var(--green)';
      el.style.background = 'rgba(16,185,129,0.1)';
      el.style.borderColor = 'rgba(16,185,129,0.3)';
      el.querySelector('span').style.background = 'var(--green)';
    } else if (i === step) {
      el.style.color = 'var(--accent)';
      el.style.background = 'rgba(59,130,246,0.1)';
      el.style.borderColor = 'rgba(59,130,246,0.3)';
      el.querySelector('span').style.background = 'var(--accent)';
    } else {
      el.style.color = 'var(--text3)';
      el.style.background = 'var(--bg3)';
      el.style.borderColor = 'var(--border)';
      el.querySelector('span').style.background = 'var(--text3)';
    }
  });
}

