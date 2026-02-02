import process from "node:process";
import { extractCommand, hasHelpFlag, parseCliArgs } from "../cli/args.js";
import { createClientFromCli } from "../zentao/client.js";

function parseCsvIntegers(value) {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) {
    const nested = value.flatMap((item) => String(item).split(/[,|]/));
    const parsed = nested.map((item) => Number(item)).filter((n) => Number.isFinite(n));
    return parsed.length ? parsed : null;
  }
  const tokens = String(value)
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const parsed = tokens.map((item) => Number(item)).filter((n) => Number.isFinite(n));
  return parsed.length ? parsed : null;
}

function printHelp() {
  process.stdout.write(`zentao-mcp bugs <subcommand>\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  zentao-mcp bugs list --product <id> [--page N] [--limit N]\n`);
  process.stdout.write(`  zentao-mcp bugs mine [--scope assigned|opened|resolved|all] [--status active|resolved|closed|all] [--include-details]\n`);
}

export async function runBugs({ argv = [], env = process.env } = {}) {
  if (hasHelpFlag(argv)) {
    printHelp();
    return;
  }

  const { command: sub, argv: argvWithoutSub } = extractCommand(argv);
  const cliArgs = parseCliArgs(argvWithoutSub);
  const api = createClientFromCli({ argv: argvWithoutSub, env });

  if (sub === "list") {
    const product = cliArgs.product;
    if (!product) throw new Error("Missing --product");
    const result = await api.listBugs({
      product,
      page: cliArgs.page,
      limit: cliArgs.limit,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (sub === "mine") {
    const includeDetails = Boolean(cliArgs["include-details"]);
    const includeZero = Boolean(cliArgs["include-zero"]);
    const productIds = parseCsvIntegers(cliArgs["product-ids"]);
    const result = await api.bugsMine({
      account: cliArgs.account,
      scope: cliArgs.scope,
      status: cliArgs.status,
      productIds,
      includeZero,
      perPage: cliArgs["per-page"],
      maxItems: cliArgs["max-items"],
      includeDetails,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  throw new Error(`Unknown bugs subcommand: ${sub || "(missing)"}`);
}
