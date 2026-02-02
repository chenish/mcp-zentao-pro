# zentao (ZenTao CLI)

This package provides a CLI for ZenTao REST API (products + bugs).

When instructing users, assume the primary workflow is:

1) install with pnpm globally
2) `zentao login` once
3) run `zentao ...` commands without passing credentials each time

## Installation

Global install (recommended):

```bash
pnpm i -g @leeguoo/zentao-mcp
```

If pnpm is not installed:

```bash
npm i -g pnpm
pnpm i -g @leeguoo/zentao-mcp
```

Or use without installing:

```bash
npx -y @leeguoo/zentao-mcp --help
```

This installs the `zentao` command (and keeps `zentao-mcp` as a compatibility alias).

## Authentication

Recommended: login once (stored locally):

```bash
zentao login --zentao-url=https://zentao.example.com/zentao --zentao-account=leo --zentao-password=***
```

This writes:

- `~/.config/zentao/config.toml` (or `$XDG_CONFIG_HOME/zentao/config.toml`)

IMPORTANT: `zentaoUrl` should usually include `/zentao`.
If login returns 404 HTML, your base path is likely missing `/zentao`.

You can pass credentials via environment variables:

```bash
export ZENTAO_URL="https://zentao.example.com/zentao"
export ZENTAO_ACCOUNT="leo"
export ZENTAO_PASSWORD="***"
```

Or via CLI flags:

- `--zentao-url`
- `--zentao-account`
- `--zentao-password`

## Commands

### List products

```bash
zentao products list
```

By default, this prints a simple TSV table (key fields). To get full JSON:

Full JSON output:

```bash
zentao products list --json
```

### List bugs for a product

```bash
zentao bugs list --product 1
```

By default, this prints a simple TSV table. To get full JSON:

Full JSON output:

```bash
zentao bugs list --product 1 --json
```

### Get bug details

```bash
zentao bug get --id 123
```

By default, this prints a simple TSV (single row). To get full JSON:

Full JSON output:

```bash
zentao bug get --id 123 --json
```

### List my bugs

```bash
zentao bugs mine --scope assigned --status active
```

By default, this prints a simple summary table. To include bug details:

```bash
zentao bugs mine --status active --include-details
```

Full JSON output:

```bash
zentao bugs mine --scope assigned --status active --json
```

Common options:

- `--scope`: `assigned|opened|resolved|all`
- `--status`: `active|resolved|closed|all` (supports `,` or `|` separated)
- `--include-details`: include bug list in response
- `--product-ids`: limit scan to specific products, e.g. `--product-ids=1,2,3`

### Self test

```bash
zentao self-test
```

Use `--expected N` to make it CI-friendly (exit code 2 when mismatch):

```bash
zentao self-test --expected 0
```

## Whoami

After login:

```bash
zentao whoami
```

### Release (maintainers)

Requires `git`, `npm`, and `gh`.

```bash
zentao release patch --dry-run
```

Recommended publishing flow is via GitHub Actions npm Trusted Publisher (OIDC):

1) bump `package.json` version
2) create a matching tag `vX.Y.Z`
3) push the tag to GitHub
4) workflow `publish-npm.yml` publishes to npm

If you use Actions publishing, prefer `zentao release patch --skip-publish` locally.
