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
  .command('my')
  .argument('<type>', 'Type: tasks, stories, bugs')
  .description('Get my dashboard items')
  .action(async (type) => {
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
      
      const items = await client.getMyDashboard(dataType);
      console.table(items);
    } catch (error: any) {
      console.error('❌ Failed to fetch dashboard:', error.message || error);
    }
  });

program
  .command('task')
  .argument('<action>', 'Action: create, effort')
  .option('--execId <id>', 'Execution ID')
  .option('--name <name>', 'Task name')
  .option('--assign <account>', 'Assignee account')
  .option('--taskId <id>', 'Task ID')
  .option('--consumed <h>', 'Consumed hours')
  .option('--desc <text>', 'Effort description / comment')
  .option('--deadline <date>', 'Task deadline (YYYY-MM-DD)')
  .option('--estimate <h>', 'Estimated hours')
  .action(async (action, options) => {
    const conf = getConfig();
    if (!conf.url || !conf.token) {
      console.error('❌ Please run "zentao login" first.');
      process.exit(1);
    }

    const client = new ZentaoClient(conf.url, conf.token);

    try {
      if (action === 'create') {
        if (!options.execId || !options.name || !options.assign || !options.deadline || !options.estimate) {
          console.error('❌ Missing required options for task create: --execId, --name, --assign, --deadline, --estimate');
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

        const payload = {
          name: options.name,
          assignedTo: assignedTo,
          type: 'devel',
          deadline: options.deadline,
          estimate: parseFloat(options.estimate),
          // estStarted will be automatically populated inside client.createTask
        };

        const res = await client.createTask(options.execId, payload);
        console.log('✅ Task created successfully. Raw response:', res);
      } 
      else if (action === 'effort') {
        if (!options.taskId || !options.consumed || !options.desc) {
          console.error('❌ Missing required options for task effort: --taskId, --consumed, --desc');
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
      else {
        console.error('❌ Unknown action. Use "zentao task create" or "zentao task effort"');
      }
    } catch (error: any) {
      console.error('❌ Operation failed:', error.message || error);
      if (error.response && error.response.data) {
        console.error('Server response:', JSON.stringify(error.response.data, null, 2));
      }
    }
  });

program.parse(process.argv);
