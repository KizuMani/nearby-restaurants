'use strict';

// ---------- 誕生日のお祝い（クラッカー） ----------
// 誕生日当日の、その日はじめての表示のときだけ、画面の左右下から紙ふぶきを飛ばして、お祝いのひとことを出す。
// 「その日に見せた」という日付だけをこの端末に残す（外部には送らない）。
// 画面の動きを減らす設定の端末では、何も出さない。
window.GohanCelebrate = (() => {
  const KEY = 'nearbyGohan.partyShown.v1';
  const COLORS = ['#c9441f', '#e4572e', '#f5a96a', '#ffc531', '#f2c14e', '#f08a6b', '#ffd98a'];   // 街のイラストと同じ暖色系
  const GRAVITY = 520, DRAG = 3;       // px/s²・1/s。軽い紙がゆっくり落ちる感じ
  const LIFE = 5, FADE = 0.8;          // 全体の長さと、最後に消えていく時間（秒）
  const WAVES = [{ at: 0, n: 46 }, { at: 0.5, n: 34 }];   // 1回目と、少し遅れた2回目（左右それぞれの数）
  let shownInMemory = '';               // 端末に保存できないときの代わり（その画面を開いている間だけ）
  let playing = false;

  const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const alreadyShown = day => {
    if (shownInMemory === day) return true;
    try { return localStorage.getItem(KEY) === day; } catch { return false; }
  };
  const markShown = day => {
    shownInMemory = day;
    try { localStorage.setItem(KEY, day); } catch { /* 保存できなくても動く */ }
  };
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);

  // 紙ふぶきの動き（キャンバスに描く）
  function confetti(done) {
    const canvas = document.createElement('canvas');
    canvas.className = 'party-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const c = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    document.body.append(canvas);

    const pieces = [];
    const shoot = (fromRight, n) => {
      for (let i = 0; i < n; i++) {
        const tilt = rand(10, 42) * Math.PI / 180;          // 真上から、内側へ傾ける角度
        const v = h * rand(1.4, 2.8);                       // 打ち上げの速さ（画面の高さに合わせる）
        const size = rand(6, 12);
        pieces.push({
          x: fromRight ? w - 6 : 6, y: h * 0.9,
          vx: (fromRight ? -1 : 1) * Math.sin(tilt) * v, vy: -Math.cos(tilt) * v,
          size, thin: size * rand(0.45, 0.7), round: Math.random() < 0.28,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          rot: rand(0, 6.28), spin: rand(-9, 9), flip: rand(0, 6.28), flipSpeed: rand(5, 12),
          sway: rand(10, 40), swayF: rand(2, 5), phase: rand(0, 6.28),
        });
      }
    };

    let t = 0, last = performance.now(), wave = 0;
    const frame = now => {
      const dt = Math.max(0, Math.min((now - last) / 1000, 1 / 30));   // 止まっていたあとで急に飛ばず、時間が戻ることもない
      last = now; t += dt;
      while (wave < WAVES.length && t >= WAVES[wave].at) { shoot(false, WAVES[wave].n); shoot(true, WAVES[wave].n); wave++; }
      c.clearRect(0, 0, w, h);
      const alpha = t > LIFE - FADE ? Math.max(0, (LIFE - t) / FADE) : 1;
      const drag = Math.exp(-DRAG * dt);
      for (const p of pieces) {
        p.vx *= drag; p.vy = p.vy * drag + GRAVITY * dt;
        p.x += (p.vx + Math.sin(t * p.swayF + p.phase) * p.sway) * dt; p.y += p.vy * dt;
        p.rot += p.spin * dt; p.flip += p.flipSpeed * dt;
        if (p.y > h + 20) continue;
        c.save();
        c.globalAlpha = alpha;
        c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.cos(p.flip));   // ひらひら裏返る
        c.fillStyle = p.color;
        if (p.round) { c.beginPath(); c.arc(0, 0, p.size * 0.35, 0, 6.28); c.fill(); }
        else c.fillRect(-p.size / 2, -p.thin / 2, p.size, p.thin);
        c.restore();
      }
      if (t < LIFE) requestAnimationFrame(frame);
      else { canvas.remove(); done(); }
    };
    requestAnimationFrame(frame);
  }

  // お祝いのひとこと（しばらくして自然に消える）
  function toast(name) {
    const el = document.createElement('div');
    el.className = 'party-toast';
    el.setAttribute('role', 'status');
    el.textContent = (name ? `${name}さん、` : '') + 'お誕生日おめでとうございます！';   // 名前は textContent で入れる
    document.body.append(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 600); }, 4200);
  }

  // 画面が見えているときに始める（別のタブで開かれた場合は、見えるようになってから）
  const whenVisible = fn => {
    if (document.visibilityState === 'visible') fn();
    else document.addEventListener('visibilitychange', function once() {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', once); fn();
    });
  };

  // force: その日に見せたかどうかを見ずに出す（動作確認用）
  function birthday(name, { force = false } = {}) {
    if (playing || reduced()) return;
    const day = dayKey();
    if (!force) {
      if (alreadyShown(day)) return;
      markShown(day);
    }
    playing = true;
    whenVisible(() => setTimeout(() => { toast(name); confetti(() => { playing = false; }); }, 400));
  }

  return { birthday };
})();
