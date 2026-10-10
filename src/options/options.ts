import { connectSubscriptions, disconnectSubscriptions } from '../auth/GoogleAuth';
import { DEFAULT_CATEGORIES, categoryEnabled } from '../background/feed/categories';
import { sendMessage } from '../background/messaging/protocol';
import { createIcon } from '../content/ui/icons';
import { DAILY_SEARCH_LIMIT, DAILY_UNIT_LIMIT, type Settings, type Status } from '../shared/types';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as unknown as T;
}

const SETTING_IDS = [
  'enabled',
  'density',
  'videos-per-section',
  'randomization',
  'freshness',
  'load-more',
  'region',
  'hide-shorts',
  'hide-livestreams',
  'hide-clickbait',
  'min-duration',
  'max-duration',
];

const TOAST_MS = 2600;

let settings: Settings;
let status: Status;
let customTopics: string[] = [];
let saveTimer: number | undefined;

function lines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function toast(message: string, kind: 'ok' | 'error' = 'ok'): void {
  const host = el('toasts');
  const node = document.createElement('div');
  node.className = `toast toast--${kind}`;
  node.append(createIcon(kind === 'ok' ? 'check' : 'close', 15));
  const text = document.createElement('span');
  text.textContent = message;
  node.append(text);
  host.append(node);

  window.setTimeout(() => {
    node.classList.add('is-leaving');
    window.setTimeout(() => node.remove(), 240);
  }, TOAST_MS);
}

/* ------------------------------------------------------------- status ----- */

function pill(label: string, tone: 'ok' | 'off'): HTMLElement {
  const node = document.createElement('span');
  node.className = `pill pill--${tone}`;
  const dot = document.createElement('span');
  dot.className = 'pill__dot';
  const text = document.createElement('span');
  text.textContent = label;
  node.append(dot, text);
  return node;
}

function meterRow(label: string, value: number, max: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'meter__row';

  const name = document.createElement('span');
  name.textContent = label;

  const amount = document.createElement('strong');
  amount.textContent = `${value} / ${max}`;

  const bar = document.createElement('div');
  bar.className = 'meter__bar';
  const fill = document.createElement('div');
  fill.className = 'meter__fill';
  fill.style.setProperty('--v', String(max > 0 ? Math.min(1, value / max) : 0));
  bar.append(fill);

  row.append(name, amount, bar);
  return row;
}

function renderStatus(): void {
  const pills = el('status-pills');
  pills.replaceChildren(
    pill(status.hasApiKey ? 'API key set' : 'No API key', status.hasApiKey ? 'ok' : 'off'),
    pill(
      status.subscriptionsConnected ? 'Subscriptions connected' : 'Subscriptions off',
      status.subscriptionsConnected ? 'ok' : 'off',
    ),
  );

  const meter = el('quota-meter');
  meter.replaceChildren(
    meterRow('Quota units used today', status.quota.units, DAILY_UNIT_LIMIT),
    meterRow('Search calls used today', status.quota.searchCalls, DAILY_SEARCH_LIMIT),
  );
}

async function refreshStatus(): Promise<void> {
  status = await sendMessage({ type: 'GET_STATUS' });
  renderStatus();
}

/* ------------------------------------------------------------ sections ---- */

function renderCategories(): void {
  const container = el('categories');
  container.replaceChildren();

  for (const category of DEFAULT_CATEGORIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toggle';
    button.dataset.categoryId = category.id;
    button.setAttribute('aria-pressed', String(categoryEnabled(category, settings)));

    const label = document.createElement('span');
    label.textContent = category.label;
    button.append(label);

    if (category.kind === 'search') {
      const hint = document.createElement('span');
      hint.className = 'toggle__hint';
      hint.textContent = 'topic search';
      button.append(hint);
    }

    button.addEventListener('click', () => {
      const next = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(next));
      scheduleSave();
    });

    container.append(button);
  }
}

function readCategories(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  const buttons = el('categories').querySelectorAll<HTMLButtonElement>('button[data-category-id]');
  for (const button of buttons) {
    const id = button.dataset.categoryId;
    if (id) result[id] = button.getAttribute('aria-pressed') === 'true';
  }
  return result;
}

function renderTopics(): void {
  const container = el('topics');
  container.replaceChildren();

  for (const topic of customTopics) {
    const chip = document.createElement('span');
    chip.className = 'chip';

    const text = document.createElement('span');
    text.textContent = topic;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${topic}`);
    remove.append(createIcon('close', 13));
    remove.addEventListener('click', () => {
      customTopics = customTopics.filter((entry) => entry !== topic);
      renderTopics();
      void save();
    });

    chip.append(text, remove);
    container.append(chip);
  }
}

/* --------------------------------------------------------------- form ----- */

function fillForm(): void {
  el<HTMLInputElement>('enabled').checked = settings.enabled;
  el<HTMLSelectElement>('density').value = settings.density;
  el<HTMLInputElement>('videos-per-section').value = String(settings.videosPerSection);
  el<HTMLInputElement>('randomization').value = String(settings.randomization);
  el<HTMLSelectElement>('freshness').value = settings.freshness;
  el<HTMLSelectElement>('load-more').value = settings.loadMore;
  el<HTMLInputElement>('region').value = settings.regionCode;
  el<HTMLInputElement>('hide-shorts').checked = settings.hideShorts;
  el<HTMLInputElement>('hide-livestreams').checked = settings.hideLivestreams;
  el<HTMLInputElement>('hide-clickbait').checked = settings.hideClickbait;
  el<HTMLInputElement>('min-duration').value = String(Math.round(settings.minDurationSec / 60));
  el<HTMLInputElement>('max-duration').value = String(Math.round(settings.maxDurationSec / 60));
  el<HTMLTextAreaElement>('include-channels').value = settings.includeChannels.join('\n');
  el<HTMLTextAreaElement>('exclude-channels').value = settings.excludeChannels.join('\n');
  customTopics = [...settings.customTopics];
  el('randomization-out').textContent = `${settings.randomization}%`;
}

function readForm(): Partial<Settings> {
  return {
    enabled: el<HTMLInputElement>('enabled').checked,
    density: el<HTMLSelectElement>('density').value as Settings['density'],
    videosPerSection: Number(el<HTMLInputElement>('videos-per-section').value),
    randomization: Number(el<HTMLInputElement>('randomization').value),
    freshness: el<HTMLSelectElement>('freshness').value as Settings['freshness'],
    loadMore: el<HTMLSelectElement>('load-more').value as Settings['loadMore'],
    regionCode: el<HTMLInputElement>('region').value.toUpperCase() || 'US',
    hideShorts: el<HTMLInputElement>('hide-shorts').checked,
    hideLivestreams: el<HTMLInputElement>('hide-livestreams').checked,
    hideClickbait: el<HTMLInputElement>('hide-clickbait').checked,
    minDurationSec: Math.round(Number(el<HTMLInputElement>('min-duration').value) * 60),
    maxDurationSec: Math.round(Number(el<HTMLInputElement>('max-duration').value) * 60),
    customTopics,
    includeChannels: lines(el<HTMLTextAreaElement>('include-channels').value),
    excludeChannels: lines(el<HTMLTextAreaElement>('exclude-channels').value),
    categories: readCategories(),
  };
}

function scheduleSave(): void {
  if (saveTimer !== undefined) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void save(), 350);
}

async function save(): Promise<void> {
  try {
    settings = await sendMessage({ type: 'UPDATE_SETTINGS', payload: readForm() });
    toast('Settings saved');
  } catch (error) {
    toast(`Could not save: ${(error as Error).message}`, 'error');
  }
}

/* -------------------------------------------------------------- wiring ---- */

function wire(): void {
  for (const id of SETTING_IDS) {
    el(id).addEventListener('change', () => scheduleSave());
  }

  el('randomization').addEventListener('input', () => {
    el('randomization-out').textContent = `${el<HTMLInputElement>('randomization').value}%`;
  });

  el('save-key').addEventListener('click', () => {
    void (async () => {
      const key = el<HTMLInputElement>('api-key').value.trim();
      if (!key) {
        toast('Enter a key first', 'error');
        return;
      }
      try {
        status = await sendMessage({ type: 'SET_API_KEY', payload: { apiKey: key } });
        el<HTMLInputElement>('api-key').value = '';
        renderStatus();
        toast('API key saved');
      } catch (error) {
        toast(`Could not save key: ${(error as Error).message}`, 'error');
      }
    })();
  });

  el('clear-key').addEventListener('click', () => {
    void (async () => {
      status = await sendMessage({ type: 'SET_API_KEY', payload: { apiKey: '' } });
      renderStatus();
      toast('API key cleared');
    })();
  });

  el('connect-subs').addEventListener('click', () => {
    void (async () => {
      try {
        await connectSubscriptions();
        await sendMessage({ type: 'UPDATE_SETTINGS', payload: { subscriptionsEnabled: true } });
        await refreshStatus();
        toast('Subscriptions connected');
      } catch (error) {
        toast((error as Error).message, 'error');
      }
    })();
  });

  el('disconnect-subs').addEventListener('click', () => {
    void (async () => {
      await disconnectSubscriptions().catch(() => undefined);
      await sendMessage({ type: 'UPDATE_SETTINGS', payload: { subscriptionsEnabled: false } });
      await refreshStatus();
      toast('Subscriptions disconnected');
    })();
  });

  el('reshuffle').addEventListener('click', () => {
    void (async () => {
      status = await sendMessage({ type: 'RESHUFFLE' });
      renderStatus();
      toast('Feed reshuffled');
    })();
  });

  el('add-topic').addEventListener('click', () => addTopic());

  el('topic-input').addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Enter') {
      event.preventDefault();
      addTopic();
    }
  });
}

function addTopic(): void {
  const input = el<HTMLInputElement>('topic-input');
  const value = input.value.trim();
  if (!value) return;
  if (!customTopics.some((topic) => topic.toLowerCase() === value.toLowerCase())) {
    customTopics.push(value);
  }
  input.value = '';
  renderTopics();
  scheduleSave();
}

async function init(): Promise<void> {
  [settings, status] = await Promise.all([
    sendMessage({ type: 'GET_SETTINGS' }),
    sendMessage({ type: 'GET_STATUS' }),
  ]);
  renderCategories();
  fillForm();
  renderTopics();
  renderStatus();
  wire();
}

void init();
