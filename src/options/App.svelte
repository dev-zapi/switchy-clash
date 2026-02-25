<script lang="ts">
	import { onMount } from 'svelte';
	import { ClashAPI } from '$lib/services/clash-api';
	import { storage } from '$lib/services/storage';
	import { ensureHostPermission, isLocalhostHost } from '$lib/services/permissions';
	import type { ExtensionConfig, ThemeMode } from '$lib/types';
	import { DEFAULT_BYPASS_LIST, DEFAULT_CONFIG } from '$lib/types';
	import { applyTheme, generateId, initTheme } from '$lib/utils';
	import StatusDot from '$lib/components/StatusDot.svelte';

	// Predefined emojis for configuration
	const EMOJIS = ['🏠', '🏢', '💻', '🖥️', '📱', '🌐', '⚡', '🔒', '🚀', '📡', '🌍', '🔧'];

	// State management using Svelte 5 runes
	let configs = $state<ExtensionConfig[]>([]);
	let themeMode = $state<ThemeMode>('system');
	let isLoading = $state(true);
	let editingConfig = $state<ExtensionConfig | null>(null);
	let isEditing = $state(false);
	let globalBypassList = $state<string[]>([...DEFAULT_BYPASS_LIST]);
	let testStatus = $state<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
	let isCheckingAll = $state(false);
	let formErrors = $state<Record<string, string>>({});

	// Derived states
	let defaultConfig = $derived(configs.find(c => c.isDefault));
	let hasConfigs = $derived(configs.length > 0);

	// Initialize on mount
	onMount(() => {
		loadData();
	});

	// Apply theme when it changes
	$effect(() => {
		applyTheme(themeMode);
	});

	async function loadData(): Promise<void> {
		try {
			isLoading = true;
			const [storedConfigs, storedTheme] = await Promise.all([
				storage.getConfigs(),
				storage.getThemeMode()
			]);
			configs = storedConfigs;
			themeMode = storedTheme;
			
			// Load global bypass list from first config or use default
			if (configs.length > 0 && configs[0].bypassList) {
				globalBypassList = [...configs[0].bypassList];
			}
		} catch (error) {
			console.error('Failed to load data:', error);
			showNotification('Failed to load settings', 'error');
		} finally {
			isLoading = false;
		}
	}

	function showNotification(message: string, type: 'success' | 'error' | 'info'): void {
		testStatus = { message, type };
		setTimeout(() => {
			testStatus = null;
		}, 3000);
	}

	function handleAddNew(): void {
		editingConfig = {
			...DEFAULT_CONFIG,
			id: generateId(),
			isDefault: configs.length === 0, // First config is default
			lastUsed: Date.now()
		};
		isEditing = true;
		formErrors = {};
		testStatus = null;
	}

	function handleEdit(config: ExtensionConfig): void {
		editingConfig = { ...config };
		isEditing = true;
		formErrors = {};
		testStatus = null;
	}

	function handleCancel(): void {
		editingConfig = null;
		isEditing = false;
		formErrors = {};
		testStatus = null;
	}

	function validateForm(config: ExtensionConfig): boolean {
		const errors: Record<string, string> = {};

		if (!config.name.trim()) {
			errors.name = 'Name is required';
		}

		if (!config.host.trim()) {
			errors.host = 'Host is required';
		}

		if (config.port < 1 || config.port > 65535) {
			errors.port = 'Port must be between 1 and 65535';
		}

		formErrors = errors;
		return Object.keys(errors).length === 0;
	}

	async function handleSave(): Promise<void> {
		if (!editingConfig) return;

		if (!validateForm(editingConfig)) {
			return;
		}

		// Request host permission for non-localhost hosts
		if (!isLocalhostHost(editingConfig.host)) {
			const granted = await ensureHostPermission(editingConfig.host);
			if (!granted) {
				showNotification(`Host permission denied for ${editingConfig.host}. The extension needs access to connect to this address.`, 'error');
				return;
			}
		}

		try {
			const isNew = !configs.find(c => c.id === editingConfig!.id);
			
			// If setting as default, unset other defaults
			if (editingConfig.isDefault) {
				configs = configs.map(c => ({
					...c,
					isDefault: c.id === editingConfig!.id
				}));
			}

			if (isNew) {
				configs = [...configs, editingConfig];
			} else {
				configs = configs.map(c => 
					c.id === editingConfig!.id ? editingConfig! : c
				);
			}

			await storage.setConfigs(configs);

			// Set as active config if it's the first config or marked as default
			if (isNew && (configs.length === 1 || editingConfig.isDefault)) {
				await storage.setActiveConfigId(editingConfig.id);
			}

			showNotification(isNew ? 'Configuration added' : 'Configuration updated', 'success');
			handleCancel();
		} catch (error) {
			console.error('Failed to save config:', error);
			showNotification('Failed to save configuration', 'error');
		}
	}

	async function handleDelete(configId: string): Promise<void> {
		const config = configs.find(c => c.id === configId);
		if (!config) return;

		const confirmed = confirm(`Are you sure you want to delete "${config.name}"?`);
		if (!confirmed) return;

		try {
			const wasDefault = config.isDefault;
			configs = configs.filter(c => c.id !== configId);

			// If we deleted the default and there are remaining configs, set the first as default
			if (wasDefault && configs.length > 0) {
				configs[0].isDefault = true;
			}

			await storage.setConfigs(configs);
			showNotification('Configuration deleted', 'success');
		} catch (error) {
			console.error('Failed to delete config:', error);
			showNotification('Failed to delete configuration', 'error');
		}
	}

	async function handleTestConnection(): Promise<void> {
		if (!editingConfig) return;

		// Request host permission for non-localhost hosts before testing
		if (!isLocalhostHost(editingConfig.host)) {
			const granted = await ensureHostPermission(editingConfig.host);
			if (!granted) {
				testStatus = { message: `Host permission denied for ${editingConfig.host}`, type: 'error' };
				return;
			}
		}

		testStatus = { message: 'Testing connection...', type: 'info' };

		try {
			const api = new ClashAPI(
				editingConfig.host,
				editingConfig.port,
				editingConfig.secret
			);
			
			const isHealthy = await api.healthCheck(3000);
			
			if (isHealthy) {
				testStatus = { message: 'Connection successful!', type: 'success' };
			} else {
				testStatus = { message: 'Connection failed', type: 'error' };
			}
		} catch (error) {
			testStatus = { 
				message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
				type: 'error' 
			};
		}
	}

	async function handleCheckAll(): Promise<void> {
		if (configs.length === 0) return;

		isCheckingAll = true;
		testStatus = { message: 'Checking all configurations...', type: 'info' };

		try {
			const updatedConfigs = await Promise.all(
				configs.map(async (config) => {
					try {
						const api = new ClashAPI(config.host, config.port, config.secret);
						const isAvailable = await api.healthCheck(3000);
						return {
							...config,
							status: isAvailable ? 'available' as const : 'unavailable' as const
						};
					} catch {
						return {
							...config,
							status: 'unavailable' as const
						};
					}
				})
			);

			configs = updatedConfigs;
			await storage.setConfigs(configs);
			
			const available = updatedConfigs.filter(c => c.status === 'available').length;
			testStatus = { 
				message: `Health check complete: ${available}/${updatedConfigs.length} available`, 
				type: available === updatedConfigs.length ? 'success' : 'info' 
			};
		} catch (error) {
			showNotification('Failed to check configurations', 'error');
		} finally {
			isCheckingAll = false;
		}
	}

	function handleExport(): void {
		if (configs.length === 0) {
			showNotification('No configurations to export', 'error');
			return;
		}

		const exportData = {
			version: 1,
			configs: configs.map(c => ({
				...c,
				status: 'unknown' // Reset status on export
			})),
			exportDate: new Date().toISOString()
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `switchy-clash-configs-${new Date().toISOString().split('T')[0]}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		showNotification('Configurations exported', 'success');
	}

	function handleImport(event: Event): void {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (e) => {
			try {
				const data = JSON.parse(e.target?.result as string);
				
				if (!data.configs || !Array.isArray(data.configs)) {
					throw new Error('Invalid config file format');
				}

				const importedConfigs: ExtensionConfig[] = data.configs.map((c: ExtensionConfig) => ({
					...c,
					id: generateId(), // Generate new IDs to avoid conflicts
					status: 'unknown'
				}));

				// Merge with existing or replace
				const shouldReplace = confirm(
					`Import ${importedConfigs.length} configurations?\n\nClick "OK" to replace all existing configs, or "Cancel" to append.`
				);

				if (shouldReplace) {
					configs = importedConfigs;
				} else {
					// Check for duplicate names and append
					const existingNames = new Set(configs.map(c => c.name));
					const uniqueConfigs = importedConfigs.filter(c => !existingNames.has(c.name));
					configs = [...configs, ...uniqueConfigs];
				}

				// Ensure at least one default
				if (!configs.some(c => c.isDefault) && configs.length > 0) {
					configs[0].isDefault = true;
				}

				await storage.setConfigs(configs);
				showNotification(`Imported ${importedConfigs.length} configurations`, 'success');
			} catch (error) {
				console.error('Import failed:', error);
				showNotification(
					`Import failed: ${error instanceof Error ? error.message : 'Invalid file'}`, 
					'error'
				);
			}
		};
		reader.readAsText(file);
		input.value = ''; // Reset input
	}

	async function handleThemeToggle(): Promise<void> {
		const modes: ThemeMode[] = ['light', 'dark', 'system'];
		const currentIndex = modes.indexOf(themeMode);
		const nextMode = modes[(currentIndex + 1) % modes.length];
		
		themeMode = nextMode;
		await storage.setThemeMode(nextMode);
		applyTheme(nextMode);
	}

	async function handleGlobalBypassChange(event: Event): Promise<void> {
		const textarea = event.target as HTMLTextAreaElement;
		const lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l);
		globalBypassList = lines;

		// Update all configs with new bypass list
		const updatedConfigs = configs.map(c => ({
			...c,
			bypassList: [...globalBypassList]
		}));
		
		configs = updatedConfigs;
		await storage.setConfigs(updatedConfigs);
	}

	function getThemeIcon(mode: ThemeMode): string {
		switch (mode) {
			case 'light': return '☀️';
			case 'dark': return '🌙';
			case 'system': return '💻';
		}
	}

	function getThemeLabel(mode: ThemeMode): string {
		switch (mode) {
			case 'light': return 'Light';
			case 'dark': return 'Dark';
			case 'system': return 'System';
		}
	}
</script>

<div class="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
	<div class="max-w-[800px] mx-auto px-6 py-8">
		<!-- Header -->
		<header class="flex items-center justify-between mb-8">
			<h1 class="text-2xl font-semibold text-[var(--color-text)]">
				Switchy Clash Settings
			</h1>
			<button
				onclick={handleThemeToggle}
				class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors border border-[var(--color-border)]"
				title="Toggle theme (current: {getThemeLabel(themeMode)})"
			>
				<span class="text-lg">{getThemeIcon(themeMode)}</span>
				<span class="text-sm font-medium">{getThemeLabel(themeMode)}</span>
			</button>
		</header>

		{#if isLoading}
			<div class="flex items-center justify-center py-12">
				<div class="animate-spin h-8 w-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full"></div>
			</div>
		{:else}
			<!-- Configurations Section -->
			<section class="mb-8">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-lg font-medium text-[var(--color-text)]">Configurations</h2>
					<button
						onclick={handleAddNew}
						class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Add New
					</button>
				</div>

				{#if !hasConfigs}
					<div class="text-center py-12 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] border-dashed">
						<div class="text-4xl mb-3">🔌</div>
						<p class="text-[var(--color-text-secondary)] mb-2">No configurations yet</p>
						<p class="text-sm text-[var(--color-text-muted)]">Add your first Clash API configuration to get started</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each configs as config (config.id)}
							<div class="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5 transition-all hover:border-[var(--color-primary)]/50">
								<div class="flex items-start justify-between">
									<div class="flex items-start gap-3">
										<span class="text-2xl" title="Configuration icon">{config.emoji}</span>
										<div>
											<div class="flex items-center gap-2">
												<h3 class="font-medium text-[var(--color-text)]">
													{config.name}
												</h3>
												{#if config.isDefault}
													<span class="px-2 py-0.5 text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full border border-[var(--color-primary)]/20">
														Default
													</span>
												{/if}
											</div>
											<p class="text-sm text-[var(--color-text-secondary)] mt-0.5">
												{config.host}:{config.port}
											</p>
											<div class="flex items-center gap-2 mt-2">
												<StatusDot status={config.status} />
												<span class="text-xs text-[var(--color-text-muted)] capitalize">
													{config.status === 'available' ? '🟢 Available' : config.status === 'unavailable' ? '🔴 Unavailable' : '⚪ Unknown'}
												</span>
											</div>
										</div>
									</div>
									<div class="flex items-center gap-2">
										<button
											onclick={() => handleEdit(config)}
											class="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors"
											title="Edit configuration"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
											</svg>
										</button>
										<button
											onclick={() => handleDelete(config.id)}
											class="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded-lg transition-colors"
											title="Delete configuration"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Action Buttons -->
					<div class="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-[var(--color-border)]">
						<button
							onclick={handleCheckAll}
							disabled={isCheckingAll}
							class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-text)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{#if isCheckingAll}
								<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							{/if}
							Check All
						</button>

						<button
							onclick={handleExport}
							class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-text)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-lg transition-colors"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
							</svg>
							Export
						</button>

						<label class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-text)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-lg transition-colors cursor-pointer">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
							</svg>
							Import
							<input
								type="file"
								accept=".json"
								onchange={handleImport}
								class="hidden"
							/>
						</label>
					</div>
				{/if}
			</section>

			<!-- Edit Configuration Section -->
			{#if isEditing && editingConfig}
				<section class="mb-8">
					<h2 class="text-lg font-medium text-[var(--color-text)] mb-4">
						{configs.find(c => c.id === editingConfig!.id) ? 'Edit Configuration' : 'Add Configuration'}
					</h2>
					
					<div class="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-6">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
							<!-- Name -->
							<div class="md:col-span-1">
								<label for="config-name" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
									Name <span class="text-[var(--color-danger)]">*</span>
								</label>
								<input
									id="config-name"
									type="text"
									bind:value={editingConfig.name}
									placeholder="e.g., Home Server"
									class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
								/>
								{#if formErrors.name}
									<p class="mt-1 text-xs text-[var(--color-danger)]">{formErrors.name}</p>
								{/if}
							</div>

							<!-- Emoji -->
							<div class="md:col-span-1">
								<span class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
									Emoji
								</span>
								<div class="flex flex-wrap gap-2">
									{#each EMOJIS as emoji}
										<button
											type="button"
											onclick={() => { if (editingConfig) editingConfig.emoji = emoji; }}
											class="w-10 h-10 text-xl rounded-lg border transition-all {editingConfig.emoji === emoji ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'}"
										>
											{emoji}
										</button>
									{/each}
								</div>
							</div>

							<!-- Host -->
							<div class="md:col-span-1">
								<label for="config-host" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
									Host <span class="text-[var(--color-danger)]">*</span>
								</label>
								<input
									id="config-host"
									type="text"
									bind:value={editingConfig.host}
									placeholder="127.0.0.1"
									class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
								/>
								{#if formErrors.host}
									<p class="mt-1 text-xs text-[var(--color-danger)]">{formErrors.host}</p>
								{/if}
							</div>

							<!-- Port -->
							<div class="md:col-span-1">
								<label for="config-port" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
									Port <span class="text-[var(--color-danger)]">*</span>
								</label>
								<input
									id="config-port"
									type="number"
									bind:value={editingConfig.port}
									min="1"
									max="65535"
									placeholder="9090"
									class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
								/>
								{#if formErrors.port}
									<p class="mt-1 text-xs text-[var(--color-danger)]">{formErrors.port}</p>
								{/if}
							</div>

							<!-- Secret -->
							<div class="md:col-span-2">
								<label for="config-secret" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
									Secret (optional)
								</label>
								<input
									id="config-secret"
									type="password"
									bind:value={editingConfig.secret}
									placeholder="API secret token"
									class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
								/>
							</div>

							<!-- Bypass List -->
							<div class="md:col-span-2">
								<label for="config-bypass" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
									Bypass List (one per line)
								</label>
								<textarea
									id="config-bypass"
									value={editingConfig.bypassList?.join('\n') ?? ''}
									oninput={(e) => {
										const lines = e.currentTarget.value.split('\n').map(l => l.trim()).filter(l => l);
										editingConfig!.bypassList = lines;
									}}
									rows="4"
									placeholder="localhost&#10;127.0.0.1&#10;*.local&#10;<local>"
									class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all resize-none font-mono text-sm"
								></textarea>
								<p class="mt-1 text-xs text-[var(--color-text-muted)]">
									Domains/IPs that bypass the proxy. Common patterns: localhost, 127.0.0.1, *.local, &lt;local&gt;
								</p>
							</div>

							<!-- Set as Default -->
							<div class="md:col-span-2">
								<label class="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										bind:checked={editingConfig.isDefault}
										class="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] bg-[var(--color-bg)]"
									/>
									<span class="text-sm text-[var(--color-text)]">Set as default configuration</span>
								</label>
							</div>
						</div>

						<!-- Test Status -->
						{#if testStatus}
							<div class="mb-4 p-3 rounded-lg text-sm {testStatus.type === 'success' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20' : testStatus.type === 'error' ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/20' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20'}">
								{testStatus.message}
							</div>
						{/if}

						<!-- Action Buttons -->
						<div class="flex flex-wrap items-center gap-3">
							<button
								onclick={handleTestConnection}
								class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-text)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-lg transition-colors"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
								</svg>
								Test Connection
							</button>

							<button
								onclick={handleSave}
								class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								Save
							</button>

							<button
								onclick={handleCancel}
								class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] rounded-lg transition-colors"
							>
								Cancel
							</button>
						</div>
					</div>
				</section>
			{/if}

			<!-- Global Bypass List Section -->
			<section class="mb-8">
				<h2 class="text-lg font-medium text-[var(--color-text)] mb-4">Proxy Bypass List (Global Default)</h2>
				<div class="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-6">
					<label for="global-bypass" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
						One per line:
					</label>
					<textarea
						id="global-bypass"
						value={globalBypassList.join('\n')}
						oninput={handleGlobalBypassChange}
						rows="6"
						class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all resize-none font-mono text-sm"
					></textarea>
					<p class="mt-2 text-xs text-[var(--color-text-muted)]">
						These patterns will be applied to all configurations. Changes are saved automatically.
					</p>
				</div>
			</section>
		{/if}
	</div>
</div>

<style>
	/* Custom styles for better UX */
	:global(input[type="number"]::-webkit-inner-spin-button,
	input[type="number"]::-webkit-outer-spin-button) {
		opacity: 1;
	}
</style>
