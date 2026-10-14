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
  const today = new Date();
  $('#birthday').max = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // ---------- 保存済みの内容を表示 ----------
  const saved = G.load();
  if (saved) {
    $('#name').value = saved.name;
    $('#birthday').value = saved.birthday;
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
    const v = $('#birthday').value;
    const age = G.ageOf(v);
    let msg = '誕生日の当日は、特別な日向けの並びになります。20歳未満の方には、居酒屋・バーを表示しません。';
    if (v && age === null) msg = '生年月日を正しく入力してください。';
    else if (G.isBirthday(v)) msg = 'お誕生日おめでとうございます！今日は特別な日向けの並びになります。';
    else if (age !== null && age < 20) msg = '20歳未満のため、居酒屋・バーは表示されません。';
    $('#birthdayNote').textContent = msg;
  }
  function refresh() { updateGenreLimit(); updateBirthdayNote(); }

  $('#genres').addEventListener('change', updateGenreLimit);
  $('#birthday').addEventListener('input', updateBirthdayNote);
  refresh();

  // ---------- 保存・削除 ----------
  const showError = msg => { const e = $('#formError'); e.textContent = msg; e.hidden = !msg; };

  $('#profileForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const name = $('#name').value.trim();
    const birthday = $('#birthday').value;
    if (!name) { showError('ユーザーネームを入力してください。'); $('#name').focus(); return; }
    if (birthday && G.ageOf(birthday) === null) { showError('生年月日を正しく入力してください。'); $('#birthday').focus(); return; }
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
    refresh();
    btn.textContent = 'プロフィールを削除';
    showError('');
    $('#savedText').textContent = 'プロフィールを削除しました。';
    $('#saved').hidden = false;
  });
})();
