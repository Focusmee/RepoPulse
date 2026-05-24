# SBTI AI 开发者画像生成模块

SBTI 是 RepoPulse 的 AI 开发者行为风格测试层。它的外层是轻松、有传播感的人格结果，内核是可以转成 RepoPulse 日报 profile 的结构化画像。

第一版只做内部 persona/profile generator，不做 Web 服务、数据库、登录系统或复杂前端页面。

本文档放在 `src/persona/`，作为模块级操作手册。全局架构边界仍以 `docs/06-系统架构与模块边界.md` 为准，日报画像规范仍以 `docs/07-日报内容与个性化规范.md` 为准。

## 产品角色

SBTI 在 RepoPulse 里的角色是获客、onboarding 和 profile generator，不是传统心理测试。

它要完成三件事：

1. 用轻松、有传播感的问题降低用户第一次配置画像的门槛。
2. 把测试答案转成可被 RepoPulse 日报读取的 profile JSON。
3. 输出 `personaResult`，供未来网站、社交分享图、本地结果页或图文生成器使用。

推荐用户路径是：

```text
做 SBTI 测试
  -> 生成 RepoPulse profile
  -> 运行或订阅个性化日报
  -> 查看项目推荐理由、风险和行动建议
```

未来如果接入网站，网站只负责收集 answers、调用 `generateSbtiProfile({ answers })` 并展示结果。GitHub 采集、README 分析、排序和日报渲染仍由 RepoPulse 原有模块负责。

## 模块边界

SBTI 模块只负责：

```text
测试答案 answers
  -> SBTI 人格结果
  -> 细化标签 tags
  -> RepoPulse profile JSON
  -> 结果页数据 personaResult
```

它不采集 GitHub，不分析 README，不排序项目，也不渲染日报。现有日报命令继续通过 `--profile` 读取生成后的 JSON：

```bash
npm run report -- --profile config/profiles/sbti-generated.json --limit 8
```

因此耦合点只有 Profile Mapping：`src/persona/buildProfileFromSbti.js` 会把 SBTI 标签投影成当前 RepoPulse 已支持的字段。

相关文件：

- `src/persona/sbtiQuestions.js`：8 道题、选项和答案枚举。
- `src/persona/scoreSbtiAnswers.js`：答案校验、四维代码计算和细化标签生成。
- `src/persona/buildProfileFromSbti.js`：Profile Mapping，仅在这里知道 RepoPulse profile schema。
- `src/persona/renderPersonaResult.js`：未来前端或图文生成器使用的结果页数据。
- `src/persona/renderPersonaResultHtml.js`：把结果页数据渲染为本地 HTML。
- `src/persona/adaptRecommendationWeights.js`：把推荐权重转成解释提示和实验参数，不接入 ranker。
- `config/personas/sbti-types.json`：8 个核心人格、alias 和推荐权重词条。
- `scripts/generate-sbti-profile.js`：CLI 入口。

## 使用方式

使用内置模拟答案：

```bash
npm run sbti -- --sample
```

在终端逐题完成测试：

```bash
npm run sbti -- --interactive --output config/profiles/sbti-generated.json
```

从 JSON 读取答案并写入 profile：

```bash
npm run sbti -- \
  --input examples/sbti-answer.sample.json \
  --output config/profiles/sbti-generated.json
```

输出本地结果页：

```bash
npm run sbti -- --sample --result-output outputs/sbti-result.html
```

`config/profiles/sbti-generated.json` 是脚本生成的示例 profile，可重复覆盖，不作为手工维护画像。

## v1 样例包

SBTI v1 维护 3 个可复现样例，用于演示“答案 -> profile -> 结果页 -> 日报读取”的完整链路：

| 样例 | 人格 | 展示重点 |
| --- | --- | --- |
| `examples/sbti/sbti.answers.json` | SBTI / 火速开搞型 | developer tools、quick demo、半天验证 |
| `examples/sbti/smpc.answers.json` | SMPC / 产品化雷达型 | startup validation、产品机会、2-3 天验证 |
| `examples/sbti/rbpc.answers.json` | RBPC / 稳健落地派 | enterprise workflow、工作自动化、1-2 周试点 |

一次性生成 showcase：

```bash
npm run sbti:showcase
npm run sbti:showcase -- --output outputs/sbti-showcase
```

默认会在 `outputs/sbti-showcase/` 下为每个样例生成：

- `profile.json`：可被 RepoPulse 日报命令读取的 profile。
- `persona-result.json`：未来前端或图文生成器可消费的结果页数据。
- `persona-result.html`：本地可视化结果页。
- `manifest.json`：样例索引、人格结果、profile 路径和下一步 report 命令。

单个样例也可以继续走原有 CLI：

```bash
npm run sbti -- \
  --input examples/sbti/sbti.answers.json \
  --output config/profiles/sbti-generated.json \
  --result-output outputs/sbti-showcase/sbti/persona-result.html
```

验证日报读取：

```bash
npm run report -- --profile outputs/sbti-showcase/sbti/profile.json --limit 8 --dry-run
```

## SBTI v1 内部验收清单

SBTI v1 在进入真实用户验证或轻量网站入口前，必须先完成内部验收。验收目标不是证明人格测试“心理学正确”，而是确认它能稳定生成 profile、能被日报读取，并且 3 个代表人格在解释重点上有明显差异。

### 验收输入与生成物

固定使用 3 个样例：

| 样例 | 预期人格 | 重点场景 |
| --- | --- | --- |
| `examples/sbti/sbti.answers.json` | SBTI / 火速开搞型 | developer tools、quick demo、半天验证 |
| `examples/sbti/smpc.answers.json` | SMPC / 产品化雷达型 | startup validation、产品机会、2-3 天验证 |
| `examples/sbti/rbpc.answers.json` | RBPC / 稳健落地派 | enterprise workflow、工作自动化、1-2 周试点 |

运行：

```bash
npm run sbti:showcase
```

必须生成：

- `outputs/sbti-showcase/manifest.json`
- `outputs/sbti-showcase/sbti/profile.json`
- `outputs/sbti-showcase/sbti/persona-result.json`
- `outputs/sbti-showcase/sbti/persona-result.html`
- `outputs/sbti-showcase/smpc/profile.json`
- `outputs/sbti-showcase/smpc/persona-result.json`
- `outputs/sbti-showcase/smpc/persona-result.html`
- `outputs/sbti-showcase/rbpc/profile.json`
- `outputs/sbti-showcase/rbpc/persona-result.json`
- `outputs/sbti-showcase/rbpc/persona-result.html`

### 基础功能验收

| 检查项 | 通过标准 |
| --- | --- |
| 样例答案可解析 | 3 个答案文件都能通过 `generateSbtiProfile({ answers })` |
| 人格代码正确 | 分别生成 `SBTI`、`SMPC`、`RBPC` |
| profile 可被日报读取 | 3 个 `profile.json` 都能作为 `npm run report -- --profile ...` 的输入 |
| 结果页可打开 | 3 个 `persona-result.html` 都包含 headline、描述、画像摘要和推荐策略 |
| 溯源正确 | showcase 生成的 profile 中 `generated_by` 必须是 `scripts/generate-sbti-showcase.js` |
| 语言不是硬限制 | `preferred_languages` 可以为空数组，不能因为为空导致 profile normalization 或 report 失败 |
| 元数据保留 | `persona_type`、`persona_code`、`persona_name`、`persona_metadata`、`recommendationWeights` 必须保留 |
| 模块边界不破坏 | SBTI 不采集 GitHub、不分析 README、不直接改 ranker、不渲染日报 |

### 三人格差异审查

对 3 个 profile 分别跑 dry-run：

```bash
npm run report -- --profile outputs/sbti-showcase/sbti/profile.json --limit 8 --dry-run
npm run report -- --profile outputs/sbti-showcase/smpc/profile.json --limit 8 --dry-run
npm run report -- --profile outputs/sbti-showcase/rbpc/profile.json --limit 8 --dry-run
```

如果当前环境无法访问 GitHub，`fetch failed` 不算 profile 读取失败；但只能说明入口可用，不能说明真实推荐内容已通过验收。真实内容验收需要在可联网环境重新运行非 dry-run 报告。

人工审查重点：

| 人格 | 必须体现 | 不应出现 |
| --- | --- | --- |
| SBTI / 火速开搞型 | quickstart、demo 友好、低安装成本、半天内能验证 | 把大型源码深读当作默认推荐理由 |
| SMPC / 产品化雷达型 | 明确用户场景、可收费机会、SaaS / workflow 包装、最小验证 | 只讲技术热度，不讲谁会用、怎么验证 |
| RBPC / 稳健落地派 | license、维护状态、风险、生产试点边界、企业流程落地 | 忽略风险，或把早期高风险项目写成可直接上线 |

### profile 字段验收

每个样例至少检查这些字段：

| 字段 | SBTI 预期 | SMPC 预期 | RBPC 预期 |
| --- | --- | --- | --- |
| `persona_code` | `SBTI` | `SMPC` | `RBPC` |
| `time_budget` | `weekend` | `deep-study` | `deep-study` |
| `raw_time_budget` | `half_day` | `two_three_days` | `one_two_weeks` |
| `skill_level` | `intermediate` | `senior` | `senior` |
| `industry_tags` | `developer_tools` | `general_ai_apps` | `enterprise_workflow` |
| `report_explanation_style` | `action_first` | `validation_first` | `workflow_value` |

允许 topics 和 traits 随 mapping 迭代调整，但调整后必须仍能解释该人格的推荐差异。

### 内部验收记录模板

每次生成 showcase 后，可以复制下面模板做记录：

```markdown
## SBTI v1 内部验收 - YYYY-MM-DD

### 环境

- commit:
- Node:
- 是否联网:
- 是否配置 GitHub Token:

### 命令

- [ ] npm run check
- [ ] npm test
- [ ] npm run sbti:showcase
- [ ] npm run report -- --profile outputs/sbti-showcase/sbti/profile.json --limit 8 --dry-run
- [ ] npm run report -- --profile outputs/sbti-showcase/smpc/profile.json --limit 8 --dry-run
- [ ] npm run report -- --profile outputs/sbti-showcase/rbpc/profile.json --limit 8 --dry-run

### 样例结果

| 样例 | 人格是否正确 | profile 是否可读 | 结果页是否清楚 | 报告解释是否体现差异 | 结论 |
| --- | --- | --- | --- | --- | --- |
| SBTI |  |  |  |  |  |
| SMPC |  |  |  |  |  |
| RBPC |  |  |  |  |  |

### 发现的问题

- 

### 下一步修复

- 
```

输入格式：

```json
{
  "answers": {
    "q1": "A",
    "q2": "A",
    "q3": "A",
    "q4": "A",
    "q5": "developer_tools",
    "q6": "quick_demo",
    "q7": "half_day",
    "q8": "dont_know_how_to_replicate"
  }
}
```

## 输出字段

生成的 profile 同时包含两层字段：

- RepoPulse 现有日报会读取的字段：`profile_id`、`role`、`preferred_languages`、`interested_topics`、`learning_goals`、`skill_level`、`known_stack`、`weak_areas`、`time_budget`、`preferred_project_size`、`goal_priority`、`excluded_topics`、`daily_limit`。
- SBTI 元数据字段：`persona_type`、`persona_code`、`persona_raw_code`、`persona_name`、`industry_tags`、`expertise_level`、`raw_time_budget`、`tech_stack_friction`、`current_pain_points`、`preferred_project_traits`、`avoid_project_traits`、`report_explanation_style`、`recommendationWeights`、`persona_metadata`。

`preferred_languages` 第一版保持空数组。语言不是硬过滤条件；SBTI 主要通过 topics、goals、time budget 和 skill level 影响现有推荐流程。

## Profile Mapping

SBTI 的原始时间预算会保存在 `raw_time_budget`，同时映射到 RepoPulse 当前支持的 `time_budget`：

| SBTI 时间预算 | RepoPulse time_budget |
| --- | --- |
| `ten_minutes` | `quick-scan` |
| `thirty_minutes` | `quick-scan` |
| `half_day` | `weekend` |
| `two_three_days` | `deep-study` |
| `one_two_weeks` | `deep-study` |

SBTI 的专业程度会映射到 RepoPulse 当前支持的 `skill_level`：

| SBTI expertise_level | RepoPulse skill_level |
| --- | --- |
| `beginner_or_busy` | `junior` |
| `intermediate` | `intermediate` |
| `advanced_or_deep` | `senior` |

`recommendationWeights` 暂时只是画像元数据，不会改变现有 ranker。`adaptRecommendationWeights()` 只把它转换成解释提示和实验参数；后续如果要让不同人格直接影响排序，需要新增显式实验开关。

## 扩展词条与比重

权重默认以 `1.0` 为中性，`>1.0` 表示该人格更重视该信号，`<1.0` 表示弱化该信号。

| 词条 | 含义 | 中性比重 |
| --- | --- | --- |
| `learning_value` | 项目是否值得学习、复刻和拆解 | `1.0` |
| `demo_friendliness` | 是否容易在短时间跑出可展示 demo | `1.0` |
| `documentation_quality` | README、示例、教程和架构说明质量 | `1.0` |
| `trend_signal` | 是否代表新方向、生态变化或开发范式 | `1.0` |
| `productization_potential` | 是否容易包装成工具、SaaS 或业务流程 | `1.0` |
| `risk_penalty` | 风险对推荐排序的惩罚敏感度 | `1.0` |
| `setup_cost_penalty` | 安装、部署和外部依赖成本惩罚敏感度 | `1.0` |
| `architecture_clarity` | 架构、模块边界和源码入口是否清晰 | `1.0` |
| `integration_potential` | 是否方便通过 API、SDK、CLI、MCP 或工作流接入 | `1.0` |
| `portfolio_value` | 是否适合转化为作品集或简历项目 | `1.0` |
| `clear_use_case` | 是否有明确用户场景和真实问题 | `1.0` |
| `ecosystem_signal` | 是否反映生态位、同类工具变化或新范式迁移 | `1.0` |
| `license_clarity` | 许可证是否清楚，是否适合复刻、商用或团队试点 | `1.0` |
| `maintenance_signal` | 维护活跃度、issue 状态、版本发布和长期可用性信号 | `1.0` |

## 未来服务化方向

核心接口已经是纯函数：

```js
import { generateSbtiProfile } from "./index.js";

const result = generateSbtiProfile({ answers });
```

未来拆成 Web 或服务时，可以直接复用该接口：

- Web 表单或本地可视化窗口只负责收集 `answers`。
- 服务 API 只负责调用 `generateSbtiProfile` 并返回 `profile` 与 `personaResult`。
- RepoPulse 日报仍然只消费 profile JSON，保持与测试系统隔离。
