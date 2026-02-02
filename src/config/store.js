import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function escapeTomlString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\"/g, "\\\"");
}

function unescapeTomlString(value) {
  return String(value)
    .replace(/\\n/g, "\n")
    .replace(/\\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function parseToml(text) {
  const out = {};
  const lines = String(text).split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("[")) continue;

    const idx = line.indexOf("=");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = unescapeTomlString(value.slice(1, -1));
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    if (key) out[key] = value;
  }
  return out;
}

function toToml(config) {
  const lines = [];
  lines.push('# zentao CLI config');
  lines.push('# WARNING: stored as plaintext');
  if (config.zentaoUrl) lines.push(`zentaoUrl = "${escapeTomlString(config.zentaoUrl)}"`);
  if (config.zentaoAccount) lines.push(`zentaoAccount = "${escapeTomlString(config.zentaoAccount)}"`);
  if (config.zentaoPassword) lines.push(`zentaoPassword = "${escapeTomlString(config.zentaoPassword)}"`);
  lines.push("");
  return lines.join("\n");
}

function getConfigDir(env) {
  const xdg = env.XDG_CONFIG_HOME;
  if (xdg) return xdg;
  const home = os.homedir();
  return path.join(home, ".config");
}

export function getConfigPath({ env = process.env } = {}) {
  return path.join(getConfigDir(env), "zentao", "config.toml");
}

export function loadConfig({ env = process.env } = {}) {
  const filePath = getConfigPath({ env });
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = parseToml(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch (error) {
    return null;
  }
}

export function saveConfig(config, { env = process.env } = {}) {
  const filePath = getConfigPath({ env });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, toToml(config), "utf8");
  return filePath;
}
