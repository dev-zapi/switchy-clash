import { test, expect, seedStorage } from './fixtures';

test.describe('Options Page', () => {
  test('renders the options page', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);

    await expect(page.locator('#app')).toBeAttached();
    // Options page should show the settings title
    await expect(page.locator('text=/Switchy Clash|Settings/i')).toBeVisible({ timeout: 5000 });
    await page.close();
  });

  test('shows add config button when no configs exist', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);

    // Should have an "Add" or "New" config button
    await expect(page.locator('text=/add|new|create/i').first()).toBeVisible({ timeout: 5000 });
    await page.close();
  });

  test('displays existing configs when seeded', async ({ context, extensionId, mockAPI }) => {
    await seedStorage(context, extensionId, {
      configs: [
        {
          id: 'cfg-1',
          name: 'Home Server',
          emoji: '🏠',
          host: '127.0.0.1',
          port: mockAPI.port,
          secret: '',
          bypassList: ['localhost'],
          isDefault: true,
          lastUsed: Date.now(),
          status: 'available',
        },
        {
          id: 'cfg-2',
          name: 'Office Server',
          emoji: '🏢',
          host: '192.168.1.100',
          port: 9090,
          secret: 'test-secret',
          bypassList: ['localhost'],
          isDefault: false,
          lastUsed: 0,
          status: 'unknown',
        },
      ],
      activeConfigId: 'cfg-1',
      proxyEnabled: false,
      themeMode: 'light',
    });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);

    await expect(page.locator('text=Home Server')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Office Server')).toBeVisible({ timeout: 5000 });
    await page.close();
  });

  test('can open add config form', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);

    // Click the add button
    const addButton = page.locator('text=/add|new|create/i').first();
    await addButton.click();

    // Form fields should appear (name, host, port)
    await expect(page.locator('input').first()).toBeVisible({ timeout: 5000 });
    await page.close();
  });

  test('theme selector works', async ({ context, extensionId }) => {
    await seedStorage(context, extensionId, { themeMode: 'dark' });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);

    // In dark mode, html should have 'dark' class
    await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5000 });
    await page.close();
  });

  test('shows config emoji and name', async ({ context, extensionId, mockAPI }) => {
    await seedStorage(context, extensionId, {
      configs: [
        {
          id: 'cfg-emoji',
          name: 'Rocket Server',
          emoji: '🚀',
          host: '127.0.0.1',
          port: mockAPI.port,
          secret: '',
          bypassList: [],
          isDefault: true,
          lastUsed: Date.now(),
          status: 'available',
        },
      ],
      activeConfigId: 'cfg-emoji',
      proxyEnabled: false,
      themeMode: 'light',
    });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);

    await expect(page.locator('text=🚀')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Rocket Server')).toBeVisible({ timeout: 5000 });
    await page.close();
  });
});
