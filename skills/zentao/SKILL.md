---
name: zentao
description: 禅道(ZenTao) MCP大模型能力扩展包。提供跨项目的数据聚合视图、一句话生成任务、无缝报工(Log Effort)、自动状态流转等四组原生能力。
metadata: {"openclaw":{"emoji":"🚀","install":[{"id":"node","kind":"node","package":"@chenish/zentao-mcp-agent","bins":["zentao-mcp","zentao-cli"],"label":"Install ZenTao AI Assistant"}]}}
---

# ZenTao AI Assistant (zentao-mcp-agent)

## When to use this skill
当你（大语言模型）需要代替用户在禅道中查阅待办、分配任务、填报工时或操作任务状态机时，请**必须**启用此扩展包提供的 Tool 集合。依托我们的 MVC+RESTful 混动底层架构，你可以基于用户授权，越过繁杂的分页与项目界面，进行事项的统筹处理。

## 💡 AI 最佳实践指引 (For LLM AI)

作为 AI Assistant，当用户提出下述意图时，请严格按照指引调用底层提供的 4 大 Tool 工具：

### 1. 全视界地盘拉取 (Global Dashboard)
- **触发意图**：用户询问**“看看张三手头有什么活”**、**“最近哪些线上 Bug 延期了”**。
- **调用动作**：调用 `getDashboard`。
- **参数指南**：通过 `assignee` 参数传入真实的中文姓名（如 张三，本插件会自动映射为底层 account），通过 `status`（可选参数如 doing, wait, done）进行多维过滤。跨迭代返回 tasks / bugs / stories 数据。

### 2. 对话式任务派发 (Chat-to-Task)
- **触发意图**：用户说**“把网关排查的活儿发给李四，给半天时间”**，但未指明具体项目或迭代时。
- **调用动作**：组合调用 `getProjects` -> `getActiveExecutions` -> (若无当期迭代则调用 `createExecution`) -> 最后发起 `createTask`。
- **参数指南**：务必先明确当前的迭代/执行 `execId`。如不确定，先查询项目列表及其下挂载的近期执行。如有必要跨月，可智能创建一个当月的新冲刺。派单时，可以直接传入真实的中文 `name`、`assignee` 和工时 `estimate`（默认2小时）。底层已内置自动修补禅道必填项和账号映射转换。

### 3. 一句话快捷报工 (Seamless Effort Logging)
- **触发意图**：用户说**“给 10452 任务登记 2 个小时的内容撰写工时”**。
- **调用动作**：调用 `addEstimate`。
- **参数指南**：必须带有精确的 `taskId`、耗时 `consumed` 以及备注 `work`。本接口底座已修复了禅道坑爹的报工幽灵丢失漏洞，直接确保工时准确入库！

### 4. 极简状态流转 (State Machine Control)
- **触发意图**：用户说**“那个 Bug 修完了，状态转给测试组长张三”**。
- **调用动作**：调用 `updateTask` 工具组合。

### 5. 智能链接提取 (Smart Link Resolver)
- **触发意图**：用户在群聊或对话中甩出一条任意掺杂着链接的文本（如 **“帮我看看这个任务什么情况：http://zentao.yourcompany.com/task-view-123.html”**）。
- **调用动作**：提取包含网址在内的整段内容传给底层解析封装。你可以依此瞬间掌握该链接指向的任务/缺陷/需求等一切核心骨干状态。

---
## 💻 安全与环境依赖说明 (Environment & Security)

> **⚠️ 运行须知：** 
> 这是一个受限的主流大模型端桥接应用。为保障您的操作合规，本扩展不会在未授权状态下进行任何风险调优或系统篡改。

作为环境依赖底座，首次使用必须执行授权鉴权：
```bash
zentao-cli login --url "https://xxxxx.com/zentao" --account "<账号>" --pwd "<密码>"
```

### 2. 命令行全量调用实例

本插件已将极其复杂的禅道 API 与路由封装为极简的指令集，可用作日常 CLI：

**🔥 地盘全视界 (My Dashboard - 部分功能开发中)**
```bash
# 基础：默认拉取指派给我的待办任务
zentao-cli my tasks
# 分类：拉取指派给我的缺陷清单
zentao-cli my bugs
# 分类：拉取指派给我的需求清单 (聚合：一键获取我名下的业务需求)
zentao-cli my stories
# 上帝视角：跨权限查看张三地盘上的所有任务 (查岗：跨项目查阅张三的任务列表)
zentao-cli my tasks --assign 张三
# 精准过滤：查看张三目前正在进行中的任务 (过滤：精确提取张三进行中的代办)
zentao-cli my tasks --assign 张三 --status doing
```

**🔥 对话派单化与执行自治 (Projects & Chat-to-Task)**
```bash
# 列出活跃中的项目总库 (新增能力)
zentao-cli projects
# 获取某项目下活跃的冲刺/迭代 ID 列表 (例如 577号项目)
zentao-cli executions --project 577
# 当期无迭代时：自动新建一个默认7天的本月新冲刺阶段
zentao-cli execution create --projectId 577 --name "2026年3月常规迭代"
# 瞬时派单：时间与工时全部由底层静默注入默认值
zentao-cli task create --execId 123 --name "网关熔断排查" --assign "张三"
# 精细派单：明确指定 8 小时预估工时和特定截止日期
zentao-cli task create --execId 123 --name "全量压测" --assign "李四" --estimate 8 --deadline "2026-03-20"
```

**🔥 单点状态机 (State Machine Control)**
```bash
# 状态扭转：仅将任务状态标记为已完成
zentao-cli task update --taskId 123 --status done
# 任务转交：仅将任务丢给张三处理
zentao-cli task update --taskId 123 --assign 张三
# 复合协同：完成、转交、加备注一气呵成
zentao-cli task update --taskId 123 --status done --assign 张三 --comment "代码已提交，转交测试验证"
```

**⚠️ 一句话报工作业 (Log Effort - 测试解决中)**
*(注：由于禅道底层隐秘的过滤规则，目前报工部分接口存在连通性缺陷，正在紧急修复连通中)*
```bash
# 极简报工：给 69704 任务快速登记 2 小时消耗
zentao-cli task effort --taskId 69704 --consumed 2
# 详尽报工：登记耗时并追加详细的研发日志
zentao-cli task effort --taskId 69704 --consumed 2.5 --desc "完成了核心业务逻辑的编写"
```

---

## 🤝 欢迎提出需求与共建

如果你对本插件有任何新的期待，或者希望由社区帮你加入更多针对禅道系统的定制化、自动化功能接口，我们非常**愿意并且乐意为大家拓展功能**！
欢迎随时前往 [GitHub Repository](https://github.com/chenish/mcp-zentao-pro/issues) 提交你的 Issue 需求或者 Bug 报错。


