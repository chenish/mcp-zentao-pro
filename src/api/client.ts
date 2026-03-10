import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { URLSearchParams } from 'url';

export class ZentaoClient {
  private rest: AxiosInstance;
  private mvc: AxiosInstance;
  private baseURL: string;
  private _account: string = '';
  private _password: string = '';  // base64-encoded for safe in-memory storage only

  constructor(baseURL: string, token: string = '') {
    this.baseURL = baseURL;

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
        'Cookie': `zentaosid=${token}`,
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
      // Only intercept auth failures; avoid infinite retry loops
      if ((status === 401 || status === 403) && !error.config?._isRetry) {
        const creds = this._getCredentials();
        if (!creds) return Promise.reject(error);
        try {
          console.log('[Auth] Token expired, silently refreshing...');
          const loginRes = await axios.post(
            `${this.baseURL}/api.php/v1/tokens`,
            creds,
            { headers: { 'Content-Type': 'application/json' } }
          );
          if (loginRes.data?.token) {
            this.setToken(loginRes.data.token);
            // Mark the retry request to avoid infinite loop
            const retryConfig: AxiosRequestConfig & { _isRetry?: boolean } = {
              ...error.config,
              _isRetry: true,
              headers: {
                ...error.config.headers,
                'Token': loginRes.data.token,
                'Cookie': `zentaosid=${loginRes.data.token}`,
              },
            };
            return instance(retryConfig);
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

  setToken(token: string) {
    this.rest.defaults.headers['Token'] = token;
    // MVC API in ZenTao expects the token in the Cookie under 'zentaosid'
    this.mvc.defaults.headers['Cookie'] = `zentaosid=${token}`;
  }

  async login(account: string, password: string): Promise<string> {
    const res = await this.rest.post('/api.php/v1/tokens', { account, password });
    if (res.data && res.data.token) {
      this.setToken(res.data.token);
      return res.data.token;
    }
    throw new Error('Login failed, no token received');
  }

  async getUsersMapping(): Promise<Record<string, string>> {
    const res = await this.rest.get('/api.php/v1/users?limit=500');
    const mapping: Record<string, string> = {};
    if (res.data && Array.isArray(res.data.users)) {
      res.data.users.forEach((u: any) => {
        if (u.account) {
          mapping[u.account] = u.account;
          if (u.realname) {
            mapping[u.realname] = u.account;
          }
        }
      });
    }
    return mapping;
  }

  async getProjects(): Promise<any[]> {
    const res = await this.rest.get('/api.php/v1/projects?status=doing&limit=50');
    if (res.data && Array.isArray(res.data.projects)) {
      return res.data.projects;
    }
    return [];
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

  async createExecution(projectId: number, payload: {
    name: string;
    begin: string;
    end: string;
    days: number;
    team: string; // 成员拷贝
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

  /**
   * Fetch user's assigned items.
   * @param keepMeta When true, retains time-sensitive fields (deadline, lastEditedDate, etc.) needed for metric analysis.
   */
  async getMyDashboard(type: 'task' | 'story' | 'bug', assignee?: string, status?: string, keepMeta?: boolean): Promise<any[]> {
    const url = `/my-${type}-assignedTo-0-id_desc-0-100-1.json`;
    const res = await this.mvc.get(url);

    console.log(`[DEBUG MVC RAW] Response data type:`, typeof res.data);
    if (typeof res.data === 'string') {
      console.log(`[DEBUG MVC RAW] Response preview:`, res.data.substring(0, 100));
    } else {
      console.log(`[DEBUG MVC RAW] Response keys:`, Object.keys(res.data || {}));
      if (res.data?.data) {
        console.log(`[DEBUG MVC RAW] res.data.data type:`, typeof res.data.data);
        if (typeof res.data.data === 'string') console.log(`[DEBUG MVC RAW] res.data.data preview:`, res.data.data.substring(0, 100));
      }
    }

    // Sometimes ZenTao returns stringified JSON in the data property
    let parsedData = Array.isArray(res.data) ? res.data : null;

    if (!parsedData && res.data) {
      if (typeof res.data.data === 'string') {
        try {
          parsedData = JSON.parse(res.data.data);
        } catch (e) {
          console.error('Failed to parse MVC JSON response', e);
        }
      } else if (typeof res.data.data === 'object' && res.data.data !== null) {
        parsedData = res.data.data;
      } else if (typeof res.data === 'object') {
        parsedData = res.data;
      }
    }

    if (parsedData) {
      const key = type === 'story' ? 'stories' : type === 'bug' ? 'bugs' : 'tasks';
      let items = (parsedData as Record<string, any>)[key] || [];
      if (typeof items === 'object' && !Array.isArray(items)) {
        items = Object.values(items);
      }

      // Filter out tasks based on user request:
      // - Hide 'cancel' tasks.
      // - Keep 'closed' tasks as they might be tasks the user assigned to others and have come back for verification.
      items = items.filter((item: any) => {
        if (item.status === 'cancel') return false;
        if (status && item.status !== status) return false;
        if (assignee && item.assignedTo !== assignee && item.openedBy !== assignee) return false;
        return true;
      });

      // Clean up the data for LLM token usage and CLI readability
      return items.map((item: any) => {
        if (keepMeta) {
          // For metric operations, keep time-related fields but still strip noisy ones
          const { desc, openedDate, finishedBy, finishedDate, canceledBy, canceledDate,
            closedBy, closedDate, lastEditedBy, color, mailto, ...metaItem } = item;
          return metaItem;
        }
        const {
          desc, openedBy, openedDate, assignedDate, estStarted,
          realStarted, finishedBy, finishedDate, canceledBy, canceledDate,
          closedBy, closedDate, lastEditedBy, lastEditedDate, color, mailto,
          ...cleanItem
        } = item;
        return cleanItem;
      });
    }

    return [];
  }

  /**
   * 派发前负荷雷达 (Workload Radar)
   * 拉取指定用户进行中/待开始任务，汇总并发单量与预估剩余工时，供派单者参考（不强制阻断）。
   */
  async getMemberLoad(assignees: string[]): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    await Promise.all(assignees.map(async (assignee) => {
      const [tasks, bugs] = await Promise.all([
        this.getMyDashboard('task', assignee, undefined, true),
        this.getMyDashboard('bug', assignee, undefined, true),
      ]);
      const activeItems = [...tasks, ...bugs].filter(
        (i) => i.status === 'doing' || i.status === 'wait'
      );
      const totalLeft = activeItems.reduce((sum: number, i: any) => {
        const left = parseFloat(i.left) || 0;
        return sum + left;
      }, 0);
      result[assignee] = {
        activeTaskCount: activeItems.length,
        totalLeftHours: parseFloat(totalLeft.toFixed(1)),
        items: activeItems.map((i: any) => ({
          id: i.id, name: i.name, status: i.status,
          estimate: i.estimate, left: i.left, deadline: i.deadline,
          pri: i.pri,
        })),
      };
    }));
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

    await Promise.all(assignees.map(async (assignee) => {
      const tasks = await this.getMyDashboard('task', assignee, 'doing', true);
      tasks.forEach((item: any) => {
        const lastEdit = item.lastEditedDate || item.assignedDate || item.openedDate;
        if (!lastEdit) return;
        const elapsed = now - new Date(lastEdit).getTime();
        if (elapsed > thresholdMs) {
          stagnant.push({
            type: 'task',
            assignee,
            id: item.id,
            name: item.name,
            status: item.status,
            pri: item.pri,
            lastUpdated: lastEdit,
            stagnantDays: Math.floor(elapsed / (1000 * 60 * 60 * 24)),
          });
        }
      });
    }));

    return stagnant.sort((a, b) => b.stagnantDays - a.stagnantDays);
  }

  /**
   * 晨会综合作战沙盘 (Morning Standup Radar)
   * 按多个用户聚合数据，输出：已超期、今明到期、高优任务 三类预警清单，供大模型直接生成晨会通报。
   */
  async getMorningCheck(assignees: string[]): Promise<{ overdue: any[]; dueSoon: any[]; highPriority: any[] }> {
    const today = this.getCurrentDateString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${(tomorrow.getMonth() + 1).toString().padStart(2, '0')}-${tomorrow.getDate().toString().padStart(2, '0')}`;

    const overdue: any[] = [];
    const dueSoon: any[] = [];
    const highPriority: any[] = [];

    await Promise.all(assignees.map(async (assignee) => {
      const [tasks, bugs] = await Promise.all([
        this.getMyDashboard('task', assignee, undefined, true),
        this.getMyDashboard('bug', assignee, undefined, true),
      ]);
      const items = [...tasks, ...bugs].filter(
        (i) => i.status !== 'done' && i.status !== 'closed' && i.status !== 'cancel'
      );
      items.forEach((item: any) => {
        const base = { type: 'task', assignee, id: item.id, name: item.name, status: item.status, pri: item.pri, deadline: item.deadline };
        if (item.deadline) {
          if (item.deadline < today) {
            overdue.push({ ...base, overdueDays: Math.floor((Date.now() - new Date(item.deadline).getTime()) / 86400000) });
          } else if (item.deadline <= tomorrowStr) {
            dueSoon.push(base);
          }
        }
        if (item.pri && item.pri <= 2) {
          highPriority.push(base);
        }
      });
    }));

    return { overdue, dueSoon, highPriority };
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

    const url = `/task-recordEstimate-${taskId}.json`;

    // Simulate traditional web form submission with array index [1]
    const params = new URLSearchParams();
    params.append('id[1]', taskId.toString());
    params.append('dates[1]', payload.date);
    params.append('consumed[1]', payload.consumed.toString());
    params.append('left[1]', payload.left.toString());
    params.append('work[1]', `【Agent】${payload.work}`);

    try {
      const response = await this.mvc.post(url, params.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
          // mvc is already configured with zentaosid Cookie during login
        }
      });

      return response.data;
    } catch (error) {
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
        desc: item.desc ? item.desc.substring(0, 300) + '...' : ''
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
