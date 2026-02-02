import process from "node:process";
import { extractCommand, hasHelpFlag, parseCliArgs } from "../cli/args.js";
import { createClientFromCli } from "../zentao/client.js";

function printHelp() {
  process.stdout.write(`zentao products list\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  zentao products list [--page N] [--limit N] [--json]\n`);
  process.stdout.write(`\n`);
  process.stdout.write(`Options:\n`);
  process.stdout.write(`  --json               print full JSON payload\n`);
}

export function formatProductsSimple(products) {
  const rows = [];
  rows.push(["id", "name", "totalBugs", "status"].join("\t"));
  for (const product of products) {
    rows.push(
      [
        String(product.id ?? ""),
        String(product.name ?? ""),
        String(product.totalBugs ?? product.totalBugsCount ?? ""),
        String(product.status ?? product.productStatus ?? ""),
      ].join("\t")
    );
  }
  return `${rows.join("\n")}\n`;
}

export async function runProducts({ argv = [], env = process.env } = {}) {
  if (hasHelpFlag(argv)) {
    printHelp();
    return;
  }

  const { command: sub, argv: argvWithoutSub } = extractCommand(argv);
  if (sub !== "list") throw new Error(`Unknown products subcommand: ${sub || "(missing)"}`);

  const cliArgs = parseCliArgs(argvWithoutSub);
  const api = createClientFromCli({ argv: argvWithoutSub, env });
  const result = await api.listProducts({
    page: cliArgs.page,
    limit: cliArgs.limit,
  });

  if (cliArgs.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const products = result?.result?.products;
  if (!Array.isArray(products)) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(formatProductsSimple(products));
}
