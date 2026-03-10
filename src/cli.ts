#!/usr/bin/env node
import { Command } from 'commander';
import { ZentaoClient } from './api/client.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

const program = new Command();

program
  .name('zentao')
  .description('Zentao CLI Tool for Agent V4 Framework')
  .version('1.0.0');

// Load environment variables for token auth
function getConfig() {
  const configPath = path.join(os.homedir(), '.config', 'zentao', '.env');
  if (fs.existsSync(configPath)) {
    dotenv.config({ path: configPath });
  }
  return {
    url: process.env.ZENTAO_URL || '',
    token: process.env.ZENTAO_TOKEN || ''
  };
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
      const token = await client.login(options.account, options.pwd);

      const configDir = path.join(os.homedir(), '.config', 'zentao');
      // Robustness: ensure configuration directory exists recursively
      fs.mkdirSync(configDir, { recursive: true });

      const envContent = `ZENTAO_URL=${options.url}\nZENTAO_TOKEN=${token}\n`;
      const configPath = path.join(configDir, '.env');
      fs.writeFileSync(configPath, envContent, 'utf-8');

      console.log('✅ Login successful, config saved to:', configPath);
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
      const client = new ZentaoClient(conf.url, conf.token);
      const output = await client.resolveUrlAndFetch(text);
      console.log('✅ Entity resolved successfully:');
      console.table([output]);
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
      const client = new ZentaoClient(conf.url, conf.token);
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
      const client = new ZentaoClient(conf.url, conf.token);
      let projects = await client.getProjects();
      console.table(projects.map(p => ({ id: p.id, name: p.name, status: p.status, begin: p.begin, end: p.end })));
    } catch (e: any) {
      console.error('❌ Failed:', e.message || e);
    }
  });

program
  .command('executions')
  .description('Get active executions/sprints')
  .option('--status <status>', 'Filter by status (e.g. doing)')
  .action(async (options) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }
    try {
      const client = new ZentaoClient(conf.url, conf.token);
      let executions = await client.getActiveExecutions();
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
        const client = new ZentaoClient(conf.url, conf.token);

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
  .argument('<action>', 'Action: create, effort, update')
  .option('--execId <id>', 'Execution ID')
  .option('--name <name>', 'Task name')
  .option('--assign <account>', 'Assignee account')
  .option('--taskId <id>', 'Task ID')
  .option('--consumed <h>', 'Consumed hours')
  .option('--desc <text>', 'Effort description / comment')
  .option('--deadline <date>', 'Task deadline (YYYY-MM-DD)')
  .option('--estimate <h>', 'Estimated hours')
  .option('--status <status>', 'New task status (e.g. done, closed)')
  .option('--comment <text>', 'Comment for the update operation')
  .action(async (action, options) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }

    const client = new ZentaoClient(conf.url, conf.token);

    try {
      if (action === 'create') {
        if (!options.execId || !options.name || !options.assign) {
          console.error('❌ Missing required options for task create: --execId, --name, --assign');
          return;
        }

        let assignedTo = options.assign;
        // Robustness: Implicit account mapping for assignee
        try {
          const mapping = await client.getUsersMapping();
          if (mapping[options.assign]) {
            assignedTo = mapping[options.assign];
            console.log(`✅ Implicit mapping activated: Assigned "${options.assign}" -> "${assignedTo}"`);
          }
        } catch (e) {
          console.warn('⚠️ Could not fetch user mappings. Treating assignee as raw account name.');
        }

        const defaultDeadline = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
        const payload = {
          name: options.name,
          assignedTo: assignedTo,
          type: 'devel',
          deadline: options.deadline || defaultDeadline,
          estimate: options.estimate ? parseFloat(options.estimate) : 2,
          // estStarted will be automatically populated inside client.createTask
        };

        const res = await client.createTask(options.execId, payload);
        console.log('✅ Task created successfully. Raw response:', res);
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
        console.error('❌ Unknown action. Use "zentao task create", "zentao task effort", or "zentao task update"');
      }
    } catch (error: any) {
      console.error('❌ Operation failed:', error.message || error);
      if (error.response && error.response.data) {
        console.error('Server response:', JSON.stringify(error.response.data, null, 2));
      }
    }
  });

program.parse(process.argv);
