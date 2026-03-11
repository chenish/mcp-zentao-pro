# zentao-mcp-agent (ZenTao MCP & CLI)

🚀 **专为现代研发团队打造的 ChatOps 效能中枢**

本项目不仅是一个简单的 API 封装，更是一个基于 `@modelcontextprotocol/sdk` 开发的标准 **MCP Server**。依托本项目独创的 **“MVC 上帝视角 + RESTful 精准写入”** 混动架构，完美穿透禅道底层的跨项目严苛隔离与分页限制，赋能大模型（如 OpenClaw）无缝实现极速研发管理。

---

## 🌟 九大核心功能矩阵 (Core Features)

> **💡 说明：** 本项目底层抹平了严苛的产研隔离、鉴权校验与分页限制。以下九大场景中，部分已直接固化为原生工具 (Tool)，部分需结合定时系统 (Cron) 与高级提示词来实现。

### 一、 数据透视与日常跟进 (解决信息孤岛)

#### 1. 全局待办透视 (God-Mode Dashboard)
- **【功能清单】**：
  - [x] 支持拉取指定用户的全量待办数据，包含 **任务 (Tasks)、需求 (Stories)、缺陷 (Bugs)**。
  - [x] 支持跨越产品和迭代隔离，按照真实处理状态、指派人进行多维组合查询。
- **【CLI 调用示例】**：
  - `zentao-cli my tasks` (基础：拉取指派给我的任务)
  - `zentao-cli my bugs` (分类：拉取指派给我的缺陷清单)
  - `zentao-cli my stories` (聚合：一键获取我名下的业务需求)
  - `zentao-cli my tasks --assign zhangsan` (⚠️还在支持中 查岗：跨项目查阅张三的任务列表)
  - `zentao-cli my tasks --status doing` (过滤：精确提取张我的进行中的任务)
  - `zentao-cli my tasks --assign zhangsan --status doing` (⚠️还在支持中查岗：跨项目查阅张三进行中的代办)
- **【OpenClaw 使用场景】**：
  用户在聊天框输入：*“查一下张三目前手上有哪些进行中的 Bug，有没有延期的？”* -> Agent 跨迭代拉取全量缺陷并分析回复。

#### 2. 链接智能解析 (Smart Link Resolver)
- **【功能清单】**：
  - [x] 支持直接从夹杂着对话内容的凌乱文本中用正则提取核心禅道 URL。
  - [x] 无缝请求解析器瞬间抓取任务详情、状态、优先级及骨干内容。
- **【CLI 调用示例】**：
  - `zentao-cli view "大家看一下这个链路报错：http://zentao.yourcompany.com/task-view-123.html"`
- **【OpenClaw 使用场景】**：
  用户在群聊丢出杂乱链接，Agent 会直接抽丝剥茧为您解构出背后的禅道实体当前状态供解答。

#### 3. 晨会自动播报 (Morning Standup Radar)
- **【功能清单】**：
  - [x] 按指定团队成员聚合全量待办，分类输出 **已超期 / 今明到期 / 高优** 三类预警清单。
  - [x] 支持中文名/账号自动映射，批量并发拉取，供大模型直接生成晨会通报。
- **【CLI 调用示例】**：
  - `zentao-cli morning-check --team zhangsan,lisi,wangwu` (⚠️努力上线中~综合晨报：生成超期·临期·高优三色预警)
  - `zentao-cli morning-check --team 张三,李四` (⚠️努力上线中~支持中文姓名，自动映射账号)
- **【OpenClaw 使用场景】**：
  每日清晨，Cron 触发 `morning-check` 拉取多维风险清单交给大模型，生成一份完整的晨会催办通报发至工作群。

---

### 二、 极速执行与流转 (降低流程损耗)

#### 4. 对话式极速建单 (Chat-to-Task)
- **【功能清单】**：
  - [x] 支持查询活跃项目 (`getProjects`) 及迭代，或按需新建当月执行冲刺 (`createExecution`)。
  - [x] 基于指定迭代一键创建任务，支持自动映射人员中文名至系统底层账号。
  - [x] 智能容错与补全：自动推端补齐必填的预计开始时间、截止时间、预估工时。
- **【CLI 调用示例】**：
  - `zentao-cli projects` (摸底：获取我归属的项目库)
  - `zentao-cli executions --project 577` (摸底：获取项目577下的迭代)
  - `zentao-cli execution create --projectId 577 --name "2026年3月常规迭代"` (兜底：动态建档补缺)
  - `zentao-cli task create --execId 123 --name "网关排查" --assign "zhangsan"` (瞬时极简派单)
  - `zentao-cli task create --execId 123 --name "全量压测" --assign "李四" --estimate 8 --deadline "2026-03-20"` (精细派发：明确指定 8 小时预估工时和特定截止日期)
- **【OpenClaw 使用场景】**：
  用户输入：*“把路由限流排查发给李四，预计4个小时，后天完成。”* -> Agent 瞬间提取意图补缺自动建单。

#### 5. 对话式快捷报工 (Seamless Effort Logging)
- **【功能清单】**：
  - [x] 支持为指定任务直接登记实际消耗工时。
  - [x] 支持为指定任务直接登记实际消耗工时并附加工作说明备注。
  - [ ] 支持为指定任务直接附加工作说明备注。
- **【CLI 调用示例】**：
  - `zentao-cli task effort --taskId 69704 --consumed 2` (⚠️努力上线中~极简报工：给 69704 任务快速登记 2 小时消耗)
  - `zentao-cli task effort --taskId 69704 --consumed 2.5 --desc "修复了NPE异常"` (⚠️努力上线中~登记并附加进度)
  - `zentao-cli task effort --taskId 69704 --desc "修复了NPE异常"` (⚠️努力上线中~登记任务说明)
- **【OpenClaw 使用场景】**：
  用户输入：*“帮我给69704任务报个工，花了 2 小时写核心逻辑。”* -> Agent 精准提取 ID 与耗时写入底层。

#### 6. 极简状态流转 (State Machine Control)
- **【功能清单】**：
  - [ ] 支持根据任务名称自动获取任务ID
  - [x] 支持修改任务进行中、已完成等生命周期状态。
  - [ ] 支持修改需求进行中、已完成等生命周期状态。
  - [ ] 支持修改缺陷进行中、已完成等生命周期状态。
  - [x] 支持责任人转交操作。
  - [x] 支持单次交互中复合追加评论。
- **【CLI 调用示例】**：
  - `zentao-cli task update --taskId 123 --status done  --comment "已完成转测"`
  - `zentao-cli task update --taskId 123 --status done` (单项流转：仅将任务状态标记为已完成)
  - `zentao-cli task update --taskId 123 --assign zhangsan` (任务转交：仅将任务丢给张三处理)
  - `zentao-cli task update --taskId 123 --status doing --assign zhangsan --comment "代码已提交，转交测试验证"` (复合流转：完成、转交、加备注一气呵成)
  - `zentao-cli task update --taskId 69705 --comment "我是Agent：单纯追加一条排查进展记录" `(轻量打卡：不修改状态与指派人，仅填报一条无耗时的进展留言)
  - `zentao-cli task update --taskId 69705 --comment "问题已修复，耗时半天" --consumed 4 `(精确进度：单独填报耗时并留下排查过程备注)

- **【OpenClaw 使用场景】**：
  用户输入：*“排查做完了，变成已完成并转给王五跟进。”* -> Agent 直接驱动全套状态流转。

---

### 三、 敏捷度量与风险预警 (前置风险干预)

#### 7. 派发前负荷参考雷达 (Workload Radar)
- **【功能清单】**：
  - [x] 测算目标员工当前并行任务数与预估剩余总工时，以备派单者参考（**软性提示，不强制阻断**）。
  - [x] 支持一次查询多人，单独呈现各人承载量，辅助派单决策。
- **【CLI 调用示例】**：
  - `zentao-cli load --assign zhangsan` (⚠️努力上线中~单人：查看张三的当前任务与剩余工时)
  - `zentao-cli load --assign 张三,李四,王五` (⚠️努力上线中~批量：一次对比多人负荷状况，支持中文名)
- **【OpenClaw 使用场景】**：
  分配任务前，Agent 调用 `load` 拉取候选人的当前承重信息，由派单者结合实际节奏自行决策是否分派。

#### 8. 停滞单据排查 (Stagnant Tasks Patrol)
- **【功能清单】**：
  - [x] 精准排查指定人员名单中，长期处于进行中但超 N 天无任何更新记录的停滞单据。
  - [x] 支持按人员范围圈选，避免大团队全局扫描产生噪音干扰。
- **【CLI 调用示例】**：
  - `zentao-cli stagnant --assign zhangsan --days 3` (⚠️努力上线中~单人：排查张三 3 天未动的停滞任务)
  - `zentao-cli stagnant --assign 张三,李四 --days 5` (⚠️努力上线中~批量：5 天无进展的静默单据一网打尽)

#### 9. 自动化周报摘要 (Weekly Synthesis)
- **【功能清单】**：
  - [ ] 自动聚合团队当周已交付的高优需求与重大修复缺陷。
  - [ ] 过滤琐碎杂活，一键生成高管和业务视角的团队交付周报素材。
- **【CLI 调用示例】**：
  - *(计划中)*
- **【OpenClaw 使用场景】**：
  大模型自动化扫面全组千锤百炼后汇聚成的完结清单，进行抽象总结归档汇报。

---

## 🛠️ API 调试与开发者指南

1. **附赠 Postman 集合文件**
   本项目代码仓库 `doc/postman/` 目录下提供了一份 `Zentao_V4_Final.postman_collection.json`。该集合固化了所有登录逻辑、MVC 解析黑科技与核心 API 断言，建议开发者导入直接进行冒烟测试。
2. **双重鉴权架构守则 (极度重要！)**
   - **RESTful 接口** (`/api.php/v1/...`)：请求头必须携带 `Token: xxx`。
   - **MVC 接口** (`.json` 结尾)：请求头必须携带 `zentaosid: xxx`。
3. **项目构建测试**
   - `npm install`
   - `npm run build`
   - `node dist/cli.js login --url <您的禅道地址> --account <账号> --pwd <密码>`
   - `node dist/cli.js my tasks` 等于 `zentao-cli my tasks` 
   - 其他功能同上 
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
