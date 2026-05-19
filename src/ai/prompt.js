export const LEARNING_DIMENSIONS = [
  {
    id: "documentation_quality",
    label: "文档清晰度",
    weight: 0.2,
    question: "README、quickstart、usage、examples、docs 是否足够帮助用户快速开始？"
  },
  {
    id: "code_structure_readability",
    label: "工程结构可读性",
    weight: 0.2,
    question: "是否能从文档、目录或描述中看出模块边界、核心路径和架构线索？"
  },
  {
    id: "technical_representativeness",
    label: "技术代表性",
    weight: 0.15,
    question: "是否代表某类技术趋势、经典工程模式或值得学习的生态方向？"
  },
  {
    id: "practical_transfer_value",
    label: "实战迁移价值",
    weight: 0.15,
    question: "是否适合改造成 demo、工具、简历项目、业务应用或产品想法？"
  },
  {
    id: "maturity_signal",
    label: "成熟度信号",
    weight: 0.1,
    question: "stars、forks、license、release、维护活跃度是否支撑投入学习？"
  },
  {
    id: "profile_goal_fit",
    label: "用户目标匹配",
    weight: 0.1,
    question: "是否匹配当前用户画像中的语言、topic、学习目标和排除项？"
  },
  {
    id: "overall_judgement",
    label: "综合判断",
    weight: 0.1,
    question: "综合以上证据后，它作为学习材料是否值得投入时间？"
  }
];

export function buildOpenAIMessages(input, { retryMode = false } = {}) {
  return [
    {
      role: "system",
      content: [
        "你是 RepoPulse 的开源项目学习价值分析器。",
        "你的目标不是复述 GitHub 热度，而是帮助开发者判断一个项目是否值得学习、如何学习、有什么风险。",
        "只允许基于输入中的 repo、trend、documents、user_profile 判断。",
        "如果证据不足，必须降低 confidence.score，并在 risks 中说明不确定性。",
        "输出必须是严格 JSON，不要输出 Markdown，不要在 JSON 外添加任何文字。",
        retryMode
          ? "这是一次 JSON parse 失败后的重试。请输出更短但完整的严格 JSON：不要代码块、不要注释、不要尾随逗号、不要省略必填字段。"
          : ""
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        task: retryMode
          ? "上一次模型输出不是合法 JSON。请重新评估这个 GitHub 仓库，并只返回可被 JSON.parse 解析的 JSON 对象。"
          : "评估这个 GitHub 仓库是否值得当前用户学习，并按 schema 输出。",
        scoring_rubric: {
          score_range: "所有分数都是 0-100 的整数",
          final_learning_score:
            "learning_value.score 必须按 breakdown 的 weight 加权计算，允许四舍五入，不能只凭主观印象。",
          dimensions: LEARNING_DIMENSIONS
        },
        output_schema: {
          schema_version: "1.2",
          summary: "一句话说明项目用途，少于 40 个中文字",
          problem_solved: "它解决的问题",
          why_it_matters_now: "为什么现在值得关注",
          learning_value: {
            score: "0-100",
            level: "low | medium | high",
            breakdown: [
              {
                id: "documentation_quality",
                label: "文档清晰度",
                weight: 0.2,
                score: "0-100",
                reason: "为什么给这个分",
                evidence: "输入中的具体证据"
              }
            ],
            reasons: [{ reason: "推荐理由", evidence: "输入中的证据" }]
          },
          trend_explanation: { score_hint: "高 | 中 | 低", signals: ["信号"] },
          audience: ["适合的人群"],
          profile_fit: { score: "0-100", why_for_this_user: "为什么适合当前用户画像" },
          learning_cost: {
            level: "low | medium | high",
            investment_fit_score: "0-100，越高表示越适合当前用户现在投入，不表示成本越高",
            estimated_effort: "30 分钟了解 / 半天跑通 / 2-3 天深入",
            prerequisites: ["需要补齐的前置知识"],
            blockers: ["可能卡住用户的环境、依赖、源码规模或概念门槛"],
            why_for_this_user: "结合当前画像解释为什么成本低/中/高"
          },
          recommended_reading_path: [{ step: 1, action: "1 到 3 个下一步动作，例如先读 README 某节或让 AI 分析某个入口模块", goal: "目标" }],
          project_idea: "可转化的应用或简历项目想法",
          risks: [{ risk: "最多 3 条具体风险，必须说明触发依据或影响", severity: "low | medium | high" }],
          confidence: { score: "0-100", reason: "置信度原因" }
        },
        quality_rules: [
          "每个 learning_value.breakdown 项都必须有 reason 和 evidence。",
          "learning_value.reasons 必须 2-4 条，每条都必须有 evidence。",
          "recommended_reading_path 必须 1-3 步，并且可执行；优先写下一步动作，不要写长学习计划。",
          "recommended_reading_path 至少包含一种具体入口，例如 README 的章节、examples、src/packages 入口、或 clone 后交给 AI 分析的模块。",
          "learning_cost.level 描述学习成本高低；learning_cost.investment_fit_score 描述当下投入适配度，分数越高越适合投入。",
          "学习成本不是项目风险：项目规模、环境复杂、陌生技术栈等写入 learning_cost；license、维护、API 稳定性等写入 risks。",
          "risks 至少 1 条，最多 3 条；没有明显风险也要写出需要复核的不确定性。",
          "risks 优先覆盖 API 兼容/破坏性变更、数据安全/隐私、license、外部服务依赖、项目规模、维护节奏或 release 稳定性。",
          "风险必须具体，不要只写“项目较新”“学习成本高”“存在不确定性”。",
          "不要编造 README、release、examples、架构或功能。"
        ],
        input
      })
    }
  ];
}
