#!/usr/bin/env node
import { Command } from 'commander';
import { ZentaoClient } from './api/client.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

const program = new Command();
const CONFIG_DIR = path.join(os.homedir(), '.config', 'zentao');
const CONFIG_PATH = path.join(CONFIG_DIR, '.env');
const TEAMS_PATH = path.join(CONFIG_DIR, 'teams.json');

type TeamEntry = {
  name: string;
  members: string[];
  updatedAt: string;
};

type TeamStore = Record<string, TeamEntry>;

program
  .name('zentao')
  .description('Zentao CLI Tool for Agent V4 Framework')
  .version('1.1.3');
program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  zentao team save --name "规划组" --users "zhangsan,lisi"');
  console.log('  zentao manage --team-name "规划组" --type tasks --deadline-to 2026-03-16');
  console.log('  zentao morning-check --team-name "规划组"');
  console.log('  zentao weekly-synthesis --team-name "规划组"');
  console.log('  zentao story update --storyId 12072 --status closed --comment "需求已验收完成"');
  console.log('  zentao bug update --bugId 11071 --status done --comment "缺陷已修复完成"');
});

// Load environment variables for token auth
function getConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    dotenv.config({ path: CONFIG_PATH });
  }
  return {
    url: process.env.ZENTAO_URL || '',
    token: process.env.ZENTAO_TOKEN || '',
    zentaosid: process.env.ZENTAO_SID || '',
    account: process.env.ZENTAO_ACCOUNT ? Buffer.from(process.env.ZENTAO_ACCOUNT, 'base64').toString() : '',
    password: process.env.ZENTAO_PASSWORD ? Buffer.from(process.env.ZENTAO_PASSWORD, 'base64').toString() : '',
  };
}

type LoadedConfig = ReturnType<typeof getConfig>;

function writeConfig(conf: LoadedConfig) {
  ensureConfigDir();
  const envContent = [
    `ZENTAO_URL=${conf.url}`,
    `ZENTAO_TOKEN=${conf.token}`,
    `ZENTAO_SID=${conf.zentaosid}`,
    `ZENTAO_ACCOUNT=${conf.account ? Buffer.from(conf.account).toString('base64') : ''}`,
    `ZENTAO_PASSWORD=${conf.password ? Buffer.from(conf.password).toString('base64') : ''}`,
  ].join('\n') + '\n';
  fs.writeFileSync(CONFIG_PATH, envContent, 'utf-8');
}

function createConfiguredClient(conf: LoadedConfig) {
  const client = new ZentaoClient(conf.url, conf.token, conf.zentaosid);
  if (conf.account && conf.password) {
    client.setCredentials(conf.account, conf.password);
    client.setAuthRefreshHandler(({ token, zentaosid }) => {
      writeConfig({
        ...conf,
        token,
        zentaosid,
      });
    });
  }
  return client;
}

function ensureConfigDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function normalizeTeamKey(name: string): string {
  return String(name || '').trim().toLowerCase();
}

function splitMembers(raw?: string): string[] {
  if (!raw) return [];
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function splitEstimateValues(raw?: string): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function readTeamStore(): TeamStore {
  if (!fs.existsSync(TEAMS_PATH)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(TEAMS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as TeamStore;
  } catch {
    return {};
  }
}

function writeTeamStore(store: TeamStore) {
  ensureConfigDir();
  fs.writeFileSync(TEAMS_PATH, JSON.stringify(store, null, 2) + '\n', 'utf-8');
}

function getStoredTeam(name: string): TeamEntry | null {
  const store = readTeamStore();
  return store[normalizeTeamKey(name)] || null;
}

function saveStoredTeam(name: string, members: string[]) {
  const normalizedName = String(name || '').trim();
  const store = readTeamStore();
  store[normalizeTeamKey(normalizedName)] = {
    name: normalizedName,
    members: Array.from(new Set(members.map((member) => String(member || '').trim()).filter(Boolean))),
    updatedAt: new Date().toISOString(),
  };
  writeTeamStore(store);
}

function deleteStoredTeam(name: string): boolean {
  const key = normalizeTeamKey(name);
  const store = readTeamStore();
  if (!store[key]) return false;
  delete store[key];
  writeTeamStore(store);
  return true;
}

program
  .command('login')
  .description('Login to Zentao and save the token to local config')
  .requiredOption('--url <url>', 'Zentao base URL')
  .requiredOption('--account <act>', 'Accountname')
  .requiredOption('--pwd <pwd>', 'Password')
  .action(async (options) => {
    try {
      const client = new ZentaoClient(options.url);
      const authRes = await client.login(options.account, options.pwd);

      writeConfig({
        url: options.url,
        token: authRes.token,
        zentaosid: authRes.zentaosid,
        account: options.account,
        password: options.pwd,
      });

      console.log('✅ Login successful, config saved to:', CONFIG_PATH);
    } catch (error: any) {
      console.error('❌ Login failed:', error.message || error);
      process.exit(1);
    }
  });

program
  .command('view')
  .argument('<text>', 'Any string containing a zentao item URL')
  .description('Smart resolve and fetch ZenTao entity from text')
  .action(async (text) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }
    try {
      const conf = getConfig();
      const client = createConfiguredClient(conf);
      const output = await client.resolveUrlAndFetch(text);
      console.log('✅ Entity resolved successfully:');
      console.table([{
        ID: output.id,
        类型: output.type,
        名称: output.name,
        当前状态: output.statusLabel || output.status,
        原始状态: output.status,
        任务模式: output.taskMode || '',
        指派给: output.assignedTo,
        截止日期: output.deadline || '',
        完成时间: output.finishedDate || output.closedDate || '',
        最近完成动作: output.latestCompletionAt ? `${output.latestCompletionBy} 于 ${output.latestCompletionAt} 完成` : '',
        闭环判断: output.closureSummary || '',
        团队状态: output.teamStatusSummary || '',
        网页链接: output.webUrl,
      }]);
    } catch (error: any) {
      console.error('❌ Resolve failed:', error.message || error);
    }
  });

program
  .command('my')
  .argument('<type>', 'Type: tasks, stories, bugs')
  .option('--assign <account>', 'Filter by assignee (e.g. zhangsan)')
  .option('--status <status>', 'Filter by status (e.g. doing, wait)')
  .description('Get my dashboard items')
  .action(async (type, options) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login --url <url> --account <act> --pwd <pwd>" first.');
      process.exit(1);
    }

    try {
      const client = createConfiguredClient(conf);
      let dataType: 'task' | 'story' | 'bug' = 'task';
      if (type === 'stories' || type === 'story') dataType = 'story';
      else if (type === 'bugs' || type === 'bug') dataType = 'bug';

      // mapping user alias
      let assignee = options.assign;
      if (assignee) {
        try {
          const mapping = await client.getUsersMapping();
          if (mapping[assignee]) assignee = mapping[assignee];
        } catch { } // ignore
      }

      const items = await client.getMyDashboard(dataType, assignee, options.status);
      console.table(items);
    } catch (error: any) {
      console.error('❌ Failed to fetch dashboard:', error.message || error);
    }
  });

program
  .command('projects')
  .description('Get active projects')
  .action(async () => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }
    try {
      const client = createConfiguredClient(conf);
      let projects = await client.getProjects();
      console.table(projects.map(p => ({ id: p.id, name: p.name, status: p.status, begin: p.begin, end: p.end })));
    } catch (e: any) {
      console.error('❌ Failed:', e.message || e);
    }
  });

program
  .command('executions')
  .description('Get active executions/sprints')
  .option('--projectId <id>', 'Filter by project ID')
  .option('--status <status>', 'Filter by status (e.g. doing)')
  .action(async (options) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }
    try {
      const client = createConfiguredClient(conf);
      const projectId = options.projectId ? parseInt(options.projectId, 10) : undefined;
      let executions = await client.getActiveExecutions(projectId);
      if (options.status) executions = executions.filter(e => e.status === options.status);
      console.table(executions.map(e => ({ id: e.id, name: e.name, status: e.status, begin: e.begin, end: e.end, progress: e.progress })));
    } catch (e: any) {
      console.error('❌ Failed:', e.message || e);
    }
  });

program
  .command('execution')
  .argument('<action>', 'Action: create')
  .option('--projectId <id>', 'Parent Project ID')
  .option('--name <name>', 'Execution name')
  .option('--begin <date>', 'Begin date (YYYY-MM-DD)')
  .option('--end <date>', 'End date (YYYY-MM-DD)')
  .option('--days <days>', 'Available work days', '5')
  .action(async (action, options) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }
    try {
      if (action === 'create') {
        if (!options.projectId || !options.name) {
          console.error('❌ Missing required options: --projectId, --name');
          return;
        }
        const client = createConfiguredClient(conf);

        // Auto padding missing dates
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const defaultBegin = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        // Next week
        const end = new Date(now.getTime() + 86400000 * 7);
        const defaultEnd = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

        const res = await client.createExecution(parseInt(options.projectId), {
          name: options.name,
          begin: options.begin || defaultBegin,
          end: options.end || defaultEnd,
          days: parseInt(options.days),
          team: '' // Default empty
        });
        console.log('✅ Execution created successfully. Raw response:', res);
      }
    } catch (e: any) {
      console.error('❌ Failed:', e.message || e);
    }
  });

program
  .command('task')
  .argument('<action>', 'Action: create, effort, update, find')
  .option('--execId <id>', 'Execution ID')
  .option('--projectId <id>', 'Project ID for auto monthly execution resolution')
  .option('--templateExecId <id>', 'Template execution ID used when auto-creating the current month execution')
  .option('--executionName <name>', 'Execution name used when auto-creating the current month execution')
  .option('--storyId <id>', 'Story ID when splitting a story into task')
  .option('--name <name>', 'Task name')
  .option('--assign <account>', 'Assignee account or comma-separated members for multi-task')
  .option('--mode <mode>', 'Task collaboration mode when multiple assignees are provided: multi or linear')
  .option('--team-estimates <hours>', 'Per-member estimates for multi-task, comma-separated (e.g. 2,2,4)')
  .option('--owner <names>', 'Task lookup owners, comma-separated accounts or Chinese names')
  .option('--team-name <name>', 'Saved team name for task lookup scope')
  .option('--taskId <id>', 'Task ID')
  .option('--consumed <h>', 'Consumed hours')
  .option('--desc <text>', 'Effort description / comment')
  .option('--deadline <date>', 'Task deadline (YYYY-MM-DD)')
  .option('--estimate <h>', 'Estimated hours')
  .option('--pri <level>', 'Task priority, defaults to 3')
  .option('--status <status>', 'New task status (e.g. done, closed)')
  .option('--date-from <date>', 'Task lookup completed-date start window (YYYY-MM-DD)')
  .option('--date-to <date>', 'Task lookup completed-date end window (YYYY-MM-DD)')
  .option('--comment <text>', 'Comment for the update operation')
  .on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  zentao task create --execId 123 --name "网关排查" --assign zhangsan');
    console.log('  zentao task create --execId 123 --name "网关排查" --assign zhangsan --pri 2 --desc "补充任务描述"');
    console.log('  zentao task create --execId 123 --name "多人联调排查" --assign "zhangsan,lisi,wangwu" --estimate 6');
    console.log('  zentao task create --execId 123 --name "多人串行验收" --assign "zhangsan,lisi" --mode linear --team-estimates 3,5');
    console.log('  zentao task create --storyId 12072 --projectId 281 --name "数据库改造脚本适配" --assign zhangsan --estimate 8 --pri 2');
    console.log('  zentao task create --storyId 12072 --projectId 281 --templateExecId 5825 --executionName "黑龙江移动_网优之家_2026年03月" --name "数据库改造脚本适配" --assign zhangsan --desc "从需求拆分的研发任务"');
    console.log('  zentao task find --name "网关排查"');
    console.log('  zentao task update --taskId 123 --status done --comment "已完成转测"');
  })
  .action(async (action, options) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }

    const client = createConfiguredClient(conf);

    try {
      if (action === 'create') {
        if (!options.name || !options.assign) {
          console.error('❌ Missing required options for task create: --name, --assign');
          return;
        }
        const assignees = await resolveMemberInputs(client, options.assign);
        if (assignees.length === 0) {
          console.error('❌ No valid assignees resolved from --assign.');
          return;
        }

        const assigneeLabel = await describeTeamMembers(client, assignees);
        const isMultiTask = assignees.length > 1;
        const requestedMode = String(options.mode || '').trim().toLowerCase();
        if (requestedMode && requestedMode !== 'multi' && requestedMode !== 'linear') {
          console.error('❌ Invalid --mode. Please use "multi" or "linear".');
          return;
        }

        let executionId = options.execId;
        let story: any = null;
        if (options.storyId) {
          story = await client.getStory(options.storyId);
          if (!executionId) {
            const ensuredExecution = await client.ensureMonthlyExecutionForStory({
              storyId: options.storyId,
              projectId: options.projectId ? parseInt(options.projectId, 10) : undefined,
              templateExecId: options.templateExecId ? parseInt(options.templateExecId, 10) : undefined,
              executionName: options.executionName,
            });
            executionId = String(ensuredExecution.executionId);
            if (ensuredExecution.created) {
              console.log(`✅ Auto-created current month execution: ${ensuredExecution.executionName} (copied from ${ensuredExecution.templateExecutionName})`);
            } else {
              console.log(`✅ Reusing current month execution: ${ensuredExecution.executionName}`);
            }
          }
        }

        if (!executionId) {
          console.error('❌ Missing execution target. Please provide --execId, or provide --storyId with --projectId to auto-prepare the current month execution.');
          return;
        }

        const defaultDeadline = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
        const payload: any = {
          name: options.name,
          type: 'devel',
          deadline: options.deadline || defaultDeadline,
          pri: options.pri ? parseInt(options.pri, 10) : 3,
          ...(options.desc ? { desc: options.desc } : {}),
          ...(options.storyId ? { story: parseInt(options.storyId, 10) } : {}),
          ...(story?.module ? { module: story.module } : {}),
          // estStarted will be automatically populated inside client.createTask
        };

        if (isMultiTask) {
          const explicitTeamEstimates = splitEstimateValues(options.teamEstimates);
          if (options.teamEstimates && explicitTeamEstimates.length !== assignees.length) {
            console.error(`❌ --team-estimates count (${explicitTeamEstimates.length}) must match assignee count (${assignees.length}).`);
            return;
          }

          let teamEstimates: number[];
          if (explicitTeamEstimates.length > 0) {
            teamEstimates = explicitTeamEstimates;
          } else if (options.estimate) {
            const totalEstimate = parseFloat(options.estimate);
            const avg = Math.floor((totalEstimate / assignees.length) * 10) / 10;
            teamEstimates = assignees.map((_, index) => {
              if (index < assignees.length - 1) return avg;
              return Number((totalEstimate - avg * (assignees.length - 1)).toFixed(1));
            });
          } else {
            teamEstimates = assignees.map(() => 2);
          }

          payload.multiple = 1;
          payload.mode = requestedMode || 'multi';
          payload.team = assignees;
          payload.teamEstimate = teamEstimates;
          payload.estimate = Number(teamEstimates.reduce((sum, item) => sum + item, 0).toFixed(1));
        } else {
          payload.assignedTo = assignees[0];
          payload.estimate = options.estimate ? parseFloat(options.estimate) : 2;
          if (assignees[0] !== options.assign) {
            console.log(`✅ Implicit mapping activated: Assigned "${options.assign}" -> "${assignees[0]}"`);
          }
        }

        const res = await client.createTask(executionId, payload);
        console.log('✅ Task created successfully.');
        console.log(`任务ID：${res.id}`);
        console.log(`任务名称：${res.name}`);
        console.log(`执行ID：${res.execution}`);
        console.log(`任务模式：${res.mode || 'single'}`);
        console.log(`指派对象：${assigneeLabel}`);
        if (isMultiTask) {
          console.log(`成员预估：${(payload.teamEstimate || []).join(', ')}h`);
          console.log(`总预估：${payload.estimate}h`);
        } else {
          console.log(`总预估：${payload.estimate}h`);
        }
      }
      else if (action === 'effort') {
        if (!options.taskId || !options.consumed) {
          console.error('❌ Missing required options for task effort: --taskId, --consumed');
          return;
        }

        const payload = {
          consumed: parseFloat(options.consumed),
          left: 0,
          work: options.desc,
          // date will be populated inside client.addEstimate
        };

        const res = await client.addEstimate(options.taskId, payload);
        console.log('✅ Effort logged successfully. Raw response:', res);
      }
      else if (action === 'find') {
        if (!options.name) {
          console.error('❌ Missing required options for task find: --name');
          return;
        }

        const owners = options.owner || conf.account;
        const assignees = await resolveMemberInputs(client, owners, options.teamName);
        const statuses = resolveStatusFilters(options.status);
        const result = await client.findTasksByName(options.name, assignees, {
          statuses,
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
        });

        console.log('\n🔎 任务名称检索结果 (Task Lookup)\n');
        console.log(`检索关键词：${options.name}`);
        if (options.teamName) console.log(`团队范围：${options.teamName}`);
        else console.log(`成员范围：${owners}`);
        console.log(`匹配数量：${result.length}`);

        if (result.length === 0) {
          console.log('未找到匹配任务。');
          return;
        }

        console.table(result.map((item: any) => ({
          负责人: item.realname ? `${item.realname} (${item.account})` : item.account,
          编号: item.id,
          任务名称: item.name,
          状态: item.status,
          优先级: item.pri,
          截止日期: formatDisplayDate(item.deadline),
          完成日期: formatDisplayDate(item.finishedDate || item.closedDate || ''),
          所属执行: item.executionName || '',
        })));
      }
      else if (action === 'update') {
        if (!options.taskId) {
          console.error('❌ Missing required options for task update: --taskId');
          return;
        }

        const payload: any = {};
        if (options.assign) {
          let assignedTo = options.assign;
          try {
            const mapping = await client.getUsersMapping();
            if (mapping[options.assign]) {
              assignedTo = mapping[options.assign];
              console.log(`✅ Implicit mapping activated: Assigned "${options.assign}" -> "${assignedTo}"`);
            }
          } catch (e) {
            console.warn('⚠️ Could not fetch user mappings. Treating assignee as raw account name.');
          }
          payload.assignedTo = assignedTo;
        }
        if (options.status) payload.status = options.status;
        if (options.comment) payload.comment = options.comment;
        if (options.consumed !== undefined) payload.consumed = options.consumed;
        if (options.left !== undefined) payload.left = options.left;

        if (Object.keys(payload).length === 0) {
          console.error('❌ Nothing to update. Please provide --assign, --status, or --comment');
          return;
        }

        const res = await client.updateTask(options.taskId, payload);
        console.log('✅ Task updated successfully. Raw response:', res);
      }
      else {
        console.error('❌ Unknown action. Use "zentao task create", "zentao task effort", "zentao task find", or "zentao task update"');
      }
    } catch (error: any) {
      console.error('❌ Operation failed:', error.message || error);
      if (error.response && error.response.data) {
        console.error('Server response:', JSON.stringify(error.response.data, null, 2));
      }
    }
  });

program
  .command('story')
  .argument('<action>', 'Action: update')
  .option('--storyId <id>', 'Story ID')
  .option('--assign <account>', 'Assignee account or Chinese name')
  .option('--status <status>', 'New story status (e.g. active, done, closed)')
  .option('--comment <text>', 'Comment for the update operation')
  .option('--closed-reason <reason>', 'Close reason for story close flow', 'done')
  .description('Update story lifecycle or assignment through REST workflow nodes')
  .on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  zentao story update --storyId 12072 --status closed --comment "需求已验收完成"');
    console.log('  zentao story update --storyId 14526 --status active --comment "重新激活继续推进"');
    console.log('  zentao story update --storyId 12072 --assign zhangsan --comment "转交跟进"');
  })
  .action(async (action, options) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }

    const client = createConfiguredClient(conf);

    try {
      if (action !== 'update') {
        console.error('❌ Unknown action. Use "zentao story update"');
        return;
      }

      if (!options.storyId) {
        console.error('❌ Missing required options for story update: --storyId');
        return;
      }

      const payload: any = {};
      if (options.assign) {
        const assignedTo = await resolveSingleAssignee(client, options.assign);
        if (assignedTo !== options.assign) {
          console.log(`✅ Implicit mapping activated: Assigned "${options.assign}" -> "${assignedTo}"`);
        }
        payload.assignedTo = assignedTo;
      }
      if (options.status) payload.status = options.status;
      if (options.comment) payload.comment = options.comment;
      if (options.closedReason) payload.closedReason = options.closedReason;

      if (!payload.status && !payload.assignedTo) {
        console.error('❌ Nothing to update. Please provide --status or --assign');
        return;
      }

      const res = await client.updateStory(options.storyId, payload);
      console.log('✅ Story updated successfully. Raw response:', res);
    } catch (error: any) {
      console.error('❌ Operation failed:', error.message || error);
      if (error.response && error.response.data) {
        console.error('Server response:', JSON.stringify(error.response.data, null, 2));
      }
    }
  });

program
  .command('bug')
  .argument('<action>', 'Action: update')
  .option('--bugId <id>', 'Bug ID')
  .option('--assign <account>', 'Assignee account or Chinese name')
  .option('--status <status>', 'New bug status (e.g. active, done, closed)')
  .option('--comment <text>', 'Comment for the update operation')
  .option('--resolution <resolution>', 'Resolution for bug done flow', 'fixed')
  .option('--resolved-date <date>', 'Resolved date (YYYY-MM-DD)')
  .description('Update bug lifecycle or assignment through REST workflow nodes')
  .on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  zentao bug update --bugId 11071 --status done --comment "缺陷已修复完成"');
    console.log('  zentao bug update --bugId 11071 --status closed --comment "验证通过，关闭缺陷"');
    console.log('  zentao bug update --bugId 11071 --assign zhangsan --comment "转交继续跟进"');
  })
  .action(async (action, options) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }

    const client = createConfiguredClient(conf);

    try {
      if (action !== 'update') {
        console.error('❌ Unknown action. Use "zentao bug update"');
        return;
      }

      if (!options.bugId) {
        console.error('❌ Missing required options for bug update: --bugId');
        return;
      }

      const payload: any = {};
      if (options.assign) {
        const assignedTo = await resolveSingleAssignee(client, options.assign);
        if (assignedTo !== options.assign) {
          console.log(`✅ Implicit mapping activated: Assigned "${options.assign}" -> "${assignedTo}"`);
        }
        payload.assignedTo = assignedTo;
      }
      if (options.status) payload.status = options.status;
      if (options.comment) payload.comment = options.comment;
      if (options.resolution) payload.resolution = options.resolution;
      if (options.resolvedDate) payload.resolvedDate = options.resolvedDate;

      if (!payload.status && !payload.assignedTo) {
        console.error('❌ Nothing to update. Please provide --status or --assign');
        return;
      }

      const res = await client.updateBug(options.bugId, payload);
      console.log('✅ Bug updated successfully. Raw response:', res);
    } catch (error: any) {
      console.error('❌ Operation failed:', error.message || error);
      if (error.response && error.response.data) {
        console.error('Server response:', JSON.stringify(error.response.data, null, 2));
      }
    }
  });


/**
 * ─────────────────────────────────────
 * 高级度量工具 (Advanced Metric Tools)
 * ─────────────────────────────────────
 */

// Helper 函数：解析逗号分隔的用户名列表并做账号映射
async function resolveAssignees(client: ZentaoClient, raw: string): Promise<string[]> {
  const names = raw.split(',').map(s => s.trim()).filter(Boolean);
  try {
    const mapping = await client.getUsersMapping();
    return names.map(n => mapping[n] || n);
  } catch {
    return names;
  }
}

async function resolveSingleAssignee(client: ZentaoClient, raw: string): Promise<string> {
  const [resolved] = await resolveAssignees(client, raw);
  return resolved || raw;
}

async function resolveMemberInputs(client: ZentaoClient, raw?: string, teamName?: string): Promise<string[]> {
  const storedMembers = teamName ? (getStoredTeam(teamName)?.members || []) : [];
  if (teamName && storedMembers.length === 0) {
    throw new Error(`Team "${teamName}" not found. Please run "zentao team save --name ${teamName} --users <成员列表>" first.`);
  }

  const combined = Array.from(new Set([...splitMembers(raw), ...storedMembers]));
  if (combined.length === 0) {
    throw new Error('Please provide --users/--assign/--team or --team-name.');
  }

  return resolveAssignees(client, combined.join(','));
}

async function describeTeamMembers(client: ZentaoClient | null, members: string[]): Promise<string> {
  if (!client || members.length === 0) {
    return members.join(', ');
  }

  const labels = await Promise.all(
    members.map(async (member) => {
      const realname = await client.getUserRealname(member);
      return realname ? `${realname}(${member})` : member;
    })
  );
  return labels.join(', ');
}

function resolveManageTypes(raw?: string): Array<'task' | 'story' | 'bug'> {
  if (!raw || raw === 'all') return ['task', 'story', 'bug'];

  const parsed = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => {
      if (item === 'tasks' || item === 'task') return 'task';
      if (item === 'stories' || item === 'story') return 'story';
      if (item === 'bugs' || item === 'bug') return 'bug';
      return '';
    })
    .filter(Boolean) as Array<'task' | 'story' | 'bug'>;

  return parsed.length > 0 ? Array.from(new Set(parsed)) : ['task', 'story', 'bug'];
}

function resolveStatusFilters(raw?: string): string[] {
  if (!raw) return [];

  return Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function formatManageTypeLabel(types: Array<'task' | 'story' | 'bug'>): string {
  const labels: Record<'task' | 'story' | 'bug', string> = {
    task: '任务',
    story: '需求',
    bug: 'Bug',
  };

  return types.map((type) => labels[type]).join(' / ');
}

function buildManageFilterSummary(options: any): string {
  const parts: string[] = [];
  if (options.teamName) parts.push(`团队=${options.teamName}`);
  if (options.users) parts.push(`成员=${options.users}`);
  if (options.status) parts.push(`状态=${options.status}`);
  if (options.dateFrom || options.dateTo) {
    parts.push(`完成时间=${options.dateFrom || '...'} ~ ${options.dateTo || '...'}`);
  }
  if (options.deadlineFrom || options.deadlineTo) {
    parts.push(`截止日期=${options.deadlineFrom || '...'} ~ ${options.deadlineTo || '...'}`);
  }
  if (options.overdueOnly) parts.push('仅已延期');

  return parts.join(' | ');
}

function formatDisplayDate(value?: string): string {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === '0000-00-00 00:00:00' || normalized === '0000-00-00') {
    return '';
  }
  return normalized;
}

function formatShortName(value?: string, length: number = 20): string {
  return String(value || '').substring(0, length);
}

function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
}

function parseDateOnly(value?: string): Date {
  const normalized = String(value || '').trim();
  if (!normalized) return new Date();
  return new Date(`${normalized}T00:00:00`);
}

function getWeekWindow(baseDate?: string): { dateFrom: string; dateTo: string; weekEnd: string } {
  const anchor = parseDateOnly(baseDate);
  const day = anchor.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    dateFrom: formatDateOnly(monday),
    dateTo: formatDateOnly(anchor),
    weekEnd: formatDateOnly(sunday),
  };
}

program
  .command('team')
  .argument('<action>', 'Action: save, list, show, delete')
  .option('--name <name>', '团队名称')
  .option('--users <names>', '团队成员账号或中文名，多人用逗号分隔')
  .description('管理本地缓存的团队别名，供 manage/load/stagnant/morning-check 复用')
  .on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  zentao team save --name "规划组" --users "zhangsan,lisi,wangwu"');
    console.log('  zentao team list');
    console.log('  zentao team show --name "规划组"');
    console.log('  zentao team delete --name "规划组"');
  })
  .action(async (action, options) => {
    const normalizedAction = String(action || '').trim().toLowerCase();
    const conf = getConfig();

    try {
      if (normalizedAction === 'save') {
        if (!options.name || !options.users) {
          console.error('❌ Missing required options for team save: --name, --users');
          return;
        }
        if (!conf.url || !conf.token) {
          console.error('❌ Please run "zentao login" first.');
          process.exit(1);
        }

        const client = createConfiguredClient(conf);
        const members = await resolveAssignees(client, options.users);
        saveStoredTeam(options.name, members);
        const memberSummary = await describeTeamMembers(client, members);
        console.log(`✅ Team "${options.name}" saved successfully.`);
        console.log(`成员(${members.length})：${memberSummary}`);
        console.log(`配置文件：${TEAMS_PATH}`);
        return;
      }

      if (normalizedAction === 'list') {
        const teams = Object.values(readTeamStore()).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        if (teams.length === 0) {
          console.log('📭 当前没有已保存的团队。可使用 `zentao team save --name <团队名> --users <成员列表>` 创建。');
          return;
        }

        let client: ZentaoClient | null = null;
        if (conf.url && conf.token) {
          client = createConfiguredClient(conf);
        }

        const rows = await Promise.all(
          teams.map(async (team) => ({
            团队名: team.name,
            成员数: team.members.length,
            成员: await describeTeamMembers(client, team.members),
            更新时间: formatDisplayDate(team.updatedAt),
          }))
        );
        console.table(rows);
        return;
      }

      if (normalizedAction === 'show') {
        if (!options.name) {
          console.error('❌ Missing required option for team show: --name');
          return;
        }

        const team = getStoredTeam(options.name);
        if (!team) {
          console.error(`❌ Team "${options.name}" not found.`);
          return;
        }

        let client: ZentaoClient | null = null;
        if (conf.url && conf.token) {
          client = createConfiguredClient(conf);
        }

        console.log(`\n👥 团队：${team.name}`);
        console.log(`成员数：${team.members.length}`);
        console.log(`更新时间：${formatDisplayDate(team.updatedAt) || '-'}`);

        const rows = await Promise.all(
          team.members.map(async (member) => ({
            账号: member,
            姓名: client ? (await client.getUserRealname(member)) || '' : '',
          }))
        );
        console.table(rows);
        return;
      }

      if (normalizedAction === 'delete') {
        if (!options.name) {
          console.error('❌ Missing required option for team delete: --name');
          return;
        }

        const deleted = deleteStoredTeam(options.name);
        if (!deleted) {
          console.error(`❌ Team "${options.name}" not found.`);
          return;
        }

        console.log(`✅ Team "${options.name}" deleted successfully.`);
        return;
      }

      console.error('❌ Unknown team action. Use "save", "list", "show", or "delete".');
    } catch (e: any) {
      console.error('❌ Failed:', e.message || e);
    }
  });

program
  .command('manage')
  .description('管理视角聚合指定成员的任务、需求、缺陷')
  .option('--users <names>', '成员账号或中文名，多人用逗号分隔')
  .option('--team-name <name>', '已保存的团队名称，可与 --users 组合使用')
  .option('--type <types>', '聚合类型：all/tasks/stories/bugs，可逗号分隔', 'all')
  .option('--status <status>', '按状态过滤，支持逗号分隔，如 doing、wait、done')
  .option('--date-from <date>', '完成/关闭项的开始日期，格式 YYYY-MM-DD')
  .option('--date-to <date>', '完成/关闭项的结束日期，格式 YYYY-MM-DD')
  .option('--deadline-from <date>', '按截止日期开始范围过滤，格式 YYYY-MM-DD')
  .option('--deadline-to <date>', '按截止日期结束范围过滤，格式 YYYY-MM-DD')
  .option('--overdue-only', '仅保留已延期项（截止日期早于今天）')
  .on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  zentao manage --users zhangsan,lisi --type tasks');
    console.log('  zentao manage --team-name "规划组" --status doing,wait,done --date-from 2026-03-10 --date-to 2026-03-14');
    console.log('  zentao manage --team-name "规划组" --type tasks --deadline-to 2026-03-16');
    console.log('  zentao manage --team-name "规划组" --type tasks --overdue-only');
  })
  .action(async (options) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }

    try {
      const client = createConfiguredClient(conf);

      const assignees = await resolveMemberInputs(client, options.users, options.teamName);
      const types = resolveManageTypes(options.type);
      const statuses = resolveStatusFilters(options.status);
      const result = await client.getManagedDashboard(assignees, types, {
        statuses,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        deadlineFrom: options.deadlineFrom,
        deadlineTo: options.deadlineTo,
        overdueOnly: Boolean(options.overdueOnly),
      });

      console.log('\n🧭 管理视角聚合结果 (Management Dashboard)\n');
      console.log(`查询类型：${formatManageTypeLabel(types)}`);
      const filterSummary = buildManageFilterSummary(options);
      if (filterSummary) {
        console.log(`过滤条件：${filterSummary}`);
      }
      const totalParts: string[] = [];
      if (types.includes('task')) totalParts.push(`任务 ${result.totals.tasks}`);
      if (types.includes('story')) totalParts.push(`需求 ${result.totals.stories}`);
      if (types.includes('bug')) totalParts.push(`Bug ${result.totals.bugs}`);
      console.log(`总计（当前查询口径）：${totalParts.join(' | ')}`);

      for (const user of result.users) {
        const displayName = user.realname ? `${user.realname} (${user.account})` : user.account;
        console.log(`\n👤 ${displayName}`);
        console.log(`任务 ${user.summary.tasks} | 需求 ${user.summary.stories} | Bug ${user.summary.bugs}`);

        if (types.includes('task') && user.tasks.length > 0) {
          console.log('\nTasks');
          console.table(user.tasks.map((item: any) => ({
            编号: item.id,
            任务名称: item.name,
            状态: item.status,
            优先级: item.pri,
            截止日期: formatDisplayDate(item.deadline),
            完成日期: formatDisplayDate(item.finishedDate || item.closedDate || ''),
            所属执行: item.executionName,
            更新时间: formatDisplayDate(item.lastEditedDate || item.assignedDate || item.openedDate || ''),
          })));
        }

        if (types.includes('story') && user.stories.length > 0) {
          console.log('\nStories');
          console.table(user.stories.map((item: any) => ({
            编号: item.id,
            需求名称: item.title || item.name,
            状态: item.status,
            优先级: item.pri,
            截止日期: formatDisplayDate(item.deadline || ''),
            关闭日期: formatDisplayDate(item.closedDate || ''),
            阶段: item.stage,
            更新时间: formatDisplayDate(item.lastEditedDate || item.assignedDate || item.openedDate || ''),
          })));
        }

        if (types.includes('bug') && user.bugs.length > 0) {
          console.log('\nBugs');
          console.table(user.bugs.map((item: any) => ({
            编号: item.id,
            Bug标题: item.title,
            状态: item.status,
            优先级: item.pri,
            严重程度: item.severity,
            截止日期: formatDisplayDate(item.deadline || ''),
            解决日期: formatDisplayDate(item.resolvedDate || item.closedDate || ''),
            指派给: item.assignedTo,
            更新时间: formatDisplayDate(item.lastEditedDate || item.assignedDate || item.openedDate || ''),
          })));
        }
      }
    } catch (e: any) {
      console.error('❌ Failed:', e.message || e);
    }
  });

// ─ load: 派发前负荷参考雷达 ─────────────────────
program
  .command('load')
  .description('查看指定成员的当前并发任务数与剩余工时（仅供派单参考，不强制阻断）')
  .option('--assign <names>', '成员账号或中文名，多人用逗号分隔（如 zhangsan,lisi 或 张三,李四）')
  .option('--team-name <name>', '已保存的团队名称，可与 --assign 组合使用')
  .on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  zentao load --assign zhangsan,lisi');
    console.log('  zentao load --team-name "规划组"');
  })
  .action(async (options) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }
    try {
      const client = createConfiguredClient(conf);
      const assignees = await resolveMemberInputs(client, options.assign, options.teamName);
      const result = await client.getMemberLoad(assignees);
      console.log('\n📊 派发前负荷参考雷达 (Workload Radar)\n');
      for (const [person, data] of Object.entries(result) as [string, any][]) {
        console.log(
          `👤 ${person}：并发事项 ${data.activeTaskCount} 件 | P1任务 ${data.urgentPriorityCount} 件 | 剩余工时 ${data.totalLeftHours}h | 任务平均进度 ${data.taskAverageProgress}%`
        );
        if (data.items.length > 0) {
          console.table(data.items.map((item: any) => ({
            类型: item.type === 'bug' ? 'Bug' : '任务',
            编号: item.id,
            名称: item.name,
            状态: item.status,
            优先级: item.pri,
            预计工时: item.estimate,
            剩余工时: item.left,
            进度: item.progress === '' ? '' : `${item.progress}%`,
            截止日期: formatDisplayDate(item.deadline),
          })));
        }
      }
    } catch (e: any) {
      console.error('❌ Failed:', e.message || e);
    }
  });

// ─ stagnant: 停滞/静默单据排查 ─────────────────────
program
  .command('stagnant')
  .description('排查指定成员名单中长期未更新（停滞）的进行中任务')
  .option('--assign <names>', '成员账号或中文名，多人用逗号分隔')
  .option('--team-name <name>', '已保存的团队名称，可与 --assign 组合使用')
  .option('--days <n>', '停滞天数阈值（默认3天）', '3')
  .on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  zentao stagnant --assign zhangsan,lisi --days 5');
    console.log('  zentao stagnant --team-name "规划组" --days 5');
  })
  .action(async (options) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }
    try {
      const client = createConfiguredClient(conf);
      const assignees = await resolveMemberInputs(client, options.assign, options.teamName);
      const result = await client.getStagnantTasks(assignees, parseInt(options.days));
      if (result.length === 0) {
        console.log(`✅ 无停滞单据 (阈值 ${options.days} 天)`);
      } else {
        console.log(`\n⚠️  停滞单据排查报告 (超 ${options.days} 天未更新)\n`);
        console.table(result.map(r => ({
          类型: r.type === 'bug' ? 'Bug' : '任务',
          指派人: r.assignee, ID: r.id, 名称: r.name,
          状态: r.status, 优先级: r.pri,
          最后更新: r.lastUpdated, 停滞天数: r.stagnantDays,
        })));
      }
    } catch (e: any) {
      console.error('❌ Failed:', e.message || e);
    }
  });

// ─ morning-check: 晨会综合作战沙盘 ─────────────────────
program
  .command('morning-check')
  .description('生成晨会作战沙盘：汇总已超期、今明到期、高优事项三类预警清单')
  .option('--team <names>', '团队成员账号或中文名，多人用逗号分隔')
  .option('--team-name <name>', '已保存的团队名称，可与 --team 组合使用')
  .option('--pri-max <n>', '高优先级阈值（默认2，传1则仅关注P1）', '2')
  .on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  zentao morning-check --team zhangsan,lisi,wangwu');
    console.log('  zentao morning-check --team-name "规划组"');
    console.log('  zentao morning-check --team-name "规划组" --pri-max 1');
  })
  .action(async (options) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }
    try {
      const client = createConfiguredClient(conf);
      const assignees = await resolveMemberInputs(client, options.team, options.teamName);
      const priorityThreshold = Number.parseInt(options.priMax, 10);
      const result = await client.getMorningCheck(
        assignees,
        Number.isFinite(priorityThreshold) ? priorityThreshold : 2
      );

      console.log('\n🌅 晨会作战沙盘 (Morning Standup Radar)\n');

      console.log(`🔴 已超期事项 (${result.overdue.length} 件):`);
      if (result.overdue.length === 0) console.log('  无');
      else console.table(result.overdue.map(r => ({
        类型: r.type === 'bug' ? 'Bug' : r.type === 'story' ? '需求' : '任务',
        指派人: r.assignee, ID: r.id, 名称: formatShortName(r.name),
        截止日期: formatDisplayDate(r.deadline), 超期天数: r.overdueDays, 优先级: r.pri,
        进度: r.progress === '' ? '' : `${r.progress}%`,
      })));

      console.log(`\n🟡 今明到期事项 (${result.dueSoon.length} 件):`);
      if (result.dueSoon.length === 0) console.log('  无');
      else console.table(result.dueSoon.map(r => ({
        类型: r.type === 'bug' ? 'Bug' : r.type === 'story' ? '需求' : '任务',
        指派人: r.assignee, ID: r.id, 名称: formatShortName(r.name),
        截止日期: formatDisplayDate(r.deadline), 优先级: r.pri,
        进度: r.progress === '' ? '' : `${r.progress}%`,
      })));

      console.log(`\n🟠 高优事项 (Pri ≤ ${Number.isFinite(priorityThreshold) ? priorityThreshold : 2}, ${result.highPriority.length} 件):`);
      if (result.highPriority.length === 0) console.log('  无');
      else console.table(result.highPriority.map(r => ({
        类型: r.type === 'bug' ? 'Bug' : r.type === 'story' ? '需求' : '任务',
        指派人: r.assignee, ID: r.id, 名称: formatShortName(r.name),
        状态: r.status, 截止日期: formatDisplayDate(r.deadline), 优先级: r.pri,
        进度: r.progress === '' ? '' : `${r.progress}%`,
      })));
    } catch (e: any) {
      console.error('❌ Failed:', e.message || e);
    }
  });

program
  .command('weekly-synthesis')
  .description('生成团队周报素材：聚合本周高优需求交付与重大缺陷修复')
  .option('--team <names>', '团队成员账号或中文名，多人用逗号分隔')
  .option('--team-name <name>', '已保存的团队名称，可与 --team 组合使用')
  .option('--date-from <date>', '统计开始日期，格式 YYYY-MM-DD，默认本周一')
  .option('--date-to <date>', '统计结束日期，格式 YYYY-MM-DD，默认今天')
  .option('--pri-max <n>', '统一优先级阈值（默认1，Bug 严重程度默认跟随该阈值）', '1')
  .option('--severity-max <n>', 'Bug 严重程度阈值（兼容参数；默认跟随 --pri-max）')
  .option('--view <mode>', '输出视图：summary（默认，仅统计）或 full（含详情）', 'summary')
  .on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  zentao weekly-synthesis --team zhangsan,lisi,wangwu');
    console.log('  zentao weekly-synthesis --team-name "规划组"');
    console.log('  zentao weekly-synthesis --team-name "规划组" --date-from 2026-03-09 --date-to 2026-03-13 --pri-max 1');
    console.log('  zentao weekly-synthesis --team-name "规划组" --view summary');
    console.log('  zentao weekly-synthesis --team-name "规划组" --view full');
  })
  .action(async (options) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }

    try {
      const client = createConfiguredClient(conf);
      const assignees = await resolveMemberInputs(client, options.team, options.teamName);
      const weekRange = getWeekWindow();
      const dateFrom = options.dateFrom || weekRange.dateFrom;
      const dateTo = options.dateTo || weekRange.dateTo;
      const weekWindow = getWeekWindow(dateTo);
      const priMax = Number.parseInt(options.priMax, 10);
      const severityMax = Number.parseInt(options.severityMax, 10);
      const viewMode = String(options.view || 'summary').trim().toLowerCase() === 'full' ? 'full' : 'summary';
      const teamLabel = options.teamName || await describeTeamMembers(client, assignees);
      const normalizedPriMax = Number.isFinite(priMax) ? priMax : 1;
      const normalizedSeverityMax = Number.isFinite(severityMax) ? severityMax : normalizedPriMax;

      const result = await client.getWeeklySynthesis(assignees, {
        dateFrom,
        dateTo,
        deadlineTo: weekWindow.weekEnd,
        priMax: normalizedPriMax,
        severityMax: normalizedSeverityMax,
      });

      console.log('\n🗓️ 自动化周报摘要 (Weekly Synthesis)\n');
      console.log(`统计范围：${dateFrom} ~ ${dateTo}`);
      console.log(`本周截止窗口：${dateFrom} ~ ${weekWindow.weekEnd}`);
      console.log(`统计对象：${teamLabel}`);
      console.log(`输出视图：${viewMode === 'summary' ? '摘要模式' : '完整模式'}`);
      console.log(`总交付：任务 ${result.totals.tasks} | 需求 ${result.totals.stories} | Bug ${result.totals.bugs}`);
      console.log(`高优交付：任务 ${result.totals.highPriorityTasks} | 需求 ${result.totals.stories} | Bug ${result.totals.bugs}`);
      console.log(`高优交付口径：任务 / 需求 / Bug 中，优先级 ≤ ${normalizedPriMax} 计入高优`);
      console.log(`本周待完成任务：${result.totals.dueThisWeekOpenTasks}`);

      console.log('\n👥 成员交付汇总');
      console.table(result.memberSummary.map((item) => ({
        成员: item.realname ? `${item.realname} (${item.account})` : item.account,
        完成任务: item.taskCount,
        高优任务交付: item.highPriorityTaskCount,
        高优需求交付: item.storyCount,
        重大缺陷修复: item.bugCount,
        本周待完成任务: item.dueThisWeekOpenTaskCount,
        合计: item.taskCount + item.storyCount + item.bugCount,
      })));

      if (viewMode === 'full') {
        console.log('\n🏁 本周完成任务');
        if (result.tasks.length === 0) {
          console.log('  无');
        } else {
          console.table(result.tasks.map((item: any) => ({
            成员: item.realname ? `${item.realname} (${item.account})` : item.account,
            编号: item.id,
            任务名称: item.name,
            优先级: item.pri,
            已耗时: item.consumed,
            完成日期: formatDisplayDate(item.finishedDate || item.closedDate),
            所属执行: item.executionName || '',
          })));
        }

        console.log('\n📌 高优需求交付');
        if (result.stories.length === 0) {
          console.log('  无');
        } else {
          console.table(result.stories.map((item: any) => ({
            成员: item.realname ? `${item.realname} (${item.account})` : item.account,
            编号: item.id,
            需求名称: item.name,
            优先级: item.pri,
            阶段: item.stage,
            关闭日期: formatDisplayDate(item.closedDate),
            所属执行: item.executionName || '',
          })));
        }

        console.log('\n🐞 重大缺陷修复');
        if (result.bugs.length === 0) {
          console.log('  无');
        } else {
          console.table(result.bugs.map((item: any) => ({
            成员: item.realname ? `${item.realname} (${item.account})` : item.account,
            编号: item.id,
            Bug标题: item.name,
            优先级: item.pri,
            严重程度: item.severity,
            状态: item.status,
            解决日期: formatDisplayDate(item.resolvedDate || item.closedDate),
          })));
        }

        console.log('\n⏳ 本周截止但未完成的任务');
        if (result.dueThisWeekOpenTasks.length === 0) {
          console.log('  无');
        } else {
          console.table(result.dueThisWeekOpenTasks.map((item: any) => ({
            成员: item.realname ? `${item.realname} (${item.account})` : item.account,
            编号: item.id,
            任务名称: item.name,
            状态: item.status,
            优先级: item.pri,
            进度: item.progress === '' || item.progress === undefined ? '' : `${item.progress}%`,
            截止日期: formatDisplayDate(item.deadline),
            所属执行: item.executionName || '',
          })));
        }
      }
    } catch (e: any) {
      console.error('❌ Failed:', e.message || e);
    }
  });

program.parse(process.argv);
