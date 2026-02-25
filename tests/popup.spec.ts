import { test, expect, seedStorage } from './fixtures';

test.describe('Popup Page', () => {
  test('renders the popup page with header', async ({ context, extensionId, mockAPI }) => {
    const configId = 'test-render';
    await seedStorage(context, extensionId, {
      configs: [
        {
          id: configId,
          name: 'Local',
          emoji: '🏠',
          host: '127.0.0.1',
          port: mockAPI.port,
          secret: '',
          bypassList: ['localhost'],
          isDefault: true,
          lastUsed: Date.now(),
          status: 'available',
        },
      ],
      activeConfigId: configId,
      proxyEnabled: false,
      themeMode: 'light',
    });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // The app div should mount
    await expect(page.locator('#app')).toBeAttached();
    // Should show version info from mock API ("Clash v1.18.0")
    await expect(page.locator('text=/Clash/i')).toBeVisible({ timeout: 10000 });
    await page.close();
  });

  test('shows "no config" state when storage is empty', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // With no configs, should show settings prompt or empty state
    await expect(page.locator('#app')).toBeAttached();
    // Look for either "Settings" link or "no configuration" message
    const hasSettingsPrompt = await page.locator('text=/settings|configure|no config/i').count();
    expect(hasSettingsPrompt).toBeGreaterThan(0);
    await page.close();
  });

  test('displays config info when storage is seeded', async ({ context, extensionId, mockAPI }) => {
    const configId = 'test-config-1';
    const configId2 = 'test-config-2x';
    await seedStorage(context, extensionId, {
      configs: [
        {
          id: configId,
          name: 'Test Server',
          emoji: '🏠',
          host: '127.0.0.1',
          port: mockAPI.port,
          secret: '',
          bypassList: ['localhost', '127.0.0.1'],
          isDefault: true,
          lastUsed: Date.now(),
          status: 'available',
        },
        {
          id: configId2,
          name: 'Other Server',
          emoji: '🏢',
          host: '127.0.0.1',
          port: 19999,
          secret: '',
          bypassList: [],
          isDefault: false,
          lastUsed: 0,
          status: 'unknown',
        },
      ],
      activeConfigId: configId,
      proxyEnabled: false,
      themeMode: 'light',
    });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // With multiple configs, config selector in header should contain config names
    const configSelect = page.getByRole('banner').getByRole('combobox');
    await expect(configSelect).toBeVisible({ timeout: 10000 });
    await expect(configSelect).toContainText('Test Server');
    await page.close();
  });

  test('shows proxy groups when API is reachable', async ({ context, extensionId, mockAPI }) => {
    const configId = 'test-config-2';
    await seedStorage(context, extensionId, {
      configs: [
        {
          id: configId,
          name: 'Clash Local',
          emoji: '⚡',
          host: '127.0.0.1',
          port: mockAPI.port,
          secret: '',
          bypassList: ['localhost'],
          isDefault: true,
          lastUsed: Date.now(),
          status: 'available',
        },
      ],
      activeConfigId: configId,
      proxyEnabled: false,
      themeMode: 'light',
    });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // Should show proxy group heading from the mock API
    await expect(page.getByRole('heading', { name: 'Proxy Groups' })).toBeVisible({ timeout: 10000 });
    await page.close();
  });

  test('theme toggle changes appearance', async ({ context, extensionId }) => {
    await seedStorage(context, extensionId, { themeMode: 'dark' });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // In dark mode, <html> should have 'dark' class
    await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5000 });
    await page.close();
  });

  test('light theme does not have dark class', async ({ context, extensionId }) => {
    await seedStorage(context, extensionId, { themeMode: 'light' });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // Wait for app to mount
    await expect(page.locator('#app')).toBeAttached();
    // html should NOT have dark class
    await expect(page.locator('html')).not.toHaveClass(/dark/, { timeout: 5000 });
    await page.close();
  });
});
