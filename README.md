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
  - `zentao-cli my tasks` (基础：拉取我名下的任务)
  - `zentao-cli my tasks --assign zhangsan --status doing` (查岗：跨项目查阅张三进行中的代办)
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

#### 3. 晨会自动播报 (Morning Daily Standup)
- **【功能清单】**：
  - [ ] 基于定时触发盘点团队“今日到期”与“已延期”事项。
  - [ ] 生成晨会重点跟进大纲。
- **【CLI 调用示例】**：
  - *(暂无，可结合系统的 Cron 轮询查询 `zentao-cli my tasks` 生成)*
- **【OpenClaw 使用场景】**：
  结合定时脚本，每日清晨由大模型自动整理延后或冲刺事项并发单至工作群。

---

### 二、 极速执行与流转 (降低流程损耗)

#### 4. 对话式极速建单 (Chat-to-Task)
- **【功能清单】**：
  - [x] 支持查询活跃项目 (`getProjects`) 及迭代，或按需新建当月执行冲刺 (`createExecution`)。
  - [x] 基于指定迭代一键创建任务，支持自动映射人员中文名至系统底层账号。
  - [x] 智能容错与补全：自动推端补齐必填的预计开始时间、截止时间、预估工时。
- **【CLI 调用示例】**：
  - `zentao-cli executions --project 577` (摸底：获取活跃中的项目迭代)
  - `zentao-cli execution create --projectId 577 --name "2026年3月常规迭代"` (兜底：动态建档补缺)
  - `zentao-cli task create --execId 123 --name "网关排查" --assign "zhangsan"` (瞬时极简派单)
- **【OpenClaw 使用场景】**：
  用户输入：*“把路由限流排查发给李四，做4个小时。”* -> Agent 瞬间提取意图补缺自动建单。

#### 5. 对话式快捷报工 (Seamless Effort Logging)
- **【功能清单】**：
  - [x] 支持为指定任务直接登记实际消耗工时并附加工作说明备注。
  - [x] 彻底修复禅道 V1 API 报工返回正确却空入库的幽灵漏洞，直连 MVC 原生表单确保 100% 写入。
- **【CLI 调用示例】**：
  - `zentao-cli task effort --taskId 69704 --consumed 2.5 --desc "修复了NPE异常"` (登记并附加进度)
- **【OpenClaw 使用场景】**：
  用户输入：*“帮我给69704任务报个工，花了 2 小时写核心逻辑。”* -> Agent 精准提取 ID 与耗时写入底层。

#### 6. 极简状态流转 (State Machine Control)
- **【功能清单】**：
  - [x] 支持修改任务进行中、已完成等生命周期状态。
  - [x] 支持责任人转交操作。
  - [x] 支持单次交互中复合追加工作评论。
- **【CLI 调用示例】**：
  - `zentao-cli task update --taskId 123 --status done --assign wangwu --comment "已完成转测"`
- **【OpenClaw 使用场景】**：
  用户输入：*“排查做完了，变成已完成并转给王五跟进。”* -> Agent 直接驱动全套状态流转。

---

### 三、 敏捷度量与风险预警 (前置风险干预)

#### 7. 派发负荷雷达 (Overload Warning Radar)
- **【功能清单】**：
  - [ ] 测算目标员工当前的并行处理任务数与剩余总工时。
  - [ ] 分配新需求前阻断单点过载。
- **【CLI 调用示例】**：
  - *(计划中：组合调用 Dashboard 数据提取员工并行满载点)*
- **【OpenClaw 使用场景】**：
  触发分配新建任务前，模型运行并行任务筛查机制，若目标员工满负荷则进行分配规避建议。

#### 8. 僵尸任务巡检 (Zombie Tasks Patrol)
- **【功能清单】**：
  - [ ] 揪出长期处于“进行中”但连续数天无工时消耗的停滞任务。
  - [ ] 提前暴露跨周期的交付危险并警告干系人。
- **【CLI 调用示例】**：
  - *(计划中)*
- **【OpenClaw 使用场景】**：
  巡查机器每周末查询所有在途研发单进行僵尸排雷警告。

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
