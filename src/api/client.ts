import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { URLSearchParams } from 'url';

type ZentaoUser = {
  account?: string;
  realname?: string;
  [key: string]: any;
};

type DashboardItemType = 'task' | 'story' | 'bug';

type ManagedDashboardUser = {
  account: string;
  realname: string;
  tasks: any[];
  stories: any[];
  bugs: any[];
  summary: {
    tasks: number;
    stories: number;
    bugs: number;
  };
};

type ManagedDashboardOptions = {
  statuses?: string[];
  dateFrom?: string;
  dateTo?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  overdueOnly?: boolean;
};

type WeeklySynthesisOptions = {
  dateFrom: string;
  dateTo: string;
  deadlineTo: string;
  priMax?: number;
  severityMax?: number;
};

type TaskLookupOptions = {
  statuses?: string[];
  dateFrom?: string;
  dateTo?: string;
};

export class ZentaoClient {
  public rest: AxiosInstance;
  public mvc: AxiosInstance;
  private baseURL: string;
  public token?: string;
  public zentaosid?: string;
  private usersCache: ZentaoUser[] | null = null;
  private _account: string = '';
  private _password: string = '';  // base64-encoded for safe in-memory storage only

  constructor(baseURL: string, token: string = '', zentaosid: string = '') {
    this.baseURL = baseURL;
    this.token = token;
    this.zentaosid = zentaosid;

    this.rest = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Token': token,
      },
    });

    this.mvc = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `zentaosid=${zentaosid}`,
      },
    });

    this._setupAutoTokenRefresh();
  }

  /**
   * Store credentials for silent token refresh (base64 in memory only, not written to disk here)
   */
  setCredentials(account: string, password: string) {
    this._account = Buffer.from(account).toString('base64');
    this._password = Buffer.from(password).toString('base64');
  }

  private _getCredentials(): { account: string; password: string } | null {
    if (!this._account || !this._password) return null;
    return {
      account: Buffer.from(this._account, 'base64').toString(),
      password: Buffer.from(this._password, 'base64').toString(),
    };
  }

  /**
   * Register 401 interceptors on both rest and mvc instances.
   * On 401, silently re-login and retry the original request once.
   */
  private _setupAutoTokenRefresh() {
    const refreshAndRetry = async (error: any, instance: AxiosInstance) => {
      const status = error.response?.status;
      // Also catch 302 redirect bodies which MVC throws when auth fails
      const isMvcAuthFailure = typeof error.response?.data === 'string' && error.response.data.includes('user-login.html');

      if ((status === 401 || status === 403 || isMvcAuthFailure) && !error.config?._isRetry) {
        const creds = this._getCredentials();
        if (!creds) return Promise.reject(error);
        try {
          console.log('[Auth] Token expired or MVC session lost, silently refreshing...');
          const authRes = await this.login(creds.account, creds.password);

          if (authRes.token && authRes.zentaosid) {
            // Mark the retry request to avoid infinite loop
            const retryConfig: AxiosRequestConfig & { _isRetry?: boolean } = {
              ...error.config,
              _isRetry: true,
              headers: {
                ...error.config.headers,
                'Token': authRes.token,
                'Cookie': `zentaosid=${authRes.zentaosid}`
              }
            };
            return instance.request(retryConfig);
          }
        } catch (refreshError) {
          console.error('[Auth] Silent token refresh failed:', refreshError);
        }
      }
      return Promise.reject(error);
    };

    this.rest.interceptors.response.use(
      (r) => r,
      (e) => refreshAndRetry(e, this.rest)
    );
    this.mvc.interceptors.response.use(
      (r) => r,
      (e) => refreshAndRetry(e, this.mvc)
    );
  }

  setAuth(token: string, zentaosid: string) {
    if (token) {
      this.rest.defaults.headers['Token'] = token;
      this.token = token;
    }
    if (zentaosid) {
      this.mvc.defaults.headers['Cookie'] = `zentaosid=${zentaosid}`;
      this.zentaosid = zentaosid;
    }
  }

  async login(account: string, password: string): Promise<{ token: string, zentaosid: string }> {
    // 1. Get REST Token
    const restRes = await this.rest.post('/api.php/v1/tokens', { account, password });
    if (!restRes.data || !restRes.data.token) {
      throw new Error('REST Login failed, no token received');
    }
    const token = restRes.data.token;

    // 2. Get MVC zentaosid (Session Cookie)
    const formData = new URLSearchParams();
    formData.append('account', account);
    formData.append('password', password);
    formData.append('keepLogin', '1');
    const mvcRes = await this.mvc.post('/api.php?m=user&f=login&t=json', formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    let zentaosid = '';
    const cookies = mvcRes.headers['set-cookie'] || [];
    for (const cookie of cookies) {
      if (cookie.includes('zentaosid=')) {
        zentaosid = cookie.split(';')[0].split('=')[1];
        break;
      }
    }

    // In rare cases, ZenTao might not set Cookie but return it in response body depending on version/config
    if (!zentaosid) {
      try {
        const lData = typeof mvcRes.data === 'string' ? JSON.parse(mvcRes.data) : mvcRes.data;
        if (lData.user && lData.user.session) {
          zentaosid = lData.user.session;
        }
      } catch (e) { }
    }

    if (!zentaosid) {
      throw new Error('MVC Login failed, no zentaosid cookie received');
    }

    this.setAuth(token, zentaosid);
    return { token, zentaosid };
  }

  private extractUsersFromPayload(payload: any): ZentaoUser[] {
    const candidates = [
      payload?.users,
      payload?.data?.users,
      payload?.result?.users,
      Array.isArray(payload) ? payload : null,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter((user: ZentaoUser) => Boolean(user?.account));
      }
    }

    return [];
  }

  private extractPositiveNumber(value: any): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }

  private extractUsersTotal(payload: any): number | null {
    return this.extractPositiveNumber(
      payload?.total ?? payload?.pager?.recTotal ?? payload?.page?.total ?? payload?.meta?.total
    );
  }

  private mergeUserIntoCache(user: ZentaoUser): ZentaoUser | null {
    const account = String(user?.account || '').trim();
    if (!account) return null;

    const nextUser = { ...user, account };
    if (!this.usersCache) {
      this.usersCache = [nextUser];
      return nextUser;
    }

    const index = this.usersCache.findIndex((item) => item.account === account);
    if (index >= 0) {
      this.usersCache[index] = { ...this.usersCache[index], ...nextUser };
      return this.usersCache[index];
    }

    this.usersCache.push(nextUser);
    return nextUser;
  }

  private async getAllUsers(): Promise<ZentaoUser[]> {
    if (this.usersCache) {
      return this.usersCache;
    }

    const usersByAccount = new Map<string, ZentaoUser>();
    const pageSize = 100;
    let page = 1;
    let total: number | null = null;

    while (page <= 50) {
      const res = await this.rest.get('/api.php/v1/users', {
        params: { limit: pageSize, page },
      });
      const pageUsers = this.extractUsersFromPayload(res.data);
      const apiLimit = this.extractPositiveNumber(res.data?.limit) ?? pageSize;

      if (total === null) {
        total = this.extractUsersTotal(res.data);
      }

      if (pageUsers.length === 0) {
        break;
      }

      let addedCount = 0;
      for (const user of pageUsers) {
        const account = String(user?.account || '').trim();
        if (!account) continue;

        if (!usersByAccount.has(account)) {
          addedCount += 1;
        }
        usersByAccount.set(account, { ...usersByAccount.get(account), ...user, account });
      }

      if (total !== null && usersByAccount.size >= total) {
        break;
      }

      if (pageUsers.length < apiLimit || addedCount === 0) {
        break;
      }

      page += 1;
    }

    this.usersCache = Array.from(usersByAccount.values());
    return this.usersCache;
  }

  private extractUserFromPayload(payload: any): ZentaoUser | null {
    const directUser = payload?.user ?? payload?.data?.user ?? payload?.data ?? payload;
    if (directUser && !Array.isArray(directUser) && typeof directUser === 'object' && directUser.account) {
      return directUser;
    }
    return null;
  }

  private extractMvcPayload(payload: any): any {
    let parsedData: any = Array.isArray(payload) ? payload : null;

    if (!parsedData && payload) {
      if (typeof payload.data === 'string') {
        try {
          parsedData = JSON.parse(payload.data);
        } catch (e) {
          console.error('Failed to parse MVC JSON response', e);
        }
      } else if (typeof payload.data === 'object' && payload.data !== null) {
        parsedData = payload.data;
      } else if (typeof payload === 'object') {
        parsedData = payload;
      }
    }

    return parsedData;
  }

  private normalizeLookupKey(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private collapseRepeatedLetters(value: string): string {
    return value.replace(/([a-z])\1+/g, '$1');
  }

  private levenshteinDistance(source: string, target: string): number {
    const sourceLength = source.length;
    const targetLength = target.length;

    if (sourceLength === 0) return targetLength;
    if (targetLength === 0) return sourceLength;

    const matrix = Array.from({ length: sourceLength + 1 }, () => Array(targetLength + 1).fill(0));
    for (let i = 0; i <= sourceLength; i += 1) matrix[i][0] = i;
    for (let j = 0; j <= targetLength; j += 1) matrix[0][j] = j;

    for (let i = 1; i <= sourceLength; i += 1) {
      for (let j = 1; j <= targetLength; j += 1) {
        const cost = source[i - 1] === target[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[sourceLength][targetLength];
  }

  private inferRealnameFromMvcUserList(userListHtml: any, account: string): string {
    const html = String(userListHtml || '');
    const normalizedAccount = this.normalizeLookupKey(account);
    if (!html || !normalizedAccount) return '';

    const relaxedAccount = this.collapseRepeatedLetters(normalizedAccount);
    const optionRegex = /<option[^>]*title='([^']*)'[^>]*data-keys='([^']*)'[^>]*>([^<]*)<\/option>/gi;
    let bestMatch: { realname: string; distance: number } | null = null;
    let secondBestDistance: number | null = null;

    for (const match of html.matchAll(optionRegex)) {
      const [, title, dataKeys, label] = match;
      const realname = String(title || label || '').trim();
      if (!realname) continue;

      const normalizedKeys = String(dataKeys || '')
        .split(/\s+/)
        .map((key) => this.normalizeLookupKey(key))
        .filter(Boolean);

      if (normalizedKeys.length === 0) continue;

      const hasExactKey = normalizedKeys.some((key) => {
        const relaxedKey = this.collapseRepeatedLetters(key);
        return key === normalizedAccount
          || key === relaxedAccount
          || relaxedKey === normalizedAccount
          || relaxedKey === relaxedAccount;
      });

      if (hasExactKey) {
        return realname;
      }

      const distance = Math.min(
        ...normalizedKeys.map((key) => {
          const relaxedKey = this.collapseRepeatedLetters(key);
          return Math.min(
            this.levenshteinDistance(key, normalizedAccount),
            this.levenshteinDistance(relaxedKey, normalizedAccount),
            this.levenshteinDistance(key, relaxedAccount),
            this.levenshteinDistance(relaxedKey, relaxedAccount)
          );
        })
      );

      if (!bestMatch || distance < bestMatch.distance) {
        secondBestDistance = bestMatch?.distance ?? secondBestDistance;
        bestMatch = { realname, distance };
      } else if (secondBestDistance === null || distance < secondBestDistance) {
        secondBestDistance = distance;
      }
    }

    if (bestMatch && bestMatch.distance <= 1 && (secondBestDistance === null || secondBestDistance - bestMatch.distance >= 2)) {
      return bestMatch.realname;
    }

    return '';
  }

  private async getUserRealnameFromMvc(account: string): Promise<string> {
    const res = await this.mvc.get(`/user-task-${account}.json`);
    const payload = this.extractMvcPayload(res.data);
    return this.inferRealnameFromMvcUserList(payload?.userList, account);
  }

  private async getUserByAccount(account: string): Promise<ZentaoUser | null> {
    const normalizedAccount = String(account || '').trim();
    if (!normalizedAccount) return null;

    const users = await this.getAllUsers();
    const cachedUser = users.find((user) => user.account === normalizedAccount);
    if (cachedUser) {
      return cachedUser;
    }

    try {
      const res = await this.rest.get(`/api.php/v1/users/${encodeURIComponent(normalizedAccount)}`);
      const singleUser = this.extractUserFromPayload(res.data);
      if (singleUser) {
        return this.mergeUserIntoCache(singleUser);
      }
    } catch {
      // Ignore resource-style lookup failures and keep account-only matching.
    }

    return null;
  }

  async getUsersMapping(): Promise<Record<string, string>> {
    const mapping: Record<string, string> = {};
    const users = await this.getAllUsers();

    users.forEach((user) => {
      const account = String(user.account || '').trim();
      const realname = String(user.realname || '').trim();

      if (account) {
        mapping[account] = account;
      }
      if (realname) {
        mapping[realname] = account;
      }
    });

    return mapping;
  }

  async getUserRealname(account: string): Promise<string> {
    const user = await this.getUserByAccount(account);
    const realname = String(user?.realname || '').trim();
    if (realname) {
      return realname;
    }

    try {
      const mvcRealname = await this.getUserRealnameFromMvc(account);
      if (mvcRealname) {
        this.mergeUserIntoCache({ account, realname: mvcRealname });
        return mvcRealname;
      }
    } catch {
      // Ignore MVC fallback failures and keep account-only matching.
    }

    return '';
  }

  private getDashboardCollectionKey(type: DashboardItemType): 'tasks' | 'stories' | 'bugs' {
    if (type === 'story') return 'stories';
    if (type === 'bug') return 'bugs';
    return 'tasks';
  }

  private getDashboardTypeLabel(type: DashboardItemType): string {
    return type === 'story' ? 'story' : type === 'bug' ? 'bug' : 'task';
  }

  private extractDashboardItems(type: DashboardItemType, payload: any): any[] {
    const key = this.getDashboardCollectionKey(type);
    let items = payload?.[key] || [];

    if (typeof items === 'object' && !Array.isArray(items)) {
      items = Object.values(items);
    }

    return Array.isArray(items) ? items : [];
  }

  private formatDashboardItems(type: DashboardItemType, items: any[], keepMeta?: boolean): any[] {
    return items.map((item: any) => {
      if (keepMeta) {
        const { desc, color, mailto, ...metaItem } = item;
        return { ...metaItem, webUrl: `${this.baseURL}/${type}-view-${item.id}.html` };
      }

      const {
        desc, openedBy, openedDate, assignedDate, estStarted,
        realStarted, finishedBy, finishedDate, canceledBy, canceledDate,
        closedBy, closedDate, lastEditedBy, lastEditedDate, color, mailto,
        ...cleanItem
      } = item;
      return { ...cleanItem, webUrl: `${this.baseURL}/${type}-view-${item.id}.html` };
    });
  }

  private buildUserScopeDefaultUrl(type: DashboardItemType, userId: string): string {
    if (type === 'story') return `/user-story-${userId}-story.json`;
    if (type === 'bug') return `/user-bug-${userId}.json`;
    return `/user-task-${userId}.json`;
  }

  private buildUserScopePageUrl(
    type: DashboardItemType,
    userId: string,
    scope: string,
    recTotal: number,
    recPerPage: number,
    page: number
  ): string {
    if (type === 'story') {
      return `/user-story-${userId}-story-${scope}-id_desc-${recTotal}-${recPerPage}-${page}.json`;
    }
    if (type === 'bug') {
      return `/user-bug-${userId}-${scope}-id_desc-${recTotal}-${recPerPage}-${page}.json`;
    }
    return `/user-task-${userId}-${scope}-id_desc-${recTotal}-${recPerPage}-${page}.json`;
  }

  private isActiveManagedStatus(status: any): boolean {
    const normalized = String(status || '').trim().toLowerCase();
    return normalized !== 'cancel' && normalized !== 'done' && normalized !== 'closed';
  }

  private isOpenManagedItem(type: DashboardItemType, status: any): boolean {
    const normalized = String(status || '').trim().toLowerCase();
    if (type === 'bug') {
      return normalized !== 'resolved' && normalized !== 'closed';
    }
    if (type === 'story') {
      return normalized !== 'closed';
    }
    return this.isActiveManagedStatus(normalized);
  }

  private isDateWithinWindow(dateValue: any, dateFrom: string, dateTo: string): boolean {
    const date = String(dateValue || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    return date >= dateFrom && date <= dateTo;
  }

  private normalizeStatuses(statuses?: string[]): string[] {
    if (!Array.isArray(statuses)) return [];
    return Array.from(
      new Set(
        statuses
          .map((status) => String(status || '').trim().toLowerCase())
          .filter(Boolean)
      )
    );
  }

  private expandStatusAliases(type: DashboardItemType, statuses?: string[]): string[] {
    const normalizedStatuses = this.normalizeStatuses(statuses);
    if (normalizedStatuses.length === 0) return [];

    const expanded = new Set<string>();
    for (const status of normalizedStatuses) {
      expanded.add(status);

      if (type === 'bug') {
        if (status === 'doing' || status === 'wait' || status === 'active') expanded.add('active');
        if (status === 'done' || status === 'resolved') expanded.add('resolved');
        if (status === 'done' || status === 'closed') expanded.add('closed');
      } else if (type === 'story') {
        if (status === 'doing' || status === 'wait' || status === 'active') expanded.add('active');
        if (status === 'done' || status === 'closed') expanded.add('closed');
      } else {
        if (status === 'active') {
          expanded.add('doing');
          expanded.add('wait');
        }
        if (status === 'done' || status === 'closed') {
          expanded.add('done');
          expanded.add('closed');
        }
      }
    }

    return Array.from(expanded);
  }

  private matchesStatusFilter(type: DashboardItemType, statusValue: any, statuses?: string[]): boolean {
    const expandedStatuses = this.expandStatusAliases(type, statuses);
    if (expandedStatuses.length === 0) return true;

    const normalizedStatusValue = String(statusValue || '').trim().toLowerCase();
    return expandedStatuses.includes(normalizedStatusValue);
  }

  private matchesDeadlineFilter(
    deadlineValue: any,
    deadlineFrom?: string,
    deadlineTo?: string,
    overdueOnly: boolean = false
  ): boolean {
    const deadline = String(deadlineValue || '').slice(0, 10);
    if (!deadline) {
      return !overdueOnly && !deadlineFrom && !deadlineTo;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return false;

    if (overdueOnly && deadline >= this.getCurrentDateString()) {
      return false;
    }

    if (deadlineFrom && deadline < deadlineFrom) return false;
    if (deadlineTo && deadline > deadlineTo) return false;

    return true;
  }

  private async fetchUserScopeItems(
    type: DashboardItemType,
    account: string,
    scope: string = 'assignedTo',
    status?: string,
    keepMeta?: boolean,
    hideCanceled: boolean = true
  ): Promise<any[]> {
    const user = await this.getUserByAccount(account);
    const userId = String(user?.id || account).trim();
    const deduped = new Map<string, any>();
    let page = 1;
    let pageTotal = 1;
    let recTotal = 0;
    let recPerPage = 20;

    while (page <= pageTotal) {
      const url = page === 1 && scope === 'assignedTo'
        ? this.buildUserScopeDefaultUrl(type, userId)
        : this.buildUserScopePageUrl(type, userId, scope, recTotal, recPerPage, page);
      const res = await this.mvc.get(url);
      const parsedData = this.extractMvcPayload(res.data);
      if (!parsedData) break;

      const items = this.extractDashboardItems(type, parsedData);
      const pager = parsedData.pager || {};
      recTotal = this.extractPositiveNumber(pager.recTotal) ?? recTotal;
      recPerPage = this.extractPositiveNumber(pager.recPerPage) ?? recPerPage;
      pageTotal = this.extractPositiveNumber(pager.pageTotal) ?? pageTotal;

      for (const item of items) {
        if (!item?.id) continue;
        const id = String(item.id);
        if (!deduped.has(id)) {
          deduped.set(id, item);
        }
      }

      if (items.length === 0 || page >= pageTotal) {
        break;
      }
      page += 1;
    }

    const filtered = Array.from(deduped.values()).filter((item: any) => {
      if (hideCanceled && item.status === 'cancel') return false;
      if (status && item.status !== status) return false;
      return true;
    });

    return this.formatDashboardItems(type, filtered, keepMeta);
  }

  async getManagedDashboard(
    assignees: string[],
    types: DashboardItemType[] = ['task', 'story', 'bug'],
    options: ManagedDashboardOptions = {}
  ): Promise<{ users: ManagedDashboardUser[]; totals: { tasks: number; stories: number; bugs: number } }> {
    const normalizedTypes = Array.from(new Set(types));
    const normalizedAssignees = Array.from(
      new Set(
        assignees.map((assignee) => String(assignee || '').trim()).filter(Boolean)
      )
    );
    const normalizedStatuses = this.normalizeStatuses(options.statuses);
    const completedDateFrom = options.dateFrom || this.getCurrentDateString();
    const completedDateTo = options.dateTo || completedDateFrom;

    const users = await Promise.all(normalizedAssignees.map(async (account) => {
      const realname = await this.getUserRealname(account);
      const [assignedTasks, finishedTasks, closedTasks, assignedStories, closedStories, assignedBugs, resolvedBugs, closedBugs] = await Promise.all([
        normalizedTypes.includes('task') ? this.fetchUserScopeItems('task', account, 'assignedTo', undefined, true, true) : Promise.resolve([]),
        normalizedTypes.includes('task') ? this.fetchUserScopeItems('task', account, 'finishedBy', undefined, true, true) : Promise.resolve([]),
        normalizedTypes.includes('task') ? this.fetchUserScopeItems('task', account, 'closedBy', undefined, true, true) : Promise.resolve([]),
        normalizedTypes.includes('story') ? this.fetchUserScopeItems('story', account, 'assignedTo', undefined, true, true) : Promise.resolve([]),
        normalizedTypes.includes('story') ? this.fetchUserScopeItems('story', account, 'closedBy', undefined, true, true) : Promise.resolve([]),
        normalizedTypes.includes('bug') ? this.fetchUserScopeItems('bug', account, 'assignedTo', undefined, true, true) : Promise.resolve([]),
        normalizedTypes.includes('bug') ? this.fetchUserScopeItems('bug', account, 'resolvedBy', undefined, true, true) : Promise.resolve([]),
        normalizedTypes.includes('bug') ? this.fetchUserScopeItems('bug', account, 'closedBy', undefined, true, true) : Promise.resolve([]),
      ]);
      const taskMap = new Map<string, any>();
      const storyMap = new Map<string, any>();
      const bugMap = new Map<string, any>();

      assignedTasks
        .filter((item: any) => {
          const normalizedStatus = String(item.status || '').trim().toLowerCase();
          const isOpenItem = this.isOpenManagedItem('task', item.status);
          const isCompletedItem = (normalizedStatus === 'done' || normalizedStatus === 'closed')
            && this.isDateWithinWindow(item.finishedDate || item.closedDate, completedDateFrom, completedDateTo);

          return (isOpenItem || isCompletedItem)
            && this.matchesStatusFilter('task', item.status, normalizedStatuses)
            && this.matchesDeadlineFilter(item.deadline, options.deadlineFrom, options.deadlineTo, options.overdueOnly);
        })
        .forEach((item: any) => taskMap.set(String(item.id), item));

      finishedTasks
        .filter((item: any) => {
          const normalizedStatus = String(item.status || '').trim().toLowerCase();
          if (normalizedStatus !== 'done' && normalizedStatus !== 'closed') return false;
          if (!this.isDateWithinWindow(item.finishedDate || item.closedDate, completedDateFrom, completedDateTo)) return false;
          if (!this.matchesStatusFilter('task', item.status, normalizedStatuses)) return false;
          if (!this.matchesDeadlineFilter(item.deadline, options.deadlineFrom, options.deadlineTo, options.overdueOnly)) return false;
          return true;
        })
        .forEach((item: any) => taskMap.set(String(item.id), item));

      closedTasks
        .filter((item: any) => {
          const normalizedStatus = String(item.status || '').trim().toLowerCase();
          if (normalizedStatus !== 'closed') return false;
          if (!this.isDateWithinWindow(item.closedDate || item.finishedDate, completedDateFrom, completedDateTo)) return false;
          if (!this.matchesStatusFilter('task', item.status, normalizedStatuses)) return false;
          if (!this.matchesDeadlineFilter(item.deadline, options.deadlineFrom, options.deadlineTo, options.overdueOnly)) return false;
          return true;
        })
        .forEach((item: any) => taskMap.set(String(item.id), item));

      const tasks = Array.from(taskMap.values()).sort((a, b) => Number(a.id) - Number(b.id));

      assignedStories
        .filter((item: any) => {
          const normalizedStatus = String(item.status || '').trim().toLowerCase();
          const isOpenItem = this.isOpenManagedItem('story', item.status);
          const isCompletedItem = normalizedStatus === 'closed'
            && this.isDateWithinWindow(item.closedDate, completedDateFrom, completedDateTo);

          return (isOpenItem || isCompletedItem)
            && this.matchesStatusFilter('story', item.status, normalizedStatuses)
            && this.matchesDeadlineFilter(item.deadline, options.deadlineFrom, options.deadlineTo, options.overdueOnly);
        })
        .forEach((item: any) => storyMap.set(String(item.id), item));

      closedStories
        .filter((item: any) => {
          const normalizedStatus = String(item.status || '').trim().toLowerCase();
          if (normalizedStatus !== 'closed') return false;
          if (!this.isDateWithinWindow(item.closedDate, completedDateFrom, completedDateTo)) return false;
          if (!this.matchesStatusFilter('story', item.status, normalizedStatuses)) return false;
          if (!this.matchesDeadlineFilter(item.deadline, options.deadlineFrom, options.deadlineTo, options.overdueOnly)) return false;
          return true;
        })
        .forEach((item: any) => storyMap.set(String(item.id), item));

      assignedBugs
        .filter((item: any) => {
          const normalizedStatus = String(item.status || '').trim().toLowerCase();
          const isOpenItem = this.isOpenManagedItem('bug', item.status);
          const isCompletedItem = (normalizedStatus === 'resolved' || normalizedStatus === 'closed')
            && this.isDateWithinWindow(item.resolvedDate || item.closedDate, completedDateFrom, completedDateTo);

          return (isOpenItem || isCompletedItem)
            && this.matchesStatusFilter('bug', item.status, normalizedStatuses)
            && this.matchesDeadlineFilter(item.deadline, options.deadlineFrom, options.deadlineTo, options.overdueOnly);
        })
        .forEach((item: any) => bugMap.set(String(item.id), item));

      resolvedBugs
        .filter((item: any) => {
          const normalizedStatus = String(item.status || '').trim().toLowerCase();
          if (normalizedStatus !== 'resolved' && normalizedStatus !== 'closed') return false;
          if (!this.isDateWithinWindow(item.resolvedDate || item.closedDate, completedDateFrom, completedDateTo)) return false;
          if (!this.matchesStatusFilter('bug', item.status, normalizedStatuses)) return false;
          if (!this.matchesDeadlineFilter(item.deadline, options.deadlineFrom, options.deadlineTo, options.overdueOnly)) return false;
          return true;
        })
        .forEach((item: any) => bugMap.set(String(item.id), item));

      closedBugs
        .filter((item: any) => {
          if (!this.isDateWithinWindow(item.closedDate, completedDateFrom, completedDateTo)) return false;
          if (!this.matchesStatusFilter('bug', item.status, normalizedStatuses)) return false;
          if (!this.matchesDeadlineFilter(item.deadline, options.deadlineFrom, options.deadlineTo, options.overdueOnly)) return false;
          return true;
        })
        .forEach((item: any) => bugMap.set(String(item.id), item));

      const filteredStories = Array.from(storyMap.values()).sort((a, b) => Number(a.id) - Number(b.id));
      const filteredBugs = Array.from(bugMap.values()).sort((a, b) => Number(a.id) - Number(b.id));

      return {
        account,
        realname,
        tasks,
        stories: filteredStories,
        bugs: filteredBugs,
        summary: {
          tasks: tasks.length,
          stories: filteredStories.length,
          bugs: filteredBugs.length,
        },
      };
    }));

    const totals = users.reduce(
      (acc, user) => {
        acc.tasks += user.summary.tasks;
        acc.stories += user.summary.stories;
        acc.bugs += user.summary.bugs;
        return acc;
      },
      { tasks: 0, stories: 0, bugs: 0 }
    );

    return { users, totals };
  }

  async getProjects(): Promise<any[]> {
    const res = await this.rest.get('/api.php/v1/projects?status=doing&limit=50');
    if (res.data && Array.isArray(res.data.projects)) {
      return res.data.projects;
    }
    return [];
  }

  async getProject(projectId: string | number): Promise<any> {
    const res = await this.rest.get(`/api.php/v1/projects/${projectId}`);
    return res.data;
  }

  async getActiveExecutions(projectId?: number): Promise<any[]> {
    let url = '/api.php/v1/executions?status=doing&limit=50';
    if (projectId) {
      url += `&project=${projectId}`;
    }
    const res = await this.rest.get(url);
    if (res.data && Array.isArray(res.data.executions)) {
      return res.data.executions;
    }
    return [];
  }

  async getExecution(executionId: string | number): Promise<any> {
    const res = await this.rest.get(`/api.php/v1/executions/${executionId}`);
    return res.data;
  }

  async getStory(storyId: string | number): Promise<any> {
    const res = await this.rest.get(`/api.php/v1/stories/${storyId}`);
    return res.data;
  }

  async getProjectExecutions(projectId: number, pageSize: number = 100): Promise<any[]> {
    const executions: any[] = [];
    let page = 1;
    let pageTotal = 1;

    while (page <= pageTotal) {
      const res = await this.rest.get('/api.php/v1/executions', {
        params: { limit: pageSize, page },
      });
      const payload = res.data || {};
      const pageExecutions = Array.isArray(payload.executions) ? payload.executions : [];
      pageTotal = this.extractPositiveNumber(payload.pageTotal ?? Math.ceil((payload.total || 0) / (payload.limit || pageSize))) ?? pageTotal;

      executions.push(
        ...pageExecutions.filter((item: any) => Number(item.project) === Number(projectId) || Number(item.parent) === Number(projectId))
      );

      if (pageExecutions.length === 0) break;
      page += 1;
    }

    return executions.sort((a, b) => Number(b.id) - Number(a.id));
  }

  async createExecution(projectId: number, payload: {
    name: string;
    begin: string;
    end: string;
    days: number;
    team: string; // 成员拷贝
    acl?: string;
    whitelist?: string[];
  }): Promise<any> {
    const defaultPayload = {
      project: projectId,
      type: 'sprint',
      lifetime: 'short',
      ...payload
    };
    const res = await this.rest.post('/api.php/v1/executions', defaultPayload);
    return res.data;
  }

  private getMonthWindow(anchorDate?: string): { begin: string; end: string } {
    const anchor = anchorDate ? new Date(`${anchorDate}T00:00:00`) : new Date();
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return {
      begin: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-${String(monthStart.getDate()).padStart(2, '0')}`,
      end: `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`,
    };
  }

  private countWorkdays(begin: string, end: string): number {
    const start = new Date(`${begin}T00:00:00`);
    const finish = new Date(`${end}T00:00:00`);
    let count = 0;
    for (let cursor = new Date(start); cursor <= finish; cursor.setDate(cursor.getDate() + 1)) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) count += 1;
    }
    return count;
  }

  private overlapsMonthRange(item: any, begin: string, end: string): boolean {
    const itemBegin = String(item.begin || '').slice(0, 10);
    const itemEnd = String(item.end || '').slice(0, 10);
    if (!itemBegin || !itemEnd) return false;
    return itemBegin <= end && itemEnd >= begin;
  }

  private async inferStoryProjectId(story: any): Promise<number | null> {
    const executionEntries = Object.values(story?.executions || {}) as any[];
    if (executionEntries.length === 0) return null;

    const latestExecution = executionEntries
      .map((item) => Number(item?.project || item?.id || 0))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => b - a)[0];

    if (!latestExecution) return null;

    const execution = await this.getExecution(latestExecution);
    const projectId = Number(execution?.project || execution?.parent || 0);
    return projectId > 0 ? projectId : null;
  }

  async ensureMonthlyExecutionForStory(options: {
    storyId: string | number;
    projectId?: number;
    templateExecId?: number;
    executionName?: string;
    anchorDate?: string;
  }): Promise<{
    executionId: number;
    executionName: string;
    projectId: number;
    created: boolean;
    templateExecutionName?: string;
  }> {
    const story = await this.getStory(options.storyId);
    const projectId = options.projectId || await this.inferStoryProjectId(story);
    if (!projectId) {
      throw new Error('Unable to infer project from story. Please provide --projectId explicitly.');
    }

    const project = await this.getProject(projectId);
    const executions = await this.getProjectExecutions(projectId);
    const { begin, end } = this.getMonthWindow(options.anchorDate);

    const existingExecution = executions.find((item: any) => {
      const status = String(item.status || '').trim().toLowerCase();
      return status !== 'closed' && status !== 'cancel' && this.overlapsMonthRange(item, begin, end);
    });

    if (existingExecution) {
      return {
        executionId: Number(existingExecution.id),
        executionName: String(existingExecution.name || ''),
        projectId,
        created: false,
      };
    }

    const templateExecution = options.templateExecId
      ? await this.getExecution(options.templateExecId)
      : executions.find((item: any) => String(item.status || '').trim().toLowerCase() !== 'cancel');

    if (!templateExecution?.name) {
      throw new Error('No template execution found for this project. Please provide --templateExecId or create an execution manually first.');
    }

    const monthStart = new Date(`${begin}T00:00:00`);
    const defaultExecutionName = `${project.name}_${monthStart.getFullYear()}年${String(monthStart.getMonth() + 1).padStart(2, '0')}月`;
    const createdExecution = await this.createExecution(projectId, {
      name: options.executionName || defaultExecutionName,
      begin,
      end,
      days: this.countWorkdays(begin, end),
      team: String(templateExecution.name || ''),
      acl: templateExecution.acl || undefined,
      whitelist: Array.isArray(templateExecution.whitelist) ? templateExecution.whitelist : undefined,
    });

    return {
      executionId: Number(createdExecution.id),
      executionName: String(createdExecution.name || options.executionName || defaultExecutionName),
      projectId,
      created: true,
      templateExecutionName: String(templateExecution.name || ''),
    };
  }

  /**
   * Fetch user's assigned items.
   * @param keepMeta When true, retains time-sensitive fields (deadline, lastEditedDate, etc.) needed for metric analysis.
   */
  async getMyDashboard(type: 'task' | 'story' | 'bug', assignee?: string, status?: string, keepMeta?: boolean): Promise<any[]> {
    const isFetchingOther = assignee && assignee !== '';
    if (isFetchingOther && assignee) {
      return this.fetchUserScopeItems(type, assignee, 'assignedTo', status, keepMeta, true);
    }

    const typeLabel = this.getDashboardTypeLabel(type);
    const url = `/my-${typeLabel}-assignedTo-0-id_desc-0-100-1.json`;

    const res = await this.mvc.get(url);

    const parsedData = this.extractMvcPayload(res.data);

    if (parsedData) {
      let items = this.extractDashboardItems(type, parsedData);

      items = items.filter((item: any) => {
        if (item.status === 'cancel') return false;
        if (status && item.status !== status) return false;
        return true;
      });

      return this.formatDashboardItems(type, items, keepMeta);
    }

    return [];
  }

  /**
   * 派发前负荷雷达 (Workload Radar)
   * 拉取指定用户进行中/待开始任务，汇总并发单量与预估剩余工时，供派单者参考（不强制阻断）。
   */
  async getMemberLoad(assignees: string[]): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    const dashboard = await this.getManagedDashboard(assignees, ['task', 'bug'], {
      statuses: ['doing', 'wait'],
    });

    dashboard.users.forEach((user) => {
      const taskItems = user.tasks.map((item: any) => ({ ...item, itemType: 'task' }));
      const bugItems = user.bugs.map((item: any) => ({ ...item, itemType: 'bug' }));
      const activeItems = [
        ...taskItems,
        ...bugItems,
      ];
      const totalLeft = activeItems.reduce((sum: number, i: any) => {
        const left = parseFloat(i.left) || 0;
        return sum + left;
      }, 0);
      const urgentPriorityCount = taskItems.filter((item: any) => String(item.pri || '') === '1').length;
      const taskProgressValues = taskItems
        .map((item: any) => Number(item.progress))
        .filter((value: number) => Number.isFinite(value));
      const taskAverageProgress = taskProgressValues.length > 0
        ? parseFloat((taskProgressValues.reduce((sum, value) => sum + value, 0) / taskProgressValues.length).toFixed(1))
        : 0;

      result[user.account] = {
        activeTaskCount: activeItems.length,
        urgentPriorityCount,
        totalLeftHours: parseFloat(totalLeft.toFixed(1)),
        taskAverageProgress,
        items: activeItems.map((i: any) => ({
          type: i.itemType,
          id: i.id,
          name: i.name || i.title,
          status: i.status,
          estimate: i.estimate, left: i.left, deadline: i.deadline,
          pri: i.pri,
          progress: i.itemType === 'task' && Number.isFinite(Number(i.progress)) ? Number(i.progress) : '',
        })),
      };
    });

    return result;
  }

  /**
   * 静默单据排查 (Stagnant Tasks Radar)
   * 扫描指定用户名单中，超过 days 天未发生任何更新且仍在处理中的单据，以便干系人跟进。
   */
  async getStagnantTasks(assignees: string[], days: number = 3): Promise<any[]> {
    const thresholdMs = days * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const stagnant: any[] = [];

    const dashboard = await this.getManagedDashboard(assignees, ['task'], {
      statuses: ['doing'],
    });

    dashboard.users.forEach((user) => {
      user.tasks.forEach((item: any) => {
        const lastEdit = item.lastEditedDate || item.assignedDate || item.openedDate;
        if (!lastEdit) return;
        const elapsed = now - new Date(lastEdit).getTime();
        if (elapsed > thresholdMs) {
          stagnant.push({
            type: 'task',
            assignee: user.account,
            id: item.id,
            name: item.name,
            status: item.status,
            pri: item.pri,
            lastUpdated: lastEdit,
            stagnantDays: Math.floor(elapsed / (1000 * 60 * 60 * 24)),
          });
        }
      });
    });

    return stagnant.sort((a, b) => b.stagnantDays - a.stagnantDays);
  }

  /**
   * 晨会综合作战沙盘 (Morning Standup Radar)
   * 按多个用户聚合数据，输出：已超期、今明到期、高优事项 三类预警清单，供大模型直接生成晨会通报。
   * 无截止日期的需求不纳入晨会预警，避免把弱时效事项误报为晨会风险。
   */
  async getMorningCheck(
    assignees: string[],
    priorityThreshold: number = 2
  ): Promise<{ overdue: any[]; dueSoon: any[]; highPriority: any[] }> {
    const today = this.getCurrentDateString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${(tomorrow.getMonth() + 1).toString().padStart(2, '0')}-${tomorrow.getDate().toString().padStart(2, '0')}`;

    const overdue: any[] = [];
    const dueSoon: any[] = [];
    const highPriority: any[] = [];

    const dashboard = await this.getManagedDashboard(assignees, ['task', 'story', 'bug'], {
      statuses: ['doing', 'wait'],
    });

    dashboard.users.forEach((user) => {
      const items = [
        ...user.tasks.map((item: any) => ({ ...item, itemType: 'task', label: item.name })),
        ...user.stories.map((item: any) => ({ ...item, itemType: 'story', label: item.title || item.name })),
        ...user.bugs.map((item: any) => ({ ...item, itemType: 'bug', label: item.title || item.name })),
      ];
      items.forEach((item: any) => {
        if (item.itemType === 'story' && !item.deadline) {
          return;
        }

        const base = {
          type: item.itemType,
          assignee: user.account,
          id: item.id,
          name: item.label,
          status: item.status,
          pri: item.pri,
          deadline: item.deadline,
          progress: Number.isFinite(Number(item.progress)) ? Number(item.progress) : '',
        };
        if (item.deadline) {
          if (item.deadline < today) {
            overdue.push({ ...base, overdueDays: Math.floor((Date.now() - new Date(item.deadline).getTime()) / 86400000) });
          } else if (item.deadline <= tomorrowStr) {
            dueSoon.push(base);
          }
        }
        if (item.pri && Number(item.pri) <= priorityThreshold) {
          highPriority.push(base);
        }
      });
    });

    return { overdue, dueSoon, highPriority };
  }

  async getWeeklySynthesis(
    assignees: string[],
    options: WeeklySynthesisOptions
  ): Promise<{
    tasks: any[];
    highPriorityTasks: any[];
    stories: any[];
    bugs: any[];
    dueThisWeekOpenTasks: any[];
    memberSummary: Array<{
      account: string;
      realname: string;
      taskCount: number;
      highPriorityTaskCount: number;
      storyCount: number;
      bugCount: number;
      dueThisWeekOpenTaskCount: number;
    }>;
    totals: {
      tasks: number;
      highPriorityTasks: number;
      stories: number;
      bugs: number;
      dueThisWeekOpenTasks: number;
    };
  }> {
    const priMax = Number.isFinite(Number(options.priMax)) ? Number(options.priMax) : 1;
    const severityMax = Number.isFinite(Number(options.severityMax)) ? Number(options.severityMax) : priMax;
    const [completedDashboard, openTaskDashboard] = await Promise.all([
      this.getManagedDashboard(assignees, ['task', 'story', 'bug'], {
        statuses: ['done'],
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
      }),
      this.getManagedDashboard(assignees, ['task'], {
        statuses: ['doing', 'wait'],
        deadlineFrom: options.dateFrom,
        deadlineTo: options.deadlineTo,
      }),
    ]);

    const tasks: any[] = [];
    const highPriorityTasks: any[] = [];
    const stories: any[] = [];
    const bugs: any[] = [];
    const dueThisWeekOpenTasks: any[] = [];
    const memberSummary: Array<{
      account: string;
      realname: string;
      taskCount: number;
      highPriorityTaskCount: number;
      storyCount: number;
      bugCount: number;
      dueThisWeekOpenTaskCount: number;
    }> = [];
    const openTaskMap = new Map<string, any[]>();

    openTaskDashboard.users.forEach((user) => {
      const openItems = user.tasks
        .filter((item: any) => Boolean(item.deadline))
        .map((item: any) => ({
          account: user.account,
          realname: user.realname,
          id: item.id,
          name: item.name,
          pri: item.pri,
          status: item.status,
          progress: item.progress,
          deadline: item.deadline,
          executionName: item.executionName,
        }));
      openTaskMap.set(user.account, openItems);
      dueThisWeekOpenTasks.push(...openItems);
    });

    completedDashboard.users.forEach((user) => {
      const completedTasks = user.tasks.map((item: any) => ({
        account: user.account,
        realname: user.realname,
        id: item.id,
        name: item.name,
        pri: item.pri,
        status: item.status,
        consumed: item.consumed,
        finishedDate: item.finishedDate,
        closedDate: item.closedDate,
        deadline: item.deadline,
        executionName: item.executionName,
      }));
      const selectedHighPriorityTasks = completedTasks.filter((item: any) => {
        const pri = Number(item.pri);
        return Number.isFinite(pri) && pri <= priMax;
      });

      const selectedStories = user.stories
        .filter((item: any) => {
          const pri = Number(item.pri);
          return Number.isFinite(pri) && pri <= priMax;
        })
        .map((item: any) => ({
          account: user.account,
          realname: user.realname,
          id: item.id,
          name: item.title || item.name,
          pri: item.pri,
          stage: item.stage,
          closedDate: item.closedDate,
          executionName: item.executionName,
          status: item.status,
        }));

      const selectedBugs = user.bugs
        .filter((item: any) => {
          const pri = Number(item.pri);
          const severity = Number(item.severity);
          const priMatched = Number.isFinite(pri) && pri <= priMax;
          const severityMatched = Number.isFinite(severity) && severity <= severityMax;
          return priMatched || severityMatched;
        })
        .map((item: any) => ({
          account: user.account,
          realname: user.realname,
          id: item.id,
          name: item.title || item.name,
          pri: item.pri,
          severity: item.severity,
          status: item.status,
          resolvedDate: item.resolvedDate,
          closedDate: item.closedDate,
          assignedTo: item.assignedTo,
        }));

      tasks.push(...completedTasks);
      highPriorityTasks.push(...selectedHighPriorityTasks);
      stories.push(...selectedStories);
      bugs.push(...selectedBugs);
      const dueThisWeekOpenItems = openTaskMap.get(user.account) || [];
      memberSummary.push({
        account: user.account,
        realname: user.realname,
        taskCount: completedTasks.length,
        highPriorityTaskCount: selectedHighPriorityTasks.length,
        storyCount: selectedStories.length,
        bugCount: selectedBugs.length,
        dueThisWeekOpenTaskCount: dueThisWeekOpenItems.length,
      });
    });

    tasks.sort((a, b) => String(b.finishedDate || b.closedDate || '').localeCompare(String(a.finishedDate || a.closedDate || '')) || Number(b.id) - Number(a.id));
    highPriorityTasks.sort((a, b) => Number(a.pri) - Number(b.pri) || (Number(b.consumed) || 0) - (Number(a.consumed) || 0) || Number(b.id) - Number(a.id));
    stories.sort((a, b) => String(b.closedDate || '').localeCompare(String(a.closedDate || '')) || Number(b.id) - Number(a.id));
    bugs.sort((a, b) => String(b.resolvedDate || b.closedDate || '').localeCompare(String(a.resolvedDate || a.closedDate || '')) || Number(b.id) - Number(a.id));
    dueThisWeekOpenTasks.sort((a, b) => String(a.deadline || '').localeCompare(String(b.deadline || '')) || Number(a.pri) - Number(b.pri) || Number(a.id) - Number(b.id));
    memberSummary.sort((a, b) => (b.taskCount + b.storyCount + b.bugCount) - (a.taskCount + a.storyCount + a.bugCount) || a.account.localeCompare(b.account));

    return {
      tasks,
      highPriorityTasks,
      stories,
      bugs,
      dueThisWeekOpenTasks,
      memberSummary,
      totals: {
        tasks: tasks.length,
        highPriorityTasks: highPriorityTasks.length,
        stories: stories.length,
        bugs: bugs.length,
        dueThisWeekOpenTasks: dueThisWeekOpenTasks.length,
      },
    };
  }

  async findTasksByName(
    keyword: string,
    assignees: string[],
    options: TaskLookupOptions = {}
  ): Promise<any[]> {
    const normalizedKeyword = String(keyword || '').trim().toLowerCase();
    if (!normalizedKeyword) return [];

    const statuses = options.statuses && options.statuses.length > 0
      ? options.statuses
      : ['doing', 'wait', 'done'];

    const dashboard = await this.getManagedDashboard(assignees, ['task'], {
      statuses,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
    });

    const matches: any[] = [];
    dashboard.users.forEach((user) => {
      user.tasks.forEach((item: any) => {
        const taskName = String(item.name || '').trim();
        if (!taskName) return;
        if (!taskName.toLowerCase().includes(normalizedKeyword)) return;

        matches.push({
          account: user.account,
          realname: user.realname,
          id: item.id,
          name: taskName,
          status: item.status,
          pri: item.pri,
          deadline: item.deadline,
          finishedDate: item.finishedDate,
          closedDate: item.closedDate,
          executionName: item.executionName,
          webUrl: item.webUrl || `${this.baseURL}/task-view-${item.id}.html`,
        });
      });
    });

    return matches.sort((a, b) => {
      const aExact = a.name.toLowerCase() === normalizedKeyword ? 1 : 0;
      const bExact = b.name.toLowerCase() === normalizedKeyword ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      if (a.name.length !== b.name.length) return a.name.length - b.name.length;
      return Number(b.id) - Number(a.id);
    });
  }

  async createTask(executionId: string | number, payload: any): Promise<any> {
    if (!payload.estStarted) {
      payload.estStarted = this.getCurrentDateString();
    }
    const res = await this.rest.post(`/api.php/v1/executions/${executionId}/tasks`, payload);
    return res.data;
  }

  async addEstimate(taskId: string | number, payload: any): Promise<any> {
    if (!payload.date) {
      payload.date = this.getCurrentDateString();
    }

    try {
      const restPayload = {
        date: payload.date,
        consumed: payload.consumed,
        left: payload.left,
        work: `【Agent】${payload.work}`
      };
      const res = await this.rest.post(`/api.php/v1/tasks/${taskId}/estimate`, restPayload);
      return res.data;
    } catch (error: any) {
      console.error(`[REST] addEstimate failed for task ${taskId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async updateTask(taskId: string | number, payload: any): Promise<any> {
    let lastRes = null;

    // Route to specific ZenTao workflow nodes based on the requested 'status' or 'assignedTo'
    if (payload.status === 'done') {
      const finishPayload: any = {
        consumed: payload.consumed || 1, // 'consumed' is mandatory for ZenTao finishing node
        currentConsumed: payload.consumed || 1,
        realStarted: payload.realStarted || this.getCurrentDateString(), // To satisfy "实际开始不能为空" if not started
        finishedDate: payload.finishedDate || this.getCurrentDateString(), // To satisfy "实际完成(finishedDate)不能为空"
        left: 0,
        comment: payload.comment || ''
      };
      if (payload.assignedTo) finishPayload.assignedTo = payload.assignedTo;

      const res = await this.rest.post(`/api.php/v1/tasks/${taskId}/finish`, finishPayload);
      lastRes = res.data;
    } else if (payload.status === 'closed') {
      const closePayload = {
        closedReason: 'done', // default to done if trying to close directly
        comment: payload.comment || ''
      };
      const res = await this.rest.post(`/api.php/v1/tasks/${taskId}/close`, closePayload);
      lastRes = res.data;
    } else if (payload.status === 'doing') {
      const startPayload = {
        consumed: payload.consumed || 0,
        comment: payload.comment || ''
      };
      const res = await this.rest.post(`/api.php/v1/tasks/${taskId}/start`, startPayload);
      lastRes = res.data;
    } else if (payload.assignedTo) {
      const assignPayload = {
        assignedTo: payload.assignedTo,
        comment: payload.comment || ''
      };
      const res = await this.rest.post(`/api.php/v1/tasks/${taskId}/assignto`, assignPayload);
      lastRes = res.data;
    } else if (payload.comment || payload.consumed !== undefined) {
      // If only comment or consumed is provided without status/assign change, use MVC addEstimate
      const res = await this.addEstimate(taskId, {
        consumed: payload.consumed !== undefined ? payload.consumed : 0,
        left: payload.left !== undefined ? payload.left : '', // Setting left to empty protects original left value if not provided
        work: payload.comment || ''
      });
      lastRes = res;
    } else {
      // Fallback to basic generic PUT for property updates (e.g. name, pri)
      const res = await this.rest.put(`/api.php/v1/tasks/${taskId}`, payload);
      lastRes = res.data;
    }

    return lastRes;
  }

  async updateStory(storyId: string | number, payload: any): Promise<any> {
    let lastRes = null;
    const normalizedStatus = String(payload.status || '').trim().toLowerCase();

    if (normalizedStatus === 'done' || normalizedStatus === 'closed') {
      const closePayload: any = {
        closedReason: payload.closedReason || 'done',
      };
      if (payload.comment) closePayload.comment = payload.comment;
      const res = await this.rest.post(`/api.php/v1/stories/${storyId}/close`, closePayload);
      lastRes = res.data;
    } else if (normalizedStatus === 'doing' || normalizedStatus === 'active') {
      const activatePayload: any = {};
      if (payload.comment) activatePayload.comment = payload.comment;
      const res = await this.rest.post(`/api.php/v1/stories/${storyId}/activate`, activatePayload);
      lastRes = res.data;

      if (payload.assignedTo) {
        const assignPayload: any = {
          assignedTo: payload.assignedTo,
        };
        if (payload.comment) assignPayload.comment = payload.comment;
        const assignRes = await this.rest.post(`/api.php/v1/stories/${storyId}/assign`, assignPayload);
        lastRes = assignRes.data;
      }
    } else if (payload.assignedTo) {
      const assignPayload: any = {
        assignedTo: payload.assignedTo,
      };
      if (payload.comment) assignPayload.comment = payload.comment;
      const res = await this.rest.post(`/api.php/v1/stories/${storyId}/assign`, assignPayload);
      lastRes = res.data;
    } else {
      const res = await this.rest.put(`/api.php/v1/stories/${storyId}`, payload);
      lastRes = res.data;
    }

    return lastRes;
  }

  async updateBug(bugId: string | number, payload: any): Promise<any> {
    let lastRes = null;
    const normalizedStatus = String(payload.status || '').trim().toLowerCase();

    if (normalizedStatus === 'done' || normalizedStatus === 'resolved') {
      const resolvePayload: any = {
        resolution: payload.resolution || 'fixed',
        resolvedDate: payload.resolvedDate || this.getCurrentDateString(),
      };
      if (payload.assignedTo) resolvePayload.assignedTo = payload.assignedTo;
      if (payload.comment) resolvePayload.comment = payload.comment;
      const res = await this.rest.post(`/api.php/v1/bugs/${bugId}/resolve`, resolvePayload);
      lastRes = res.data;
    } else if (normalizedStatus === 'closed') {
      const closePayload: any = {};
      if (payload.comment) closePayload.comment = payload.comment;
      const res = await this.rest.post(`/api.php/v1/bugs/${bugId}/close`, closePayload);
      lastRes = res.data;
    } else if (normalizedStatus === 'doing' || normalizedStatus === 'wait' || normalizedStatus === 'active') {
      const activatePayload: any = {};
      if (payload.assignedTo) activatePayload.assignedTo = payload.assignedTo;
      if (payload.comment) activatePayload.comment = payload.comment;
      const res = await this.rest.post(`/api.php/v1/bugs/${bugId}/activate`, activatePayload);
      lastRes = res.data;
    } else if (payload.assignedTo) {
      const assignPayload: any = {
        assignedTo: payload.assignedTo,
      };
      if (payload.comment) assignPayload.comment = payload.comment;
      const res = await this.rest.post(`/api.php/v1/bugs/${bugId}/assign`, assignPayload);
      lastRes = res.data;
    } else {
      const res = await this.rest.put(`/api.php/v1/bugs/${bugId}`, payload);
      lastRes = res.data;
    }

    return lastRes;
  }

  async resolveUrlAndFetch(text: string): Promise<any> {
    if (!text) throw new Error('Input text is empty');

    // Regex to match typical zentao MVC urls or paths: task-view-69608.html, bug-view-12.html, story-view-55.html
    const pattern = /(task|bug|story)-view-(\d+)/;
    const match = text.match(pattern);

    if (!match) {
      throw new Error('No valid ZendTao item link found in the provided text.');
    }

    const type = match[1]; // task, bug, or story
    const id = match[2];

    const apiUrl = `/api.php/v1/${type === 'story' ? 'stories' : type + 's'}/${id}`;

    try {
      const res = await this.rest.get(apiUrl);
      if (!res.data) throw new Error(`Failed to fetch ${type} #${id}`);

      const item = res.data;

      // Pluck essential fields for Context Window economy
      return {
        id: item.id,
        type: type,
        name: item.name || item.title,
        status: item.status,
        pri: item.pri,
        assignedTo: item.assignedTo,
        openedBy: item.openedBy,
        estimate: item.estimate,
        consumed: item.consumed,
        deadline: item.deadline,
        desc: item.desc ? item.desc.substring(0, 300) + '...' : '',
        webUrl: `${this.baseURL}/${type}-view-${id}.html`
      };

    } catch (e: any) {
      throw new Error(`Error resolving ${type} #${id}: ` + (e.response?.data?.error || e.message));
    }
  }

  private getCurrentDateString(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; // YYYY-MM-DD
  }

  private getCurrentDateTimeString(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
}
