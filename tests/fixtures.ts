import { type BrowserContext, chromium, test as base } from '@playwright/test';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================
// Mock Clash API Server
// ========================================

export interface MockClashAPI {
  port: number;
  url: string;
  server: Server;
  /** Override response for a specific endpoint */
  setResponse(method: string, path: string, body: unknown, status?: number): void;
  close(): Promise<void>;
}

interface RouteHandler {
  body: unknown;
  status: number;
}

export function createMockClashAPI(): Promise<MockClashAPI> {
  return new Promise((resolve) => {
    const routes = new Map<string, RouteHandler>();

    // Default responses
    routes.set('GET /version', { body: { version: 'v1.18.0', premium: true }, status: 200 });
    routes.set('GET /configs', {
      body: { port: 7890, 'socks-port': 7891, 'mixed-port': 7890, mode: 'rule', 'log-level': 'info' },
      status: 200,
    });
    routes.set('GET /proxies', {
      body: {
        proxies: {
          GLOBAL: { name: 'GLOBAL', type: 'Selector', now: 'Proxy', all: ['Proxy', 'DIRECT'] },
          Proxy: { name: 'Proxy', type: 'Selector', now: 'Node-1', all: ['Node-1', 'Node-2', 'Node-3'] },
          'Node-1': { name: 'Node-1', type: 'Shadowsocks', history: [{ delay: 120 }] },
          'Node-2': { name: 'Node-2', type: 'Vmess', history: [{ delay: 250 }] },
          'Node-3': { name: 'Node-3', type: 'Trojan', history: [{ delay: 0 }] },
          DIRECT: { name: 'DIRECT', type: 'Direct', history: [] },
          REJECT: { name: 'REJECT', type: 'Reject', history: [] },
        },
      },
      status: 200,
    });
    routes.set('GET /connections', { body: { downloadTotal: 0, uploadTotal: 0, connections: [] }, status: 200 });
    routes.set('GET /rules', { body: { rules: [] }, status: 200 });

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const key = `${req.method} ${req.url?.split('?')[0]}`;
      const handler = routes.get(key);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Methods', '*');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (handler) {
        res.writeHead(handler.status);
        res.end(JSON.stringify(handler.body));
      } else {
        // For PUT/PATCH requests like proxy switching, return success by default
        if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
          res.writeHead(200);
          res.end(JSON.stringify({ message: 'ok' }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ message: 'Not found' }));
        }
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        port,
        url: `http://127.0.0.1:${port}`,
        server,
        setResponse(method: string, path: string, body: unknown, status = 200) {
          routes.set(`${method} ${path}`, { body, status });
        },
        close() {
          return new Promise<void>((res) => server.close(() => res()));
        },
      });
    });
  });
}

// ========================================
// Extension Fixture
// ========================================

const EXTENSION_PATH = path.resolve(__dirname, '..', 'dist');

export interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  mockAPI: MockClashAPI;
}

export const test = base.extend<ExtensionFixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    if (!fs.existsSync(path.join(EXTENSION_PATH, 'manifest.json'))) {
      throw new Error('Extension not built. Run `npm run build` first.');
    }
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // Wait for the service worker to register
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId);
  },

  mockAPI: async ({}, use) => {
    const api = await createMockClashAPI();
    await use(api);
    await api.close();
  },
});

export { expect } from '@playwright/test';

// ========================================
// Helper: Seed chrome.storage.local
// ========================================

export async function seedStorage(
  context: BrowserContext,
  extensionId: string,
  data: Record<string, unknown>,
) {
  // Open a minimal extension page to run JS in extension context
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await page.evaluate((storageData) => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set(storageData, resolve);
    });
  }, data);
  await page.close();
}
