# zentao-mcp-agent (MCP & CLI)

🚀 核心能力矩阵 (9大杀手级应用场景)

本项目不仅仅是一个简单的 API 封装，而是专为现代研发团队打造的 ChatOps 效能中枢。依托本项目独创的 “MVC上帝视角 + RESTful精准写入” 混动引擎，完美突破了禅道底层的跨项目隔离与分页限制，赋能大模型无缝实现以下 9 大研发管理闭环：

## 🔍 一、 极致的数据洞察与触达 (Data & Insights)

- [x] **1. 全视界地盘拉取 (God-Mode Dashboard)**
突破官方标准 API 严苛的产品/迭代隔离墙！通过底层 MVC 路由直连，跨项目一键透视指定员工的真实待办负荷（完美支持“多人任务”所有权穿透），打造 AI 的全知视角。

- [ ] **2. 智能链接解析 (Smart Link Unfurling)**
只需在对话（如 OpenClaw / QQ Bot）中丢出任意禅道 Task、Bug 或 Story 链接，AI 瞬间解析背后的富文本详情、当前状态及关联人，告别频繁切换浏览器的割裂感。

- [ ] **3. 晨会/站会智能播报 (Daily Stand-up Assistant)**
基于全量数据底座，轻松让 AI 梳理团队“今日到期”与“已延期”的阻塞事项，一键生成清爽的晨会催办大纲，直击交付痛点。

## ⚡ 二、 极速的任务流转与执行 (Action & Execution)

- [x] **4. 对话式任务派发 (Chat-to-Task)**
告别网页端繁琐的建单表单！只需一句自然语言（如：“把路由排查的活儿派给李建”），AI 将自动推断活跃迭代、补齐必填的预计开始/截止日期、注入默认预估工时，瞬间完成建单。

- [x] **5. 一句话快捷报工 (Seamless Effort Logging)**
破解禅道复杂的工时登记（Estimate）路由与权限校验。支持在聊天框内直接发送自然语言报工（如：“给网关任务登记2小时”），底层引擎精准模拟真实表单写入，确保工时分毫不差。

- [ ] **6. 极简状态流转 (State Machine Control)**
在终端或聊天窗口内，直接完成任务状态推进（进行中 -> 待审核）、指派人转交及追加备注，让研发流水线在命令行里全速运转。

## 📊 三、 研发效能与敏捷管理 (Agile Management)

- [ ] **7. 派发前负荷雷达 (Workload Radar)**
在分配新需求前，AI 可基于 Dashboard 数据实时测算目标员工当前的并行任务数与剩余总工时。自动预警单点过载，辅助组长进行更科学的资源调度。

- [ ] **8. 状态异常静默巡检 (Zombie Task Detection)**
支持扫描并揪出长期处于“进行中”但连续数天无新工时消耗、无状态变更的“僵尸任务”，帮助项目负责人提前暴露研发风险并精准干预。

- [ ] **9. 高管级周报摘要 (Weekly Executive Summary)**
每周末自动提取团队已交付的高优需求（Story）与缺陷修复（Bug），秒级生成业务价值视角的交付总结，直接为你下一份向上汇报的 PPT 提供高质量素材。

## 快速开始 (Quick Start)

全局安装：
```bash
npm install -g @chenish/zentao-mcp-agent
```

登录并连接禅道：
```bash
zentao-cli login --url <您的禅道地址> --account <账号> --pwd <密码>
```

查看我的仪表盘 (支持 tasks, bugs, stories)：
```bash
zentao-cli my tasks
```

对话式任务派发 (建单)：
```bash
zentao-cli task create --execId <执行/迭代ID> --name "路由排查" --assign "lijian" --estimate 4 --deadline "2026-03-15"
```

一句话快捷报工：
```bash
zentao-cli task effort --taskId <任务ID> --consumed 2.5 --desc "完成了核心业务逻辑的编写"
```

## 支持的 MCP Tools

本项目通过 OpenClaw 等 MCP Client 挂载后，即可激活以下大模型能力：

- `getDashboard`: 跨越项目墙的全局任务/需求/Bug汇总
- `createTask`: 基于人类自然语言推断配置，一句话完成任务派发
- `addEstimate`: 深度模拟网页端表单，穿透权限墙轻松报工
- `getUsersMapping`: 隐式中英文账号名映射

## 🗺️ 后续建设计划 (Roadmap)

我们刚刚完成了 **Phase 1: 核心 API Client 与 CLI 工具开发** 的底层突破。未来，我们将继续攻克以下高优场景：

1. **我派发/关注的任务寻踪 (Assigned-out & Followed Tasks Tracking)**：除了拉取当前指派给自己的任务（My Tasks），下一步将支持自动过滤和追踪我曾经派发给别人的高优需求与任务，确保闭环节点不断裂。
2. **工时消耗精细化分析图谱**：从单一的粗颗粒报工，升级为结合团队周维度的工时消耗计算与预警。
3. **状态机的全量接入 (State Control)**：开发针对任务的 Start/Finish/Close/Cancel 等全生命周期流转接口。
4. **全面 MCP 化部署**：将目前所有的 CLI 能力完全包装为 OpenClaw 的 Standard Tools，让终端能力彻底进入对话框。
