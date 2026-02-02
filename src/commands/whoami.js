import process from "node:process";
import { hasHelpFlag } from "../cli/args.js";
import { loadConfig } from "../config/store.js";
import { ZentaoClient, createClientFromCli } from "../zentao/client.js";

function printHelp() {
  process.stdout.write(`zentao whoami - show current account\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  zentao whoami\n`);
  process.stdout.write(`\n`);
  process.stdout.write(`Reads credentials from flags/env, falling back to saved login config.\n`);
}

export async function runWhoami({ argv = [], env = process.env } = {}) {
  if (hasHelpFlag(argv)) {
    printHelp();
    return;
  }

  const stored = loadConfig({ env }) || null;
  const client = createClientFromCli({ argv, env });

  // Best-effort verification: ensure token can be fetched.
  await client.ensureToken();

  const account = client.account;
  const baseUrl = client.baseUrl;
  process.stdout.write(`${account}\n`);
  if (stored && (stored.zentaoUrl || stored.zentaoAccount)) {
    process.stdout.write(`url: ${baseUrl}\n`);
  }
}
