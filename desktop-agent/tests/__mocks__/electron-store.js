// Minimal in-memory electron-store mock for Jest.
class Store {
  constructor({ defaults = {} } = {}) {
    this._data = JSON.parse(JSON.stringify(defaults));
  }
  get(key, fallback) {
    const parts = key.split('.');
    let v = this._data;
    for (const p of parts) { if (v == null) return fallback; v = v[p]; }
    return v !== undefined ? v : fallback;
  }
  set(key, value) {
    const parts = key.split('.');
    let obj = this._data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] == null) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
  }
  delete(key) { this.set(key, undefined); }
}
module.exports = Store;
