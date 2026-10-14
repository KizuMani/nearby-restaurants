'use strict';

// ---------- 上部の街のイラスト（アイソメ図をその場で描画） ----------
function buildTown(opts = {}) {
  const U = 40, A = U * 0.866, B = U * 0.5, OX = 450, OY = 100;
  const P = (x, y, z = 0) => [OX + (x - y) * A, OY + (x + y) * B - z * U];   // 格子座標 → 画面座標
  const f = n => Math.round(n * 10) / 10;
  const pts = a => a.map(p => f(p[0]) + ',' + f(p[1])).join(' ');
  const poly = (a, fill, extra = '') => `<polygon points="${pts(a)}" fill="${fill}" stroke="${fill}" stroke-width=".7" stroke-linejoin="round" ${extra}/>`;
  const soft = (a, fill, r) => `<polygon points="${pts(a)}" fill="${fill}" stroke="${fill}" stroke-width="${r}" stroke-linejoin="round"/>`;
  const rect = (x1, y1, x2, y2) => [P(x1, y1), P(x2, y1), P(x2, y2), P(x1, y2)];

  const items = [];
  let g0 = -1000;
  const ground = s => items.push({ d: g0++, s });
  const add = (d, s) => items.push({ d, s });

  const W = { top: '#fffaf0', left: '#fdebd0', right: '#f4d3a8' };          // 壁
  const GLASS_L = '#bfe0ea', GLASS_R = '#a3cddb', WOOD = '#b9805a';
  const SHADOW = '#a8742c';

  // 立方体：左面（+y側）・右面（+x側）・上面
  const box = (x, y, w, d, h, c, z0 = 0, noTop = false) => {
    const t = [P(x, y, z0 + h), P(x + w, y, z0 + h), P(x + w, y + d, z0 + h), P(x, y + d, z0 + h)];
    const l = [P(x, y + d, z0 + h), P(x + w, y + d, z0 + h), P(x + w, y + d, z0), P(x, y + d, z0)];
    const r = [P(x + w, y, z0 + h), P(x + w, y + d, z0 + h), P(x + w, y + d, z0), P(x + w, y, z0)];
    return poly(l, c.left) + poly(r, c.right) + (noTop ? '' : poly(t, c.top));
  };
  const shadow = (x, y, w, d) => poly([P(x, y), P(x + w + .7, y), P(x + w + .7, y + d + .7), P(x, y + d + .7)], SHADOW, 'opacity=".18"');
  const winL = (x1, x2, yy, z1, z2, fill = GLASS_L) => poly([P(x1, yy, z2), P(x2, yy, z2), P(x2, yy, z1), P(x1, yy, z1)], fill);
  const winR = (xx, y1, y2, z1, z2, fill = GLASS_R) => poly([P(xx, y1, z2), P(xx, y2, z2), P(xx, y2, z1), P(xx, y1, z1)], fill);

  // 切妻屋根の家（棟がx方向）
  const house = (x, y, w, d, h, rh, roof) => {
    const ym = y + d / 2, oh = .15, ov = .12;
    const l = [P(x, y + d, h), P(x + w, y + d, h), P(x + w, y + d, 0), P(x, y + d, 0)];
    const r = [P(x + w, y, h), P(x + w, y + d, h), P(x + w, y + d, 0), P(x + w, y, 0)];
    return shadow(x, y, w, d)
      + poly(l, W.left) + poly(r, W.right)
      + poly([P(x - oh, y - ov, h), P(x + w + oh, y - ov, h), P(x + w + oh, ym, h + rh), P(x - oh, ym, h + rh)], roof.back)
      + poly([P(x + w, y, h), P(x + w, y + d, h), P(x + w, ym, h + rh)], W.right)
      + poly([P(x - oh, ym, h + rh), P(x + w + oh, ym, h + rh), P(x + w + oh, y + d + ov, h), P(x - oh, y + d + ov, h)], roof.front)
      + winL(x + .25, x + .75, y + d, .3, .85) + winL(x + w - .75, x + w - .25, y + d, .3, .85)
      + poly([P(x + w * .42, y + d, 0), P(x + w * .58, y + d, 0), P(x + w * .58, y + d, .8), P(x + w * .42, y + d, .8)], WOOD)
      + winR(x + w, y + d * .3, y + d * .7, .3, .8);
  };

  // 木・植物・人など（木は秋のようなオレンジ・黄・赤の3色）
  const LEAF = [['#e0782f', '#f08f45', '#f8b46a'], ['#e0a82c', '#f0c443', '#f8dd7f'], ['#cf4a30', '#e1643f', '#ef8e6b']];
  const tree = (x, y, s = 1, k = 0) => {
    const [px, py] = P(x, y), p = LEAF[k % 3];
    const c = (cx, cy, r, fill) => `<circle cx="${f(px + cx * s)}" cy="${f(py + cy * s)}" r="${f(r * s)}" fill="${fill}"/>`;
    return `<ellipse cx="${f(px)}" cy="${f(py + 2)}" rx="${f(18 * s)}" ry="${f(7 * s)}" fill="${SHADOW}" opacity=".22"/>`
      + `<rect x="${f(px - 2.5 * s)}" y="${f(py - 14 * s)}" width="${f(5 * s)}" height="${f(14 * s)}" rx="2" fill="#8b6a4c"/>`
      + c(-10, -26, 13, p[0]) + c(11, -27, 12, p[0]) + c(0, -36, 14, p[0])
      + c(-3, -24, 13, p[1]) + c(-6, -37, 8, p[2]);
  };
  const pine = (x, y, s = 1) => {
    const [px, py] = P(x, y);
    const tri = (w, top, bot, fill) => `<polygon points="${f(px - w * s)},${f(py - bot * s)} ${f(px + w * s)},${f(py - bot * s)} ${f(px)},${f(py - top * s)}" fill="${fill}" stroke="${fill}" stroke-width="5" stroke-linejoin="round"/>`;
    return `<ellipse cx="${f(px)}" cy="${f(py + 2)}" rx="${f(14 * s)}" ry="${f(5.5 * s)}" fill="${SHADOW}" opacity=".22"/>`
      + `<rect x="${f(px - 2 * s)}" y="${f(py - 12 * s)}" width="${f(4 * s)}" height="${f(12 * s)}" fill="#8b6a4c"/>`
      + tri(15, 36, 11, '#eab03a') + tri(11, 54, 28, '#f7cf63');
  };
  const person = (x, y, shirt, hair, s = 1.25) => {
    const [px, py] = P(x, y);
    return `<ellipse cx="${f(px)}" cy="${f(py + 1)}" rx="${f(7 * s)}" ry="${f(2.6 * s)}" fill="${SHADOW}" opacity=".25"/>`
      + `<rect x="${f(px - 3.6 * s)}" y="${f(py - 9 * s)}" width="${f(2.8 * s)}" height="${f(9 * s)}" rx="1.2" fill="#6b5a66"/>`
      + `<rect x="${f(px + .8 * s)}" y="${f(py - 9 * s)}" width="${f(2.8 * s)}" height="${f(9 * s)}" rx="1.2" fill="#574858"/>`
      + `<rect x="${f(px - 5 * s)}" y="${f(py - 22 * s)}" width="${f(10 * s)}" height="${f(14 * s)}" rx="${f(4 * s)}" fill="${shirt}"/>`
      + `<circle cx="${f(px)}" cy="${f(py - 27 * s)}" r="${f(4.6 * s)}" fill="#ffdcb8"/>`
      + `<path d="M${f(px - 4.9 * s)},${f(py - 27.4 * s)} A${f(4.9 * s)},${f(4.9 * s)} 0 0 1 ${f(px + 4.9 * s)},${f(py - 27.4 * s)} Z" fill="${hair}"/>`;
  };
  const dog = (x, y) => {
    const [px, py] = P(x, y);
    return `<ellipse cx="${f(px)}" cy="${f(py - 6)}" rx="7.5" ry="4.2" fill="#a8744a"/><circle cx="${f(px + 7.5)}" cy="${f(py - 10)}" r="3.4" fill="#a8744a"/>`
      + `<rect x="${f(px - 5.5)}" y="${f(py - 4)}" width="2" height="4.5" fill="#8d5f3a"/><rect x="${f(px + 3)}" y="${f(py - 4)}" width="2" height="4.5" fill="#8d5f3a"/>`;
  };
  const lamp = (x, y) => {
    const [px, py] = P(x, y);
    return `<line x1="${f(px)}" y1="${f(py)}" x2="${f(px)}" y2="${f(py - 36)}" stroke="#9b7a5a" stroke-width="3" stroke-linecap="round"/>`
      + `<circle cx="${f(px)}" cy="${f(py - 39)}" r="4.6" fill="#ffefb0" stroke="#9b7a5a" stroke-width="2"/>`;
  };
  const pole = (x, y) => {
    const a = P(x, y), b = P(x, y, 2.5);
    return `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="#d8c3a5" stroke-width="3.4" stroke-linecap="round"/>`
      + `<line x1="${f(b[0] - 10)}" y1="${f(b[1] + 3)}" x2="${f(b[0] + 10)}" y2="${f(b[1] - 3)}" stroke="#d8c3a5" stroke-width="2.8" stroke-linecap="round"/>`;
  };
  const wire = (p, q) => {
    const a = P(p[0], p[1], 2.5), b = P(q[0], q[1], 2.5), sag = 10;
    return [-4, 4].map(o => `<path d="M${f(a[0] + o)},${f(a[1] + o * .4)} Q${f((a[0] + b[0]) / 2)},${f((a[1] + b[1]) / 2 + sag)} ${f(b[0] + o)},${f(b[1] + o * .4)}" fill="none" stroke="#d9553b" stroke-width="1.7" opacity=".95"/>`).join('');
  };
  const parasol = (x, y, color) => {
    const [px, py] = P(x, y);
    return `<ellipse cx="${f(px)}" cy="${f(py)}" rx="11" ry="5" fill="#fff"/>`
      + `<line x1="${f(px)}" y1="${f(py)}" x2="${f(px)}" y2="${f(py - 28)}" stroke="#9b7a5a" stroke-width="2.2"/>`
      + `<path d="M${f(px - 20)},${f(py - 27)} Q${f(px)},${f(py - 44)} ${f(px + 20)},${f(py - 27)} Z" fill="${color}"/>`;
  };
  const car = (x, y, c) => {                      // x方向に走る車
    const [w1x, w1y] = P(x + .3, y + .62, .1), [w2x, w2y] = P(x + 1.0, y + .62, .1);
    return shadow(x, y, 1.3, .62) + box(x, y, 1.3, .62, .3, c, .1) + box(x + .3, y + .04, .65, .54, .26, c, .4)
      + winL(x + .34, x + .9, y + .58, .44, .62, '#d3ecf3') + winR(x + .95, y + .1, y + .5, .44, .62, '#a9d2df')
      + `<ellipse cx="${f(w1x)}" cy="${f(w1y)}" rx="5" ry="5.6" fill="#4a3a3a"/><ellipse cx="${f(w2x)}" cy="${f(w2y)}" rx="5" ry="5.6" fill="#4a3a3a"/>`;
  };
  const truck = (x, y) => {                       // y方向に走る配達トラック
    const cabc = { top: '#f9b75f', left: '#f09a3a', right: '#d8842a' };
    const [a1x, a1y] = P(x + .7, y + .35, .1), [a2x, a2y] = P(x + .7, y + 1.25, .1);
    return shadow(x, y, .7, 1.55) + box(x, y, .7, 1.1, .8, W, .1) + box(x, y + 1.1, .7, .45, .52, cabc, .1)
      + winL(x + .08, x + .62, y + 1.55, .32, .52, '#d3ecf3') + winR(x + .7, y + 1.15, y + 1.5, .32, .5, '#bfe0ea')
      + `<ellipse cx="${f(a1x)}" cy="${f(a1y)}" rx="5" ry="5.6" fill="#4a3a3a"/><ellipse cx="${f(a2x)}" cy="${f(a2y)}" rx="5" ry="5.6" fill="#4a3a3a"/>`;
  };
  const awning = (x, y, n, sw, c1, c2) => {         // 縞のひさし
    let s = '';
    for (let i = 0; i < n; i++) s += box(x + i * sw, y, sw, .38, .16, i % 2 ? c2 : c1, 1.22);
    return s;
  };
  const RED_STRIPE = { top: '#ee7a5c', left: '#d9553b', right: '#bf452d' };
  const CREAM_STRIPE = { top: '#fffaf0', left: '#f6ecd6', right: '#e8dabc' };
  const YELLOW_STRIPE = { top: '#ffd45e', left: '#f4b92e', right: '#dca020' };
  const blob = (cx, cy, R, seed) => {
    const a = [];
    for (let i = 0; i < 30; i++) {
      const t = i / 30 * Math.PI * 2, r = R * (1 + .16 * Math.sin(3 * t + seed) + .09 * Math.sin(5 * t + seed * 2));
      a.push(P(cx + r * Math.cos(t), cy + r * Math.sin(t)));
    }
    return a;
  };

  // ===== 地面・道路・池 =====
  ground(`<rect x="-400" y="-400" width="1800" height="1800" fill="#f8dfae"/>`);
  ground(soft(rect(.4, .4, 3.6, 3.6), '#fdeccb', 16));
  ground(soft(rect(5.6, .4, 9.8, 3.6), '#fdeccb', 16));
  ground(soft(rect(.4, 5.5, 3.6, 9.6), '#fbd7bd', 16));
  ground(soft(rect(5.5, 5.5, 8.5, 8.4), '#fbd7bd', 16));
  ground(soft(rect(8.9, 5.5, 11, 9.6), '#fdeccb', 16));
  ground(poly(rect(-3, 3.75, 14, 5.25), '#f1d9a8'));
  ground(poly(rect(3.75, -3, 5.25, 14), '#f1d9a8'));
  ground(poly(rect(-3, 3.9, 14, 5.1), '#fff7e8'));
  ground(poly(rect(3.9, -3, 5.1, 14), '#fff7e8'));
  const dash = (a, b) => `<polyline points="${pts([a, b])}" fill="none" stroke="#f1d9a8" stroke-width="2.4" stroke-dasharray="9 9"/>`;
  ground(dash(P(-3, 4.5), P(3.6, 4.5)) + dash(P(5.4, 4.5), P(14, 4.5)) + dash(P(4.5, -3), P(4.5, 3.6)) + dash(P(4.5, 5.4), P(4.5, 14)));
  ground(soft(blob(1.9, 1.9, 1.15, 1), '#a9dbe6', 10));
  ground(poly(blob(1.7, 1.75, .6, 2), '#c8eaf1'));

  // ===== レストラン（中央） =====
  const R = { x: 5.4, y: 5.4, w: 2.2, d: 2.0, h: 1.7 };
  const RC = { top: '#c9441f', left: '#fff1dc', right: '#f6d9b0' };
  add(R.x + R.w / 2 + R.y + R.d / 2,
    shadow(R.x, R.y, R.w, R.d) + box(R.x, R.y, R.w, R.d, R.h, RC)
    + poly([P(R.x + .18, R.y + .18, R.h), P(R.x + R.w - .18, R.y + .18, R.h), P(R.x + R.w - .18, R.y + R.d - .18, R.h), P(R.x + .18, R.y + R.d - .18, R.h)], '#e8704f')
    + winL(R.x + .2, R.x + 1.0, R.y + R.d, .45, 1.2) + winL(R.x + 1.75, R.x + 2.05, R.y + R.d, .45, 1.2)
    + poly([P(R.x + 1.2, R.y + R.d, 0), P(R.x + 1.62, R.y + R.d, 0), P(R.x + 1.62, R.y + R.d, 1.05), P(R.x + 1.2, R.y + R.d, 1.05)], WOOD)
    + winR(R.x + R.w, R.y + .25, R.y + .85, .55, 1.25) + winR(R.x + R.w, R.y + 1.1, R.y + 1.7, .55, 1.25)
    + awning(R.x + .1, R.y + R.d, 6, .33, RED_STRIPE, CREAM_STRIPE)
    + box(7.0, 5.7, .35, .35, .6, W, R.h));
  const [sx, sy] = P(7.18, 5.88, R.h + .6);
  add(12.8, `<circle cx="${f(sx)}" cy="${f(sy - 10)}" r="7" fill="#fff" opacity=".9"/><circle cx="${f(sx + 7)}" cy="${f(sy - 22)}" r="9" fill="#fff" opacity=".8"/><circle cx="${f(sx + 2)}" cy="${f(sy - 36)}" r="6" fill="#fff" opacity=".7"/>`);

  // ===== カフェ（左） =====
  const CF = { x: .7, y: 5.9, w: 2.3, d: 2.0, h: 1.35 };
  const CC = { top: '#f29a3f', left: W.left, right: W.right };
  add(CF.x + CF.w / 2 + CF.y + CF.d / 2,
    shadow(CF.x, CF.y, CF.w, CF.d) + box(CF.x, CF.y, CF.w, CF.d, CF.h, CC)
    + poly([P(CF.x + .18, CF.y + .18, CF.h), P(CF.x + CF.w - .18, CF.y + .18, CF.h), P(CF.x + CF.w - .18, CF.y + CF.d - .18, CF.h), P(CF.x + .18, CF.y + CF.d - .18, CF.h)], '#f9bd6a')
    + winL(CF.x + .2, CF.x + 1.0, CF.y + CF.d, .4, 1.05) + winL(CF.x + 1.5, CF.x + 2.1, CF.y + CF.d, .4, 1.05)
    + winR(CF.x + CF.w, CF.y + .3, CF.y + .9, .45, 1.05) + winR(CF.x + CF.w, CF.y + 1.15, CF.y + 1.7, .45, 1.05)
    + awning(CF.x + .1, CF.y + CF.d, 6, .33, YELLOW_STRIPE, CREAM_STRIPE));
  add(9.4, parasol(1.3, 8.6, '#ffd45e') + parasol(2.7, 8.8, '#f08a6b'));

  // ===== 家（右奥） =====
  const roofR = { back: '#ee8a62', front: '#d9553b' }, roofY = { back: '#fbd070', front: '#f2ac3a' };
  add(5.7 + .95 + .7 + .8, house(5.7, .7, 1.9, 1.6, 1.2, .9, roofR));
  add(7.7 + .95 + 1.3 + .8, house(7.7, 1.3, 1.9, 1.6, 1.2, .9, roofY));
  add(6.2 + .9 + 2.6 + .55, house(6.2, 2.6, 1.8, 1.1, 1.0, .8, roofR));

  // ===== 木々 =====
  [[.6, .8, 1, 0], [3.4, .6, 1, 1], [.6, 3.2, 1, 2], [3.3, 3.3, 1, 0], [9.3, .6, 1, 1], [9.3, 3.2, .9, 0], [3.4, 8.4, 1, 1], [.5, 5.1, .9, 2], [9.2, 6.3, 1, 0], [8.4, 8.6, 1, 2]]
    .forEach(([x, y, s, k]) => add(x + y, tree(x, y, s * 1.1, k)));
  [[2.3, .4], [.5, 2.0], [3.5, 2.0, .9], [5.6, 8.5], [9.5, 8.0], [10.2, 4.5, .9], [3.3, 9.5]].forEach(([x, y, s]) => add(x + y, pine(x, y, s || 1)));

  // ===== 乗り物 =====
  add(6.4 + .65 + 4.2 + .31, car(6.4, 4.2, { top: '#f58a6b', left: '#e0583a', right: '#c64529' }));
  add(.4 + .65 + 4.2 + .31, car(.4, 4.2, { top: '#ffe083', left: '#f6c244', right: '#dea62e' }));
  add(4.2 + .35 + 8.2 + .78, truck(4.2, 7.4));

  // ===== 街灯・電柱・ベンチ・人 =====
  add(7.4, lamp(3.7, 3.7)); add(8.6, lamp(5.3, 3.3)); add(9, lamp(3.7, 5.3));
  add(1.2 + 3.78, pole(1.2, 3.78)); add(5.6 + 3.78, pole(5.6, 3.78)); add(9.4 + 3.78, pole(9.4, 3.78));
  add(5.6 + 3.78 + .5, wire([1.2, 3.78], [5.6, 3.78]) + wire([5.6, 3.78], [9.4, 3.78]));
  add(3.1 + .1 + 1.6 + .45, box(3.1, 1.6, .25, .9, .22, { top: '#e8c68e', left: '#c9a56b', right: '#b48e55' }));
  add(6.55 + 7.95 + .2, person(6.55, 7.95, '#e9704a', '#3b2a20'));
  add(2.3 + 4.6 + .2, person(2.3, 4.62, '#4f8fae', '#5b3a29'));
  add(2.9 + 4.4 + .2, person(2.9, 4.42, '#f2c14e', '#2f2a26'));
  add(3.3 + 2.2 + .2, person(3.35, 2.25, '#e9704a', '#b8602a'));
  add(1.3 + 8.9 + .2, person(1.3, 8.95, '#f2c14e', '#5b3a29'));
  add(7.0 + 3.55 + .2, person(7.0, 3.6, '#4f8fae', '#b8602a') + dog(7.55, 3.65));

  // ===== 地図ピン・鳥（常に前面） =====
  const [px, py] = P(6.5, 6.4, R.h);
  add(1e4, `<ellipse cx="${f(px)}" cy="${f(py - 2)}" rx="16" ry="6" fill="#8a3b0a" opacity=".25"/>`
    + `<g transform="translate(${f(px)},${f(py - 16)})"><g class="bob"><path d="M0,0 C-5,-12 -24,-26 -24,-46 A24,24 0 1 1 24,-46 C24,-26 5,-12 0,0 Z" fill="#c9441f"/><circle cx="0" cy="-46" r="10" fill="#fff"/><circle cx="0" cy="-46" r="4.4" fill="#ffc531"/></g></g>`);
  const bird = (x, y) => `<path d="M0,0 q4.5,-6 9,0 q4.5,-6 9,0" transform="translate(${x},${y})" stroke="#fffdf6" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  add(1e4 + 1, bird(575, 190) + bird(600, 172) + bird(330, 200) + bird(655, 235));

  items.sort((a, b) => a.d - b.d);
  const vb = opts.crop ? '130 170 640 280' : '130 120 640 380';
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${items.map(i => i.s).join('')}</svg>`;
}
document.querySelectorAll('[data-scene]').forEach(el => {
  try { el.innerHTML = buildTown({ crop: el.dataset.scene === 'banner' }); } catch (e) { console.warn('イラストを描画できませんでした', e); }
});
