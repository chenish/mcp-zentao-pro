export function parseCliArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const [flag, inlineValue] = raw.split("=", 2);
    const key = flag.replace(/^--/, "");
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
      continue;
    }
    args[key] = true;
  }
  return args;
}

export function hasHelpFlag(argv) {
  return argv.includes("--help") || argv.includes("-h");
}

export function getOption(cliArgs, env, envName, cliName) {
  if (cliArgs[cliName]) return cliArgs[cliName];
  const envValue = env[envName];
  if (envValue) return envValue;
  return null;
}

function isFlagToken(raw) {
  return raw.startsWith("-") && raw !== "-";
}

export function splitSubcommand(argv) {
  // Goal: find the first positional argument that isn't a flag or a flag value.
  // This allows: `zentao-mcp self-test --foo=bar`.
  // It also avoids treating `--zentao-url https://...` value as a subcommand.
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];

    if (raw === "--") {
      return { command: null, commandArgv: argv };
    }

    if (raw.startsWith("--")) {
      const hasInlineValue = raw.includes("=");
      if (hasInlineValue) continue;
      const next = argv[i + 1];
      if (next && !isFlagToken(next)) {
        i += 1;
      }
      continue;
    }

    if (raw === "-h") continue;
    if (raw === "-v") continue;
    if (raw.startsWith("-")) continue;

    return { command: raw, commandArgv: argv.slice(i + 1) };
  }

  return { command: null, commandArgv: argv };
}

function findFirstPositional(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (raw === "--") continue;

    if (raw.startsWith("--")) {
      const hasInlineValue = raw.includes("=");
      if (hasInlineValue) continue;
      const next = argv[i + 1];
      if (next && !isFlagToken(next)) {
        i += 1;
      }
      continue;
    }

    if (raw === "-h") continue;
    if (raw === "-v") continue;
    if (raw.startsWith("-")) continue;

    return { index: i, value: raw };
  }

  return { index: -1, value: null };
}

export function extractCommand(argv) {
  const { index, value } = findFirstPositional(argv);
  if (!value) return { command: null, argv };
  const nextArgv = argv.slice(0, index).concat(argv.slice(index + 1));
  return { command: value, argv: nextArgv };
}
