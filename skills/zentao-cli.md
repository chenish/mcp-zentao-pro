# zentao (ZenTao CLI)

This package provides a CLI for ZenTao REST API (products + bugs).

## Installation

Global install:

```bash
npm i -g @leeguoo/zentao-mcp
```

Or use without installing:

```bash
npx -y @leeguoo/zentao-mcp --help
```

This installs the `zentao` command (and keeps `zentao-mcp` as a compatibility alias).

## Authentication

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

Full JSON output:

```bash
zentao products list --json
```

### List bugs for a product

```bash
zentao bugs list --product 1
```

Full JSON output:

```bash
zentao bugs list --product 1 --json
```

### Get bug details

```bash
zentao bug get --id 123
```

Full JSON output:

```bash
zentao bug get --id 123 --json
```

### List my bugs

```bash
zentao bugs mine --scope assigned --status active
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

## Login / Whoami

Save credentials locally:

```bash
zentao login --zentao-url=https://zentao.example.com/zentao --zentao-account=leo --zentao-password=***
```

Config file:

- `~/.config/zentao/config.toml` (or `$XDG_CONFIG_HOME/zentao/config.toml`)

Then:

```bash
zentao whoami
```

### Release (maintainers)

Requires `git`, `npm`, and `gh`.

```bash
zentao release patch --dry-run
```
