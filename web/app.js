import { createGenerator, loadPack } from '/minglu-sdk.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const packStatus = $('pack-status');
function setPackStatus(text) { packStatus.textContent = text; }
function setStatus(element, text, error = false) {
  element.textContent = text;
  element.classList.toggle('error', error);
}
function resetOutputs() {
  for (const panel of document.querySelectorAll('[data-panel]')) {
    const status = panel.querySelector('.status');
    const results = panel.querySelector('.results');
    if (status) setStatus(status, '');
    if (results) results.innerHTML = '';
  }
}
function setBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (!button.dataset.idleLabel) button.dataset.idleLabel = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? '生成中…' : button.dataset.idleLabel;
  form.setAttribute('aria-busy', String(busy));
}
document.querySelectorAll('.status').forEach((element) => element.setAttribute('aria-live', 'polite'));

const surnameInput = $('surname');
function validateSurname() {
  const value = surnameInput.value.trim();
  const ok = value === '' || /^[\u4e00-\u9fa5]{1,6}$/.test(value);
  surnameInput.setCustomValidity(ok ? '' : '姓氏只允许 1–6 个汉字');
}
surnameInput.addEventListener('input', validateSurname);
validateSurname();

const EXCLUDE_KEY = 'minglu-exclude-words';
const excludeInput = $('exclude-person');
try { excludeInput.value = localStorage.getItem(EXCLUDE_KEY) || ''; } catch { /* ignore */ }
excludeInput.addEventListener('input', () => {
  try {
    if (excludeInput.value.trim()) localStorage.setItem(EXCLUDE_KEY, excludeInput.value);
    else localStorage.removeItem(EXCLUDE_KEY);
  } catch { /* ignore */ }
});
function excludedWords() {
  return excludeInput.value.split(/[,，、\s]+/).map((term) => term.trim()).filter(Boolean);
}
function containsExcluded(person, terms) {
  if (terms.length === 0) return false;
  const given = person.given.map((c) => c.text).join('');
  return terms.some((term) => given.includes(term) || person.fullName.includes(term));
}

const tabs = [...document.querySelectorAll('.tab')];
const panels = [...document.querySelectorAll('[data-panel]')];
function activateTab(name, focus = false) {
  const selected = tabs.find((tab) => tab.dataset.tab === name) ?? tabs[0];
  for (const tab of tabs) {
    const active = tab === selected;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  for (const panel of panels) panel.hidden = panel.dataset.panel !== selected.dataset.tab;
  if (focus) selected.focus();
}
tabs.forEach((tab, index) => {
  const name = tab.dataset.tab;
  tab.id = `tab-${name}`;
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', `panel-${name}`);
  const panel = panels.find((item) => item.dataset.panel === name);
  if (panel) {
    panel.id = `panel-${name}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-${name}`);
  }
  tab.addEventListener('click', () => activateTab(name));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    activateTab(tabs[next].dataset.tab, true);
  });
});
activateTab('person');

function seedOf(inputId) {
  const raw = $(inputId).value.trim();
  if (!raw) return undefined;
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

let gen = null;
const PACK_KEY = 'minglu-pack';
let activePack = localStorage.getItem(PACK_KEY) || 'seed';
async function ensureGenerator(status, silent = false) {
  if (gen) {
    syncAllusionAvailability();
    return gen;
  }
  if (!silent) setStatus(status, `首次生成：加载本地 pack（${activePack}）…`);
  setPackStatus(`加载 ${activePack}…`);
  const token = $('token').value.trim();
  const headers = token ? { authorization: 'Bearer ' + token } : {};
  const pack = await loadPack(`/v1/pack?pack=${encodeURIComponent(activePack)}`, headers);
  gen = createGenerator(pack);
  setPackStatus(packLine(gen));
  syncAllusionAvailability();
  return gen;
}

function syncAllusionAvailability() {
  const select = $('allusion');
  const commoner = $('klass').value === '俗人';
  const available = Boolean(gen && Object.keys(gen.pack.allusions ?? {}).length > 0);
  select.disabled = commoner || !available;
  if (!available) {
    if (!commoner) select.value = '';
    select.title = gen ? '当前数据包没有典故索引' : '数据包加载后才能选择用典';
  } else {
    select.title = '';
  }
}

async function loadPackOptions() {
  const select = $('pack-select');
  const token = $('token').value.trim();
  const headers = token ? { authorization: 'Bearer ' + token } : {};
  try {
    const response = await fetch('/v1/packs', { headers });
    const payload = await response.json();
    const packs = Array.isArray(payload.data) ? payload.data : [];
    if (!packs.length) throw new Error('no packs');
    select.innerHTML = packs.map((pack) => `<option value="${esc(pack.id)}">${esc(pack.id)} · ${esc(pack.version)}</option>`).join('');
    const saved = localStorage.getItem(PACK_KEY);
    activePack = saved && packs.some((pack) => pack.id === saved) ? saved : (payload.default || packs[0].id);
    if (!packs.some((pack) => pack.id === activePack)) activePack = packs[0].id;
    select.value = activePack;
    setPackStatus(`数据包：${activePack}（加载中）`);
  } catch {
    select.innerHTML = '<option value="seed">seed</option>';
    activePack = 'seed';
    select.value = activePack;
    setPackStatus('pack 列表加载失败，使用 seed');
  }
  try {
    await ensureGenerator($('status-person'), true);
  } catch (error) {
    setPackStatus(`pack 加载失败：${error.message}`);
  }
}
$('pack-select').addEventListener('change', async () => {
  activePack = $('pack-select').value;
  localStorage.setItem(PACK_KEY, activePack);
  gen = null;
  resetOutputs();
  syncAllusionAvailability();
  setPackStatus(`已切换：${activePack}（加载中）`);
  try {
    await ensureGenerator($('status-person'), true);
  } catch (error) {
    setPackStatus(`pack 加载失败：${error.message}`);
  }
});
$('token').addEventListener('change', () => {
  gen = null;
  resetOutputs();
  syncAllusionAvailability();
  loadPackOptions();
});
loadPackOptions();

function packLine(generator) {
  const line = `pack ${generator.pack.id}@${generator.pack.version} · ${generator.pack.license}`;
  setPackStatus(line);
  return line;
}

const RECENT_KEY = 'minglu-recent-names';
function recentNames() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(value) ? value.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function rememberNames(names) {
  try {
    const merged = [...new Set([...recentNames(), ...names])].slice(-40);
    localStorage.setItem(RECENT_KEY, JSON.stringify(merged));
  } catch {
    // localStorage 不可用时放弃抑制，不影响生成
  }
}

const PRESET_LENGTHS = { 'ming-imperial': 20, 'generic-a': 20, 'generic-b': 20 };
function syncGenerationIndex() {
  const preset = $('preset').value;
  const input = $('index');
  const max = PRESET_LENGTHS[preset] ?? 20;
  input.disabled = !preset || $('klass').value === '俗人';
  input.max = String(max);
  if (!preset) {
    input.value = '1';
    return;
  }
  const value = Number(input.value) || 1;
  input.value = String(Math.min(max, Math.max(1, Math.trunc(value))));
}
$('preset').addEventListener('change', syncGenerationIndex);

const lockedPersonFields = ['era', 'style', 'allusion', 'preset', 'index'];
function syncClassLocks() {
  const commoner = $('klass').value === '俗人';
  for (const id of lockedPersonFields) $(id).disabled = commoner;
  if (commoner) {
    $('era').value = 'tangsong';
    $('style').value = '';
    $('allusion').value = '';
    $('preset').value = '';
    $('index').value = '1';
  }
  syncGenerationIndex();
  syncAllusionAvailability();
  const hint = $('lock-person');
  hint.hidden = !commoner;
  hint.textContent = commoner ? '俗人模式：时代、风格、字辈固定不启用' : '';
}
$('klass').addEventListener('change', syncClassLocks);
syncClassLocks();

$('form-person').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $('status-person');
  const results = $('names-person');
  setStatus(status, '生成中…'); results.innerHTML = '';
  const style = $('style').value;
  const surname = surnameInput.value.trim();
  if (surname && !/^[\u4e00-\u9fa5]{1,6}$/.test(surname)) {
    status.textContent = '姓氏只能填 1–6 个汉字，不能含数字/字母/符号';
    return;
  }
  const preset = $('preset').value;
  const index = Number($('index').value) || 1;
  const presetMax = PRESET_LENGTHS[preset] ?? 20;
  if (preset && (index < 1 || index > presetMax)) {
    status.textContent = `字辈序号需为 1–${presetMax}`;
    return;
  }
  setBusy(form, true);
  const profile = {
    gender: $('gender').value,
    class: $('klass').value,
    ...($('klass').value !== '俗人'
      ? {
          era: $('era').value,
          ...(style ? { style: [style] } : {}),
          ...($('allusion').value ? { allusion: $('allusion').value } : {}),
          ...(preset ? { generation: { preset, index, position: 'first' } } : {}),
        }
      : {}),
    ...(surname ? { surname } : {}),
  };
  try {
    const generator = await ensureGenerator(status);
    const requested = Math.min(10, Math.max(1, Number($('count-person').value) || 5));
    const explicitSeed = seedOf('seed-person') !== undefined;
    const recent = explicitSeed ? new Set() : new Set(recentNames());
    const people = generator.generateBatch({
      ...profile,
      count: explicitSeed ? requested : requested + 20,
      ...(explicitSeed ? { seed: seedOf('seed-person') } : {}),
    });
    const excluded = excludedWords();
    const fresh = (explicitSeed ? people : people.filter((p) => !recent.has(p.fullName)))
      .filter((person) => !containsExcluded(person, excluded));
    const selected = fresh.slice(0, requested);
    if (selected.length < requested) {
      for (const person of people) {
        if (selected.length >= requested) break;
        if (!selected.includes(person) && !containsExcluded(person, excluded)) selected.push(person);
      }
    }
    if (!explicitSeed) rememberNames(selected.map((p) => p.fullName));
    status.textContent = `已生成 ${selected.length} 个 · ${packLine(generator)}`;
    results.innerHTML = selected.map((p) => {
      const tags = (p.styleTags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
      const chars = p.given.map((c) => `${esc(c.text)} ${esc(c.pinyin || '')}${c.tone ? ' ' + c.tone : ''}`).join(' · ');
      const genTag = p.generation ? `<span class="tag">字辈 ${esc(p.generation.char)}</span>` : '';
      const allusion = p.allusion ? `<div class="chars">典：${esc(p.allusion.source)}「${esc(p.allusion.line)}」</div>` : '';
      const warnings = (p.warnings || []).map((w) => `<div class="warn">${esc(w.message)}</div>`).join('');
      return `<div class="name"><b>${esc(p.fullName)}</b>${genTag}${tags}<div class="chars">${chars}</div>${allusion}${warnings}</div>`;
    }).join('');
  } catch (error) {
    setStatus(status, '失败：' + error.message, true);
  } finally {
    setBusy(form, false);
  }
});

$('form-sect').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $('status-sect');
  const results = $('names-sect');
  setStatus(status, '生成中…'); results.innerHTML = '';
  setBusy(form, true);
  try {
    const generator = await ensureGenerator(status);
    const alignment = $('alignment-sect').value;
    const sects = generator.sects({
      count: Number($('count-sect').value) || 9,
      alignment,
      ...(seedOf('seed-sect') !== undefined ? { seed: seedOf('seed-sect') } : {}),
    });
    status.textContent = `已生成 ${sects.length} 个宗门 · ${packLine(generator)}`;
    results.innerHTML = sects.map((sect) => {
      const tags = (sect.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
      return `<div class="name"><b>${esc(sect.fullName)}</b>${tags}<div class="chars">${esc(sect.description)}</div></div>`;
    }).join('');
  } catch (error) {
    setStatus(status, '失败：' + error.message, true);
  } finally {
    setBusy(form, false);
  }
});

$('form-pill').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $('status-pill');
  const results = $('names-pill');
  setStatus(status, '生成中…'); results.innerHTML = '';
  setBusy(form, true);
  try {
    const generator = await ensureGenerator(status);
    const kind = $('kind-pill').value;
    const suffix = $('suffix-pill').value;
    const mode = $('mode-pill').value;
    const pills = generator.pills({
      count: Number($('count-pill').value) || 8,
      kind,
      suffix,
      mode,
      ...(seedOf('seed-pill') !== undefined ? { seed: seedOf('seed-pill') } : {}),
    });
    status.textContent = `已生成 ${pills.length} 个丹药 · ${packLine(generator)}`;
    results.innerHTML = pills.map((pill) => {
      const tags = (pill.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
      return `<div class="name"><b>${esc(pill.fullName)}</b><span class="tag">${esc(pill.tier)}</span>${tags}<div class="chars">${esc(pill.description)}</div></div>`;
    }).join('');
  } catch (error) {
    setStatus(status, '失败：' + error.message, true);
  } finally {
    setBusy(form, false);
  }
});

$('form-technique').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $('status-technique');
  const results = $('names-technique');
  setStatus(status, '生成中…'); results.innerHTML = '';
  setBusy(form, true);
  try {
    const generator = await ensureGenerator(status);
    const kind = $('kind-technique').value;
    const suffix = $('suffix-technique').value;
    const techniques = generator.techniques({
      count: Number($('count-technique').value) || 8,
      kind,
      suffix,
      ...(seedOf('seed-technique') !== undefined ? { seed: seedOf('seed-technique') } : {}),
    });
    status.textContent = `已生成 ${techniques.length} 个功法 · ${packLine(generator)}`;
    results.innerHTML = techniques.map((technique) => {
      const tags = (technique.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
      const structure = `${technique.head} + ${technique.middle ?? '∅'} + ${technique.suffix}`;
      return `<div class="name"><b>${esc(technique.fullName)}</b>${tags}<div class="chars">${esc(structure)} · ${esc(technique.description)}</div></div>`;
    }).join('');
  } catch (error) {
    setStatus(status, '失败：' + error.message, true);
  } finally {
    setBusy(form, false);
  }
});

$('form-artifact').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $('status-artifact');
  const results = $('names-artifact');
  setStatus(status, '生成中…'); results.innerHTML = '';
  setBusy(form, true);
  try {
    const generator = await ensureGenerator(status);
    const artifacts = generator.artifacts({
      count: Number($('count-artifact').value) || 6,
      ...(seedOf('seed-artifact') !== undefined ? { seed: seedOf('seed-artifact') } : {}),
    });
    status.textContent = `已生成 ${artifacts.length} 个法宝 · ${packLine(generator)}`;
    results.innerHTML = artifacts.map((artifact) => {
      const tags = (artifact.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
      return `<div class="name"><b>${esc(artifact.name)}</b><span class="tag">${esc(artifact.modifierKind)}</span>${tags}<div class="chars">${esc(artifact.modifier)} + ${esc(artifact.form)}</div></div>`;
    }).join('');
  } catch (error) {
    setStatus(status, '失败：' + error.message, true);
  } finally {
    setBusy(form, false);
  }
});
