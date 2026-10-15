'use strict';

// ---------- 検索アプリ本体 ----------

// お店のデータは、OpenStreetMap の無料の公開サーバー（Overpass）から取る。止まっていたり混んでいたりすることがあるため、
//  ・使えるサーバーを複数並べ、遅いときは待たずに次のサーバーにも同時に聞く（先に答えたほうを使う）
//  ・取れた結果はこの端末に一時保存し、同じ場所の再検索では聞かない。通信に失敗したときは、保存してあるデータで代用する
// 2026-10 の測定では、private.coffee と kumi は応答がなく、本家系は重い検索（ジャンルをまとめて指定する書き方）が 504 で失敗した。
const OVERPASS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
];
const ATTEMPT_MS = 14000;                         // 1つのサーバーを待つ上限
const HEDGE_MS = 4000;                            // これだけ待っても答えがなければ、次のサーバーにも同時に聞く
const CACHE_PREFIX = 'nearbyGohan.places.v1.';
const CACHE_FRESH_MS = 30 * 60 * 1000;            // 30分以内なら、外部に聞かずに保存したデータを使う
const CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000;   // 通信に失敗したときは、1週間以内の保存データで代用する
const CACHE_MAX = 6;                              // 保存する場所の数（古いものから消す）
const PAGE = 10;   // 一度に表示する件数（多すぎると重くなるため）。「さらに読み込む」で、さらに PAGE 件ずつ増やす

const GENRES = {
  all:  { label: 'すべて' },
  meal: { label: '食事',         test: p => p.amenity === 'restaurant' || p.amenity === 'fast_food' },
  cafe: { label: 'カフェ',       test: p => p.amenity === 'cafe' },
  bar:  { label: '居酒屋・バー', test: p => p.amenity === 'bar' || p.amenity === 'pub' || p.cuisines.includes('izakaya') },
};
const AMENITY_JA = { restaurant: 'レストラン', cafe: 'カフェ', fast_food: 'ファストフード', bar: 'バー', pub: 'パブ' };
const CUISINE_JA = {
  japanese: '和食', sushi: '寿司', ramen: 'ラーメン', noodle: '麺類', udon: 'うどん', soba: 'そば',
  izakaya: '居酒屋', yakiniku: '焼肉', tempura: '天ぷら', tonkatsu: 'とんかつ', curry: 'カレー',
  chinese: '中華', korean: '韓国料理', italian: 'イタリアン', pizza: 'ピザ', french: 'フレンチ',
  burger: 'ハンバーガー', sandwich: 'サンドイッチ', coffee_shop: 'コーヒー', thai: 'タイ料理',
  indian: 'インド料理', vietnamese: 'ベトナム料理', steak_house: 'ステーキ', seafood: '海鮮',
  chicken: 'チキン', donburi: '丼', gyudon: '牛丼', okonomiyaki: 'お好み焼き', regional: '郷土料理',
  asian: 'アジア料理', western: '洋食', dessert: 'デザート', ice_cream: 'アイス', bakery: 'ベーカリー',
};

const state = { lat: null, lon: null, radius: 500, genre: 'all', openOnly: false, places: [], limit: PAGE, selectedId: null };
const $ = s => document.querySelector(s);
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ---------- プロフィールと「今の気分」（どちらかがあれば、並べ替えに使う） ----------
const GP = window.GohanProfile;
const MOOD_KEY = 'nearbyGohan.mood.v1';
let ctx = null;          // 並べ替えに使う情報（プロフィールも気分もなければ null）
let moodText = '';       // 気分は日によって変わるので、この画面を開いている間だけ覚えておく（sessionStorage）
const readMood = () => { try { return sessionStorage.getItem(MOOD_KEY) || ''; } catch { return ''; } };
const writeMood = v => { try { sessionStorage.setItem(MOOD_KEY, v); } catch { /* 保存できなくても動く */ } };

function rebuildContext() {
  ctx = GP.buildContext(GP.load(), moodText);
  const registered = !!(ctx && ctx.hasProfile);
  $('#profileBtnText').textContent = registered ? `${ctx.profile.name}さん` : 'プロフィール登録';
  $('#profileBtn').classList.toggle('registered', registered);
}
function updateNote() {
  const el = $('#profileNote');
  if (!ctx) { el.hidden = true; return; }
  const parts = [ctx.hasProfile ? `${ctx.profile.name}さん向けに並べています。` : '気分に合わせて並べています。'];
  if (ctx.birthdayToday) parts.push('お誕生日おめでとうございます！');
  const m = ctx.mood;
  if (m.matched.length) parts.push(m.matched.map(i => `「${i.label}」→ ${i.note}`).join(' / '));
  else if (ctx.moodText) parts.push(`気分「${ctx.moodText}」は読み取れなかったので、いつも通りのバランスで並べています。`);
  if (ctx.adultOnly) parts.push('20歳未満のため、居酒屋・バーは表示していません。');
  el.textContent = parts.join(' ');
  el.hidden = false;
}
// 気分が変わったら、並びをその場で入れかえる
function applyMood(text) {
  moodText = String(text || '').trim().slice(0, 60);
  writeMood(moodText);
  rebuildContext();
  updateNote();
  document.querySelectorAll('.example').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === moodText)));
  if (state.lat != null) render();
}

// ---------- 小さなユーティリティ ----------
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
}
function safeUrl(u) {
  if (!u) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u);
    return /^https?:$/.test(url.protocol) ? url.href : null;
  } catch { return null; }
}
function safePhone(p) {
  if (!p) return null;
  const first = p.split(';')[0].trim();
  return /^[0-9+\-() ]{5,20}$/.test(first) ? first : null;
}
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function fmtDist(m) { return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`; }
function setStatus(msg, isError = false) {
  const s = $('#status');
  s.textContent = msg;
  s.classList.toggle('error', isError);
}

// ---------- データ取得 ----------
// 軽い検索：ジャンルをまとめて正規表現で指定する書き方は、本家系のサーバーで 504 になりやすいので、ジャンルごとに分けて指定する
function buildQuery(lat, lon, radius) {
  const parts = ['restaurant', 'cafe', 'fast_food', 'bar', 'pub']
    .map(a => `nwr["amenity"="${a}"]["name"](around:${radius},${lat},${lon});`).join('');
  return `[out:json][timeout:20];(${parts});out center tags qt;`;
}

async function queryOne(ep, q, signal) {
  const res = await fetch(ep, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(q),
    signal,
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  // 混雑時は JSON ではなくエラー内容の XML が返るため、パースに失敗したら次のサーバーへ
  const json = JSON.parse(await res.text());
  if (/runtime error|timed out/i.test(json.remark || '')) throw new Error(json.remark);
  if (!Array.isArray(json.elements)) throw new Error('unexpected response');
  return json.elements;
}

// 前回うまくいったサーバーから聞く。初めてのときは先頭の2つをランダムに入れかえて、特定のサーバーに偏らないようにする
function endpointOrder() {
  const list = OVERPASS.slice();
  let good = null;
  try { good = localStorage.getItem('nearbyGohan.endpoint'); } catch { /* なくても動く */ }
  if (good && list.includes(good)) return [good, ...list.filter(e => e !== good)];
  return Math.random() < 0.5 ? list : [list[1], list[0], ...list.slice(2)];
}
function rememberEndpoint(ep) { try { localStorage.setItem('nearbyGohan.endpoint', ep); } catch { /* なくても動く */ } }

// 順番に聞く。失敗したらすぐ次へ、HEDGE_MS 待っても答えがなければ待たずに次にも聞く。最初に成功した結果を使い、残りは中止する
function raceEndpoints(q, onSlow) {
  const order = endpointOrder();
  return new Promise((resolve, reject) => {
    const controllers = [];
    let next = 0, running = 0, done = false, lastErr = null, hedgeTimer = null;
    const finish = fn => { done = true; clearTimeout(hedgeTimer); controllers.forEach(c => c.abort()); fn(); };
    const armHedge = () => { clearTimeout(hedgeTimer); hedgeTimer = setTimeout(() => { if (!done) launch(); }, HEDGE_MS); };
    function launch() {
      if (done || next >= order.length) return false;
      const ep = order[next++];
      const ac = new AbortController();
      controllers.push(ac);
      const timer = setTimeout(() => ac.abort(), ATTEMPT_MS);
      running++;
      if (next > 1) onSlow?.(next);
      queryOne(ep, q, ac.signal)
        .then(els => { if (!done) { rememberEndpoint(ep); finish(() => resolve(els)); } })
        .catch(e => { lastErr = e; })
        .finally(() => {
          clearTimeout(timer);
          running--;
          if (done) return;
          if (!launch() && running === 0) finish(() => reject(lastErr || new Error('all endpoints failed')));
        });
      armHedge();
      return true;
    }
    launch();
  });
}

// ---------- 取得したデータの一時保存（この端末の中だけ） ----------
const snap = v => Math.round(v * 1000) / 1000;      // 約100mごとに丸める（近い場所なら同じデータを使い回せる）
const cacheKey = (lat, lon, r) => `${CACHE_PREFIX}${snap(lat)},${snap(lon)},${r}`;
const KEEP_TAGS = ['name', 'name:ja', 'amenity', 'cuisine', 'opening_hours', 'website', 'contact:website', 'phone', 'contact:phone', 'brand', 'brand:ja'];
function slimElement(e) {                            // 使う項目だけに絞って、保存する量を減らす
  const tags = {};
  for (const k of KEEP_TAGS) if (e.tags && e.tags[k] != null) tags[k] = e.tags[k];
  return { type: e.type, id: e.id, lat: e.lat, lon: e.lon, center: e.center, tags };
}
function readCache(key) {
  try { const o = JSON.parse(localStorage.getItem(key)); return o && Array.isArray(o.els) && typeof o.t === 'number' ? o : null; } catch { return null; }
}
function pruneCache(max) {
  try {
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) items.push({ k, t: (readCache(k) || { t: 0 }).t });
    }
    items.sort((a, b) => b.t - a.t).slice(max).forEach(x => localStorage.removeItem(x.k));
  } catch { /* なくても動く */ }
}
function writeCache(key, els) {
  const entry = JSON.stringify({ t: Date.now(), els: els.map(slimElement) });
  try { localStorage.setItem(key, entry); } catch { pruneCache(1); try { localStorage.setItem(key, entry); } catch { /* 容量不足なら保存しない */ } }
  pruneCache(CACHE_MAX);
}

// お店のデータを取る。{ els, source: 'cache'|'network'|'stale', age } を返す
async function fetchPlaces(lat, lon, radius, onSlow) {
  const key = cacheKey(lat, lon, radius);
  const cached = readCache(key);
  const age = cached ? Date.now() - cached.t : Infinity;
  if (cached && age < CACHE_FRESH_MS) return { els: cached.els, source: 'cache', age };
  try {
    const els = await raceEndpoints(buildQuery(snap(lat), snap(lon), radius), onSlow);
    writeCache(key, els);
    return { els, source: 'network', age: 0 };
  } catch (e) {
    if (cached && age < CACHE_STALE_MS) return { els: cached.els, source: 'stale', age };
    throw e;
  }
}
function fmtAge(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(m, 1)}分`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}時間` : `${Math.round(h / 24)}日`;
}

function openState(hours) {
  if (!hours || typeof opening_hours === 'undefined') return null;
  try { return new opening_hours(hours).getState(new Date()); } catch { return null; }
}

function normalize(el, lat0, lon0, radius) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;
  const cuisines = (t.cuisine || '').split(';').map(s => s.trim()).filter(Boolean);
  const p = {
    id: el.type + el.id,
    name: t['name:ja'] || t.name,
    amenity: t.amenity, cuisines, lat, lon,
    dist: haversine(lat0, lon0, lat, lon),
    hours: t.opening_hours || null,
    website: safeUrl(t.website || t['contact:website']),
    phone: safePhone(t.phone || t['contact:phone']),
    brand: t['brand:ja'] || t.brand || '',
  };
  p.open = openState(p.hours);
  p.genreLabel = (cuisines.map(c => CUISINE_JA[c]).filter(Boolean)[0]) || AMENITY_JA[p.amenity] || '飲食店';
  // おすすめ度：営業中を最優先、近さ、登録情報の充実度
  let s = 30 * (1 - Math.min(p.dist / radius, 1));
  if (p.open === true) s += 40; else if (p.open === false) s -= 50;
  if (cuisines.length) s += 8;
  if (p.hours) s += 6;
  if (p.website) s += 6;
  if (p.phone) s += 4;
  p.baseScore = s;   // プロフィールによる加点は GP.personalize() が p.score に反映する
  return p;
}

// ---------- 地図 ----------
const map = L.map('map', { zoomControl: true }).setView([35.681, 139.767], 15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);
const layer = L.layerGroup().addTo(map);
let youMarker = null, circle = null;
const markers = new Map();
const pinStyle = sel => sel
  ? { radius: 11, fillColor: css('--pin-sel'), color: css('--pin-ring'), weight: 3 }
  : { radius: 7, fillColor: css('--pin'), color: '#fff', weight: 2 };

function drawMap(shown) {
  layer.clearLayers();
  markers.clear();
  if (youMarker) youMarker.remove();
  if (circle) circle.remove();
  youMarker = L.circleMarker([state.lat, state.lon], { radius: 8, color: '#fff', weight: 3, fillColor: css('--you'), fillOpacity: 1 }).addTo(map).bindTooltip('現在地');
  circle = L.circle([state.lat, state.lon], { radius: state.radius, color: css('--you'), weight: 1.5, fillOpacity: 0.06 }).addTo(map);
  for (const p of shown) {
    const m = L.circleMarker([p.lat, p.lon], { ...pinStyle(false), fillOpacity: 0.95 });
    m.bindTooltip(p.name);
    m.on('click', () => select(p.id, true));
    m.addTo(layer);
    markers.set(p.id, m);
  }
}

// ---------- 表示 ----------
function filtered() {
  const g = GENRES[state.genre];
  return state.places
    .map(p => GP.personalize(p, ctx))      // プロフィールがあれば点数・理由・価格の目安を付ける
    .filter(p => !p.hidden)
    .filter(p => !g.test || g.test(p))
    .filter(p => !state.openOnly || p.open === true)
    .sort((a, b) => b.score - a.score);
}

function render({ fit = false } = {}) {
  const all = filtered();
  const shown = all.slice(0, state.limit);
  $('#random').disabled = all.length === 0;
  $('#more').hidden = all.length <= state.limit;
  if (state.lat != null) {
    drawMap(shown);
    if (fit) map.fitBounds(circle.getBounds(), { padding: [10, 10] });
  }
  const list = $('#list');
  list.replaceChildren();
  shown.forEach((p, i) => list.append(card(p, i)));
  if (state.lat != null) {
    const note = all.length === 0 ? '条件に合うお店が見つかりませんでした。' : `おすすめ順に ${all.length} 件`;
    setStatus(`${note}（半径${state.radius >= 1000 ? state.radius / 1000 + 'km' : state.radius + 'm'}）`);
  }
  if (state.selectedId) markSelected(state.selectedId);
}

function card(p, rank) {
  const gmap = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
  const best = !!ctx && rank === 0;
  return h('li', { class: 'card' + (best ? ' best' : ''), id: 'c-' + p.id, onclick: () => select(p.id, false) },
    best && h('div', { class: 'badge' }, 'いまのあなたにいちばん'),
    h('div', { class: 'top' },
      h('span', { class: 'name' }, p.name),
      h('span', { class: 'dist' }, fmtDist(p.dist))),
    h('div', { class: 'meta' },
      h('span', { class: 'tag genre' }, p.genreLabel),
      p.open === true && h('span', { class: 'tag open' }, '営業中'),
      p.open === false && h('span', { class: 'tag' }, '営業時間外'),
      ctx && p.priceLabel && h('span', { class: 'tag price' }, p.priceLabel)),
    ctx && p.reasons.length > 0 && h('div', { class: 'why' }, p.reasons.slice(0, 3).map(r => h('span', { class: 'why-chip' }, r))),
    p.hours && h('div', { class: 'hours' }, p.hours),
    h('div', { class: 'links' },
      h('a', { href: gmap, target: '_blank', rel: 'noopener' }, '地図で開く'),
      p.website && h('a', { href: p.website, target: '_blank', rel: 'noopener' }, 'Webサイト'),
      p.phone && h('a', { href: 'tel:' + p.phone.replace(/[^0-9+]/g, '') }, '電話')));
}

function markSelected(id) {
  document.querySelectorAll('.card.selected').forEach(e => e.classList.remove('selected'));
  document.getElementById('c-' + id)?.classList.add('selected');
  for (const [mid, m] of markers) m.setStyle(pinStyle(mid === id));
}

function select(id, scrollToCard) {
  state.selectedId = id;
  markSelected(id);
  const m = markers.get(id);
  if (m) { m.bringToFront(); map.panTo(m.getLatLng()); }
  if (scrollToCard) document.getElementById('c-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- 検索の実行 ----------
let searchSeq = 0;
async function searchAt(lat, lon) {
  const seq = ++searchSeq;
  state.lat = lat; state.lon = lon; state.limit = PAGE; state.selectedId = null;
  map.setView([lat, lon], 15);
  setStatus('お店を探しています…');
  $('#list').replaceChildren();
  try {
    const res = await fetchPlaces(lat, lon, state.radius, () => {
      if (seq === searchSeq) setStatus('応答が遅いので、別のサーバーにも問い合わせています…');
    });
    if (seq !== searchSeq) return; // 後から始めた検索を優先する
    state.places = res.els.map(e => normalize(e, lat, lon, state.radius)).filter(Boolean);
    render({ fit: true });
    if (res.source === 'stale') setStatus(`${$('#status').textContent} ※通信できなかったため、${fmtAge(res.age)}前に保存したデータで表示しています。`);
  } catch (e) {
    console.error(e);
    if (seq === searchSeq) setStatus('お店のデータを取得できませんでした。無料の公開サーバーがどれも応答しませんでした。少し待ってからもう一度お試しください。', true);
  }
}

function locate() {
  if (!navigator.geolocation) { setStatus('このブラウザは位置情報に対応していません。場所を入力してください。', true); return; }
  setStatus('現在地を取得しています…');
  navigator.geolocation.getCurrentPosition(
    pos => searchAt(pos.coords.latitude, pos.coords.longitude),
    err => {
      const msg = err.code === 1 ? '位置情報の利用が許可されていません。ブラウザの設定を確認するか、場所を入力してください。'
                : err.code === 3 ? '現在地の取得がタイムアウトしました。もう一度お試しください。'
                : '現在地を取得できませんでした。場所を入力してください。';
      setStatus(msg, true);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}

async function searchPlaceName(q) {
  setStatus('場所を探しています…');
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=ja&q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const r = (await res.json())[0];
    if (!r) { setStatus('その場所が見つかりませんでした。', true); return; }
    await searchAt(parseFloat(r.lat), parseFloat(r.lon));
  } catch (e) {
    console.error(e);
    setStatus('場所を検索できませんでした。少し待ってからもう一度お試しください。', true);
  }
}

// ---------- イベント ----------
for (const [key, g] of Object.entries(GENRES)) {
  $('#chips').append(h('button', {
    class: 'chip', 'aria-pressed': String(key === state.genre), 'data-g': key,
    onclick: () => {
      state.genre = key; state.limit = PAGE;
      document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.g === key)));
      render();
    },
  }, g.label));
}
$('#locate').addEventListener('click', locate);
$('#searchForm').addEventListener('submit', e => { e.preventDefault(); const q = $('#place').value.trim(); if (q) searchPlaceName(q); });
$('#radius').addEventListener('change', e => { state.radius = Number(e.target.value); if (state.lat != null) searchAt(state.lat, state.lon); });
$('#openOnly').addEventListener('change', e => { state.openOnly = e.target.checked; state.limit = PAGE; render(); });
$('#more').addEventListener('click', () => { state.limit += PAGE; render(); });
$('#random').addEventListener('click', () => {
  const pool = filtered().slice(0, 10);
  if (!pool.length) return;
  const p = pool[Math.floor(Math.random() * pool.length)];
  if (!document.getElementById('c-' + p.id)) { state.limit = Math.max(state.limit, filtered().indexOf(p) + 1); render(); }
  select(p.id, true);
});

// ---------- 今の気分 ----------
for (const ex of GP.MOOD_EXAMPLES) {
  $('#examples').append(h('button', {
    type: 'button', class: 'chip example', 'aria-pressed': 'false',
    onclick: () => { $('#mood').value = ex; applyMood(ex); },
  }, ex));
}
let moodTimer = null;
$('#mood').addEventListener('input', e => {            // 入力が止まってから反映する
  clearTimeout(moodTimer);
  moodTimer = setTimeout(() => applyMood(e.target.value), 400);
});
$('#mood').addEventListener('search', e => applyMood(e.target.value));   // ×ボタンで消したとき
$('#mood').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); clearTimeout(moodTimer); applyMood(e.target.value); e.target.blur(); }
});

// ---------- 起動時 ----------
moodText = readMood();
$('#mood').value = moodText;
rebuildContext();
updateNote();
document.querySelectorAll('.example').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === moodText)));
// プロフィール画面から「戻る」で戻ってきたときも、最新のプロフィールで並べ直す
window.addEventListener('pageshow', e => {
  if (!e.persisted) return;
  rebuildContext();
  updateNote();
  if (state.lat != null) render();
});
