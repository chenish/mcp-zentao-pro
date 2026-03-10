# zentao-mcp-agent (ZenTao MCP & CLI)

🚀 **专为现代研发团队打造的 ChatOps 效能中枢**

本项目不仅是一个简单的 API 封装，更是一个基于 `@modelcontextprotocol/sdk` 开发的标准 **MCP Server**。依托本项目独创的 **“MVC 上帝视角 + RESTful 精准写入”** 混动架构，完美穿透禅道底层的跨项目严苛隔离与分页限制，赋能大模型（如 OpenClaw）无缝实现极速研发管理。

---

## 🛠️ 第一层：核心基础工具 (MCP Tools / CLI 原生支持)

本层包含 4 大硬核底层能力。本项目已将极其恶心的禅道鉴权、必填项校验、路由跨界等坑位全部在底层抹平，直接对外提供开箱即用的业务级工具。

### 1. 全视界地盘拉取 (God-Mode Dashboard)
- **【功能清单】**：
  1. 支持拉取指定用户的全量待办数据，包含 **任务 (Tasks)、需求 (Stories)、缺陷 (Bugs)**。
  2. 支持跨越产品和迭代隔离，按照事项的真实处理状态、指派人进行多维组合查询。
- **【CLI 调用示例】**：
  - `zentao-cli my tasks` (基础：默认拉取指派给我的待办任务)
  - `zentao-cli my bugs` (分类：拉取指派给我的缺陷清单)
  - `zentao-cli my tasks --assign zhangsan` (上帝视角：跨权限查看张三地盘上的所有任务)
  - `zentao-cli my tasks --assign zhangsan --status doing` (精准过滤：查看张三目前正在进行中的任务)
- **【OpenClaw 使用场景】**：
  用户在聊天框输入：*“帮我查一下张三目前手上有哪些进行中的 Bug，有没有延期的？”*
  Agent 会自动调用 `getDashboard` 工具，传入 assignee 和 status 参数，跨迭代拉取张三的全量 Bug 列表，并根据截止日期分析后回复。

### 2. 对话式任务派发 (Chat-to-Task)
- **【功能清单】**：
  1. 支持查询当前活跃的执行/迭代 (`execId`)，为派发任务提供环境依据。
  2. 基于指定迭代一键创建任务，支持自动映射人员中文名至系统底层账号。
  3. 智能容错与补全：自动补全必填的预计开始时间、截止时间、预估工时。
- **【CLI 调用示例】**：
  - `zentao-cli executions --status doing` (前置操作：获取当前正在进行中的迭代 ID 列表)
  - `zentao-cli task create --execId 123 --name "网关熔断排查" --assign "zhangsan"` (极简派发：时间与工时全部由底层静默注入默认值)
  - `zentao-cli task create --execId 123 --name "全量压测" --assign "lisi" --estimate 8 --deadline "2026-03-20"` (精细派发：明确指定 8 小时预估工时和特定截止日期)
- **【OpenClaw 使用场景】**：
  用户输入：*“把路由限流排查的活儿派给李四，给 4 个小时。”*
  Agent 调用 `createTask` 工具，提取意图转化为完整参数瞬间建单。

### 3. 一句话快捷报工 (Seamless Effort Logging)
- **【功能清单】**：
  1. 支持为指定的任务登记实际消耗工时。
  2. 支持填写本次报工的具体备注说明。
  3. 底层彻底修复禅道 REST 报工经常返回 `200 OK` 却不入库的“幽灵报工”漏洞，采用原生表单校验，确保 100% 写入。
- **【CLI 调用示例】**：
  - `zentao-cli task effort --taskId 69704 --consumed 2` (极简报工：给 69704 任务快速登记 2 小时消耗)
  - `zentao-cli task effort --taskId 69704 --consumed 2.5 --desc "完成了核心业务逻辑的编写，修复了NPE异常"` (详尽报工：登记耗时并追加详细的研发日志)
- **【OpenClaw 使用场景】**：
  用户输入：*“帮我给 69704 号任务报个工，花了 2 个小时，备注是完成了逻辑梳理。”*
  Agent 精准提取 ID、耗时与备注，调用 `addEstimate` 工具直接入库。

### 4. 极简状态流转 (State Machine Control)
- **【功能清单】**：
  1. 支持修改已有任务的状态（如变更为 done、closed 等）。
  2. 支持重新指派任务负责人（转交操作）。
  3. 支持在流转时追加操作备注/评论。
- **【CLI 调用示例】**：
  - `zentao-cli task update --taskId 123 --status done` (单项流转：仅将任务状态标记为已完成)
  - `zentao-cli task update --taskId 123 --assign zhangsan` (任务转交：仅将任务丢给张三处理)
  - `zentao-cli task update --taskId 123 --status done --assign zhangsan --comment "代码已提交，转交测试验证"` (复合流转：完成、转交、加备注一气呵成)
- **【OpenClaw 使用场景】**：
  用户输入：*“那个排查任务做完了，帮我把状态改成已完成，转交给测试组的王五。”*
  Agent 调用 `updateTask` 工具，一键完成任务的闭环与流转动作。

---

## 🚀 第二层：高级 Agent 业务场景 (需结合扩展)

> **💡 说明：** 本项目提供了第一层强大的查写 API 底座。以下高级场景，需要您在 OpenClaw 中配置具体的 **System Prompt (系统提示词)** 或结合本地 **Cron 定时脚本** 触发调用来实现。

- **5. 智能链接解析**：在对话中丢出任意禅道链接，通过 OpenClaw 结合底层 API，瞬间抓取富文本详情。
- **6. 晨会/站会智能播报**：基于 Cron 定时触发，清晨调用地盘拉取接口，梳理“今日到期”与“已延期”事项，生成催办大纲发到工作群。
- **7. 派发前负荷雷达**：在分配新需求前，要求大模型调用 Dashboard 测算目标员工并行的处理中任务数与剩余工时，避免单点过载。
- **8. 僵尸任务巡检**：定时扫描 Dashboard，揪出长期处于进行中但连续数天无工时消耗的任务，提前暴露风险。
- **9. 高管级周报摘要**：每周末拉取已完成的高优需求与缺陷，交由大模型生成业务视角的交付周报素材。

---

## 🛠️ API 调试与开发者指南

1. **附赠 Postman 集合文件**
   本项目代码仓库 `doc/postman/` 目录下提供了一份 `Zentao_V4_Final.postman_collection.json`。该集合固化了所有登录逻辑、MVC 解析黑科技与核心 API 断言，建议开发者导入直接进行冒烟测试。
2. **双重鉴权架构守则 (极度重要！)**
   - **RESTful 接口** (`/api.php/v1/...`)：请求头必须携带 `Token: xxx`。
   - **MVC 接口** (`.json` 结尾)：请求头必须携带 `zentaosid: xxx`。

---

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
