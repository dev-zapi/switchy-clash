import { mount } from 'svelte';
import '../app.css';
import App from './App.svelte';
import { initTheme, initFont } from '$lib/utils';

initTheme();
initFont();

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
