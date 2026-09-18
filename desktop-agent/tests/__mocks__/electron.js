// Minimal Electron mock for Jest (Node environment, no Electron runtime).
// Only the symbols actually used by src/lib files are mocked.

const net = {
  request: jest.fn()
};

module.exports = {
  net,
  app: { getPath: jest.fn(() => '/tmp') },
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  ipcRenderer: { invoke: jest.fn(), send: jest.fn() },
  contextBridge: { exposeInMainWorld: jest.fn() },
  shell: { openExternal: jest.fn() },
  clipboard: { writeText: jest.fn(), readText: jest.fn() }
};
