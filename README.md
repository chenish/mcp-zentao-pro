# zentao-mcp

ZenTao CLI for products + bugs.

## Installation

Global install (recommended):

```bash
pnpm i -g @leeguoo/zentao-mcp
```

If you don't have pnpm:

```bash
npm i -g pnpm
pnpm i -g @leeguoo/zentao-mcp
```

Or use without installing:

```bash
npx -y @leeguoo/zentao-mcp --help
```

This installs the `zentao` command (and keeps `zentao-mcp` as a compatibility alias).

## Configuration

### Required Parameters

You can configure the CLI using CLI arguments or environment variables:

CLI arguments:

- `--zentao-url` (e.g. `https://zentao.example.com/zentao`)
- `--zentao-account`
- `--zentao-password`

Environment variables:

- `ZENTAO_URL`
- `ZENTAO_ACCOUNT`
- `ZENTAO_PASSWORD`

Tip: `ZENTAO_URL` should include the ZenTao base path (often `/zentao`).

Example:

- `https://zentao.example.com/zentao` (common)

If you see `404 Not Found` when logging in, your base path is likely missing `/zentao`.

## Commands

List products:

```bash
zentao products list
```

Full JSON output:

```bash
zentao products list --json
```

List bugs for a product:

```bash
zentao bugs list --product 1
```

Full JSON output:

```bash
zentao bugs list --product 1 --json
```

Get bug details:

```bash
zentao bug get --id 123
```

Full JSON output:

```bash
zentao bug get --id 123 --json
```

List my bugs:

```bash
zentao bugs mine --scope assigned --status active
```

Full JSON output:

```bash
zentao bugs mine --scope assigned --status active --json
```

Self test:

```bash
zentao self-test
```

## Login

Save credentials locally (stored as plaintext TOML under your user config directory):

```bash
zentao login --zentao-url=https://zentao.example.com/zentao --zentao-account=leo --zentao-password=***
```

Config file:

- `~/.config/zentao/config.toml` (or `$XDG_CONFIG_HOME/zentao/config.toml`)

Then commands can omit auth flags:

```bash
zentao whoami
zentao products list
```

Troubleshooting login:

- If `Token response parse failed: <html>...404 Not Found...`, try:
  - `https://your-host/zentao` instead of `https://your-host/`

## Release (maintainers)

### GitHub Actions (recommended)

This repo supports npm Trusted Publisher (OIDC) via GitHub Actions.

1. Create a tag matching `package.json` version:

```bash
git tag v0.5.1
git push origin v0.5.1
```

2. The workflow `.github/workflows/publish-npm.yml` will run tests and publish to npm.

In npm Trusted Publisher settings, set the workflow filename to `publish-npm.yml`.

### Local release (fallback)

Requires `git`, `npm`, and `gh`.

```bash
zentao release patch --dry-run
```

If you are using GitHub Actions publishing, prefer tagging + pushing, or run local release with:

```bash
zentao release patch --skip-publish
```

## Local Development

```bash
pnpm install
pnpm test
```

## Security

Do not commit credentials. Prefer environment variables in local runs.

## Skill

See `skills/SKILL.md`.
