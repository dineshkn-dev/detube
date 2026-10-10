import { sendMessage } from '../background/messaging/protocol';
import { createIcon, type IconName } from '../content/ui/icons';
import { DAILY_SEARCH_LIMIT, DAILY_UNIT_LIMIT, type Status } from '../shared/types';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as unknown as T;
}

let status: Status;

function statusRow(icon: IconName, label: string, value: string, ok: boolean): HTMLElement {
  const row = document.createElement('div');
  row.className = 'srow';

  const name = document.createElement('span');
  name.className = 'srow__label';
  name.append(createIcon(icon, 14), document.createTextNode(label));

  const amount = document.createElement('span');
  amount.className = ok ? 'srow__value srow__value--ok' : 'srow__value';
  amount.textContent = value;

  row.append(name, amount);
  return row;
}

function render(): void {
  el<HTMLInputElement>('enabled').checked = status.enabled;

  const host = el('status-rows');
  host.replaceChildren(
    statusRow('key', 'API key', status.hasApiKey ? 'Set' : 'Not set', status.hasApiKey),
    statusRow(
      'user',
      'Subscriptions',
      status.subscriptionsConnected ? 'Connected' : 'Off',
      status.subscriptionsConnected,
    ),
  );

  const meter = document.createElement('div');
  meter.className = 'meter';
  const caption = document.createElement('div');
  caption.className = 'meter__caption';
  caption.textContent = `Today: ${status.quota.units} units · ${status.quota.searchCalls}/${DAILY_SEARCH_LIMIT} searches`;
  const bar = document.createElement('div');
  bar.className = 'meter__bar';
  const fill = document.createElement('div');
  fill.className = 'meter__fill';
  fill.style.setProperty('--v', String(Math.min(1, status.quota.units / DAILY_UNIT_LIMIT)));
  bar.append(fill);
  meter.append(caption, bar);
  host.append(meter);
}

async function refresh(): Promise<void> {
  status = await sendMessage({ type: 'GET_STATUS' });
  render();
}

function wire(): void {
  el('enabled').addEventListener('change', () => {
    void (async () => {
      await sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: { enabled: el<HTMLInputElement>('enabled').checked },
      });
      await refresh();
    })();
  });

  el('reshuffle').addEventListener('click', (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.classList.remove('is-spinning');
    void button.offsetWidth;
    button.classList.add('is-spinning');
    window.setTimeout(() => button.classList.remove('is-spinning'), 600);

    void (async () => {
      status = await sendMessage({ type: 'RESHUFFLE' });
      render();
    })();
  });

  el('open-youtube').addEventListener('click', () => {
    void chrome.tabs.create({ url: 'https://www.youtube.com/' });
  });

  el('open-options').addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
  });
}

void refresh()
  .then(wire)
  .catch((error) => {
    const host = document.getElementById('status-rows');
    if (host) host.textContent = `Settings unavailable — reload the extension. (${String(error)})`;
  });
