import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { extractCommand, hasHelpFlag, parseCliArgs } from "../cli/args.js";
import { printReleaseHelp } from "../cli/help.js";

function run(cmd, args, { cwd, env, dryRun } = {}) {
  const printable = [cmd, ...args].join(" ");
  if (dryRun) {
    process.stdout.write(`[dry-run] ${printable}\n`);
    return { status: 0 };
  }
  const res = spawnSync(cmd, args, {
    cwd,
    env,
    stdio: "inherit",
  });
  if (res.status !== 0) {
    const error = new Error(`Command failed (${res.status}): ${printable}`);
    error.exitCode = res.status || 1;
    throw error;
  }
  return res;
}

function commandExists(name) {
  if (process.platform === "win32") {
    const res = spawnSync("where", [name], { stdio: "ignore" });
    return res.status === 0;
  }
  const res = spawnSync("sh", ["-lc", `command -v ${name}`], {
    stdio: "ignore",
  });
  return res.status === 0;
}

async function confirm(question, { yes }) {
  if (yes) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise((resolve) => {
      rl.question(`${question} (y/n) `, (value) => resolve(value));
    });
    return String(answer).trim().toLowerCase().startsWith("y");
  } finally {
    rl.close();
  }
}

function readPackageVersion(repoRoot) {
  const pkgPath = path.join(repoRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  return String(pkg.version || "0.0.0");
}

function extractChangelogNotes(repoRoot, version) {
  const changelogPath = path.join(repoRoot, "CHANGELOG.md");
  if (!fs.existsSync(changelogPath)) return `Release v${version}`;
  const text = fs.readFileSync(changelogPath, "utf8");
  const start = text.match(new RegExp(`^## \\s*\\[?${version.replace(/\./g, "\\.")}\\]?\\s*$`, "m"));
  if (!start) return `Release v${version}`;
  const startIndex = start.index ?? 0;
  const rest = text.slice(startIndex);
  const next = rest.slice(1).match(/^##\s/m);
  const endIndex = next ? startIndex + 1 + (next.index ?? 0) : text.length;
  return text.slice(startIndex, endIndex).trim();
}

function gitHasUncommittedChanges(repoRoot) {
  const res = spawnSync("git", ["diff-index", "--quiet", "HEAD", "--"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  return res.status !== 0;
}

function ensureGitRepo(repoRoot) {
  const res = spawnSync("git", ["rev-parse", "--git-dir"], { cwd: repoRoot, stdio: "ignore" });
  if (res.status !== 0) {
    throw new Error("Not a git repo. Please run this command from a git repository.");
  }
}

function ensureDependencies() {
  const missing = [];
  for (const cmd of ["git", "npm", "gh"]) {
    if (!commandExists(cmd)) missing.push(cmd);
  }
  if (missing.length) {
    throw new Error(`Missing required tools: ${missing.join(", ")}`);
  }
}

export async function runRelease({ argv = [], env = process.env } = {}) {
  if (hasHelpFlag(argv)) {
    printReleaseHelp();
    return;
  }

  const { command: versionTypeRaw, argv: argvWithoutVersionType } = extractCommand(argv);
  const versionType = versionTypeRaw || "patch";
  const cliArgs = parseCliArgs(argvWithoutVersionType);
  const repoRoot = process.cwd();

  const dryRun = Boolean(cliArgs["dry-run"]);
  const yes = Boolean(cliArgs.yes);
  const skipPush = Boolean(cliArgs["skip-push"]);
  const skipGithubRelease = Boolean(cliArgs["skip-github-release"]);
  const skipPublish = Boolean(cliArgs["skip-publish"]);

  if (!new Set(["patch", "minor", "major"]).has(versionType)) {
    throw new Error(`Invalid version type: ${versionType}`);
  }

  ensureDependencies();
  ensureGitRepo(repoRoot);

  if (gitHasUncommittedChanges(repoRoot)) {
    const ok = await confirm("Warning: uncommitted changes. Continue?", { yes });
    if (!ok) return;
  }

  const currentVersion = readPackageVersion(repoRoot);
  process.stdout.write(`Current version: ${currentVersion}\n`);
  run("npm", ["version", versionType, "--no-git-tag-version"], { cwd: repoRoot, env, dryRun });
  const newVersion = readPackageVersion(repoRoot);
  process.stdout.write(`New version: ${newVersion}\n`);

  run("git", ["add", "package.json"], { cwd: repoRoot, env, dryRun });
  try {
    run("git", ["commit", "-m", `chore: bump version to ${newVersion}`], { cwd: repoRoot, env, dryRun });
  } catch (error) {
    if (!/nothing to commit/i.test(String(error.message || ""))) throw error;
  }

  run("git", ["tag", "-a", `v${newVersion}`, "-m", `Release v${newVersion}`], {
    cwd: repoRoot,
    env,
    dryRun,
  });

  if (!skipPush) {
    const pushAttempts = [
      ["push", "origin", "main"],
      ["push", "origin", "master"],
      ["push"],
    ];
    let pushed = false;
    for (const args of pushAttempts) {
      try {
        run("git", args, { cwd: repoRoot, env, dryRun });
        pushed = true;
        break;
      } catch (error) {
        if (dryRun) {
          pushed = true;
          break;
        }
      }
    }
    if (!pushed && !dryRun) {
      throw new Error("Failed to push branch.");
    }
    run("git", ["push", "origin", `v${newVersion}`], { cwd: repoRoot, env, dryRun });
  }

  if (!skipGithubRelease) {
    const notes = extractChangelogNotes(repoRoot, newVersion);
    run(
      "gh",
      [
        "release",
        "create",
        `v${newVersion}`,
        "--title",
        `v${newVersion}`,
        "--notes",
        notes,
        "--latest",
      ],
      { cwd: repoRoot, env, dryRun }
    );
  }

  if (!skipPublish) {
    const whoami = spawnSync("npm", ["whoami"], { cwd: repoRoot, stdio: "ignore" });
    if (whoami.status !== 0) {
      const ok = await confirm("Warning: not logged into npm. Run npm login now?", { yes });
      if (!ok) return;
      run("npm", ["login"], { cwd: repoRoot, env, dryRun });
    }
    run("npm", ["publish", "--access", "public"], { cwd: repoRoot, env, dryRun });
  }

  process.stdout.write(`Release done: v${newVersion}\n`);
}
