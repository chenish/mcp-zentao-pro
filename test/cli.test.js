import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { extractCommand, parseCliArgs } from "../src/cli/args.js";
import { createClientFromCli, ZentaoClient } from "../src/zentao/client.js";
import { getConfigPath, loadConfig, saveConfig } from "../src/config/store.js";
import { formatProductsSimple } from "../src/commands/products.js";
import { formatBugsMineSimple, formatBugsSimple } from "../src/commands/bugs.js";
import { formatBugSimple } from "../src/commands/bug.js";

test("extractCommand skips flag values", () => {
  const argv = [
    "--zentao-url",
    "https://example.com/zentao",
    "products",
    "list",
    "--page",
    "2",
  ];

  const first = extractCommand(argv);
  assert.equal(first.command, "products");
  assert.equal(first.argv.includes("products"), false);
  assert.equal(first.argv.includes("https://example.com/zentao"), true);

  const second = extractCommand(first.argv);
  assert.equal(second.command, "list");
  assert.equal(second.argv.includes("list"), false);
  assert.equal(second.argv.includes("2"), true);
});

test("parseCliArgs supports --flag value and --flag=value", () => {
  const args = parseCliArgs([
    "--zentao-url",
    "https://example.com/zentao",
    "--page=2",
    "--include-details",
  ]);

  assert.equal(args["zentao-url"], "https://example.com/zentao");
  assert.equal(args.page, "2");
  assert.equal(args["include-details"], true);
});

test("createClientFromCli throws on missing auth", () => {
  const env = { XDG_CONFIG_HOME: `/tmp/zentao-cli-test-empty-${process.pid}` };
  assert.throws(
    () => createClientFromCli({ argv: [], env }),
    /Missing ZENTAO_URL/
  );
});

test("config store save/load roundtrip", () => {
  const env = { XDG_CONFIG_HOME: "/tmp/zentao-cli-test" };
  const filePath = getConfigPath({ env });
  saveConfig({ zentaoUrl: "u", zentaoAccount: "a", zentaoPassword: "p" }, { env });
  const loaded = loadConfig({ env });
  assert.equal(loaded.zentaoUrl, "u");
  assert.equal(filePath.includes("zentao/config.toml"), true);
});

test("ZentaoClient listProducts uses token then GET products", async () => {
  const calls = [];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });

    if (String(url).endsWith("/api.php/v1/tokens")) {
      return {
        text: async () => JSON.stringify({ token: "t_abc" }),
      };
    }

    if (String(url).includes("/api.php/v1/products")) {
      return {
        text: async () =>
          JSON.stringify({
            products: [{ id: 1, name: "P1" }],
            total: 1,
            limit: 1000,
          }),
      };
    }

    return {
      text: async () => JSON.stringify({ error: "unexpected" }),
    };
  };

  try {
    const client = new ZentaoClient({
      baseUrl: "https://example.com/zentao",
      account: "leo",
      password: "pw",
    });

    const result = await client.listProducts({ page: 1, limit: 1000 });
    assert.equal(result.status, 1);
    assert.equal(result.result?.products?.[0]?.name, "P1");

    assert.equal(calls.length, 2);
    assert.ok(calls[0].url.endsWith("/api.php/v1/tokens"));
    assert.ok(calls[1].url.includes("/api.php/v1/products"));
    assert.equal(calls[1].options?.headers?.Token, "t_abc");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("formatProductsSimple prints TSV", () => {
  const out = formatProductsSimple([
    { id: 1, name: "P1", totalBugs: 10, status: "normal" },
    { id: 2, name: "P2", totalBugs: 0, productStatus: "closed" },
  ]);
  assert.ok(out.includes("id\tname\ttotalBugs\tstatus"));
  assert.ok(out.includes("1\tP1\t10\tnormal"));
  assert.ok(out.includes("2\tP2\t0\tclosed"));
});

test("formatBugsSimple prints TSV", () => {
  const out = formatBugsSimple([
    { id: 1, title: "T1", status: "active", pri: 2, severity: 3, assignedTo: { account: "leo" } },
  ]);
  assert.ok(out.includes("id\ttitle\tstatus\tpri\tseverity\tassignedTo"));
  assert.ok(out.includes("1\tT1\tactive\t2\t3\tleo"));
});

test("formatBugSimple prints one-row TSV", () => {
  const out = formatBugSimple({
    id: 9,
    title: "Hello",
    status: "resolved",
    pri: 3,
    severity: 2,
    assignedTo: { account: "a" },
    openedBy: { account: "b" },
    resolvedBy: { account: "c" },
  });
  assert.ok(out.includes("id\ttitle\tstatus\tpri\tseverity\tassignedTo\topenedBy\tresolvedBy"));
  assert.ok(out.includes("9\tHello\tresolved\t3\t2\ta\tb\tc"));
});

test("formatBugsMineSimple prints summary", () => {
  const out = formatBugsMineSimple({
    total: 2,
    products: [{ id: 1, name: "P1", myBugs: 2, totalBugs: 10 }],
    bugs: [],
  });
  assert.ok(out.includes("total\t2"));
  assert.ok(out.includes("1\tP1\t2\t10"));
});
