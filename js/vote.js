// ============================================================
// VOTE ADVISOR — 大师投票席
// ============================================================

// 虚拟大师配置：每个大师有独特风格、关键词偏好、评分倾向
const INVESTORS = [
  {
    id: 'buffett',
    name: '沃伦·巴菲特',
    avatar: '👴',
    avatarBg: 'linear-gradient(135deg,#b91c1c,#7f1d1d)',
    style: '价值投资 · 护城河理论',
    // 决策框架：能力圈 → 内在价值 → 护城河 → 安全边际
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 能力圈判断 ──
      // 巴菲特明确说过不懂石油/大宗商品期货
      const outOfCircle = /原油|石油|期货|futures|大宗商品|commodit/i.test(text);
      if (outOfCircle && /能源|石油|原油|商品期货/i.test(text)) score -= 2;

      // ── 价值特征加分 ──
      const hasMoat = /护城河|垄断|龙头|定价权|品牌|网络效应|转换成本/i.test(text);
      const hasCashFlow = /现金流|分红|股息|永续|稳健|ROE\s*[>≥]/i.test(text);
      const hasValuation = /PE\s*[<≤]|PB\s*[<≤]|低估值|市盈率\s*[<≤]|市净率\s*[<≤]/i.test(text);

      if (hasMoat) score += 1.5;
      if (hasCashFlow) score += 1;
      if (hasValuation) score += 1;

      // ── 价值陷阱风险扣分 ──
      const isSpeculative = /战争|地缘|题材|概念|热点|情绪|庄家|游资|追涨/i.test(text);
      const isHighLeverage = /高杠杆|杠杆|futures|期货|保证金/i.test(text);
      const isShortTerm = horizon === 'short' || /短线|日内|追涨|杀跌/i.test(text);

      if (isSpeculative) score -= 1.5;
      if (isHighLeverage) score -= 1;
      if (isShortTerm) score -= 1.5;

      // ── 时间周期偏好 ──
      if (horizon === 'long') score += 0.5;

      // ── 绝对禁区 ──
      if (type === 'stock_short') score -= 2; // 巴菲特不做空
      if (/做空|short.*sell|put.*option/i.test(text)) score -= 2;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '强烈看多 · 符合价值投资框架';
      if (score >= 6) return '谨慎关注 · 需验证内在价值';
      if (score >= 4) return '超出能力圈 · 需极度谨慎';
      return '不符合投资原则 · 不参与';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const isCommodity = /原油|石油|期货|大宗商品|能源/i.test(text);
      const hasMoat = /护城河|垄断|品牌|定价权/i.test(text);
      const isSpeculative = /战争|地缘|题材|情绪/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isShort = type === 'stock_short' || type === 'futures_short';

      if (isCommodity) {
        return '巴菲特多次表示不投资自己不懂的大宗商品期货。"我不擅长预测石油价格，这不是我的能力圈。"如果标的能转化为有护城河的商业模式（如能源龙头公司股权），则是另一回事。' + (isFutures ? '\n\n期货合约没有永续现金流，只有到期日和移仓成本——这与巴菲特"买企业股权"的核心逻辑背道而驰。' : '');
      }
      if (isSpeculative && score < 6) {
        return '你描述的是事件驱动的投机逻辑，而非企业内在价值。巴菲特不会基于战争或地缘政治下注。他会问：10年后这家公司的现金流会是什么样子？' + (horizon === 'short' ? '\n\n短线视角下，巴菲特会特别警惕：短期事件驱动往往不可预测，"追涨杀跌"是他最反对的行为之一。' : '');
      }
      if (hasMoat && score >= 6) {
        return '该标的具备持久竞争优势特征。但我需要你能回答：能持续多少年？竞争对手复制它的难度有多大？管理层是否诚信、有能力？' + (horizon === 'short' ? '\n\n但短线视角下，巴菲特的护城河逻辑失效——短期股价由情绪和资金驱动，与护城河无关。' : '');
      }
      if (isShort) {
        return '巴菲特的信条是"做空有无限损失风险"。他不会做空——如果你相信某公司会倒闭，你需要的不只是做空，而是对做空的理由有极致的把握。';
      }
      return '核心问题：你能用一句话描述这家公司的商业模式吗？它的竞争对手为什么不能抢走它的客户？' + (horizon === 'long' ? '巴菲特要求这个答案能经受10年考验。' : horizon === 'short' ? '短线投资者不关心这个问题——但这恰恰是长期超额收益的来源。' : '') + '如果回答不了，巴菲特会说"看不懂就不投"。';
    }
  },
  {
    id: 'munger',
    name: '查理·芒格',
    avatar: '🧓',
    avatarBg: 'linear-gradient(135deg,#b45309,#92400e)',
    style: '逆向思维 · 多学科思维模型',
    // 决策框架：反过来想 → 多元思维模型 → 心理学偏见检测 → 耐心等待
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 逆向思维加分 ──
      const isContrarian = /别人恐惧|逆向|低估|冷门|无人问津|分歧/i.test(text);
      const mentionsWorst = /最坏|最差|极端|最悲观|最坏情况/i.test(text);
      if (isContrarian) score += 2;
      if (mentionsWorst) score += 1.5; // 芒格最爱问最坏情况

      // ── 多元思维模型检测 ──
      const hasLollapalooza = [
        /心理学|认知|偏差|行为|过度自信/i.test(text),   // 心理学模型
        /经济学|供需|边际|激励/i.test(text),            // 经济学模型
        /物理学|均衡|对称|临界/i.test(text),            // 物理学模型
        /历史|周期|重复|规律/i.test(text),              // 历史模型
      ].filter(Boolean).length;
      score += hasLollapalooza * 0.5; // 每个额外维度+0.5

      // ── 常见偏见扣分 ──
      const recencyBias = /最近|刚|刚刚|当前|近期/i.test(text) && /一定|肯定|必然/i.test(text);
      const authorityBias = /专家说|券商|研报|名人|大V/i.test(text) && !/验证|核实|批判/i.test(text);
      const groupthink = /大家都在|热门|赛道|都在买/i.test(text);

      if (recencyBias) score -= 1.5;
      if (authorityBias) score -= 1;
      if (groupthink) score -= 1;

      // ── 能力圈边界 ──
      const complexFinancial = /复杂期权|结构化|嵌套|高杠杆/i.test(text);
      if (complexFinancial) score -= 1;

      // ── 芒格耐心等待特质 ──
      if (/等待|耐心|不急|慢慢来|长期跟踪/i.test(text)) score += 1;

      if (type === 'stock_short') score -= 1;
      if (horizon === 'short') score -= 0.5;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '逆向+多模型 · 值得深入研究';
      if (score >= 6) return '有逻辑 · 需反向验证';
      if (score >= 4) return '需倒过来想 · 谨慎行事';
      return '存在明显认知偏见 · 不建议';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const isContrarian = /别人恐惧|逆向|低估|分歧/i.test(text);
      const mentionsWorst = /最坏|最差|极端|最悲观/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isShort = type === 'stock_short' || type === 'futures_short';
      const isMacro = type === 'macro';

      if (score >= 7) {
        if (isContrarian && mentionsWorst) {
          let reason = '这符合芒格的"逆向思维"：先问"这件事最坏能坏到什么程度？反过来成立的条件是什么？"加上你提到了多个思维维度，这正是芒格所倡导的lollapalooza效应。\n\n';
          if (isFutures) {
            reason += '在期货场景下，芒格会特别追问：这个头寸的最坏情形（价格归零/暴涨）是否有流动性保障？期货展期的成本是否在计算之内？';
          } else if (isShort) {
            reason += '芒格对做空极为谨慎：你是否计算了做空的最大损失（理论上无限）？有没有一个硬性的止损价格？';
          } else if (isMacro) {
            reason += '芒格会结合达里奥的经济机器框架：在衰退/危机情形下，这个宏观头寸的尾部风险有多大？';
          } else {
            reason += '建议用清单思维再过一遍所有可能出错的环节。';
          }
          return reason;
        }
        let reason = '芒格会认可这个逻辑。';
        if (horizon === 'short') {
          reason += '\n\n但短期视角下，他一定会追问：你是否在利用了别人的短期错误认知？这个错误能被快速证伪吗？持有时间越长，越需要基本面支撑。';
        } else if (horizon === 'long') {
          reason += '\n\n长线视角下，他追问的是：10年后这个逻辑还成立吗？是否有被颠覆的可能性（技术变革、监管政策）？';
        } else {
          reason += '\n\n他一定会追问：你是否在利用了别人的错误认知？错误的代价有多大？这个机会的持久性如何？';
        }
        return reason;
      }

      let reason = '按照芒格的方法论，先倒过来想："这个' + (isFutures ? '期货头寸' : isShort ? '做空交易' : '投资') + '最可能失败的10个原因是什么？"\n';
      if (horizon === 'short') {
        reason += '\n短线芒格关注：你是否因为"最近赚钱了"而产生了近因偏差？情绪化决策的可能性有多大？';
      } else {
        reason += '\n芒格曾说"告诉我我会死在哪里，我就不去那里"——这个逻辑能通过这个检验吗？';
      }
      return reason;
    }
  },
  {
    id: 'soros',
    name: '乔治·索罗斯',
    avatar: '🦊',
    avatarBg: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)',
    style: '反身性理论 · 宏观对冲',
    // 决策框架：反身性分析 → 认知偏差 → 趋势强化 → 临界点识别
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 反身性三要素检测 ──
      const hasTrend = /趋势|方向|预期|走势|方向性|上涨|下跌|升值|贬值/i.test(text);
      const hasBias = /市场预期|价格已反映|低估了|高估了|price.in|price is|预期差/i.test(text);
      const hasFeedback = /自我强化|正反馈|负反馈|循环|联动|传导|加剧/i.test(text);

      const reflexivityCount = [hasTrend, hasBias, hasFeedback].filter(Boolean).length;
      score += reflexivityCount * 1.5; // 反身性三要素齐备=满分

      // ── 宏观事件驱动 ──
      const macroEvents = /战争|制裁|政策|利率|汇率|央行|美联储|经济数据|GDP|CPI/i.test(text);
      if (macroEvents) score += 1.5;

      // ── 拐点识别 ──
      const hasPivot = /拐点|转折|临界|突破|崩溃|反转|失衡/i.test(text);
      if (hasPivot) score += 1;

      // ── 静态估值派扣分（与索罗斯相反） ──
      const isStaticAnalysis = /低估值|PE|PB|净资产|DCF|现金流折现/i.test(text) &&
                                !/动态|随|变化|调整/i.test(text);
      if (isStaticAnalysis) score -= 1;

      // ── 时间周期 ──
      if (type === 'macro') score += 1.5;
      if (type === 'arbitrage') score += 1;
      if (horizon === 'long') score -= 0.5; // 索罗斯更关注中期拐点

      // ── 持仓方向 ──
      // 索罗斯做期货/外汇/大宗商品比做股票更出名（1992年做空英镑）
      if (type === 'futures_long' || type === 'futures_short') score += 1;
      if (type === 'stock_long') score += 0.5;
      // ── 做空需要更严格的反身性条件 ──
      if (type === 'stock_short' || type === 'futures_short') {
        // 做空要求更明确的拐点信号
        const hasPivot = /拐点|转折|临界|崩溃|反转|失衡|窟窿|债务危机/i.test(text);
        if (!hasPivot) score -= 1;
      }

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '完美宏观机会 · 反身性逻辑清晰';
      if (score >= 6) return '存在预期差 · 值得检验';
      if (score >= 4) return '缺少反身性条件 · 观望';
      return '静态分析 · 不适合此框架';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const hasTrend = /趋势|预期|方向|上涨|下跌|升值|贬值/i.test(text);
      const hasBias = /低估|高估|price.in|已反映|错误定价|市场预期/i.test(text);
      const hasFeedback = /自我强化|正反馈|循环|联动|传导|加剧/i.test(text);
      const hasPivot = /拐点|转折|临界|突破|崩溃|反转/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isMacro = type === 'macro';
      const isStock = type === 'stock_long' || type === 'stock_short';

      const isFuturesShort = type === 'futures_short';
      const isFuturesLong = type === 'futures_long';
      if (score >= 7) {
        // 期货/宏观专属逻辑
        if (isFutures) {
          let reason = '索罗斯是宏观对冲大师，期货是他最擅长的武器（' + (isFuturesShort ? '1992年做空英镑' : '量子基金在大宗商品/外汇/利率期货上的经典战役') + '）。\n\n';
          reason += '他会问：\n';
          reason += '① 这份期货合约背后的"基本趋势"是什么？（供给/需求/政策/地缘）\n';
          reason += '② 市场当前的偏见是什么？多头还是空头过度乐观/悲观？\n';
          reason += '③ 什么事件会让偏见被纠正——触发临界点？\n\n';
          if (hasTrend && hasBias && hasFeedback) {
            reason += '你已识别反身性三要素（趋势+偏见+反馈）——这是索罗斯最完美的狩猎场。' + (isFuturesShort ? '\n\n做空期货时，临界点尤其重要：你的止损位在哪里？逼仓风险有多高？' : '');
          } else {
            reason += '完善反身性三要素分析：当前趋势、市场偏见、触发纠正的临界事件。';
          }
          return reason;
        }
        // 股票专属逻辑
        if (isStock) {
          let reason = '索罗斯做股票时同样用反身性框架。他会区分个股的"公司基本面"和"市场认知"之间的关系：\n\n';
          reason += '① 公司的"基本趋势"：业绩改善/市场份额扩大/行业整合\n';
          reason += '② 市场对它的"主流偏见"：过度悲观还是过度乐观？\n';
          reason += '③ 什么会让偏见纠正：财报？政策？竞争对手的黑天鹅？\n\n';
          if (hasPivot) {
            reason += '你提到了拐点——索罗斯的经典操作就是在"认知从错误走向正确"的拐点下重注。';
          } else {
            reason += '关注趋势的加速度，而非趋势本身。当市场一致看多时，往往是离场信号。';
          }
          if (horizon === 'long') {
            reason += '\n\n长期视角下，索罗斯的反身性在长期更稳定：企业业绩改善和偏见纠正都需要时间。但要警惕"假拐点"——真正的拐点需要被基本面数据验证。';
          } else if (horizon === 'short') {
            reason += '\n\n短线交易中，反身性窗口很短：市场偏见可能在几天内被纠正。索罗斯短线做的是"情绪拐点"而非"基本面拐点"——你对情绪转折的判断是否足够精准？';
          }
          return reason;
        }
        // 默认（宏观/套利）
        let reason = '索罗斯会问三个核心问题：\n';
        reason += '① 当前的"基本趋势"是什么？（' + (hasTrend ? '✓ 已识别' : '需明确') + '）\n';
        reason += '② 市场参与者的"主流偏见"是什么？（' + (hasBias ? '✓ 已识别' : '需明确') + '）\n';
        reason += '③ 这条偏见通过什么"反馈机制"自我强化或反转？（' + (hasFeedback ? '✓ 已识别' : '需明确') + '）\n\n';
        if (hasPivot) {
          reason += '你提到了拐点——索罗斯特别关注趋势从加速到减速的临界点。';
        } else {
          reason += '关注趋势的加速度，而非趋势本身。当所有人都相信同一个逻辑时，反身性往往接近顶峰。';
        }
      }
      // 低分原因
      if (isFuturesShort) {
        return '索罗斯做空期货要求更高的确定性：你的分析是否有明确的"崩溃触发条件"？没有明确拐点的做空是危险的——期货空头的损失可以是无限的（如果继续逼仓）。索罗斯经典做空案例都有：基本趋势恶化 + 市场偏见极端乐观 + 临界点清晰可识别。';
      }
      if (isFutures) {
        return '你的描述缺乏宏观视角。索罗斯做期货关注的是宏观事件如何改变供需预期，而非技术图形或短期波动。问自己：这个头寸在什么宏观场景下会自我强化？什么会让它反转？';
      }
      if (isStock) {
        return '你的描述缺少反身性视角——只关注了基本面，没有考虑市场认知的变化。问问：市场现在怎么看这家公司？这个看法可能在哪里被证伪？证伪的那一刻会发生什么？';
      }
      return '索罗斯认为"可被认知的真相"和"实际发生的结果"之间存在反身性差距。如果你的分析只看静态基本面（PE、PB），而不考虑市场认知的变化，则缺乏反身性视角。';
    }
  },
  {
    id: 'dalio',
    name: '瑞·达里奥',
    avatar: '🏛️',
    avatarBg: 'linear-gradient(135deg,#0891b2,#164e63)',
    style: '风险平价 · 全天候策略 · 债务周期',
    // 决策框架：经济机器 → 四大情境 → 风险贡献 → 去杠杆信号
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 四大经济情境匹配 ──
      // 上升 + 通胀下降 → 股票/公司债好；上升 + 通胀上升 → 大宗商品/黄金好
      // 下降 + 通胀下降 → 名义债券好；下降 + 通胀上升 → 黄金/通胀保护债券好
      const isRising = /增长|复苏|扩张|GDP上升|经济好转/i.test(text);
      const isFalling = /衰退|下滑|萎缩|放缓|疲软/i.test(text);
      const isInflationary = /通胀|物价|加息|缩表|货币紧缩/i.test(text);
      const isDeflationary = /通缩|降息|宽松|放水|量化宽松/i.test(text);

      const scenarioCount = [isRising, isFalling, isInflationary, isDeflationary].filter(Boolean).length;
      if (scenarioCount >= 2) score += 2; // 明确指定了情境组合
      else if (scenarioCount === 1) score += 1;

      // ── 分散配置加分 ──
      const diversification = /分散|配置|组合|对冲|多资产|风险平价|全天候/i.test(text);
      if (diversification) score += 1.5;

      // ── 黄金/债券（达里奥的最爱） ──
      if (/黄金|gold/i.test(text)) score += 1;
      if (/债券|bond/i.test(text) && !/违约/i.test(text)) score += 0.5;

      // ── 尾部风险意识 ──
      const tailRisk = /黑天鹅|尾部|极端|百年一遇|模型风险/i.test(text);
      if (tailRisk) score += 1;

      // ── 集中/高杠杆扣分 ──
      const isConcentrated = /重仓|all.in|全押|集中|单一/i.test(text) && !/分散/i.test(text);
      const isHighLeverage = /高杠杆|杠杆|futures|期货保证金/i.test(text);
      if (isConcentrated) score -= 1;
      if (isHighLeverage) score -= 1;

      if (type === 'macro') score += 1;
      if (type === 'arbitrage') score += 0.5;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '全天候友好 · 符合风险平价';
      if (score >= 6) return '可纳入组合 · 需评估相关性';
      if (score >= 4) return '风险贡献需评估 · 谨慎规模';
      return '不符合分散原则 · 集中风险过大';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const hasScenario = /上升|下降|通胀|通缩|增长|衰退|宽松|紧缩/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isStock = type === 'stock_long' || type === 'stock_short';
      const isMacro = type === 'macro';

      if (score >= 7) {
        let reason = '达里奥的"经济机器"会问：这个头寸在哪种经济情境下表现最好，在哪种情境下表现最差？\n\n';
        reason += '全天候策略的核心是：不要预测经济，而是为四种情境都做好准备。\n';
        reason += '  ① 上升+通胀↓ → 股票/公司债\n';
        reason += '  ② 上升+通胀↑ → 大宗商品/黄金（' + (isFutures ? '✓ 期货正适合' : '期货正适合') + '）\n';
        reason += '  ③ 下降+通胀↓ → 名义债券\n';
        reason += '  ④ 下降+通胀↑ → 黄金/通胀保护债券\n\n';

        if (isFutures) {
          reason += '你的期货头寸在②或④情境下最有优势：通胀上升期大宗商品走强（②），尾部风险期黄金对冲（④）。';
          if (/黄金|gold/i.test(text)) {
            reason += '\n\n黄金是达里奥"全天候"组合中的核心品种——它既是对冲通胀的工具，也是系统性风险（股市下跌）时的避风港。';
          }
        } else if (isStock) {
          reason += '股票在①情境（经济复苏）下表现最佳。如果你的持仓在衰退+通胀情境（④）下，你需要问自己：这只股票是否有定价权/品牌护城河，能转嫁通胀成本？';
        } else if (isMacro) {
          reason += '宏观策略在达里奥框架下是最高效的：直接押注经济机器的方向，而不是个股或单个资产。';
        }

        if (horizon === 'long') {
          reason += '\n\n长期来看，达里奥最关注的是"去杠杆信号"：债务增速是否超过收入增速？信贷利差是否扩大？这些信号出现时要及时再平衡组合。';
        } else {
          reason += '\n\n请评估：你的头寸在最坏情境下的最大回撤是多少？它对整体组合的风险贡献是否过高？';
        }
        return reason;
      }
      return '达里奥会说：投资的第一原则是"不要亏钱"。你需要系统性地思考：' + (isFutures ? '这个期货头寸在大萧条/流动性危机情形下会发生什么？期货的杠杆会放大损失。' : isStock ? '这个股票头寸在萧条/危机情景下会发生什么？股价往往与基本面脱钩下跌。' : '这个头寸在萧条/危机情景下会发生什么？') + '\n\n达里奥研究历史债务危机发现，大多数人低估了去杠杆时资产的相关性——看似分散的组合实际上高度相关。' + (horizon === 'short' ? '短期交易者往往低估尾部风险，因为你只关注近期数据。"' : '') + '这个分析能通过这个压力测试吗？';
    }
  },
  {
    id: 'simons',
    name: '吉姆·西蒙斯',
    avatar: '🔢',
    avatarBg: 'linear-gradient(135deg,#7c3aed,#4c1d95)',
    style: '量化交易 · 统计套利 · 因子模型',
    // 决策框架：数据检验 → 历史规律 → 因子暴露 → 夏普比率评估
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 可量化因子加分 ──
      const factors = {
        momentum: /动量|momentum|趋势|追涨|突破/i,
        meanReversion: /均值回归|回归|价值|反转|超跌/i,
        volatility: /波动|volatility|风险|波动率|VIX/i,
        carry: /carry|息差|利差|收益率差|carry/i,
        volume: /成交量|量能|换手|volume/i,
        liquidity: /流动性|liquidity|买卖价差|滑点/i,
      };

      let factorCount = 0;
      for (const [name, regex] of Object.entries(factors)) {
        if (regex.test(text)) factorCount++;
      }
      score += factorCount * 0.8;

      // ── 统计规律加分 ──
      const hasStatistics = /历史|统计|回测|样本|数据|规律|频率|概率|均值|分布/i.test(text);
      if (hasStatistics) score += 1.5;

      // ── 可回测性 ──
      const backtestable = /日线|分钟|收盘|开盘|技术指标|均线|MACD|RSI/i.test(text);
      if (backtestable) score += 1;

      // ── 套利机会加分 ──
      if (type === 'arbitrage') score += 1.5;

      // ── 多空方向区分 ──
      // 动量因子（追涨）→ 适合做多；均值回归因子（反转）→ 适合做空
      const hasMomentum = /动量|momentum|趋势|追涨|突破/i.test(text);
      const hasMeanReversion = /均值回归|回归|价值|反转|超跌/i.test(text);
      if (type === 'stock_long' || type === 'futures_long') {
        if (hasMomentum) score += 0.5;
        if (hasMeanReversion) score -= 0.5; // 做多时均值回归逻辑较弱
      }
      if (type === 'stock_short' || type === 'futures_short') {
        if (hasMeanReversion) score += 0.5;
        if (hasMomentum) score -= 0.5; // 做空时动量逻辑较弱
      }

      // ── 主观判断扣分 ──
      const isPureFundamental = /我认为|我觉得|相信|感觉|直觉|基本面改善/i.test(text) &&
                                  !/数据|统计|历史|验证/i.test(text);
      if (isPureFundamental) score -= 1;

      // ── 情绪驱动扣分 ──
      const isSentimentDriven = /情绪|热点|题材|庄家|游资|概念/i.test(text) && !/量化|统计/i.test(text);
      if (isSentimentDriven) score -= 1;

      if (horizon === 'short') score += 1;
      if (horizon === 'long') score -= 0.5;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '量化友好 · 因子逻辑清晰';
      if (score >= 6) return '可量化验证 · 建议回测';
      if (score >= 4) return '主观成分重 · 量化难验证';
      return '无统计规律 · 不适合量化';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const hasStatistics = /历史|统计|回测|样本|数据|规律/i.test(text);
      const hasFactors = /动量|均值|波动|carry|成交量|流动性/i.test(text);
      const hasMomentum = /动量|momentum|趋势|追涨|突破/i.test(text);
      const hasMeanReversion = /均值回归|回归|价值|反转|超跌/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isStock = type === 'stock_long' || type === 'stock_short';
      const isShort = type === 'stock_short' || type === 'futures_short';
      const isLong = type === 'stock_long' || type === 'futures_long';

      if (score >= 7) {
        let reason = '西蒙斯的文艺复兴科技公司依靠统计模型在毫秒级市场波动中获利。他的核心问题：\n\n';
        reason += '① 是否有足够的历史样本？（至少需要几百个独立观测点）\n';
        reason += '② 夏普比率够不够？（西蒙斯要求>1.5，理想>2.0）\n';
        reason += '③ 样本外表现是否与样本内一致？（过拟合是最大风险）\n';
        reason += '④ 相关性是否稳定？（很多"规律"只在特定市场状态下有效）\n\n';

        if (isFutures) {
          reason += '【期货量化要点】\n';
          reason += 'CTA策略（趋势跟随）：适合有明确方向的期货品种，关注商品期货的动量因子。\n';
          reason += '展期收益率（Roll Yield）：期货近月/远月价差也是可量化的收益来源。\n';
          reason += '库存周期：农产品/工业品库存数据是量化信号的重要来源。\n';
          if (hasMomentum) reason += '\n你提到了动量因子——这是期货量化最经典的方向。';
          if (hasMeanReversion) reason += '\n均值回归在期货跨品种套利中很有效（如螺纹钢/热卷价差）。';
        } else if (isStock) {
          if (hasFactors) {
            reason += '你提到了具体因子——这是量化策略的好苗头。但需要做完整的因子分析：IC序列、换手率成本、最大回撤。\n';
            if (isLong && hasMomentum) {
              reason += '\n做多时，动量因子最有效——追涨处于上升趋势的股票。';
            }
            if (isShort && hasMeanReversion) {
              reason += '\n做空时，均值回归因子最有效——做空那些严重超买的股票。';
            }
          }
        } else {
          reason += '你提到了具体因子——这是量化策略的好苗头。但需要做完整的因子分析：IC序列、换手率成本、最大回撤。';
        }
        return reason;
      }

      let reason = '西蒙斯曾说"有效市场假说是错的，但也没有那么错"。\n\n';
      if (isFutures) {
        reason += '期货市场有大量可量化的价格行为（持仓量变化、库存报告影响、跨期价差），但纯粹主观判断宏观事件对期货的影响，不构成量化优势。';
      } else if (isShort) {
        reason += '做空对量化模型的要求更高：做空收益来自下跌，但下跌的速度和幅度往往比上涨更难预测。';
      } else {
        reason += '如果你这个想法纯粹来自主观判断或新闻事件，而没有数据支撑，那对量化策略来说就是噪音。';
      }
      reason += '\n\n西蒙斯会问：你的edge（优势）在哪里？是可以被重复验证的吗？' + (horizon === 'short' ? '短周期量化更容易找到稳定规律，建议从高频数据入手做回测。' : horizon === 'long' ? '长周期量化面临样本稀少问题——历史上可能没有足够的独立事件来验证你的假设。' : '先做回测，让数据说话。');
      return reason;
    }
  },
  {
    id: 'lynch',
    name: '彼得·林奇',
    avatar: '🎸',
    avatarBg: 'linear-gradient(135deg,#be123c,#881337)',
    style: '成长股投资 · 身边机会 · PEG法则',
    // 决策框架：身边观察 → 渗透率 → PEG → 六种股票类型分类
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 身边观察加分 ──
      const fromLife = /我身边|我看到|我去|我朋友|我同事|我家人|生活中|身边|身边观察/i.test(text);
      if (fromLife) score += 2;

      // ── 渗透率思维（林奇核心） ──
      const penetrationThinking = /渗透率|刚开始|早期|导入期|成长期|渗透|占有率|市场份额/i.test(text);
      if (penetrationThinking) score += 1.5;

      // ── 成长性特征 ──
      const growthSignals = /营收增长|利润增|开店|扩张|连锁|渗透|用户增|复购/i.test(text);
      if (growthSignals) score += 1.5;

      // ── PEG合理性 ──
      const hasPEG = /peg|市盈率.*增长|PE.*增速|估值.*增速/i.test(text);
      if (hasPEG) score += 1;

      // ── 股票类型匹配 ──
      // 快速增长型：大行业小公司；稳定增长型：大公司稳健
      const fastGrower = /小店|小市值|新上市|连锁扩张|渗透率低/i.test(text);
      const stableGrower = /龙头|稳健|持续|成熟|蓝筹/i.test(text);
      if (fastGrower) score += 1;
      if (stableGrower) score += 0.5;

      // ── 林奇厌恶的类型 ──
      const isCyclicalTop = /周期顶部|产能过剩|夕阳|大宗|原材料|油价|大宗商品/i.test(text);
      const isAssetPlay = /土地|资产|拆迁|赔偿|一次性|账面/i.test(text);
      if (isCyclicalTop) score -= 2; // 林奇最讨厌周期股
      if (isAssetPlay) score -= 1;

      // ── 时间周期 ──
      if (horizon === 'long') score += 1;
      if (type === 'stock_long') score += 0.5;

      // ── 期货/大宗商品绝对禁区 ──
      if (/原油|石油|期货|futures|大宗商品|黄金.*期货/i.test(text)) score -= 3;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '绝佳成长机会 · 值得重仓';
      if (score >= 6) return '成长逻辑存在 · 需跟踪验证';
      if (score >= 4) return '成长性存疑 · 非此策略方向';
      return '不符合成长股框架 · 不参与';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const fromLife = /身边|生活中|我看到|我去/i.test(text);
      const penetration = /渗透率|早期|成长期|导入/i.test(text);
      const isCommodity = /原油|石油|期货|大宗|能源|商品/i.test(text);
      const isCyclical = /周期|产能|原材料/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isShort = type === 'stock_short' || type === 'futures_short';
      const isStock = type === 'stock_long' || type === 'stock_short';

      if (isCommodity) {
        let reason = '林奇曾直言不讳："大宗商品期货是投资者的坟墓。"他投资的是有血有肉的企业，而不是一堆会过期的合约。\n\n';
        if (isFutures) {
          reason += '他无法预测石油价格——但他可以理解一家连锁加油站的运营模式如何随油价波动而变化。';
        }
        reason += '\n如果你对能源行业有观点，林奇的方式是：\n';
        reason += '① 投资能源公司的股票（而非期货合约）——这样没有到期日，不需要移仓\n';
        reason += '② 找有品牌/特许经营权的能源下游企业（如管道、加油站网络）——它们能转嫁油价波动\n';
        reason += '③ 关注股息和现金流，而非期货合约的到期价差\n\n';
        reason += '期货合约有时间成本（移仓损耗），林奇关注的永续竞争优势在这里不存在。';
        return reason;
      }
      if (isCyclical && score < 5) {
        return '周期股在行业顶部时往往是最危险的——所有人都知道需求旺盛，所有人都扩张产能。林奇会问：现在行业产能利用率是多少？接下来3年有多少新增产能要投产？这个增长是真实的还是昙花一现？' + (isShort ? '\n\n做空周期股是林奇认可的策略——在产能扩张高峰期做空往往有安全边际。但需要严格止损，因为周期股的顶部往往比预期更久。' : '');
      }
      if (score >= 7) {
        let reason = '林奇最成功的投资来自他身边的生活观察。';
        if (fromLife) reason += '你提到从身边观察到，这一点完全符合林奇的方法论。';
        reason += '\n\n林奇会继续问：\n';
        reason += '① 你认识的使用这个产品/服务的人多吗？（渗透率判断）\n';
        reason += '② 公司是以什么速度在扩张？（开店速度、营收增速）\n';
        reason += '③ PEG是多少？（PE除以增速，越<1越有吸引力）\n';
        reason += '④ 这是什么类型的成长股？（6种分类：缓慢、稳定、快速、周期性、资产型、反转型）';

        if (isShort) {
          reason += '\n\n林奇对做空比较保守：做空意味着你相信某件事会让这家公司倒闭，这比买进要求更高的确定性。';
        } else if (horizon === 'short') {
          reason += '\n\n但短线和林奇格格不入——他的方法需要时间去验证渗透率和成长逻辑。短线投资者不给你这个时间。';
        }
        return reason;
      }
      return '林奇曾说："在你买股票之前，先问问自己：我能详细描述这家公司做什么吗？如果不能，就不要买。"' + (isFutures ? '\n\n期货合约更无法回答这个问题——你无法用一句话描述一桶原油的价值驱动因素。' : '') + '\n这个逻辑能否通过这个检验？';
    }
  },
  {
    id: 'zhang',
    name: '章盟主',
    avatar: '🐉',
    avatarBg: 'linear-gradient(135deg,#ea580c,#9a3412)',
    style: '顶级游资 · 龙头战法 · 情绪周期',
    // 决策框架：情绪周期定位 → 龙头识别 → 筹码结构 → 仓位管理
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 龙头战法核心 ──
      const isDragonHead = /龙头|龙一|市场龙头|板块龙头|灵魂股|情绪龙头/i.test(text);
      const isNotDragon = /跟风|补涨|后排|边缘|杂毛|蹭概念/i.test(text);
      if (isDragonHead) score += 2.5;
      if (isNotDragon) score -= 2;

      // ── 情绪周期定位 ──
      const emotionCycle = /情绪|赚钱效应|短线周期|情绪冰点|情绪高潮|回暖|退潮|分歧|一致/i.test(text);
      if (emotionCycle) score += 2;

      // ── 题材逻辑加分 ──
      const themeLogic = /题材|主题|板块|消息面|政策|事件驱动/i.test(text);
      if (themeLogic) score += 1.5;

      // ── 涨停板关注点 ──
      const boardSignals = /涨停|连板|一字板|换手板|缩量|放量|竞价|情绪共振/i.test(text);
      if (boardSignals) score += 1;

      // ── 筹码结构 ──
      const chipStructure = /筹码|抛压|套牢盘|解放|成本|均线|筹码峰/i.test(text);
      if (chipStructure) score += 1;

      // ── 基本面派扣分 ──
      const isValueInvestor = /低估值|PE|PB|分红|价值|内在价值|护城河/i.test(text) &&
                               !/情绪|题材|龙头/i.test(text);
      if (isValueInvestor) score -= 1.5;

      // ── 短线优势明显 ──
      if (horizon === 'short') score += 2;
      if (type === 'stock_short') score += 1; // 做空在短线中更常见
      if (type === 'stock_long') score -= 0.5; // 长线不符合龙头战法

      // ── 高风险警示 ──
      const isRisky = /重仓|满仓|all.in|梭哈|一把梭/i.test(text);
      if (isRisky) score -= 0.5;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '龙头机会！情绪到位可重仓';
      if (score >= 6) return '有戏！注意情绪周期节奏';
      if (score >= 4) return '题材一般，跟随为主不格局';
      return '无情绪驱动 · 不适合龙头战法';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const isDragon = /龙头|龙一|板块龙头|情绪龙头/i.test(text);
      const hasEmotion = /情绪|周期|赚钱效应|冰点|高潮|分歧/i.test(text);
      const hasChip = /筹码|抛压|换手|套牢盘/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isShort = type === 'stock_short' || type === 'futures_short';

      if (score >= 7) {
        let reason = '章盟主的核心战法是"看长做短"——看透资金博弈的本质，在情绪最激烈的阶段精准介入。\n\n';
        reason += '他会依次问：\n';
        reason += '① 现在处于情绪周期的哪个阶段？（' + (hasEmotion ? '✓ 已识别' : '需明确') + '）\n';
        reason += '② 龙头是谁？跟风是谁？（' + (isDragon ? '✓ 已识别龙头' : '需明确龙头') + '）\n';
        reason += '③ 筹码结构如何？（' + (hasChip ? '✓ 已关注' : '需关注') + '）\n';

        if (isFutures) {
          reason += '\n【期货短线要点】\n';
          reason += '期货和股票短线最大区别：期货有夜盘联动——外盘商品（黄金、原油、农产品）夜盘跳空是常见风险点。\n';
          reason += '多空主力博弈：关注期货公司席位净多头/净空头变化，以及升贴水结构（contango vs backwardation）的切换。\n';
          reason += 'COIN换手率：持仓量（OI）变化比成交量更重要——OI增加说明有新资金推动趋势；OI减少意味着趋势可能结束。\n';
          reason += isShort ? '做空在期货短线中很常见，但要注意：期货空头的最大风险是逼仓（short squeeze），尤其是流动性差的品种。' : '期货短线口诀：看外盘定价，看内盘情绪。';
        } else if (isShort) {
          reason += '\n做空在A股短线中较难——A股散户多、情绪化，做空机制不完善（融券成本高）。不建议散户短线做空。';
        } else {
          reason += '\n短线核心口诀：弱市不做连板，强市拥抱龙头。情绪高潮期不追，情绪冰点期不慌。';
        }
        return reason;
      }
      return '龙头战法讲究"只在最确定的时候下重注"。章盟主会问：这个位置追进去，止损设哪里？预期收益空间有多大？' + (isFutures ? '期货短线还要问：夜盘外盘跳空风险有多大？升贴水结构对持仓是否有利？' : '') + '如果情绪退潮，这个故事的逻辑能支撑几个板？短线交易的核心是风险收益比，不是方向对错。';
    }
  },
  {
    id: 'zuoxi',
    name: '作手新一',
    avatar: '⚡',
    avatarBg: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
    style: '新生代游资 · 情绪周期 · 主线思维',
    // 决策框架：主线确认 → 情绪节奏 → 预期差 → 止损纪律
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 主线思维（作手新一最强调的） ──
      const isMainLine = /主线|主升浪|主流|核心主线|资金主线/i.test(text);
      const notMainLine = /边缘|非主流|支线|一日游|快速轮动/i.test(text);
      if (isMainLine) score += 2.5;
      if (notMainLine) score -= 2;

      // ── 预期差（作手新一的核心词） ──
      const hasExpectDiff = /预期差|分歧|认知差|预期不同|市场低估|市场误解/i.test(text);
      if (hasExpectDiff) score += 2;

      // ── 情绪阶段判断 ──
      const emotionPhase = {
        start: /启动|初升|点火|开始|第一波|萌芽/i,
        peak: /高潮|加速|疯狂|一致|泡沫|顶部/i,
        decline: /退潮|回落|衰退|补跌|滞涨/i,
        bottom: /冰点|绝望|底部|超跌|反弹|回暖/i,
      };
      for (const [phase, regex] of Object.entries(emotionPhase)) {
        if (regex.test(text)) score += 1;
      }

      // ── 止损纪律加分（成熟的标志） ──
      const hasStopLoss = /止损|风控|控仓|分批|纪律|回撤控制|亏损|容错/i.test(text);
      if (hasStopLoss) score += 1;

      // ── 长线持有扣分 ──
      const isLongOnly = /长线|长期持有|价值投资|买了不动|等价值回归/i.test(text);
      if (isLongOnly) score -= 1.5;

      // ── 短线有利 ──
      if (horizon === 'short') score += 1.5;
      if (horizon === 'medium') score += 0.5;
      if (type === 'stock_short') score += 0.5;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '主线明确！情绪上升期积极参与';
      if (score >= 6) return '情绪逻辑存在，注意节奏';
      if (score >= 4) return '非主线方向，控仓观望';
      return '缺少主线逻辑，耐心等待';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const isMainLine = /主线|主流|核心主线/i.test(text);
      const hasExpDiff = /预期差|分歧|认知差|误解/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isShort = type === 'stock_short' || type === 'futures_short';
      const isMacro = type === 'macro';

      if (score >= 7) {
        let reason = '作手新一的核心理念："只在主线里操作，只在分歧时买入，在一致时卖出。"\n\n';
        reason += '他会依次判断：\n';
        reason += '① 这是不是当前市场的主线？（' + (isMainLine ? '✓ 符合' : '需确认') + '）\n';
        reason += '② 市场对它的预期差在哪里？（' + (hasExpDiff ? '✓ 已识别' : '需明确') + '）\n';
        reason += '③ 现在是情绪周期的哪个阶段？（启动/加速/高潮/退潮）\n';

        if (isFutures) {
          reason += '\n【期货作手要点】\n';
          reason += '宏观事件驱动的短期爆发：地缘/政策/数据公布后，等分歧出现（分歧越大预期差越大），在一致时离场。\n';
          reason += '库存周期：期货库存由增转减（基本面改善）往往对应价格拐点——这是期货主线的核心信号。\n';
          reason += isShort ? '做空期货时，关注供需拐点：库存积压+需求萎缩=做空安全边际更高。' : '做多期货时，关注库存去化和需求旺季叠加的时机。';
        } else if (isShort) {
          reason += '\n做空个股：基本面恶化是前提，但时机靠情绪——等"一致看多"的情绪顶点出现时做空，止损设在创新高的位置。';
        } else if (isMacro) {
          reason += '\n宏观机会：主线逻辑更强，关注全球资金流向的切换节点。';
        } else {
          reason += '\n短线核心口诀：弱市不做连板，强市拥抱龙头。情绪高潮期不追，情绪冰点期不慌。';
        }
        return reason;
      }
      return '作手新一会说：市场的主线只有一个。当前的方向是不是主线？不是主线就不值得重仓。其次，有没有预期差？预期差是超额收益的来源。' + (isFutures ? '期货没有基本面锚定，更依赖情绪周期——当所有资金都在一个方向时，反转风险急剧上升。' : '') + '如果市场已经充分认知这个机会，那它往往已经price in了。';
    }
  },
  {
    id: 'fang',
    name: '方新侠',
    avatar: '🦅',
    avatarBg: 'linear-gradient(135deg,#0369a1,#0c4a6e)',
    style: '价值游资 · 基本面+情绪共振 · 双击策略',
    // 决策框架：基本面验证 → 预期差识别 → 情绪共振确认 → 三击验证
    judge(text, type, horizon) {
      const lower = text.toLowerCase();
      let score = 5;

      // ── 基本面因子 ──
      const fundamentalFactors = {
        valuation: /估值|PE|PB|低估值|合理估值|便宜/i,
        earnings: /业绩|利润|营收|增长|超预期|财报/i,
        industry: /行业|赛道|景气度|政策支持|行业空间/i,
        quality: /ROE|毛利率|护城河|龙头|竞争力|壁垒/i,
      };

      let fundCount = 0;
      for (const [name, regex] of Object.entries(fundamentalFactors)) {
        if (regex.test(text)) fundCount++;
      }
      score += fundCount * 0.8;

      // ── 情绪因子 ──
      const emotionFactors = /题材|情绪|热点|龙头|连板|资金|换手/i.test(text);
      if (emotionFactors) score += 1.5;

      // ── 共振（方新侠的核心追求） ──
      const resonance = /共振|双击|基本面.*情绪|业绩.*题材|戴维斯双击|底部.*涨停/i.test(text);
      if (resonance) score += 2.5;

      // ── 预期差（基本面部分） ──
      const fundExpectDiff = /业绩超预期|行业反转|困境反转|底部反转|被错杀|预期修复/i.test(text);
      if (fundExpectDiff) score += 1.5;

      // ── 纯题材扣分（方新侠不喜欢） ──
      const pureMomentum = /纯题材|无业绩|亏损|垃圾股|讲故事|商誉/i.test(text) &&
                           !/困境反转|基本面改善|业绩修复/i.test(text);
      if (pureMomentum) score -= 2;

      // ── 短线 vs 长线 ──
      if (horizon === 'medium') score += 1;
      if (horizon === 'long') score += 0.5;
      if (type === 'stock_long') score += 0.5;

      return Math.max(1, Math.min(10, score));
    },
    getVerdict(score) {
      if (score >= 8) return '双击机会！基本面+情绪完美共振';
      if (score >= 6) return '逻辑扎实，可适度参与';
      if (score >= 4) return '逻辑不够完整，需更多验证';
      return '缺基本面支撑，谨慎参与';
    },
    getReason(text, score, type, horizon) {
      const lower = text.toLowerCase();
      const hasFundamental = /业绩|估值|行业|ROE|护城河|基本面|供需|库存|宏观/i.test(text);
      const hasEmotion = /题材|情绪|热点|龙头|资金/i.test(text);
      // 期货共振：库存+供需+宏观三重共振
      const hasResonance = /共振|双击|基本面.*情绪|业绩.*题材|库存.*供需|供需.*宏观|库存.*宏观/i.test(text);
      const isFutures = type === 'futures_long' || type === 'futures_short';
      const isStock = type === 'stock_long' || type === 'stock_short';
      const isShort = type === 'stock_short' || type === 'futures_short';

      if (score >= 7) {
        if (isFutures) {
          let reason = '方新侠的"基本面+情绪共振"框架同样适用于期货。期货的"基本面"是供需平衡表、库存周期、宏观驱动因素；"情绪"是资金对供需预期的认知偏差。\n\n';
          reason += '他会问：\n';
          reason += '① 基本面改善的驱动因素是什么？（供给收缩？需求爆发？政策干预？）\n';
          reason += '② 市场当前对供需的认知是否存在偏差？（' + (hasFundamental ? '✓ 你已识别' : '需明确') + '）\n';
          reason += '③ 情绪/资金是否认可这个逻辑？（' + (hasEmotion ? '✓ 已识别' : '需明确') + '）\n';
          reason += '④ 两者是否共振？（' + (hasResonance ? '✓ 已识别' : '需明确') + '）\n\n';
          reason += isShort
            ? '【做空共振】库存积压+需求萎缩+宏观看空=基本面超买+情绪高亢。做空安全边际：库存爆满+期货升水+投机多头持仓历史高位时，三者共振最明确。'
            : '期货双击：高库存+低价格+宏观利好预期 = 基本面超卖 + 情绪修复。';
          return reason;
        }
        if (isStock) {
          let reason = '方新侠追求的是"基本面+情绪双击"——这是A股最暴利的策略形态。\n\n';
          reason += '他会构建一个验证清单：\n';
          reason += '【基本面层】\n';
          reason += '  ① 业绩是否在趋势性改善？（' + (/业绩|利润|营收/i.test(text) ? '✓ 已识别' : '需补充') + '）\n';
          reason += '  ② 估值是否存在预期差？（' + (/估值|PE|低估值/i.test(text) ? '✓ 已识别' : '需补充') + '）\n';
          reason += '  ③ 行业/赛道景气度如何？（' + (/行业|赛道|政策/i.test(text) ? '✓ 已识别' : '需补充') + '）\n\n';
          reason += '【情绪层】\n';
          reason += '  ① 是否有题材催化剂？（' + (hasEmotion ? '✓ 已识别' : '需补充') + '）\n';
          reason += '  ② 资金认可度如何？（' + (/龙头|连板|换手|资金/i.test(text) ? '✓ 已识别' : '需补充') + '）\n\n';
          reason += '【共振检验】两个逻辑是否互相强化？（' + (hasResonance ? '✓ 已识别' : '需明确') + '）';

          if (isShort) {
            reason += '\n\n【做空逻辑】方新侠做空时：基本面恶化是前提（业绩下滑/行业景气度下降），情绪高点（所有人都在买）= 最佳做空时机。';
          } else if (horizon === 'long') {
            reason += '\n\n长线视角下，方新侠更关注：业绩改善趋势能否持续3-5年？管理层是否有执行力？估值扩张的空间有多大？';
          }
          return reason;
        }
        // 默认（宏观/套利/基金）
        let reason = '方新侠的方法论在宏观和套利场景下同样适用。核心是"找到被市场错误定价的认知差 + 等待情绪认可这个认知差被纠正"。\n\n';
        reason += '【共振检验】\n';
        reason += '  ① 基本面改善的逻辑是否清晰？（' + (hasFundamental ? '✓ 已识别' : '需补充') + '）\n';
        reason += '  ② 情绪/资金是否开始认可？（' + (hasEmotion ? '✓ 已识别' : '需补充') + '）\n';
        reason += '  ③ 两者是否共振？（' + (hasResonance ? '✓ 已识别' : '需明确') + '）';
        return reason;
      }
      if (isFutures) {
        return '方新侠做期货同样追求双击：期货的"基本面"是库存/供需/宏观，"情绪"是资金对预期的认知偏差。如果基本面没有改善预期，或情绪不认可这个逻辑，就缺少共振，机会有限。';
      }
      return '方新侠最不能接受的是"纯题材、无业绩"——这种标的缺乏基本面锚定，上涨逻辑脆弱，容易被证伪。他的理想标的是：① 基本面已经或即将改善 ② 市场情绪认可这个改善逻辑 ③ 估值存在预期差。如果缺少任何一个维度，都要降低预期。';
    }
  },
  // ============================================================
  // 第10位：我的知识库 — 基于用户个人知识库内容的虚拟分析师
  // ============================================================
  {
    id: 'mykb',
    name: '我的知识库',
    avatar: '📚',
    avatarBg: 'linear-gradient(135deg,#0ea5e9,#0369a1)',
    style: '个人知识库 · 基于历史积累的分析框架',
    // 决策框架：读取知识库 → 关键词匹配 → 分类加权 → 综合评分
    judge(text, type, horizon) {
      const knowledgeBase = DB.load('knowledge_v1', []);
      if (knowledgeBase.length === 0) return 5; // 知识库为空时给中性评分

      const lowerText = text.toLowerCase();
      let score = 5;
      let matchCount = 0;
      let totalRelevance = 0;

      // 从知识库中匹配相关条目
      knowledgeBase.forEach(entry => {
        const entryText = ((entry.title || '') + ' ' + (entry.content || '') + ' ' + (entry.tags || '').join(' ')).toLowerCase();
        let entryScore = 0;

        // 计算文本相似度（关键词匹配）
        const textWords = lowerText.split(/\s+|[,，。；;、]+/).filter(w => w.length >= 2);
        const entryWords = entryText.split(/\s+|[,，。；;、]+/).filter(w => w.length >= 2);

        // 计算共同关键词数量
        const commonWords = textWords.filter(w => entryWords.some(ew => ew.includes(w) || w.includes(ew)));
        const relevance = commonWords.length;

        if (relevance > 0) {
          matchCount++;
          totalRelevance += relevance;

          // 根据分类调整评分
          const category = (entry.category || '').toLowerCase();
          if (category.includes('投资理念') || category.includes('investment')) {
            // 投资理念类知识：如果文本符合理念，加分
            entryScore += relevance * 0.5;
          } else if (category.includes('技术分析') || category.includes('tech')) {
            // 技术分析类：如果文本中有技术词汇，加分
            const techWords = /突破|支撑|阻力|均线|MACD|KDJ|RSI|量能|金叉|死叉/i;
            if (techWords.test(text)) entryScore += relevance * 0.3;
          } else if (category.includes('宏观经济') || category.includes('macro')) {
            // 宏观类：如果文本涉及宏观因素，加分
            const macroWords = /利率|通胀|GDP|CPI|货币政策|美联储|央行|汇率/i;
            if (macroWords.test(text)) entryScore += relevance * 0.4;
          } else if (category.includes('心得体会') || category.includes('experience')) {
            // 心得体会：基于历史经验的警示
            entryScore += relevance * 0.3;
          }

          // 根据条目标签进一步调整
          if (entry.tags && Array.isArray(entry.tags)) {
            entry.tags.forEach(tag => {
              if (lowerText.includes(tag.toLowerCase())) {
                entryScore += 1;
              }
            });
          }
        }

        score += entryScore;
      });

      // 如果有匹配的知识点，根据匹配数量调整
      if (matchCount > 0) {
        const avgRelevance = totalRelevance / matchCount;
        // 匹配度越高，评分越有依据（偏离中性的幅度越大）
        const deviation = (score - 5) * Math.min(avgRelevance / 10, 1.5);
        score = 5 + deviation;
      } else {
        // 没有匹配的知识，给中性偏保守的评分
        score = 4.5;
      }

      // 类型调整
      if (type === 'stock_short' && !/做空|short/i.test(text)) score -= 1;
      if (type === 'futures_short' && !/做空|short/i.test(text)) score -= 1;

      // 时间周期调整
      if (horizon === 'short') score -= 0.5; // 知识库更适合长线
      if (horizon === 'long') score += 0.5;

      return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
    },
    getVerdict(score) {
      const knowledgeBase = DB.load('knowledge_v1', []);
      if (knowledgeBase.length === 0) return '知识库为空，暂无参考框架';
      if (score >= 8) return '高度吻合知识库积累 · 强烈推荐';
      if (score >= 6) return '符合知识库部分逻辑 · 可参考';
      if (score >= 4) return '与知识库积累偏离 · 需谨慎';
      return '与知识库逻辑相悖 · 建议回避';
    },
    getReason(text, score, type, horizon) {
      const knowledgeBase = DB.load('knowledge_v1', []);
      if (knowledgeBase.length === 0) {
        return '📚 您的知识库目前为空。\n\n建议：在"个人知识库"页面记录您的投资理念、成功经验、失败教训，这样"我的知识库"分析师可以基于您的积累给出更精准的建议。';
      }

      const lowerText = text.toLowerCase();
      let matchedEntries = [];

      // 找出最相关的知识条目（取前3条）
      const entryScores = knowledgeBase.map(entry => {
        const entryText = ((entry.title || '') + ' ' + (entry.content || '') + ' ' + (entry.tags || '').join(' ')).toLowerCase();
        let relevance = 0;
        const textWords = lowerText.split(/\s+|[,，。；;、]+/).filter(w => w.length >= 2);
        const entryWords = entryText.split(/\s+|[,，。；;、]+/).filter(w => w.length >= 2);
        textWords.forEach(w => {
          if (entryWords.some(ew => ew.includes(w) || w.includes(ew))) {
            relevance++;
          }
        });
        return { ...entry, relevance };
      }).filter(e => e.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 3);

      if (entryScores.length === 0) {
        return '📚 未找到与当前策略相关的知识库记录。\n\n这可能是您尚未记录相关领域的投资知识，建议：\n① 在"个人知识库"中添加相关主题的知识\n② 重新审视当前策略是否在有充分认知的领域内';
      }

      let reason = '📚 基于您的知识库分析：\n\n';
      reason += '【相关知识条目】\n';
      entryScores.forEach((entry, idx) => {
        reason += `${idx + 1}. 《${entry.title}》(${entry.category || '未分类'}) — 相关度：${entry.relevance}\n`;
        // 截取内容摘要
        const summary = (entry.content || '').slice(0, 80) + ((entry.content || '').length > 80 ? '...' : '');
        reason += `   ${summary}\n`;
      });

      reason += '\n【综合判断】\n';
      if (score >= 7) {
        reason += '当前策略与您的知识积累高度吻合，知识库中的相关经验支持这个方向。';
      } else if (score >= 5) {
        reason += '当前策略与知识库中的部分逻辑一致，但仍有需要验证的点。';
      } else {
        reason += '当前策略与您的知识积累存在偏离，建议参考知识库中的相关经验重新审视。';
      }

      if (horizon === 'short') {
        reason += '\n\n💡 短线视角：知识库中的经验多来自中长期实践，短线决策需额外关注市场情绪和资金流向。';
      }
      if (horizon === 'long') {
        reason += '\n\n💡 长线视角：这正是知识库经验最能发挥作用的场景，建议深入参考相关条目中的逻辑。';
      }

      return reason;
    }
  }
];

function renderVoteCardsPending() {
  const grid = document.getElementById('vote-investors-grid');
  grid.innerHTML = INVESTORS.map(inv => `
    <div class="vote-investor-card pending">
      <div class="vote-investor-header">
        <div class="vote-investor-avatar" style="background:${inv.avatarBg};">${inv.avatar}</div>
        <div>
          <div class="vote-investor-name">${inv.name}</div>
          <div class="vote-investor-style">${inv.style}</div>
        </div>
        <div style="margin-left:auto;">
          <span class="vote-investor-tag" style="background:rgba(148,163,184,0.15);color:var(--text3);">待分析</span>
        </div>
      </div>
      <div class="vote-investor-verdict" style="color:var(--text3);">等待输入头寸...</div>
      <div class="vote-investor-score-wrap">
        <div class="vote-investor-score-bar">
          <div class="vote-investor-score-fill" style="width:0%;background:var(--text3);"></div>
        </div>
        <div class="vote-investor-score-num" style="color:var(--text3);">--</div>
      </div>
      <div class="vote-investor-reason" style="color:var(--text3);">💬 请在上方输入头寸想法，点击按钮开始分析</div>
    </div>
  `).join('');
  document.getElementById('vote-summary-bar').style.display = 'none';
}

function runVote() {
  const text = document.getElementById('vote-position').value.trim();
  const type = document.getElementById('vote-type').value;
  const horizon = document.getElementById('vote-horizon').value;

  // 如果没有输入，显示待分析状态
  if (!text) {
    renderVoteCardsPending();
    return;
  }

  // 每个大师评分
  const results = INVESTORS.map(inv => {
    const score = inv.judge(text, type, horizon);
    const verdict = inv.getVerdict(score);
    const reason = inv.getReason(text, score, type, horizon);
    let sentiment;
    if (score >= 7) sentiment = 'bullish';
    else if (score <= 4) sentiment = 'bearish';
    else sentiment = 'neutral';
    return { ...inv, score, verdict, reason, sentiment };
  });

  // 汇总统计
  const avgScore = results.reduce((a, r) => a + r.score, 0) / results.length;
  const bullCount = results.filter(r => r.sentiment === 'bullish').length;
  const bearCount = results.filter(r => r.sentiment === 'bearish').length;
  const neutralCount = results.filter(r => r.sentiment === 'neutral').length;
  const consensus = avgScore >= 7 ? '强烈看多' : avgScore >= 5.5 ? '谨慎看多' : avgScore >= 4 ? '中性观望' : avgScore >= 2.5 ? '谨慎看空' : '强烈看空';
  const consensusColor = avgScore >= 7 ? 'var(--red)' : avgScore >= 4 ? 'var(--yellow)' : 'var(--green)';

  // 渲染汇总条
  const tiltBull = Math.round(bullCount / results.length * 5);
  const tiltBar = Array.from({length:5}, (_, i) => {
    if (i < tiltBull) return '<div class="vote-tilt-dot" style="background:var(--red);"></div>';
    return '<div class="vote-tilt-dot" style="background:var(--bg4);"></div>';
  }).join('');

  document.getElementById('vote-summary-bar').innerHTML = `
    <div class="vote-summary-bar" style="border-left:4px solid ${consensusColor};">
      <div class="vote-summary-score">
        <div class="vote-summary-score-num" style="color:${consensusColor};">${avgScore.toFixed(1)}</div>
        <div class="vote-summary-score-label">综合评分</div>
      </div>
      <div class="vote-summary-verdict" style="color:${consensusColor};">${consensus}</div>
      <div class="vote-tilt-indicator">
        <span style="color:var(--red);">${bullCount}多</span>
        ${tiltBar}
        <span style="color:var(--green);">${bearCount}空</span>
      </div>
      <div style="font-size:11px;color:var(--text3);min-width:60px;text-align:right;">${results.length}位大师投票</div>
    </div>
  `;

  // 渲染大师卡片（按评分排序）
  results.sort((a, b) => b.score - a.score);
  document.getElementById('vote-investors-grid').innerHTML = results.map(r => {
    const fillColor = r.sentiment === 'bullish' ? 'var(--red)' : r.sentiment === 'bearish' ? 'var(--green)' : 'var(--text3)';
    const sentimentLabel = r.sentiment === 'bullish' ? '看多' : r.sentiment === 'bearish' ? '看空' : '中性';
    const sentimentBg = r.sentiment === 'bullish' ? 'rgba(239,68,68,0.15)' : r.sentiment === 'bearish' ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)';
    return `<div class="vote-investor-card ${r.sentiment}">
      <div class="vote-investor-header">
        <div class="vote-investor-avatar" style="background:${r.avatarBg};">${r.avatar}</div>
        <div>
          <div class="vote-investor-name">${r.name}</div>
          <div class="vote-investor-style">${r.style}</div>
        </div>
        <div style="margin-left:auto;">
          <span class="vote-investor-tag" style="background:${sentimentBg};color:${fillColor};">${sentimentLabel}</span>
        </div>
      </div>
      <div class="vote-investor-verdict" style="color:${fillColor};">${r.verdict}</div>
      <div class="vote-investor-score-wrap">
        <div class="vote-investor-score-bar">
          <div class="vote-investor-score-fill" style="width:${r.score * 10}%;background:${fillColor};"></div>
        </div>
        <div class="vote-investor-score-num" style="color:${fillColor};">${r.score.toFixed(1)}</div>
      </div>
      <div class="vote-investor-reason">💬 ${r.reason}</div>
    </div>`;
  }).join('');

  document.getElementById('vote-result').style.display = '';
  document.getElementById('vote-history-panel').style.display = 'none';

  // 显示保存按钮
  document.getElementById('btn-save-vote').style.display = '';

  // 保存当前投票数据到全局变量，供保存函数使用
  window._currentVoteData = {
    text, type, horizon,
    results,
    avgScore, bullCount, bearCount, neutralCount
  };

  // 切换到当前投票 tab
  switchVoteTab('current');
}

// 保存当前投票到历史
function saveCurrentVote() {
  if (!window._currentVoteData) return;
  const data = window._currentVoteData;

  const record = {
    id: uuid(),
    text: data.text,
    type: data.type,
    horizon: data.horizon,
    createdAt: new Date().toISOString(),
    avgScore: data.avgScore,
    bullCount: data.bullCount,
    bearCount: data.bearCount,
    neutralCount: data.neutralCount,
    investors: data.results.map(r => ({
      id: r.id,
      name: r.name,
      avatar: r.avatar,
      avatarBg: r.avatarBg,
      style: r.style,
      score: r.score,
      verdict: r.verdict,
      sentiment: r.sentiment
    }))
  };

  voteHistory.unshift(record); // 最新在前
  DB.save('voteHistory_v1', voteHistory);

  // 隐藏保存按钮
  document.getElementById('btn-save-vote').style.display = 'none';

  // 更新历史计数
  updateVoteHistoryCount();

  // 提示
  showToast('投票已保存到历史记录');
}

// 切换投票 Tab
function switchVoteTab(tab) {
  currentVoteTab = tab;
  document.querySelectorAll('#vote-tabs .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.voteTab === tab);
  });

  if (tab === 'current') {
    document.getElementById('vote-result').style.display = '';
    document.getElementById('vote-history-panel').style.display = 'none';
  } else {
    document.getElementById('vote-result').style.display = 'none';
    document.getElementById('vote-history-panel').style.display = '';
    renderVoteHistory();
  }
}

// 更新历史记录计数
function updateVoteHistoryCount() {
  const count = voteHistory.length;
  document.getElementById('vote-history-count').textContent = count > 0 ? `(${count})` : '';
}

// 渲染历史记录
function renderVoteHistory() {
  const panel = document.getElementById('vote-history-panel');

  if (voteHistory.length === 0) {
    panel.innerHTML = `
      <div class="empty-state">
        <div class="icon">📜</div>
        <div class="title">暂无历史记录</div>
        <div class="desc">投票后点击「保存此投票」即可保存到历史记录</div>
      </div>
    `;
    return;
  }

  const typeMap = {
    stock_long: '📈 股票多头',
    stock_short: '📉 股票空头',
    futures_long: '📦 期货多头',
    futures_short: '📦 期货空头',
    fund_buy: '🏦 买入基金',
    fund_sell: '🏦 赎回基金',
    macro: '🌍 宏观/大类',
    arbitrage: '⚖️ 套利/对冲'
  };
  const horizonMap = {
    short: '⚡ 短线',
    medium: '📅 中线',
    long: '🏔️ 长线'
  };

  panel.innerHTML = voteHistory.map(record => {
    const consensusColor = record.avgScore >= 7 ? 'var(--red)' : record.avgScore >= 4 ? 'var(--yellow)' : 'var(--green)';
    const consensus = record.avgScore >= 7 ? '强烈看多' : record.avgScore >= 5.5 ? '谨慎看多' : record.avgScore >= 4 ? '中性观望' : record.avgScore >= 2.5 ? '谨慎看空' : '强烈看空';
    const date = new Date(record.createdAt).toLocaleString('zh-CN');

    return `
      <div class="vote-history-item" data-vote-id="${record.id}">
        <div class="vote-history-header">
          <div class="vote-history-score" style="color:${consensusColor};">${record.avgScore.toFixed(1)}</div>
          <div class="vote-history-info">
            <div class="vote-history-text">${escapeHtml(record.text.slice(0, 100))}${record.text.length > 100 ? '...' : ''}</div>
            <div class="vote-history-meta">
              <span>${typeMap[record.type] || record.type}</span>
              <span>·</span>
              <span>${horizonMap[record.horizon] || record.horizon}</span>
              <span>·</span>
              <span>${date}</span>
            </div>
          </div>
          <div class="vote-history-actions">
            <button class="btn btn-secondary btn-sm" onclick="loadVoteFromHistory('${record.id}')">查看详情</button>
            <button class="btn btn-secondary btn-sm" style="color:var(--red);" onclick="deleteVoteHistory('${record.id}')">删除</button>
          </div>
        </div>
        <div class="vote-history-summary">
          <span style="color:${consensusColor};font-weight:600;">${consensus}</span>
          <span style="color:var(--text3);margin-left:8px;">${record.bullCount}多 · ${record.neutralCount}中 · ${record.bearCount}空</span>
        </div>
      </div>
    `;
  }).join('');
}

// 从历史加载投票
function loadVoteFromHistory(id) {
  const record = voteHistory.find(r => r.id === id);
  if (!record) return;

  // 恢复输入
  document.getElementById('vote-position').value = record.text;
  document.getElementById('vote-type').value = record.type;
  document.getElementById('vote-horizon').value = record.horizon;

  // 渲染卡片
  renderVoteInvestorsFromHistory(record);

  // 切换到当前投票 tab
  switchVoteTab('current');

  // 隐藏保存按钮（已保存过的）
  document.getElementById('btn-save-vote').style.display = 'none';

  showToast('已加载历史投票');
}

// 渲染历史投票的大师卡片
function renderVoteInvestorsFromHistory(record) {
  const consensusColor = record.avgScore >= 7 ? 'var(--red)' : record.avgScore >= 4 ? 'var(--yellow)' : 'var(--green)';
  const consensus = record.avgScore >= 7 ? '强烈看多' : record.avgScore >= 5.5 ? '谨慎看多' : record.avgScore >= 4 ? '中性观望' : record.avgScore >= 2.5 ? '谨慎看空' : '强烈看空';

  const bullCount = record.bullCount;
  const bearCount = record.bearCount;
  const tiltBull = Math.round(bullCount / record.investors.length * 5);
  const tiltBar = Array.from({length:5}, (_, i) => {
    if (i < tiltBull) return '<div class="vote-tilt-dot" style="background:var(--red);"></div>';
    return '<div class="vote-tilt-dot" style="background:var(--bg4);"></div>';
  }).join('');

  document.getElementById('vote-summary-bar').innerHTML = `
    <div class="vote-summary-bar" style="border-left:4px solid ${consensusColor};">
      <div class="vote-summary-score">
        <div class="vote-summary-score-num" style="color:${consensusColor};">${record.avgScore.toFixed(1)}</div>
        <div class="vote-summary-score-label">综合评分</div>
      </div>
      <div class="vote-summary-verdict" style="color:${consensusColor};">${consensus}</div>
      <div class="vote-tilt-indicator">
        <span style="color:var(--red);">${bullCount}多</span>
        ${tiltBar}
        <span style="color:var(--green);">${bearCount}空</span>
      </div>
      <div style="font-size:11px;color:var(--text3);min-width:60px;text-align-right;">${record.investors.length}位大师投票</div>
    </div>
  `;
  document.getElementById('vote-summary-bar').style.display = '';

  document.getElementById('vote-investors-grid').innerHTML = record.investors.map(r => {
    const fillColor = r.sentiment === 'bullish' ? 'var(--red)' : r.sentiment === 'bearish' ? 'var(--green)' : 'var(--text3)';
    const sentimentLabel = r.sentiment === 'bullish' ? '看多' : r.sentiment === 'bearish' ? '看空' : '中性';
    const sentimentBg = r.sentiment === 'bullish' ? 'rgba(239,68,68,0.15)' : r.sentiment === 'bearish' ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)';
    return `<div class="vote-investor-card ${r.sentiment}">
      <div class="vote-investor-header">
        <div class="vote-investor-avatar" style="background:${r.avatarBg};">${r.avatar}</div>
        <div>
          <div class="vote-investor-name">${r.name}</div>
          <div class="vote-investor-style">${r.style}</div>
        </div>
        <div style="margin-left:auto;">
          <span class="vote-investor-tag" style="background:${sentimentBg};color:${fillColor};">${sentimentLabel}</span>
        </div>
      </div>
      <div class="vote-investor-verdict" style="color:${fillColor};">${r.verdict}</div>
      <div class="vote-investor-score-wrap">
        <div class="vote-investor-score-bar">
          <div class="vote-investor-score-fill" style="width:${r.score * 10}%;background:${fillColor};"></div>
        </div>
        <div class="vote-investor-score-num" style="color:${fillColor};">${r.score.toFixed(1)}</div>
      </div>
      <div class="vote-investor-reason" style="color:var(--text3);">💬 (历史记录)</div>
    </div>`;
  }).join('');

  document.getElementById('vote-result').style.display = '';
  document.getElementById('vote-history-panel').style.display = 'none';
}

// 删除历史记录
function deleteVoteHistory(id) {
  if (!confirm('确定删除这条历史记录？')) return;
  voteHistory = voteHistory.filter(r => r.id !== id);
  DB.save('voteHistory_v1', voteHistory);
  updateVoteHistoryCount();
  renderVoteHistory();
  showToast('已删除');
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Toast 提示
function showToast(msg) {
  const existing = document.getElementById('vote-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'vote-toast';
  toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:10000;opacity:0;transition:opacity 0.3s;';
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.style.opacity = '1');
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function refreshCurrentPage() {
  if (currentPage === 'pe-fund') renderPEFund();
  if (currentPage === 'stock') renderStock();
  if (currentPage === 'futures') renderFutures();
  if (currentPage === 'articles') renderArticles();
  if (currentPage === 'attribution') renderAttribution();
  if (currentPage === 'calendar') renderCalendar();
}

