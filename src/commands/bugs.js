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
  process.stdout.write(`zentao bugs <subcommand>\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  zentao bugs list --product <id> [--page N] [--limit N] [--json]\n`);
  process.stdout.write(`  zentao bugs mine [--scope assigned|opened|resolved|all] [--status active|resolved|closed|all] [--include-details] [--json]\n`);
}

function formatAccount(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") return String(value.account || value.name || value.realname || "");
  return "";
}

export function formatBugsSimple(bugs) {
  const rows = [];
  rows.push(["id", "title", "status", "pri", "severity", "assignedTo"].join("\t"));
  for (const bug of bugs) {
    rows.push(
      [
        String(bug?.id ?? ""),
        String(bug?.title ?? ""),
        String(bug?.status ?? ""),
        String(bug?.pri ?? ""),
        String(bug?.severity ?? ""),
        formatAccount(bug?.assignedTo),
      ].join("\t")
    );
  }
  return `${rows.join("\n")}\n`;
}

export function formatBugsMineSimple(result) {
  const total = result?.total ?? 0;
  const products = Array.isArray(result?.products) ? result.products : [];
  const rows = [];
  rows.push(`total\t${total}`);
  rows.push(["id", "name", "myBugs", "totalBugs"].join("\t"));
  for (const product of products) {
    rows.push(
      [
        String(product?.id ?? ""),
        String(product?.name ?? ""),
        String(product?.myBugs ?? ""),
        String(product?.totalBugs ?? ""),
      ].join("\t")
    );
  }

  const bugs = Array.isArray(result?.bugs) ? result.bugs : [];
  if (bugs.length) {
    rows.push("");
    rows.push("bugs");
    rows.push(formatBugsSimple(bugs).trimEnd());
  }

  return `${rows.join("\n")}\n`;
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

    if (cliArgs.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    const bugs = result?.result?.bugs;
    if (!Array.isArray(bugs)) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    process.stdout.write(formatBugsSimple(bugs));
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

    if (cliArgs.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    process.stdout.write(formatBugsMineSimple(result?.result));
    return;
  }

  throw new Error(`Unknown bugs subcommand: ${sub || "(missing)"}`);
}
