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
        if (u.realname && u.account) {
          mapping[u.realname] = u.account;
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

  async getMyDashboard(type: 'task' | 'story' | 'bug'): Promise<any[]> {
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
      
      // Filter out tasks based on user request:
      // - Hide 'cancel' tasks.
      // - Keep 'closed' tasks as they might be tasks the user assigned to others and have come back for verification.
      items = items.filter((item: any) => {
        if (item.status === 'cancel') return false;
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
    const res = await this.rest.put(`/api.php/v1/tasks/${taskId}`, payload);
    return res.data;
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
