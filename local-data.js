// Synchronous local-only adapter keeps the current form flows reliable while writing beside the app.
window.LocalDataStore = Object.freeze({
  active: window.location.protocol === 'http:'
    && ['127.0.0.1', 'localhost'].includes(window.location.hostname)
    && window.location.port === '4317',
  read() {
    if (!this.active) return { available: false, state: null };
    try {
      const request = new XMLHttpRequest();
      request.open('GET', '/api/state', false);
      request.send();
      if (request.status === 204) return { available: true, state: null };
      if (request.status !== 200) return { available: true, error: `本地文件服务读取失败（${request.status}）` };
      return { available: true, state: JSON.parse(request.responseText) };
    } catch {
      return { available: true, error: '无法连接项目目录的数据文件' };
    }
  },
  write(state) {
    if (!this.active) return { available: false, saved: false };
    try {
      const request = new XMLHttpRequest();
      request.open('PUT', '/api/state', false);
      request.setRequestHeader('Content-Type', 'application/json');
      request.send(JSON.stringify(state));
      return { available: true, saved: request.status === 200 };
    } catch {
      return { available: true, saved: false };
    }
  },
});
