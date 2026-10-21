import 'katex/dist/katex.min.css';
import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { startSync } from './learning/sync';
import { python } from './python/runtime';
import './styles.css';

render(<App />, document.getElementById('app')!);

python.start();
startSync();
void navigator.storage?.persist?.().catch(() => false);

if (import.meta.env.PROD) {
  const updateSW = registerSW({
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent('robopy:update', { detail: () => void updateSW(true) }));
    },
  });
}
