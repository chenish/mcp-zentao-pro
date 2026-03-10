import axios, { AxiosInstance } from 'axios';
import { URLSearchParams } from 'url';

export class ZentaoClient {
  private rest: AxiosInstance;
  private mvc: AxiosInstance;

  constructor(baseURL: string, token: string = '') {
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

  async getActiveExecutions(): Promise<any[]> {
    const res = await this.rest.get('/api.php/v1/executions?status=doing&limit=10');
    if (res.data && Array.isArray(res.data.executions)) {
      return res.data.executions;
    }
    return [];
  }

  async getMyDashboard(type: 'task' | 'story' | 'bug', assignee?: string, status?: string): Promise<any[]> {
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
