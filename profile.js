'use strict';
// プロフィール設定ページ：入力欄を作り、保存済みの内容を表示し、保存・削除する。
(function () {
  const G = window.GohanProfile;
  const $ = s => document.querySelector(s);
  const MAX_GENRES = 3;

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

  // ---------- 入力欄を作る ----------
  for (const c of G.CATEGORIES) {
    $('#genres').append(h('label', { class: 'pick' },
      h('input', { type: 'checkbox', name: 'genre', value: c.id }), h('span', {}, c.label)));
  }
  for (const b of G.BUDGETS) {
    $('#budgets').append(h('label', { class: 'pick' },
      h('input', { type: 'radio', name: 'budget', value: b.id }), h('span', {}, b.label)));
  }

  // 生年月日：年・月・日をそれぞれ選ぶ（カレンダーだと、遠い年まで何度も送らないと選べないため）
  const bYear = $('#bYear'), bMonth = $('#bMonth'), bDay = $('#bDay');
  const opt = (value, text) => h('option', { value: String(value) }, text);
  const thisYear = new Date().getFullYear();
  bYear.append(opt('', '年'));
  for (let y = thisYear; y >= thisYear - 100; y--) bYear.append(opt(y, `${y}年`));
  bMonth.append(opt('', '月'));
  for (let m = 1; m <= 12; m++) bMonth.append(opt(m, `${m}月`));
  // 日の選択肢は、選んだ年・月の日数（28〜31日、うるう年）に合わせる。年が未選択のときは2月29日も選べるようにする
  function fillDays() {
    const keep = bDay.value;
    const max = bMonth.value ? new Date(Number(bYear.value) || 2000, Number(bMonth.value), 0).getDate() : 31;
    bDay.replaceChildren(opt('', '日'));
    for (let d = 1; d <= max; d++) bDay.append(opt(d, `${d}日`));
    bDay.value = keep && Number(keep) <= max ? keep : '';
  }
  // 年・月・日がそろっていれば 'YYYY-MM-DD'、すべて空なら ''、一部だけなら null（入力の途中）
  function getBirthday() {
    const y = bYear.value, m = bMonth.value, d = bDay.value;
    if (!y && !m && !d) return '';
    if (!y || !m || !d) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  function setBirthday(v) {
    const [y, m, d] = v ? v.split('-').map(Number) : ['', '', ''];
    bYear.value = y ? String(y) : '';
    if (y && bYear.value !== String(y)) { bYear.append(opt(y, `${y}年`)); bYear.value = String(y); }   // 100年より前でも失わない
    bMonth.value = m ? String(m) : '';
    fillDays();
    bDay.value = d ? String(d) : '';
  }
  fillDays();

  // ---------- 保存済みの内容を表示 ----------
  const saved = G.load();
  if (saved) {
    $('#name').value = saved.name;
    setBirthday(saved.birthday);
    document.querySelectorAll('input[name=genre]').forEach(i => { i.checked = saved.genres.includes(i.value); });
    document.querySelectorAll('input[name=budget]').forEach(i => { i.checked = i.value === saved.budget; });
  }

  // ---------- 画面の更新 ----------
  function updateGenreLimit() {
    const boxes = [...document.querySelectorAll('input[name=genre]')];
    const n = boxes.filter(b => b.checked).length;
    $('#genreCount').textContent = `${n}/${MAX_GENRES}`;
    boxes.forEach(b => { b.disabled = !b.checked && n >= MAX_GENRES; });   // 3つ選んだら、残りは選べなくする
  }
  function updateBirthdayNote() {
    const v = getBirthday();
    const age = v ? G.ageOf(v) : null;
    let msg = '誕生日の当日は、特別な日向けの並びになります。20歳未満の方には、居酒屋・バーを表示しません。';
    if (v === null) msg = '年・月・日をすべて選んでください。';
    else if (v && age === null) msg = '生年月日を正しく入力してください。';
    else if (G.isBirthday(v)) msg = 'お誕生日おめでとうございます！今日は特別な日向けの並びになります。';
    else if (age !== null && age < 20) msg = '20歳未満のため、居酒屋・バーは表示されません。';
    $('#birthdayNote').textContent = msg;
  }
  function refresh() { updateGenreLimit(); updateBirthdayNote(); }

  $('#genres').addEventListener('change', updateGenreLimit);
  [bYear, bMonth].forEach(el => el.addEventListener('change', () => { fillDays(); updateBirthdayNote(); }));
  bDay.addEventListener('change', updateBirthdayNote);
  refresh();

  // ---------- 保存・削除 ----------
  const showError = msg => { const e = $('#formError'); e.textContent = msg; e.hidden = !msg; };

  $('#profileForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const name = $('#name').value.trim();
    const birthday = getBirthday();
    if (!name) { showError('ユーザーネームを入力してください。'); $('#name').focus(); return; }
    if (birthday === null) { showError('生年月日は、年・月・日をすべて選んでください。入力しない場合は、すべて「年」「月」「日」のままにしてください。'); bYear.focus(); return; }
    if (birthday && G.ageOf(birthday) === null) { showError('生年月日を正しく入力してください。'); bYear.focus(); return; }
    const genres = [...document.querySelectorAll('input[name=genre]:checked')].map(i => i.value);
    const budget = (document.querySelector('input[name=budget]:checked') || {}).value || '';
    if (!G.save({ name, birthday, genres, budget })) {
      showError('この端末のブラウザに保存できませんでした。プライベートブラウズを使っている場合は、通常のモードでお試しください。');
      return;
    }
    showError('');
    $('#savedText').textContent = `保存しました。${name}さん向けに、お店を並べます。`;
    $('#saved').hidden = false;
    $('#saved').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // 削除は誤って押さないよう、2回押して確定する
  let armed = null;
  $('#deleteBtn').addEventListener('click', ev => {
    const btn = ev.currentTarget;
    if (!armed) {
      btn.textContent = '本当に削除する（もう一度押す）';
      armed = setTimeout(() => { btn.textContent = 'プロフィールを削除'; armed = null; }, 4000);
      return;
    }
    clearTimeout(armed); armed = null;
    G.clear();
    $('#profileForm').reset();
    setBirthday('');
    refresh();
    btn.textContent = 'プロフィールを削除';
    showError('');
    $('#savedText').textContent = 'プロフィールを削除しました。';
    $('#saved').hidden = false;
  });
})();
