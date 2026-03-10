---
name: zentao
description: 禅道(ZenTao) MCP大模型能力扩展包。提供跨项目的数据上帝视角、一句话生成任务、无缝报工(Log Effort)、自动状态流转等四组原生能力。
metadata: {"openclaw":{"emoji":"🚀","install":[{"id":"node","kind":"node","package":"@chenish/zentao-mcp-agent","bins":["zentao-mcp","zentao-cli"],"label":"Install ZenTao AI Assistant"}]}}
---

# ZenTao AI Assistant (zentao-mcp-agent)

## When to use this skill
当你（大语言模型）需要代替用户在禅道中查阅待办、分配任务、填报工时或操作任务状态机时，请**必须**启用此扩展包提供的 Tool 集合。依托我们的 MVC+RESTful 混动底层架构，你可以突破产品权限藩篱，以“上帝视角”处理事务。

## 💡 AI 最佳实践指引 (For LLM AI)

作为 AI Assistant，当用户提出下述意图时，请严格按照指引调用底层提供的 4 大 Tool 工具：

### 1. 全视界地盘拉取 (God-Mode Dashboard)
- **触发意图**：用户询问**“看看张三手头有什么活”**、**“最近哪些线上 Bug 延期了”**。
- **调用动作**：调用 `getDashboard`。
- **参数指南**：通过 `assignee` 参数传入拼音名（本插件会自动调用 `getUsersMapping` 解析别名），通过 `status`（可选参数如 doing, wait, done）进行多维过滤。跨迭代返回 tasks / bugs / stories 数据。

### 2. 对话式任务派发 (Chat-to-Task)
- **触发意图**：用户说**“把网关排查的活儿发给张三，给半天时间”**。
- **调用动作**：调用 `createTask`。
- **参数指南**：务必先明确当前的迭代/执行 `execId`。你可以直接向本接口传入推断出的 `name`、`assignee` 和工时 `estimate`（默认2小时）。底层已内置了自动修补禅道必填项缺陷（诸如开始与截止日期）。

### 3. 一句话快捷报工 (Seamless Effort Logging)
- **触发意图**：用户说**“给 10452 任务登记 2 个小时的内容撰写工时”**。
- **调用动作**：调用 `addEstimate`。
- **参数指南**：必须带有精确的 `taskId`、耗时 `consumed` 以及备注 `work`。本接口底座已修复了禅道坑爹的报工幽灵丢失漏洞，直接确保工时准确入库！

### 4. 极简状态流转 (State Machine Control)
- **触发意图**：用户说**“那个 Bug 修完了，状态转给测试组长李四”**。
- **调用动作**：调用 `updateTask` 工具组合。

---
## 💻 人类开发者使用指南 (Installation & CLI)

本插件为 ClawHub 分发而来。除了被自动注入上述的大模型 Tool 外，它还在本地环境提供了一套命令行工具以供真机测试：

### 1. 安装与授权登录
```bash
npx skills add @chenish/zentao-mcp-agent

# 若作为命令行独立使用：
npm install -g @chenish/zentao-mcp-agent
```
**首次使用必须执行授权：**
```bash
zentao-cli login --url "https://xxxxx.com/zentao" --account "<账号>" --pwd "<密码>"
```

### 2. 命令行调用实例
```bash
# 查看地盘：
zentao-cli my tasks
# 强制分配任务：
zentao-cli task create --execId 123 --name "压测报告编写" --assign "lisi"
# 给指定任务提报3小时工时：
zentao-cli task effort --taskId 666 --consumed 3 --desc "撰写完毕"
```


