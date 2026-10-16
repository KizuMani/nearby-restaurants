'use strict';
/*
 * プロフィールの保存・読み込みと、プロフィールに合わせたお店の点数づけ。
 * すべてブラウザの中だけで完結し、入力内容は外部に送らない（この端末の localStorage に保存）。
 */
(function () {
  const KEY = 'nearbyGohan.profile.v1';

  // 好きなジャンル（10種類）
  const CATEGORIES = [
    { id: 'ramen', label: 'ラーメン' },
    { id: 'italian', label: 'イタリアン' },
    { id: 'chinese', label: '中華' },
    { id: 'gyudon', label: '牛丼・丼もの' },
    { id: 'fastfood', label: 'ファストフード' },
    { id: 'udon', label: 'うどん・そば' },
    { id: 'french', label: 'フレンチ' },
    { id: 'sushi', label: '寿司' },
    { id: 'yakiniku', label: '焼肉・ステーキ' },
    { id: 'cafe', label: 'カフェ・喫茶' },
  ];
  // 普段使えるごはん代
  const BUDGETS = [
    { id: 'b500', label: '～500円', cap: 500 },
    { id: 'b1000', label: '～1,000円', cap: 1000 },
    { id: 'b1500', label: '～1,500円', cap: 1500 },
    { id: 'b2000', label: '～2,000円', cap: 2000 },
    { id: 'b2000p', label: '2,000円以上', cap: Infinity },
  ];
  const MOOD_EXAMPLES = ['いつものごはん', '早く済ませたい', '今日は誕生日', 'がっつり食べたい', 'あっさり軽めがいい', 'ゆっくりお茶したい'];

  const MOOD_WEIGHT = 1.4;   // 「今の気分」は、普段の好みより強く効かせる
  const labelOf = id => (CATEGORIES.find(c => c.id === id) || {}).label || id;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ---------- 保存 ----------
  // 保存済みの値は信用せず、型と長さを毎回そろえる
  function clean(raw) {
    const o = raw && typeof raw === 'object' ? raw : {};
    const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
    const ids = CATEGORIES.map(c => c.id);
    const genres = Array.isArray(o.genres) ? [...new Set(o.genres.filter(g => ids.includes(g)))].slice(0, 3) : [];
    const birthday = typeof o.birthday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.birthday) && !isNaN(Date.parse(o.birthday)) ? o.birthday : '';
    const budget = BUDGETS.some(b => b.id === o.budget) ? o.budget : '';
    return { name: str(o.name, 20), birthday, genres, budget };
  }
  function load() {
    try { const s = localStorage.getItem(KEY); return s ? clean(JSON.parse(s)) : null; } catch { return null; }
  }
  function save(p) {
    try { localStorage.setItem(KEY, JSON.stringify(clean(p))); return true; } catch { return false; }
  }
  function clear() {
    try { localStorage.removeItem(KEY); return true; } catch { return false; }
  }

  // ---------- 年齢・誕生日 ----------
  function ageOf(birthday, now = new Date()) {
    if (!birthday) return null;
    const [y, m, d] = birthday.split('-').map(Number);
    let a = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
    return a >= 0 && a < 130 ? a : null;
  }
  function isBirthday(birthday, now = new Date()) {
    if (!birthday) return false;
    const [, m, d] = birthday.split('-').map(Number);
    return now.getMonth() + 1 === m && now.getDate() === d;
  }

  // ---------- お店のジャンル判定（OpenStreetMap の cuisine タグと店名から） ----------
  const CUISINE_MAP = {
    ramen: 'ramen', italian: 'italian', pizza: 'italian', pasta: 'italian', chinese: 'chinese', dim_sum: 'chinese',
    gyudon: 'gyudon', beef_bowl: 'gyudon', donburi: 'gyudon', rice_bowl: 'gyudon',
    burger: 'fastfood', fast_food: 'fastfood', sandwich: 'fastfood', chicken: 'fastfood', fried_chicken: 'fastfood',
    udon: 'udon', soba: 'udon', french: 'french', sushi: 'sushi',
    yakiniku: 'yakiniku', korean_bbq: 'yakiniku', steak_house: 'yakiniku', steak: 'yakiniku', bbq: 'yakiniku',
    coffee_shop: 'cafe', cafe: 'cafe', tea: 'cafe',
  };
  const NAME_RULES = {
    ramen: /ラーメン|らーめん|拉麺|中華そば|つけ麺|ramen/i,
    italian: /イタリア|パスタ|ピッツ|ピザ|トラットリア|リストランテ|pizza|pasta/i,
    chinese: /中華|中国|餃子|ギョーザ|担々|麻婆|点心|飲茶|チャイナ/,
    gyudon: /牛丼|丼|どんぶり|吉野家|すき家|松屋|なか卯/,
    fastfood: /マクドナルド|モスバーガー|ケンタッキー|バーガーキング|ロッテリア|フレッシュネス|サブウェイ|ハンバーガー|バーガー/,
    udon: /うどん|そば|蕎麦|讃岐|丸亀製麺|はなまる|ゆで太郎|小諸/,
    french: /フレンチ|フランス|ビストロ|ブラッスリー/,
    sushi: /寿司|鮨|すし|スシ|回転|スシロー|はま寿司|かっぱ寿司/,
    yakiniku: /焼肉|焼き肉|ホルモン|ステーキ|やきにく|牛角|叙々苑|いきなり/,
    cafe: /カフェ|喫茶|珈琲|コーヒー|スターバックス|ドトール|タリーズ|コメダ|ベローチェ|cafe|coffee/i,
  };
  function genresOf(p) {
    if (p._g) return p._g;
    const g = new Set();
    for (const c of p.cuisines || []) if (CUISINE_MAP[c]) g.add(CUISINE_MAP[c]);
    const text = (p.name || '') + ' ' + (p.brand || '');
    for (const [id, re] of Object.entries(NAME_RULES)) if (re.test(text)) g.add(id);
    if (p.amenity === 'cafe') g.add('cafe');
    if (p.amenity === 'fast_food' && !['gyudon', 'udon', 'ramen', 'sushi'].some(x => g.has(x))) g.add('fastfood');
    p._g = g;
    return g;
  }
  function isAlcohol(p) {
    return p.amenity === 'bar' || p.amenity === 'pub' || (p.cuisines || []).includes('izakaya')
      || /居酒屋|酒場|ビアホール|立ち飲み|バル\b/.test(p.name || '');
  }

  // ---------- 価格の目安（実際の価格データがないため、ジャンルからの推定） ----------
  const BASE_PRICE = { gyudon: 650, fastfood: 750, udon: 850, ramen: 1000, cafe: 900, chinese: 1200, italian: 1800, sushi: 2500, yakiniku: 3000, french: 4000 };
  function estimatePrice(p, genres) {
    if (isAlcohol(p)) return 3000;
    const vals = [...genres].map(g => BASE_PRICE[g]).filter(Boolean);
    if (!vals.length) return null;
    let est = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (genres.has('sushi') && /回転|回し|くら寿司|スシロー|はま寿司|かっぱ寿司|魚べい|元気寿司/.test((p.name || '') + (p.brand || ''))) est = 1500;
    return est;
  }
  function priceBandLabel(yen) {
    if (yen <= 500) return '～500円';
    if (yen <= 1000) return '～1,000円';
    if (yen <= 1500) return '～1,500円';
    if (yen <= 2000) return '～2,000円';
    return '2,000円～';
  }

  // ---------- 気分の読み取り（言葉の辞書。AIではなく決まった言葉との照合） ----------
  const INTENTS = [
    { id: 'quick', label: '早く済ませたい', note: 'ファストフード・牛丼・うどんなどを優先',
      re: /早く|早め|早い|急ぎ|急いで|急ぐ|すぐ|さくっと|ささっと|手早|時間がない|時間ない|時短|忙しい|ちゃちゃっと|サクサク|昼休み/,
      boost: { fastfood: 28, gyudon: 28, udon: 20, ramen: 8 }, price: -1 },
    { id: 'celebrate', label: '特別な日', note: '少しお高めのお店（フレンチ・イタリアン・寿司・焼肉など）を優先',
      re: /誕生日|記念日|お祝い|祝い|デート|プロポーズ|ご褒美|ごほうび|贅沢|ぜいたく|特別|接待|奮発|歓迎会|送別会/,
      boost: { french: 28, italian: 22, sushi: 22, yakiniku: 22, chinese: 6 }, penalty: { fastfood: -20, gyudon: -15 }, price: 1 },
    { id: 'cheap', label: '節約したい', note: '安く済むお店を優先',
      re: /安く|安い|節約|金欠|お金がない|お金ない|ワンコイン|コスパ|財布|貧乏|給料日前/,
      boost: { gyudon: 12, fastfood: 12, udon: 12 }, price: -2 },
    { id: 'light', label: 'あっさり軽め', note: 'うどん・そば・カフェなど軽めのお店を優先',
      re: /軽く|軽め|あっさり|ヘルシー|さっぱり|小腹|ダイエット|胃が重|胃もたれ|食欲がない|食欲ない|夏バテ|さらっと/,
      boost: { udon: 22, cafe: 14, sushi: 10 }, penalty: { ramen: -10, yakiniku: -18, fastfood: -8 } },
    { id: 'hearty', label: 'がっつり', note: 'ラーメン・焼肉・丼ものなどボリュームのあるお店を優先',
      re: /がっつり|ガッツリ|ボリューム|大盛|腹ペコ|腹ぺこ|お腹すいた|おなかすいた|お腹が空|おなかが空|空腹|たくさん|食べ盛り|肉/,
      boost: { ramen: 20, yakiniku: 22, gyudon: 18, chinese: 12, fastfood: 6 }, penalty: { cafe: -8 } },
    { id: 'relax', label: 'ゆっくりしたい', note: 'カフェ・喫茶を優先',
      re: /ゆっくり|のんびり|落ち着|まったり|静か|くつろ|休憩|一息|ひと息|作業|仕事|勉強|お茶|コーヒー|カフェ|スイーツ|甘い/,
      boost: { cafe: 28, french: 4 } },
    { id: 'drink', label: 'お酒を飲みたい', note: '居酒屋・バーを優先（20歳以上のみ）',
      re: /飲み|お酒|ビール|一杯|乾杯|打ち上げ|飲み会|ハイボール|ワイン|晩酌|二次会/,
      alcohol: 26, boost: { yakiniku: 8 } },
    { id: 'spicy', label: '辛いものが食べたい', note: '中華・ラーメンなどを優先',
      re: /辛い|からい|辛|スパイシー|麻婆|担々|激辛|カレー/,
      boost: { chinese: 22, ramen: 8 } },
    { id: 'cold', label: '温まりたい', note: 'ラーメン・うどん・中華を優先',
      re: /寒い|さむい|温まり|あったまり|あたたまり|冷え/,
      boost: { ramen: 18, udon: 16, chinese: 8 } },
    { id: 'hot', label: '涼しくさっぱり', note: 'うどん・そば・カフェ・寿司を優先',
      re: /暑い|あつい|冷たい|冷や|冷麺|蒸し暑/,
      boost: { udon: 14, cafe: 10, sushi: 8 } },
    { id: 'usual', label: 'いつも通り', note: 'バランスよく表示',
      re: /いつも|普通|ふつう|通常|おまかせ|お任せ|なんでも|何でも|適当|特になし|バランス|ふだん|普段/ },
  ];

  function interpretMood(text, opts = {}) {
    const t = String(text || '').normalize('NFKC');      // 全角・半角のゆれをそろえる
    const matched = INTENTS.filter(i => i.re.test(t));
    if (opts.birthday && !matched.some(i => i.id === 'celebrate')) {
      matched.push({ ...INTENTS.find(i => i.id === 'celebrate'), label: 'お誕生日' });
    }
    const priceBias = clamp(matched.reduce((a, i) => a + (i.price || 0), 0), -2, 2);
    return { text: t, matched, priceBias };
  }

  // ---------- 並べ替えに使う情報 ----------
  // プロフィールと「今の気分」（お店を探す画面で入力）のどちらか一方だけでも並べ替えに使う。両方なければ null
  function buildContext(profile, moodText, now = new Date()) {
    const hasProfile = !!(profile && profile.name);
    const text = String(moodText || '').trim().slice(0, 60);
    if (!hasProfile && !text) return null;
    const p = hasProfile ? profile : clean({});
    const age = ageOf(p.birthday, now);
    const birthdayToday = isBirthday(p.birthday, now);
    return {
      profile: p, hasProfile, moodText: text, age, birthdayToday,
      adultOnly: age !== null && age < 20,               // 20歳未満はお酒中心のお店を出さない
      budget: BUDGETS.find(b => b.id === p.budget) || null,
      mood: interpretMood(text, { birthday: birthdayToday }),
    };
  }

  // お店 p に、プロフィールに合わせた点数・理由・価格の目安を付ける（ctx が null なら元の点数のまま）
  function personalize(p, ctx) {
    const genres = genresOf(p);
    const price = estimatePrice(p, genres);
    p.reasons = [];
    p.hidden = false;
    p.priceLabel = price ? '目安 ' + priceBandLabel(price) : null;
    if (!ctx) { p.score = p.baseScore; return p; }

    if (ctx.adultOnly && isAlcohol(p)) p.hidden = true;
    let s = p.baseScore;

    // 特別な日など「お高めを選びたい」気分のときは、普段の好みやごはん代より気分を優先する
    const bias = ctx.mood.priceBias;

    // 好きなジャンル
    const fav = ctx.profile.genres.filter(g => genres.has(g));
    if (fav.length) { s += bias > 0 ? 18 : 30; p.reasons.push('好きなジャンル：' + labelOf(fav[0])); }

    // 気分（当てはまった言葉ごとに加点・減点。ジャンルが複数ある店は最も効くものを採用）。普段の好みより強く効かせる
    let moodPts = 0, topIntent = null, topPts = 0;
    for (const it of ctx.mood.matched) {
      let pts = Math.max(0, ...[...genres].map(g => (it.boost && it.boost[g]) || 0));
      pts += Math.min(0, ...[...genres].map(g => (it.penalty && it.penalty[g]) || 0));
      if (it.alcohol && isAlcohol(p)) pts += it.alcohol;
      moodPts += pts;
      if (pts > topPts) { topPts = pts; topIntent = it; }
    }
    s += clamp(moodPts * MOOD_WEIGHT, -45, 60);
    p.moodIntent = topIntent && topPts >= 12 ? topIntent : null;   // 一言の文言（catchCopy）でも使う
    if (p.moodIntent) p.reasons.push('気分に合う：' + topIntent.label);

    // ごはん代と、気分による価格の傾向
    if (price) {
      if (bias > 0) {
        // 特別な日：ごはん代の上限は気にせず、お高めを優先。手頃すぎるお店は下げる
        if (price >= 2000) s += 12 * bias;
        else if (price < 1500) s -= 25 * bias;
      } else {
        const cap = ctx.budget ? ctx.budget.cap : Infinity;
        if (isFinite(cap)) {
          const ratio = price / cap;
          if (ratio <= 1) { s += 12; p.reasons.push('予算に合いそう（目安）'); }
          else if (ratio > 2) s -= 35;
          else if (ratio > 1.3) s -= 15;
        }
        if (bias < 0) { if (price <= 1000) s += 8 * -bias; else if (price > 1500) s -= 8 * -bias; }
      }
    }
    p.score = s;
    return p;
  }

  // ---------- 一言の文言（上位のお店だけに付ける） ----------
  // 書くのは、データで確かめられること（営業時間）と、場面の提案（「〇〇のときに」）だけ。
  // お店の味・メニュー・評判は、今のデータにないので書かない（「たまらない」「いちおし」などの断定はしない）。
  const SCENE_COPY = {
    alcohol:  ['仕事帰りの一杯に', '仲間と軽く飲みたい日に'],
    yakiniku: ['がっつり肉を食べたい日に', '仲間とわいわい楽しみたいときに'],
    sushi:    ['ちょっといいものを食べたい日に', 'お祝いやおもてなしの候補に'],
    french:   ['ちょっと特別な日のごちそうに', '記念日やお祝いの候補に'],
    ramen:    ['がっつり満腹になりたい日に', 'しっかり食べて元気を出したい日に'],
    udon:     ['あっさり軽めに済ませたい日に', '胃にやさしく食べたい日に'],
    gyudon:   ['時間がない日でも、サクッと満腹に', '手早く済ませたいときに'],
    chinese:  ['みんなでシェアして楽しみたいときに', 'ボリュームもしっかり、の気分に'],
    italian:  ['友人や家族とシェアして楽しみたいときに', 'ちょっと気分を上げたいときに'],
    fastfood: ['さっと済ませたいときに', '隙間時間にぱっと立ち寄りたいときに'],
    cafe:     ['ひと息つきたいときに', '待ち合わせや作業のお供に'],
  };
  const SCENE_ORDER = ['alcohol', 'yakiniku', 'sushi', 'french', 'ramen', 'udon', 'gyudon', 'chinese', 'italian', 'fastfood', 'cafe'];
  const MOOD_COPY = {
    quick: '早く済ませたい今日にぴったり', celebrate: '特別な日の食事の候補に', cheap: 'お財布にやさしく済ませたい日に',
    light: 'あっさり軽めの気分に', hearty: 'がっつり食べたい気分に', relax: 'ゆっくり過ごしたい気分に',
    drink: '一杯飲みたい気分に', spicy: '辛いものが食べたい気分に', cold: '温まりたい日に', hot: '涼しくさっぱり食べたい日に',
  };
  const hashOf = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  function fmtClock(d) {
    const h = d.getHours(), m = d.getMinutes(), mm = String(m).padStart(2, '0');
    if (h === 0 && m === 0) return '24時';
    const base = h < 5 ? `深夜${h}` : String(h);
    return m ? `${base}:${mm}` : `${base}時`;
  }
  // 営業時間から言えること：営業中なら「〇時まで営業」、まだ開いていない（今日開く）なら「〇時から営業」
  function timeFact(p, now) {
    const next = p.nextChange;
    if (!(next instanceof Date) || isNaN(next)) return '';
    if (p.open === true && next - now < 20 * 3600 * 1000) return `${fmtClock(next)}まで営業`;
    if (p.open === false && next.toDateString() === now.toDateString()) return `${fmtClock(next)}から営業`;
    return '';
  }
  // 戻り値：{ text, kind: 'mood' | 'scene' }。書けることがなければ null
  function catchCopy(p, ctx, now = new Date()) {
    let phrase = '', kind = 'scene';
    if (ctx && p.moodIntent && MOOD_COPY[p.moodIntent.id]) {
      kind = 'mood';
      phrase = p.moodIntent.label === 'お誕生日' ? 'お誕生日のお祝いの候補に' : MOOD_COPY[p.moodIntent.id];
    } else {
      const genres = genresOf(p);
      const key = SCENE_ORDER.find(k => (k === 'alcohol' ? isAlcohol(p) : genres.has(k)));
      if (key) phrase = SCENE_COPY[key][hashOf(p.id) % SCENE_COPY[key].length];   // 同じお店には、いつも同じ文言（開くたびに変わらない）
    }
    const text = [timeFact(p, now), phrase].filter(Boolean).join('。');
    return text ? { text, kind } : null;
  }

  window.GohanProfile = {
    CATEGORIES, BUDGETS, MOOD_EXAMPLES,
    load, save, clear, ageOf, isBirthday, interpretMood, buildContext, personalize, labelOf, catchCopy,
  };
})();
