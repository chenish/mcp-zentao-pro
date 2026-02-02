import process from "node:process";
import readline from "node:readline";
import { hasHelpFlag, parseCliArgs, getOption } from "../cli/args.js";
import { saveConfig } from "../config/store.js";
import { ZentaoClient } from "../zentao/client.js";

function printHelp() {
  process.stdout.write(`zentao login - save credentials locally\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  zentao login --zentao-url=... --zentao-account=... --zentao-password=... [--yes]\n`);
  process.stdout.write(`\n`);
  process.stdout.write(`Notes:\n`);
  process.stdout.write(`  Credentials are stored as plaintext TOML in your user config directory.\n`);
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise((resolve) => rl.question(question, resolve));
  } finally {
    rl.close();
  }
}

export async function runLogin({ argv = [], env = process.env } = {}) {
  if (hasHelpFlag(argv)) {
    printHelp();
    return;
  }

  const cliArgs = parseCliArgs(argv);
  const yes = Boolean(cliArgs.yes);
  let baseUrl = getOption(cliArgs, env, "ZENTAO_URL", "zentao-url");
  let account = getOption(cliArgs, env, "ZENTAO_ACCOUNT", "zentao-account");
  let password = getOption(cliArgs, env, "ZENTAO_PASSWORD", "zentao-password");

  if (!baseUrl && !yes) baseUrl = String(await prompt("ZENTAO_URL: ")).trim();
  if (!account && !yes) account = String(await prompt("ZENTAO_ACCOUNT: ")).trim();
  if (!password && !yes) password = String(await prompt("ZENTAO_PASSWORD (echoed): ")).trim();

  if (!baseUrl || !account || !password) {
    throw new Error("Missing credentials. Provide flags/env, or run interactively.");
  }

  // Verify credentials by requesting a token.
  const client = new ZentaoClient({ baseUrl, account, password });
  await client.ensureToken();

  const filePath = saveConfig(
    {
      zentaoUrl: baseUrl,
      zentaoAccount: account,
      zentaoPassword: password,
    },
    { env }
  );

  process.stdout.write(`Logged in as ${account}\n`);
  process.stdout.write(`Saved to ${filePath}\n`);
}
