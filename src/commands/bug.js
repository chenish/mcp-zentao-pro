import process from "node:process";
import { extractCommand, hasHelpFlag, parseCliArgs } from "../cli/args.js";
import { createClientFromCli } from "../zentao/client.js";

function printHelp() {
  process.stdout.write(`zentao bug get\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  zentao bug get --id <bugId> [--json]\n`);
}

function formatAccount(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") return String(value.account || value.name || value.realname || "");
  return "";
}

export function formatBugSimple(bug) {
  const header = [
    "id",
    "title",
    "status",
    "pri",
    "severity",
    "assignedTo",
    "openedBy",
    "resolvedBy",
  ].join("\t");
  const row = [
    String(bug?.id ?? ""),
    String(bug?.title ?? ""),
    String(bug?.status ?? ""),
    String(bug?.pri ?? ""),
    String(bug?.severity ?? ""),
    formatAccount(bug?.assignedTo),
    formatAccount(bug?.openedBy),
    formatAccount(bug?.resolvedBy),
  ].join("\t");
  return `${header}\n${row}\n`;
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
  if (cliArgs.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const bug = result?.result?.bug;
  if (!bug || typeof bug !== "object") {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(formatBugSimple(bug));
}
