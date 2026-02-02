import process from "node:process";
import { extractCommand, hasHelpFlag, parseCliArgs } from "../cli/args.js";
import { createClientFromCli } from "../zentao/client.js";

function printHelp() {
  process.stdout.write(`zentao-mcp bug get\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  zentao-mcp bug get --id <bugId>\n`);
}

export async function runBug({ argv = [], env = process.env } = {}) {
  if (hasHelpFlag(argv)) {
    printHelp();
    return;
  }

  const { command: sub, argv: argvWithoutSub } = extractCommand(argv);
  if (sub !== "get") throw new Error(`Unknown bug subcommand: ${sub || "(missing)"}`);

  const cliArgs = parseCliArgs(argvWithoutSub);
  const id = cliArgs.id;
  if (!id) throw new Error("Missing --id");

  const api = createClientFromCli({ argv: argvWithoutSub, env });
  const result = await api.getBug({ id });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
