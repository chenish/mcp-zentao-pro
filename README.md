# zentao-mcp-agent (ZenTao MCP & CLI)

🚀 **专为现代研发团队打造的 ChatOps 效能中枢**

本项目不仅是一个简单的 API 封装，更是一个基于 `@modelcontextprotocol/sdk` 开发的标准 **MCP Server**。依托本项目独创的 **“MVC 视角 + RESTful 精准写入”** 混动架构，完美穿透禅道底层的跨项目严苛隔离与分页限制，赋能大模型（如 OpenClaw）无缝实现极速研发管理。

---

## 🌟 九大核心功能矩阵 (Core Features)

> **💡 说明：** 本项目底层抹平了严苛的产研隔离、鉴权校验与分页限制。以下九大场景中，部分已直接固化为原生工具 (Tool)，部分需结合定时系统 (Cron) 与高级提示词来实现。

### 一、 数据透视与日常跟进 (解决信息孤岛)

#### 1. 全局待办透视 (God-Mode Dashboard)
- **【功能清单】**：
  - [x] 支持拉取指定用户的全量待办数据，包含 **任务 (Tasks)、需求 (Stories)、缺陷 (Bugs)**。
  - [x] 支持跨越产品和迭代隔离，按照真实处理状态、指派人进行多维组合查询。
  - [x] 支持区分“名下/指派视角”和“管理聚合视角”：`my tasks --assign <账号>` 保持官方指派地盘语义，`manage --users <成员>` 聚合当前待办与时间窗内完成项。
  - [x] 支持以中文友好列名输出管理视角结果，便于主管直接阅读和交给大模型做总结。
  - [x] 支持时间增强筛选：管理视角可按完成时间窗、截止日期范围、延期风险进行组合过滤。
  - [x] 支持跨类型状态语义映射：`doing,wait,done` 在管理视角下可同时覆盖任务、需求、Bug 的对应待处理/已完成状态。
  - [x] 支持本地团队缓存：可先保存团队名，再通过 `--team-name` 直接复用团队成员列表。
  - [x] 支持在输出中明确展示“当前查询类型”和“过滤条件”，避免 `--type tasks` 这类定向查询被误读为全量统计。
- **【CLI 调用示例】**：
  - `zentao-cli my tasks` (基础：拉取指派给我的任务)
  - `zentao-cli my bugs` (分类：拉取指派给我的缺陷清单)
  - `zentao-cli my stories` (聚合：一键获取我名下的业务需求)
  - `zentao-cli my tasks --status wait` (待开始视角：只看当前待领取/待处理任务)
  - `zentao-cli my bugs --status active` (缺陷过滤：只看当前激活中的缺陷)
  - `zentao-cli my stories --status active` (需求过滤：只看激活中的业务需求)
  - `zentao-cli my tasks --assign zhangsan` (查岗：跨项目查阅张三的任务列表)
  - `zentao-cli my tasks --status doing` (过滤：精确提取张我的进行中的任务)
  - `zentao-cli my tasks --assign zhangsan --status doing` (查岗：跨项目查阅张三进行中的代办)
  - `zentao-cli manage --users zhangsan` (管理视角：聚合张三当前相关的任务、需求、缺陷)
  - `zentao-cli manage --users zhangsan,lisi --type tasks` (团队视角：只看多人当前任务池)
  - `zentao-cli manage --users zhangsan --type bugs` (管理视角：只看单人的缺陷清单)
  - `zentao-cli manage --users zhangsan --type stories` (管理视角：只看单人的需求清单)
  - `zentao-cli manage --users zhangsan --type tasks --status doing` (管理视角：只看进行中的任务)
  - `zentao-cli manage --users zhangsan --type tasks --status doing,wait` (多状态视角：同时查看进行中与待开始任务)
  - `zentao-cli manage --users zhangsan,lisi --type tasks,bugs` (复合视角：同时汇总团队任务与缺陷)
  - `zentao-cli manage --users 张三,李四 --date-from 2026-03-12 --date-to 2026-03-12` (时间窗视角：只补入指定日期内完成/关闭的任务)
  - `zentao-cli manage --users 张三,李四 --type tasks --deadline-to 2026-03-16` (临期视角：筛出周末前到期任务)
  - `zentao-cli manage --users 张三,李四 --type tasks --overdue-only` (风险视角：只看已延期任务)
  - `zentao-cli manage --team-name "规划组" --type tasks` (团队缓存视角：直接按团队名查询当前任务池)
  - `zentao-cli manage --team-name "规划组" --type tasks --deadline-to 2026-03-16` (团队缓存 + 临期筛选：直接查周末前到期任务)
  - `zentao-cli team save --name "规划组" --users "zhangsan,lisi,wangwu"` (团队缓存：保存团队别名)
  - `zentao-cli team list` (团队缓存：查看全部已保存团队)
  - `zentao-cli team show --name "规划组"` (团队缓存：查看团队成员详情)
  - `zentao-cli team delete --name "规划组"` (团队缓存：删除本地团队别名)
- **【口径说明】**：
  - `my tasks --assign <账号>`：保持官方“指派/名下”视角，适合查某人的当前个人地盘。
  - `manage --users <成员列表>`：走管理聚合视角，默认返回“当前未完成项 + 今日完成/关闭项”，适合主管做团队跟进。
  - `manage --users <成员列表> --date-from --date-to`：适合做周报，统计“当前执行中 + 时间窗内完成/关闭”的团队工作量。
  - `manage --users <成员列表> --deadline-to` / `--overdue-only`：适合做延期与临期催办。
  - `manage --users <成员列表> --status doing,wait,done`：在管理视角下表示“待处理 + 已完成”这类跨类型工作状态，不会只局限于任务字段字面值。
  - `manage --team-name <团队名>`：适合稳定团队的日常复查，避免每次重复输入成员名单。
  - `manage --type tasks|stories|bugs`：总计会按当前查询类型展示，不代表被省略的类型查询失败。
- **【OpenClaw 使用场景】**：
  用户在聊天框输入：*“查一下张三目前手上有哪些进行中的 Bug，有没有延期的？”* -> Agent 跨迭代拉取全量缺陷并分析回复。

#### 2. 链接智能解析 (Smart Link Resolver)
- **【功能清单】**：
  - [x] 支持直接从夹杂着对话内容的凌乱文本中用正则提取核心禅道 URL。
  - [x] 无缝请求解析器瞬间抓取任务详情、状态、优先级及骨干内容。
- **【CLI 调用示例】**：
  - `zentao-cli view "大家看一下这个链路报错：http://zentao.yourcompany.com/task-view-123.html"`
  - `zentao-cli view "请帮我看看这个缺陷：https://zentao.yourcompany.com/bug-view-456.html"` (自动识别 Bug 链接)
  - `zentao-cli view "需求链接在这里 story-view-789.html，帮我总结一下"` (从混杂文本中提取需求链接)
- **【OpenClaw 使用场景】**：
  用户在群聊丢出杂乱链接，Agent 会直接抽丝剥茧为您解构出背后的禅道实体当前状态供解答。

#### 3. 晨会自动播报 (Morning Standup Radar)
- **【功能清单】**：
  - [x] 按指定团队成员聚合全量待办，分类输出 **已超期 / 今明到期 / 高优** 三类预警清单。
  - [x] 支持中文名/账号自动映射，批量并发拉取，供大模型直接生成晨会通报。
  - [x] 晨会、负荷、停滞三类命令已复用管理视角底座，跨用户、跨类型口径保持一致。
  - [x] 支持通过 `--pri-max` 调整晨会高优先级阈值，并在预警清单中展示任务进度百分比。
  - [x] 晨会会自动忽略无截止日期的需求，避免将弱时效事项误计入预警。
- **【CLI 调用示例】**：
  - `zentao-cli morning-check --team zhangsan,lisi,wangwu` (综合晨报：生成超期·临期·高优三色预警)
  - `zentao-cli morning-check --team 张三,李四` (支持中文姓名，自动映射账号)
  - `zentao-cli morning-check --team zhangsan,lisi,wangwu,赵六` (团队晨会：多人并发扫描当日风险清单)
  - `zentao-cli morning-check --team-name "规划组"` (团队缓存晨会：直接按团队名生成晨会风险清单)
  - `zentao-cli morning-check --team-name "规划组" --pri-max 1` (高优收敛视角：晨会只关注 P1 事项)
- **【OpenClaw 使用场景】**：
  每日清晨，Cron 触发 `morning-check` 拉取多维风险清单交给大模型，生成一份完整的晨会催办通报发至工作群。

---

### 二、 极速执行与流转 (降低流程损耗)

#### 4. 对话式极速建单 (Chat-to-Task)
- **【功能清单】**：
  - [x] 支持查询活跃项目 (`getProjects`) 及迭代，或按需新建当月执行冲刺 (`createExecution`)。
  - [x] 基于指定迭代一键创建任务，支持自动映射人员中文名至系统底层账号。
  - [x] 智能容错与补全：自动推端补齐必填的预计开始时间、截止时间、预估工时。
  - [x] 支持按需求拆分任务：当未显式传入 `--execId` 时，可使用 `--storyId + --projectId` 自动复用当月执行；若当月执行不存在，则复制上个执行配置后自动创建。
  - [x] 支持在建任务时补充优先级与任务描述；`--pri` 默认值为 `3`。
- **【CLI 调用示例】**：
  - `zentao-cli projects` (摸底：获取我归属的项目库)
  - `zentao-cli executions --project 577` (历史示例保留：表达“按项目过滤迭代”的意图；当前 CLI 实参请使用 `--projectId`)
  - `zentao-cli executions --projectId 577` (精确过滤：只看指定项目下的活跃执行)
  - `zentao-cli executions --projectId 577 --status doing` (二次过滤：只看进行中的执行)
  - `zentao-cli execution create --projectId 577 --name "2026年3月常规迭代"` (兜底：动态建档补缺)
  - `zentao-cli execution create --projectId 577 --name "2026年3月常规迭代" --begin "2026-03-17" --end "2026-03-24"` (手动指定冲刺起止日期)
  - `zentao-cli execution create --projectId 577 --name "2026年3月常规迭代" --days 6` (自定义可用工作日)
  - `zentao-cli task create --execId 123 --name "网关排查" --assign "zhangsan"` (瞬时极简派单)
  - `zentao-cli task create --execId 123 --name "网关排查" --assign "zhangsan" --pri 2 --desc "补充任务描述"` (带描述派单：创建时直接写明任务背景与优先级)
  - `zentao-cli task create --execId 123 --name "多人联调排查" --assign "zhangsan,lisi,wangwu" --estimate 6` (多人并行：多人执行人默认创建为多人并行任务，总预估按成员平均分摊)
  - `zentao-cli task create --execId 123 --name "多人串行验收" --assign "zhangsan,lisi" --mode linear --team-estimates 3,5` (多人串行：显式指定串行模式与每位成员预估)
  - `zentao-cli task create --execId 123 --name "全量压测" --assign "李四" --estimate 8 --deadline "2026-03-20"` (精细派发：明确指定 8 小时预估工时和特定截止日期)
  - `zentao-cli task create --execId 123 --name "接口联调" --assign "张三" --estimate 4` (中等精度派单：指定预估工时，截止日期走默认值)
  - `zentao-cli task create --storyId 12072 --projectId 281 --name "数据库改造脚本适配" --assign "zhangsan" --estimate 8 --pri 2` (需求拆分：自动检查当月执行，必要时复制上个执行后建任务)
  - `zentao-cli task create --storyId 12072 --projectId 281 --templateExecId 5825 --executionName "2026年03月常规迭代" --name "数据库改造脚本适配" --assign "zhangsan" --desc "从需求拆分的研发任务"` (精细拆分：显式指定执行模板、新执行名称与任务描述)
- **【OpenClaw 使用场景】**：
  用户输入：*“把路由限流排查发给李四，预计4个小时，后天完成。”* -> Agent 瞬间提取意图补缺自动建单。

#### 5. 对话式快捷报工 (Seamless Effort Logging)
- **【功能清单】**：
  - [x] 支持为指定任务直接登记实际消耗工时。
  - [x] 支持为指定任务直接登记实际消耗工时并附加工作说明备注。
  - [ ] 支持为指定任务直接附加工作说明备注。
- **【CLI 调用示例】**：
  - `zentao-cli task effort --taskId 69704 --consumed 2` (极简报工：给 69704 任务快速登记 2 小时消耗)
  - `zentao-cli task effort --taskId 69704 --consumed 2.5 --desc "修复了NPE异常"` (登记并附加进度)
  - `zentao-cli task effort --taskId 69704 --desc "修复了NPE异常"` (⚠️后续优化 单独登记任务说明 可能不会生效)
- **【当前 CLI 参数说明】**：
  - 当前已稳定支持的 `task effort` 组合为 `--taskId + --consumed`，可选 `--desc` 追加说明。
  - “只写说明不填耗时”的形态仍属于规划中的增强能力，文档示例先保留作为目标能力说明。
- **【当前已知限制】**：
  - `task effort --taskId <id> --desc "..."` 这种“只写说明不填耗时”的调用，在当前禅道环境中接口虽可返回成功，但页面历史不会稳定落备注，因此暂不视为可用能力。
  - `story update --storyId <id> --status active` （⚠️后续优化 在当前禅道环境中尚未稳定生效）
- **【OpenClaw 使用场景】**：
  用户输入：*“帮我给69704任务报个工，花了 2 小时写核心逻辑。”* -> Agent 精准提取 ID 与耗时写入底层。

#### 6. 极简状态流转 (State Machine Control)
- **【功能清单】**：
  - [x] 支持根据任务名称自动获取任务ID
  - [x] 支持修改任务进行中、已完成等生命周期状态。
  - [x] 支持修改需求进行中、已完成等生命周期状态。
  - [x] 支持修改缺陷进行中、已完成等生命周期状态。
  - [x] 支持责任人转交操作。
  - [x] 支持单次交互中复合追加评论。
- **【CLI 调用示例】**：
  - `zentao-cli task update --taskId 123 --status done  --comment "已完成转测"`
  - `zentao-cli task find --name "网关排查"` (按名称检索当前账号范围内的任务，并返回可直接用于流转的任务 ID)
  - `zentao-cli task find --name "接口联调" --owner zhangsan,lisi` (按指定成员范围查任务名称，支持多人)
  - `zentao-cli task find --name "接口联调" --team-name "规划组"` (按团队缓存范围查任务名称)
  - `zentao-cli task find --name "问题排查" --team-name "规划组" --status doing,wait` (仅在进行中/待开始任务里查找)
  - `zentao-cli task update --taskId 123 --status done` (单项流转：仅将任务状态标记为已完成)
  - `zentao-cli task update --taskId 123 --status closed --comment "验证通过，执行关闭"` (关闭任务：直接走关闭节点)
  - `zentao-cli task update --taskId 123 --status doing --comment "开始处理"` (启动任务：将任务切换为进行中)
  - `zentao-cli task update --taskId 123 --assign zhangsan` (任务转交：仅将任务丢给张三处理)
  - `zentao-cli task update --taskId 123 --status doing --assign zhangsan --comment "代码已提交，转交测试验证"` (复合流转：完成、转交、加备注一气呵成)
  - `zentao-cli task update --taskId 69705 --comment "我是Agent：单纯追加一条排查进展记录"` (轻量打卡：不修改状态与指派人，仅填报一条无耗时的进展留言)
  - `zentao-cli task update --taskId 69705 --comment "问题已修复，耗时半天" --consumed 4` (精确进度：单独填报耗时并留下排查过程备注)
  - `zentao-cli story update --storyId 12072 --status closed --comment "需求已验收完成"` (需求流转：将需求直接关闭)
  - `zentao-cli story update --storyId 14526 --status active --comment "重新激活继续推进"` (需求重启：将已关闭需求重新激活)
  - `zentao-cli story update --storyId 12072 --assign zhangsan --comment "转交继续跟进"` (需求转交：将需求交给指定负责人)
  - `zentao-cli bug update --bugId 11071 --status done --comment "缺陷已修复完成"` (缺陷流转：将 Bug 置为已解决)
  - `zentao-cli bug update --bugId 11071 --status closed --comment "验证通过，关闭缺陷"` (缺陷关闭：验证后关闭 Bug)
  - `zentao-cli bug update --bugId 11071 --status active --comment "重新激活继续跟踪"` (缺陷重开：将 Bug 重新激活)
  - `zentao-cli bug update --bugId 11071 --assign zhangsan --comment "转交继续跟进"` (缺陷转交：将 Bug 交给指定负责人)

- **【OpenClaw 使用场景】**：
  用户输入：*“排查做完了，变成已完成并转给王五跟进。”* -> Agent 直接驱动全套状态流转。

---

### 三、 敏捷度量与风险预警 (前置风险干预)

#### 7. 派发前负荷参考雷达 (Workload Radar)
- **【功能清单】**：
  - [x] 测算目标员工当前并行任务数与预估剩余总工时，以备派单者参考（**软性提示，不强制阻断**）。
  - [x] 支持一次查询多人，单独呈现各人承载量，辅助派单决策。
  - [x] 统一复用管理视角口径，任务与 Bug 会在输出中显式区分类型。
  - [x] 输出 P1 未完成任务数量、任务平均进度与单项进度百分比，便于快速掌握负荷质量。
- **【CLI 调用示例】**：
  - `zentao-cli load --assign zhangsan` (单人：查看张三的当前任务与剩余工时)
  - `zentao-cli load --assign 张三,李四,王五` (批量：一次对比多人负荷状况，支持中文名)
  - `zentao-cli load --assign zhangsan,lisi,wangwu,zhaoliu` (团队派发前摸底：比较多人承载量)
  - `zentao-cli load --team-name "规划组"` (团队缓存负荷视角：直接比较团队承载量)
- **【OpenClaw 使用场景】**：
  分配任务前，Agent 调用 `load` 拉取候选人的当前承重信息，由派单者结合实际节奏自行决策是否分派。

#### 8. 停滞单据排查 (Stagnant Tasks Patrol)
- **【功能清单】**：
  - [x] 精准排查指定人员名单中，长期处于进行中但超 N 天无任何更新记录的停滞单据。
  - [x] 支持按人员范围圈选，避免大团队全局扫描产生噪音干扰。
- **【CLI 调用示例】**：
  - `zentao-cli stagnant --assign zhangsan --days 3` (单人：排查张三 3 天未动的停滞任务)
  - `zentao-cli stagnant --assign 张三,李四 --days 5` (批量：5 天无进展的静默单据一网打尽)
  - `zentao-cli stagnant --assign zhangsan,lisi,wangwu --days 7` (周维度巡检：排查一周无进展的停滞单据)
  - `zentao-cli stagnant --team-name "规划组" --days 5` (团队缓存停滞排查：按团队名做静默巡检)

#### 9. 自动化周报摘要 (Weekly Synthesis)
- **【功能清单】**：
  - [x] 自动聚合团队当周已交付的高优需求与重大修复缺陷。
  - [x] 自动统计团队本周完成任务数、需求数、缺陷数，并输出完整完成任务清单。
  - [x] 支持按统一优先级阈值过滤高优事项，默认仅保留 `P1` 价值事项；Bug 还可额外按严重程度命中，且默认跟随该阈值。
  - [x] 支持按团队缓存或多人名单批量生成周报，并输出成员维度交付汇总。
  - [x] 支持通过 `--view summary|full` 区分“统计摘要”与“详情报表”，默认采用更适合大模型消费的 `summary` 视图。
  - [x] 自动输出“总交付 / 高优交付 / 本周待完成任务”三类核心统计，方便主管快速掌握全周盘子。
  - [x] 自动按自然周识别周一到周日；即使在周四、周五、周六查询，也会把本周周末截止但尚未完成的任务纳入统计。
- **【CLI 调用示例】**：
  - `zentao-cli weekly-synthesis --team zhangsan,lisi,wangwu` (周报底座：按成员名单生成本周交付摘要)
  - `zentao-cli weekly-synthesis --team 张三,李四` (支持中文姓名：自动映射账号生成周报素材)
  - `zentao-cli weekly-synthesis --team-name "规划组"` (团队缓存周报：直接按团队名拉取本周交付)
  - `zentao-cli weekly-synthesis --team-name "规划组" --date-from 2026-03-09 --date-to 2026-03-13` (自定义时间窗：生成指定周的交付摘要)
  - `zentao-cli weekly-synthesis --team-name "规划组" --pri-max 1` (高价值视角：只保留 P1 事项，Bug 严重程度默认同步收敛)
  - `zentao-cli weekly-synthesis --team-name "规划组" --view summary` (摘要模式：只输出统计信息与成员汇总)
  - `zentao-cli weekly-synthesis --team-name "规划组" --view full` (详情模式：输出完整任务、需求、Bug 清单)
- **【OpenClaw 使用场景】**：
  大模型自动化扫面全组千锤百炼后汇聚成的完结清单，进行抽象总结归档汇报。

---

## 🛠️ API 调试与开发者指南

1. **附赠 Postman 集合文件**
   本项目代码仓库 `doc/postman/` 目录下提供了一份 `Zentao_V4_Final.postman_collection.json`。该集合固化了所有登录逻辑、MVC 解析黑科技与核心 API 断言，建议开发者导入直接进行冒烟测试。
2. **双重鉴权架构守则 (极度重要！)**
   - **RESTful 接口** (`/api.php/v1/...`)：请求头必须携带 `Token: xxx`。
   - **MVC 接口** (`.json` 结尾)：请求头必须携带 `zentaosid: xxx`。
   - **用户地盘读取口径**：跨用户读取必须优先走官方 `user-<type>-<userId>.json` 及其分页变体，不能退化为脚本拼装或纯 REST 列表代替。
   - **发布前安全检查补充**：如需在本地扩展额外敏感词，请使用未跟踪的 `.security-denylist.json`，不要把真实姓名或账号直接写进仓库。
3. **项目构建测试**
   - `npm install`
   - `npm run build`
   - `node dist/cli.js login --url <您的禅道地址> --account <账号> --pwd <密码>`
   - `node dist/cli.js my tasks` 等于 `zentao-cli my tasks` 
   - `node dist/cli.js manage --users zhangsan`
   - `node dist/cli.js team save --name "规划组" --users "zhangsan,lisi"`
    - 其他功能同上 
---

## 📚 CLI 参数速查 (CLI Cookbook)

### 1. 登录与环境
- `zentao-cli login --url "http://127.0.0.1:8080" --account "zhangsan" --pwd "******"`：登录并写入本地配置。
- `node dist/cli.js login --url "http://127.0.0.1:8080" --account "zhangsan" --pwd "******"`：本地构建后直接验证登录链路。
- 登录成功后，本地默认写入 `~/.config/zentao/.env`，其中包含 `URL / Token / zentaosid`，以及用于静默重登的账号密码（base64 形式保存）。
- 后续命令默认优先使用已登录的 `Token + zentaosid`；若鉴权失效，会自动使用本地保存的账号密码重登并重试一次原请求。
- 静默重登成功后，会把最新的 `Token + zentaosid` 回写到本地配置，避免下一个命令再次先撞一次鉴权失败。
- 该机制对个人视图、管理视角、晨报、负荷检查、停滞排查、周报等命令统一生效，不需要分别单独处理登录态。

### 2. 智能查看
- `zentao-cli view "请看这个任务：http://zentao.local/task-view-123.html"`：从文本中抽取任务链接并解析详情。
- `zentao-cli view "bug-view-456.html"`：直接解析缺陷链接。
- `zentao-cli view "story-view-789.html"`：直接解析需求链接。

### 3. 个人与跨人地盘
- `zentao-cli my tasks`
- `zentao-cli my tasks --status doing`
- `zentao-cli my tasks --assign zhangsan`
- `zentao-cli my tasks --assign 张三 --status wait`
- `zentao-cli my bugs --status active`
- `zentao-cli my stories --status active`

### 4. 管理聚合视角
- `zentao-cli manage --users zhangsan`
- `zentao-cli manage --users 张三,李四`
- `zentao-cli manage --team-name "规划组"`
- `zentao-cli manage --users 张三,李四 --type tasks`
- `zentao-cli manage --users 张三,李四 --type tasks,bugs`
- `zentao-cli manage --users 张三 --type stories`
- `zentao-cli manage --users 张三 --type bugs`
- `zentao-cli manage --users 张三 --type tasks --status doing`
- `zentao-cli manage --users 张三 --type tasks --status doing,wait`
- `zentao-cli manage --users 张三,李四 --date-from 2026-03-10 --date-to 2026-03-14`
- `zentao-cli manage --users 张三,李四 --type tasks --deadline-to 2026-03-16`
- `zentao-cli manage --users 张三,李四 --type tasks --overdue-only`
- `zentao-cli manage --team-name "规划组" --type tasks --deadline-to 2026-03-16`

### 5. 项目与执行
- `zentao-cli projects`
- `zentao-cli executions`
- `zentao-cli executions --projectId 577`
- `zentao-cli executions --projectId 577 --status doing`
- `zentao-cli execution create --projectId 577 --name "2026年3月常规迭代"`
- `zentao-cli execution create --projectId 577 --name "2026年3月常规迭代" --begin "2026-03-17" --end "2026-03-24"`
- `zentao-cli execution create --projectId 577 --name "2026年3月常规迭代" --days 6`

### 6. 创建任务
- `zentao-cli task create --execId 123 --name "网关排查" --assign "zhangsan"`
- `zentao-cli task create --execId 123 --name "网关排查" --assign "zhangsan" --pri 2 --desc "补充任务描述"`
- `zentao-cli task create --execId 123 --name "多人联调排查" --assign "zhangsan,lisi,wangwu" --estimate 6`
- `zentao-cli task create --execId 123 --name "多人串行验收" --assign "zhangsan,lisi" --mode linear --team-estimates 3,5`
- `zentao-cli task create --execId 123 --name "接口联调" --assign "张三" --estimate 4`
- `zentao-cli task create --execId 123 --name "全量压测" --assign "李四" --estimate 8 --deadline "2026-03-20"`
- `zentao-cli task create --storyId 12072 --projectId 281 --name "数据库改造脚本适配" --assign "zhangsan" --estimate 8 --pri 2`
- `zentao-cli task create --storyId 12072 --projectId 281 --templateExecId 5825 --executionName "2026年03月常规迭代" --name "数据库改造脚本适配" --assign "zhangsan" --desc "从需求拆分的研发任务"`

### 7. 报工
- `zentao-cli task effort --taskId 69704 --consumed 2`
- `zentao-cli task effort --taskId 69704 --consumed 2.5 --desc "修复了NPE异常"`

### 8. 状态流转与评论
- `zentao-cli task update --taskId 123 --status doing --comment "开始处理"`
- `zentao-cli task update --taskId 123 --status done --comment "已完成转测"`
- `zentao-cli task update --taskId 123 --status closed --comment "验证通过，执行关闭"`
- `zentao-cli task find --name "网关排查"`
- `zentao-cli task find --name "接口联调" --owner zhangsan,lisi`
- `zentao-cli task find --name "接口联调" --team-name "规划组"`
- `zentao-cli task find --name "问题排查" --team-name "规划组" --status doing,wait`
- `zentao-cli task update --taskId 123 --assign zhangsan`
- `zentao-cli task update --taskId 123 --status doing --assign zhangsan --comment "代码已提交，转交测试验证"`
- `zentao-cli task update --taskId 69705 --comment "我是Agent：单纯追加一条排查进展记录"`
- `zentao-cli task update --taskId 69705 --comment "问题已修复，耗时半天" --consumed 4`
- `zentao-cli story update --storyId 12072 --status closed --comment "需求已验收完成"`
- `zentao-cli story update --storyId 14526 --status active --comment "重新激活继续推进"`
- `zentao-cli story update --storyId 12072 --assign zhangsan --comment "转交继续跟进"`
- `zentao-cli bug update --bugId 11071 --status done --comment "缺陷已修复完成"`
- `zentao-cli bug update --bugId 11071 --status closed --comment "验证通过，关闭缺陷"`
- `zentao-cli bug update --bugId 11071 --status active --comment "重新激活继续跟踪"`
- `zentao-cli bug update --bugId 11071 --assign zhangsan --comment "转交继续跟进"`

### 9. 度量与晨会
- `zentao-cli load --assign zhangsan`
- `zentao-cli load --assign 张三,李四,王五`
- `zentao-cli load --team-name "规划组"`
- `zentao-cli stagnant --assign zhangsan --days 3`
- `zentao-cli stagnant --assign 张三,李四 --days 5`
- `zentao-cli stagnant --team-name "规划组" --days 5`
- `zentao-cli morning-check --team zhangsan,lisi,wangwu`
- `zentao-cli morning-check --team 张三,李四`
- `zentao-cli morning-check --team-name "规划组"`
- `zentao-cli morning-check --team-name "规划组" --pri-max 1`
- `zentao-cli weekly-synthesis --team zhangsan,lisi,wangwu`
- `zentao-cli weekly-synthesis --team 张三,李四`
- `zentao-cli weekly-synthesis --team-name "规划组"`
- `zentao-cli weekly-synthesis --team-name "规划组" --date-from 2026-03-09 --date-to 2026-03-13`
- `zentao-cli weekly-synthesis --team-name "规划组" --pri-max 1`
- `zentao-cli weekly-synthesis --team-name "规划组" --view summary`
- `zentao-cli weekly-synthesis --team-name "规划组" --view full`

### 10. 团队缓存
- `zentao-cli team save --name "规划组" --users "张三,李四,王五"`：保存团队别名，成员会自动映射成系统账号。
- `zentao-cli team list`：查看当前已保存的团队列表。
- `zentao-cli team show --name "规划组"`：查看团队详情与成员账号。
- `zentao-cli team delete --name "规划组"`：删除本地团队缓存。
- 本地团队配置文件默认保存在 `~/.config/zentao/teams.json`。

## ⚡ 快速开始 (Quick Start)

**1. 接入 OpenClaw (作为大模型 MCP Skill 挂载)**
```bash
npx skills add @chenish/zentao-mcp-agent
```

**2. 本地全局安装 CLI (使用终端管理)**
```bash
npm install -g @chenish/zentao-mcp-agent
```

**快速登录验证：**
```bash
zentao-cli login --url <您的禅道地址> --account <账号> --pwd <密码>
```
