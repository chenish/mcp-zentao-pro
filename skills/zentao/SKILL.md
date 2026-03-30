---
name: zentao
description: 禅道(ZenTao) MCP大模型能力扩展包。适用于跨项目待办汇总、任务派发、状态流转、晨会周报与团队管理场景。
metadata: {"openclaw":{"emoji":"🚀","install":[{"id":"node","kind":"node","package":"@chenish/zentao-mcp-agent","bins":["zentao-mcp","zentao-cli"],"label":"Install ZenTao AI Assistant"}]}}
---

# ZenTao AI Assistant

## When to use this skill
当用户希望你代替他在禅道里查询待办、汇总团队事项、创建任务、流转状态、产出晨会/周报素材时，启用这个技能。

优先把它当成“流程型技能”来用，而不是“命令回显手册”。

## Output contract

- 默认直接调用底层能力完成任务，不要把 `zentao-cli ...` 命令当成最终答复返回给用户。
- 只有当用户明确要求“给我命令”“给我 CLI 示例”“我要手动执行/排查”时，才去读取并引用 [cli-examples.md](/Users/samuel/Desktop/chat/chat-禅道自动化V2/mcp-zentao-pro/skills/zentao/cli-examples.md)。
- 在任何能力调用前，先读取 [auth-and-precheck.md](/Users/samuel/Desktop/chat/chat-禅道自动化V2/mcp-zentao-pro/skills/zentao/auth-and-precheck.md)。
- 涉及写操作时，先读取 [write-workflows.md](/Users/samuel/Desktop/chat/chat-禅道自动化V2/mcp-zentao-pro/skills/zentao/write-workflows.md)。
- 涉及查询、统计、晨会、周报、风险扫描时，先读取 [query-routing.md](/Users/samuel/Desktop/chat/chat-禅道自动化V2/mcp-zentao-pro/skills/zentao/query-routing.md)。
- 需要一个紧凑版的“创建 / my / manage”决策提示时，再读取 [decision-rules.md](/Users/samuel/Desktop/chat/chat-禅道自动化V2/mcp-zentao-pro/skills/zentao/decision-rules.md)。
- 查询类任务优先返回自然语言总结，其次再给结构化清单。
- 管理类结果优先输出中文友好字段，避免把内部字段名直接丢给用户。
- 如果只是为了确认这个技能可用，直接完成查询或操作并汇报结果，不要回显命令。

## Layered workflow

始终按下面 4 层顺序思考：

1. `鉴权与预检层`
   先检查 token / sid / 本地登录态 / 团队缓存 / 必要的项目与需求上下文。
   默认优先使用已登录的 `token + sid`；若鉴权失效，再使用本地保存的登录信息静默重登一次，并刷新本地配置。

2. `意图路由层`
   先判断这是：
   - 写操作
   - 个人查询
   - 管理汇总
   - 专项统计

3. `能力执行层`
   再从九大核心能力里选择最贴切的一项执行，不要把所有问题都硬塞到 `manage`。

4. `结果核查层`
   写操作完成后要回读结果；查询完成后要说明视角、统计口径和筛选条件。

## Nine-core-tools map

### A. 查询与洞察

#### 1. 全局待办透视
- 适用：看我自己、看某个人、看某个团队的任务/需求/Bug。
- 主要能力：`my`、`manage`
- 关键区分：
  - `my` = 官方指派 / 个人地盘
  - `manage` = 管理汇总 / 团队总览

#### 2. 链接智能解析
- 适用：用户直接甩来任务、需求、Bug 链接。
- 主要能力：`view`
- 关键规则：
  - 有链接时优先先解析链接，不要先要求用户补 ID
  - 如果用户问“是否闭环”“是不是已经完成”“这个任务现在到底是什么状态”，优先走 `view`
  - 如果识别到是多人并行任务，必须同时输出“个人完成态”和“整体闭环态”
  - 不要只根据整体 `doing/wait/done` 一句话下结论

#### 3. 晨会自动播报
- 适用：今日晨会、风险播报、今明到期、超期清单。
- 主要能力：`morning-check`
- 关键规则：
  - 这是专题统计，不要退化成普通 `manage`
  - 晨报输出的是“事项池”，可能同时包含任务 / 需求 / Bug
  - 不要把晨报里的全部超期事项都表述成“超期任务”
  - 如果用户要核对“某个人当前到底有多少个超期任务”，改用任务口径单独复查

#### 4. 派发前负荷参考雷达
- 适用：派单前判断谁比较空、谁的任务已经太多。
- 主要能力：`load`
- 关键规则：这是参考信息，不自动替用户否决派单。

#### 5. 停滞单据排查
- 适用：排查长期未更新的进行中事项。
- 主要能力：`stagnant`
- 关键规则：核心口径是“停滞天数 + 最后更新时间”，不是简单状态过滤。

#### 6. 自动化周报摘要
- 适用：团队周报、本周交付汇总、本周待完成项。
- 主要能力：`weekly-synthesis`
- 关键规则：这是周报统计，不等于普通管理聚合视图。

### B. 写入与执行

#### 7. 对话式极速建单
- 适用：普通建任务、从需求拆任务、多人任务创建。
- 主要能力：`task create`、执行查询/创建
- 关键规则：
  - 先判断是否关联需求
  - 先核查项目与执行归属
  - 多成员默认多人并行

#### 8. 对话式快捷报工
- 适用：登记耗时、补充工作说明。
- 主要能力：`task effort`
- 关键规则：当前稳定能力是“耗时 + 可选说明”。

#### 9. 极简状态流转
- 适用：启动、完成、关闭、转交、按名称找任务后再流转。
- 主要能力：`task update`、`story update`、`bug update`、`task find`
- 关键规则：先找对对象，再做状态流转或转交。

### C. 基础辅助能力

#### 10. 团队名单缓存
- 适用：固定团队反复做晨会、周报、负荷检查、管理聚合。
- 主要能力：`team save`、`team list`、`team show`、`team delete`
- 关键规则：
  - 固定团队优先先保存团队别名
  - 后续优先复用 `--team-name`

#### 11. 中文自动映射
- 适用：用户直接输入中文真实姓名，而不是系统账号。
- 主要能力：成员映射、指派映射、团队成员映射
- 关键规则：
  - 中文姓名应优先自动映射到底层账号
  - 写操作和查询都先做映射，再继续执行

#### 12. 人性化链接与网页跳转识别
- 适用：用户给出大段文本、任务名称、任务 ID，想要快速定位禅道网页。
- 主要能力：`view`、`task find`
- 关键规则：
  - 文本里出现禅道链接时，优先直接解析
  - 用户只给任务名称时，可先检索任务，再返回可点击网页链接
  - 用户只给任务 ID 时，可直接返回对应网页链接

## Required references

### 1. 鉴权与前置校验
先读 [auth-and-precheck.md](/Users/samuel/Desktop/chat/chat-禅道自动化V2/mcp-zentao-pro/skills/zentao/auth-and-precheck.md)

### 2. 写操作流程
涉及建任务、拆需求、转交、流转、报工，先读 [write-workflows.md](/Users/samuel/Desktop/chat/chat-禅道自动化V2/mcp-zentao-pro/skills/zentao/write-workflows.md)

### 3. 查询与统计路由
涉及 `my`、`manage`、`view`、`morning-check`、`load`、`stagnant`、`weekly-synthesis`，先读 [query-routing.md](/Users/samuel/Desktop/chat/chat-禅道自动化V2/mcp-zentao-pro/skills/zentao/query-routing.md)

### 4. 紧凑决策补充
需要一个简版补充时再读 [decision-rules.md](/Users/samuel/Desktop/chat/chat-禅道自动化V2/mcp-zentao-pro/skills/zentao/decision-rules.md)

## When to read cli-examples.md

只在下面这些场景读取 [cli-examples.md](/Users/samuel/Desktop/chat/chat-禅道自动化V2/mcp-zentao-pro/skills/zentao/cli-examples.md)：

- 用户明确要 CLI 命令或手动操作步骤。
- 需要给开发者做本地联调、验收、故障排查。
- 需要核对某个参数名、命令组合或帮助示例。

平时不要默认把该文件里的命令直接返回给用户。

## Current limitations

- `task effort --taskId <id> --desc "..."` 这种仅写说明不填耗时的形态，在当前禅道环境中页面历史不会稳定落备注。
- `story update --storyId <id> --status active` 在当前禅道环境中尚未稳定生效。

## Installation note

如果用户明确要安装或人工验证，可提示先安装并登录：

- 安装包：`@chenish/zentao-mcp-agent`
- 首次使用前先完成登录授权
- 具体命令写法见 [cli-examples.md](/Users/samuel/Desktop/chat/chat-禅道自动化V2/mcp-zentao-pro/skills/zentao/cli-examples.md)
