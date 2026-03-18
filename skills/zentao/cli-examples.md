# ZenTao CLI Examples

这份文件用于人工调试、手动验收和参数核对。

- 当用户明确要求 CLI 命令时，再引用这里的内容。
- 当大模型只是代替用户完成禅道操作时，不要默认回显这些命令。

## 1. 安装与登录

```bash
npm install -g @chenish/zentao-mcp-agent
npx skills add @chenish/zentao-mcp-agent
zentao-cli login --url "https://xxxxx.com/zentao" --account "<账号>" --pwd "<密码>"
```

## 2. 地盘与管理视角

```bash
zentao-cli my tasks
zentao-cli my bugs
zentao-cli my stories
zentao-cli my tasks --assign zhangsan
zentao-cli my tasks --assign zhangsan --status doing

zentao-cli manage --users zhangsan
zentao-cli manage --users zhangsan,lisi --type tasks
zentao-cli manage --users zhangsan --type bugs
zentao-cli manage --users zhangsan --type tasks --status doing
zentao-cli manage --users zhangsan --type tasks --status doing,wait
zentao-cli manage --team-name "规划组"
zentao-cli manage --users zhangsan,lisi --date-from 2026-03-12 --date-to 2026-03-12
zentao-cli manage --users zhangsan,lisi --type tasks --deadline-to 2026-03-16
zentao-cli manage --users zhangsan,lisi --type tasks --overdue-only
```

## 3. 团队缓存

```bash
zentao-cli team save --name "规划组" --users "zhangsan,lisi,wangwu"
zentao-cli team list
zentao-cli team show --name "规划组"
zentao-cli team delete --name "规划组"
```

## 4. 晨会、负荷、周报

```bash
zentao-cli morning-check --team-name "规划组" --pri-max 1
zentao-cli load --team-name "规划组"
zentao-cli weekly-synthesis --team-name "规划组"
zentao-cli weekly-synthesis --team-name "规划组" --date-from 2026-03-09 --date-to 2026-03-13 --pri-max 1
zentao-cli weekly-synthesis --team-name "规划组" --view summary
zentao-cli weekly-synthesis --team-name "规划组" --view full
```

## 5. 项目、执行与派单

```bash
zentao-cli projects
zentao-cli executions --project 577
zentao-cli executions --projectId 577
zentao-cli executions --projectId 577 --status doing
zentao-cli execution create --projectId 577 --name "2026年3月常规迭代"
zentao-cli execution create --projectId 577 --name "2026年3月常规迭代" --begin "2026-03-17" --end "2026-03-24"
zentao-cli execution create --projectId 577 --name "2026年3月常规迭代" --days 6

zentao-cli task create --execId 123 --name "网关熔断排查" --assign "zhangsan"
zentao-cli task create --execId 123 --name "网关熔断排查" --assign "zhangsan" --pri 2 --desc "补充任务描述"
zentao-cli task create --execId 123 --name "多人联调排查" --assign "zhangsan,lisi,wangwu" --estimate 6
zentao-cli task create --execId 123 --name "多人串行验收" --assign "zhangsan,lisi" --mode linear --team-estimates 3,5
zentao-cli task create --execId 123 --name "全量压测" --assign "lisi" --estimate 8 --deadline "2026-03-20"
zentao-cli task create --execId 123 --name "接口联调" --assign "zhangsan" --estimate 4
zentao-cli task create --storyId 12072 --projectId 281 --name "数据库改造脚本适配" --assign "zhangsan" --estimate 8 --pri 2
zentao-cli task create --storyId 12072 --projectId 281 --templateExecId 5825 --executionName "2026年03月常规迭代" --name "数据库改造脚本适配" --assign "zhangsan" --desc "从需求拆分的研发任务"
```

## 6. 状态流转与检索

```bash
zentao-cli task update --taskId 123 --status done
zentao-cli task find --name "网关排查"
zentao-cli task find --name "接口联调" --owner zhangsan,lisi
zentao-cli task find --name "接口联调" --team-name "规划组"
zentao-cli task update --taskId 123 --status doing --comment "开始处理"
zentao-cli task update --taskId 123 --status closed --comment "验证通过，执行关闭"
zentao-cli task update --taskId 123 --assign zhangsan
zentao-cli task update --taskId 123 --status done --assign zhangsan --comment "代码已提交，转交测试验证"

zentao-cli story update --storyId 12072 --status closed --comment "需求已验收完成"
zentao-cli story update --storyId 14526 --status active --comment "重新激活继续推进"
zentao-cli story update --storyId 12072 --assign zhangsan --comment "转交继续跟进"

zentao-cli bug update --bugId 11071 --status done --comment "缺陷已修复完成"
zentao-cli bug update --bugId 11071 --status closed --comment "验证通过，关闭缺陷"
zentao-cli bug update --bugId 11071 --status active --comment "重新激活继续跟踪"
zentao-cli bug update --bugId 11071 --assign zhangsan --comment "转交继续跟进"
```

## 7. 报工

```bash
zentao-cli task effort --taskId 69704 --consumed 2
zentao-cli task effort --taskId 69704 --consumed 2.5 --desc "完成了核心业务逻辑的编写"
```

## 8. 当前已知限制

- `task effort --taskId <id> --desc "..."` 这种仅写说明不填耗时的形态，在当前禅道环境中页面历史不会稳定落备注。
- `story update --storyId <id> --status active` 在当前禅道环境中尚未稳定生效。
