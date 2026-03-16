import { mount } from 'svelte';
import '../app.css';
import App from './App.svelte';
import { initTheme, initFont } from '$lib/utils';

initTheme();
initFont();

document.body.style.margin = '0';
document.body.style.padding = '0';

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
