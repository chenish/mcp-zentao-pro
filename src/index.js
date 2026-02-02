#!/usr/bin/env node
import process from "node:process";
import { extractCommand, hasHelpFlag } from "./cli/args.js";
import { printRootHelp } from "./cli/help.js";
import { runSelfTest } from "./commands/selftest.js";
import { runRelease } from "./commands/release.js";
import { runProducts } from "./commands/products.js";
import { runBugs } from "./commands/bugs.js";
import { runBug } from "./commands/bug.js";
import { runLogin } from "./commands/login.js";
import { runWhoami } from "./commands/whoami.js";

const argv = process.argv.slice(2);
const { command, argv: argvWithoutCommand } = extractCommand(argv);

function exitWithError(error) {
  const message = error?.message || String(error);
  process.stderr.write(`${message}\n`);
  process.exit(error?.exitCode || 1);
}

try {
  if (!command || hasHelpFlag(argv)) {
    printRootHelp();
    process.exit(0);
  }

  if (command === "self-test") {
    await runSelfTest({ argv: argvWithoutCommand, env: process.env });
    process.exit(0);
  }

  if (command === "release") {
    await runRelease({ argv: argvWithoutCommand, env: process.env });
    process.exit(0);
  }

  if (command === "login") {
    await runLogin({ argv: argvWithoutCommand, env: process.env });
    process.exit(0);
  }

  if (command === "whoami") {
    await runWhoami({ argv: argvWithoutCommand, env: process.env });
    process.exit(0);
  }

  if (command === "products") {
    await runProducts({ argv: argvWithoutCommand, env: process.env });
    process.exit(0);
  }

  if (command === "bugs") {
    await runBugs({ argv: argvWithoutCommand, env: process.env });
    process.exit(0);
  }

  if (command === "bug") {
    await runBug({ argv: argvWithoutCommand, env: process.env });
    process.exit(0);
  }

  if (command === "help") {
    printRootHelp();
    process.exit(0);
  }

  throw new Error(`Unknown subcommand: ${command}`);
} catch (error) {
  exitWithError(error);
}
