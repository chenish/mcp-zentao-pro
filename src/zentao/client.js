import { getOption, parseCliArgs } from "../cli/args.js";
import { loadConfig } from "../config/store.js";

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

function toInt(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function normalizeResult(payload) {
  return { status: 1, msg: "success", result: payload };
}

export function normalizeError(message, payload) {
  return { status: 0, msg: message || "error", result: payload ?? [] };
}

function normalizeAccountValue(value) {
  return String(value || "").trim().toLowerCase();
}

function extractAccounts(value) {
  if (value === undefined || value === null) return [];
  if (typeof value === "string" || typeof value === "number") {
    const normalized = normalizeAccountValue(value);
    return normalized ? [normalized] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractAccounts(item));
  }
  if (typeof value === "object") {
    if (value.account) return extractAccounts(value.account);
    if (value.user) return extractAccounts(value.user);
    if (value.name) return extractAccounts(value.name);
    if (value.realname) return extractAccounts(value.realname);
    return [];
  }
  return [];
}

function matchesAccount(value, matchAccount) {
  const candidates = extractAccounts(value);
  return candidates.includes(matchAccount);
}

export class ZentaoClient {
  constructor({ baseUrl, account, password }) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.account = account;
    this.password = password;
    this.token = null;
  }

  async ensureToken() {
    if (this.token) return;
    this.token = await this.getToken();
  }

  async getToken() {
    const url = `${this.baseUrl}/api.php/v1/tokens`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account: this.account,
        password: this.password,
      }),
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new Error(`Token response parse failed: ${text.slice(0, 200)}`);
    }

    if (json.error) {
      throw new Error(`Token request failed: ${json.error}`);
    }

    if (!json.token) {
      throw new Error(`Token missing in response: ${text.slice(0, 200)}`);
    }

    return json.token;
  }

  async request({ method, path, query = {}, body }) {
    await this.ensureToken();

    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });

    const headers = {
      Token: this.token,
    };

    const options = { method, headers };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new Error(`Response parse failed: ${text.slice(0, 200)}`);
    }

    return json;
  }

  async listProducts({ page, limit }) {
    const payload = await this.request({
      method: "GET",
      path: "/api.php/v1/products",
      query: {
        page: toInt(page, 1),
        limit: toInt(limit, 1000),
      },
    });

    if (payload.error) return normalizeError(payload.error, payload);
    return normalizeResult(payload);
  }

  async listBugs({ product, page, limit }) {
    if (!product) throw new Error("product is required");

    const payload = await this.request({
      method: "GET",
      path: "/api.php/v1/bugs",
      query: {
        product,
        page: toInt(page, 1),
        limit: toInt(limit, 20),
      },
    });

    if (payload.error) return normalizeError(payload.error, payload);
    return normalizeResult(payload);
  }

  async getBug({ id }) {
    if (!id) throw new Error("id is required");

    const payload = await this.request({
      method: "GET",
      path: `/api.php/v1/bugs/${id}`,
    });

    if (payload.error) return normalizeError(payload.error, payload);
    return normalizeResult(payload);
  }

  async fetchAllBugsForProduct({ product, perPage, maxItems }) {
    const bugs = [];
    let page = 1;
    let total = null;
    const pageSize = toInt(perPage, 100);
    const cap = toInt(maxItems, 0);

    while (true) {
      const payload = await this.request({
        method: "GET",
        path: "/api.php/v1/bugs",
        query: {
          product,
          page,
          limit: pageSize,
        },
      });

      if (payload.error) {
        throw new Error(payload.error);
      }

      const pageBugs = Array.isArray(payload.bugs) ? payload.bugs : [];
      total = payload.total ?? total;
      for (const bug of pageBugs) {
        bugs.push(bug);
        if (cap > 0 && bugs.length >= cap) {
          return { bugs, total };
        }
      }

      if (total !== null && payload.limit) {
        if (page * payload.limit >= total) break;
      } else if (pageBugs.length < pageSize) {
        break;
      }

      page += 1;
    }

    return { bugs, total };
  }

  async bugsMine({
    account,
    scope,
    status,
    productIds,
    includeZero,
    perPage,
    maxItems,
    includeDetails,
  }) {
    const matchAccount = normalizeAccountValue(account || this.account);
    const targetScope = (scope || "assigned").toLowerCase();
    const rawStatus = status ?? "active";
    const statusList = Array.isArray(rawStatus) ? rawStatus : String(rawStatus).split(/[|,]/);
    const statusSet = new Set(
      statusList.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    );
    const allowAllStatus = statusSet.has("all") || statusSet.size === 0;

    const productsResponse = await this.listProducts({ page: 1, limit: 1000 });
    if (productsResponse.status !== 1) return productsResponse;
    const products = productsResponse.result.products || [];

    const productSet = Array.isArray(productIds) && productIds.length
      ? new Set(productIds.map((id) => Number(id)))
      : null;

    const rows = [];
    const bugs = [];
    let totalMatches = 0;
    const maxCollect = toInt(maxItems, 200);

    for (const product of products) {
      if (productSet && !productSet.has(Number(product.id))) continue;
      const { bugs: productBugs } = await this.fetchAllBugsForProduct({
        product: product.id,
        perPage,
      });

      const matches = productBugs.filter((bug) => {
        if (!allowAllStatus) {
          const bugStatus = String(bug.status || "").trim().toLowerCase();
          if (!statusSet.has(bugStatus)) return false;
        }
        const assigned = matchesAccount(bug.assignedTo, matchAccount);
        const opened = matchesAccount(bug.openedBy, matchAccount);
        const resolved = matchesAccount(bug.resolvedBy, matchAccount);
        if (targetScope === "assigned") return assigned;
        if (targetScope === "opened") return opened;
        if (targetScope === "resolved") return resolved;
        return assigned || opened || resolved;
      });

      if (!includeZero && matches.length === 0) continue;
      totalMatches += matches.length;

      rows.push({
        id: product.id,
        name: product.name,
        totalBugs: toInt(product.totalBugs, 0),
        myBugs: matches.length,
      });

      if (includeDetails && bugs.length < maxCollect) {
        for (const bug of matches) {
          if (bugs.length >= maxCollect) break;
          bugs.push({
            id: bug.id,
            title: bug.title,
            product: bug.product,
            status: bug.status,
            pri: bug.pri,
            severity: bug.severity,
            assignedTo: bug.assignedTo,
            openedBy: bug.openedBy,
            resolvedBy: bug.resolvedBy,
            openedDate: bug.openedDate,
          });
        }
      }
    }

    return normalizeResult({
      account: matchAccount,
      scope: targetScope,
      status: allowAllStatus ? "all" : Array.from(statusSet),
      total: totalMatches,
      products: rows,
      bugs: includeDetails ? bugs : [],
    });
  }
}

export function createClientFromCli({ argv, env }) {
  const stored = loadConfig({ env }) || {};
  const cliArgs = parseCliArgs(argv);

  const baseUrl =
    getOption(cliArgs, env, "ZENTAO_URL", "zentao-url") || stored.zentaoUrl || null;
  const account =
    getOption(cliArgs, env, "ZENTAO_ACCOUNT", "zentao-account") ||
    stored.zentaoAccount ||
    null;
  const password =
    getOption(cliArgs, env, "ZENTAO_PASSWORD", "zentao-password") ||
    stored.zentaoPassword ||
    null;

  if (!baseUrl) throw new Error("Missing ZENTAO_URL or --zentao-url");
  if (!account) throw new Error("Missing ZENTAO_ACCOUNT or --zentao-account");
  if (!password) throw new Error("Missing ZENTAO_PASSWORD or --zentao-password");

  return new ZentaoClient({ baseUrl, account, password });
}
