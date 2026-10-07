// Sky-Watcher 極軸望遠鏡レチクルの SVG 描画

const SVG_NS = "http://www.w3.org/2000/svg";

// Sky-Watcher レチクルの 3 重円 (基準年と北極星の極距離 [deg])
export const YEAR_CIRCLES = [
  { year: 2012, r: 0.681 },
  { year: 2020, r: 0.65 },
  { year: 2028, r: 0.616 },
];

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

function text(parent, x, y, str, attrs = {}) {
  const t = el("text", { x, y, "text-anchor": "middle", "dominant-baseline": "central", ...attrs }, parent);
  t.textContent = str;
  return t;
}

/** 時計の読み (0〜12, 真上から時計回り) を SVG 座標の単位ベクトルに */
function clockDir(h) {
  const a = (h / 12) * 2 * Math.PI;
  return [Math.sin(a), -Math.cos(a)];
}

/**
 * メインのレチクル図を描画する。
 * @param {SVGSVGElement} svg
 * @param {object} p
 * @param {boolean} p.southern
 * @param {Array<{label:string, x:number, y:number, mag:number, primary?:boolean}>} p.stars 視野内座標 (deg, y 上向き)
 */
export function drawReticle(svg, { southern, stars }) {
  svg.replaceChildren();
  const size = 100;
  svg.setAttribute("viewBox", `${-size} ${-size} ${size * 2} ${size * 2}`);

  const fov = southern ? 4.6 : 0.95; // 視野半径 [deg]
  const scale = 92 / fov;

  const defs = el("defs", {}, svg);
  const glow = el("radialGradient", { id: "star-glow" }, defs);
  el("stop", { offset: "0%", "stop-color": "var(--star)", "stop-opacity": "1" }, glow);
  el("stop", { offset: "35%", "stop-color": "var(--star)", "stop-opacity": "0.55" }, glow);
  el("stop", { offset: "100%", "stop-color": "var(--star)", "stop-opacity": "0" }, glow);
  const clip = el("clipPath", { id: "fov-clip" }, defs);
  el("circle", { r: 92 }, clip);

  el("circle", { r: 95, class: "fov-bg" }, svg);
  const g = el("g", { "clip-path": "url(#fov-clip)" }, svg);

  // 十字線
  const gap = 3;
  for (const [x1, y1, x2, y2] of [[-92, 0, -gap, 0], [gap, 0, 92, 0], [0, -92, 0, -gap], [0, gap, 0, 92]]) {
    el("line", { x1, y1, x2, y2, class: "reticle-line" }, g);
  }

  // 3 重円と時計目盛り
  const rings = YEAR_CIRCLES.map((c) => c.r * scale);
  const outer = Math.max(...rings);
  const inner = Math.min(...rings);
  for (const r of rings) el("circle", { r, class: "reticle-ring" }, g);
  for (let i = 0; i < 72; i++) {
    const h = i / 6; // 10 分刻み
    const major = i % 6 === 0;
    const half = i % 3 === 0;
    const [dx, dy] = clockDir(h);
    const r1 = inner - (major ? 3.5 : half ? 2 : 0.5);
    const r2 = outer + (major ? 3.5 : half ? 2 : 0.5);
    el("line", { x1: dx * r1, y1: dy * r1, x2: dx * r2, y2: dy * r2, class: major ? "reticle-tick major" : "reticle-tick" }, g);
  }
  const labelR = outer + (southern ? 5 : 9);
  for (let h = 0; h < 12; h++) {
    const [dx, dy] = clockDir(h);
    const big = h % 3 === 0;
    if (southern && !big) continue;
    text(g, dx * labelR, dy * labelR, String(h), { class: big ? "reticle-num big" : "reticle-num" });
  }

  // 星
  for (const s of stars) {
    const x = s.x * scale;
    const y = -s.y * scale;
    const rad = Math.max(1.1, 3.2 - 0.4 * s.mag) * (southern ? 1 : 1.4);
    el("circle", { cx: x, cy: y, r: rad * 3, fill: "url(#star-glow)", class: s.primary ? "star-halo pulse" : "star-halo" }, g);
    el("circle", { cx: x, cy: y, r: rad, class: "star-core" }, g);
    // 基本は外側にラベルを置き、視野の端に近いときは内側へ
    const right = Math.abs(x) > 60 ? x < 0 : x >= 0;
    text(g, x + (right ? 1 : -1) * (rad + 3), y - rad - 3, s.label, { class: "star-label", "text-anchor": right ? "start" : "end" });
  }

  if (southern && stars.length >= 4) {
    // オクタンス座の台形 (σ-χ-υ-τ の順で結ぶ)
    const pts = ["σ Oct", "χ Oct", "υ Oct", "τ Oct"].map((n) => stars.find((s) => s.label === n)).filter(Boolean);
    const d = pts.map((s, i) => `${i ? "L" : "M"}${s.x * scale},${-s.y * scale}`).join(" ") + " Z";
    g.insertBefore(el("path", { d, class: "asterism" }), g.firstChild);
  }

  el("circle", { r: 92, class: "fov-edge" }, svg);

  if (!southern) {
    // 年と使う円の対応 (実機レチクル右側の凡例に相当)。視野外の右上隅に置く
    const legend = ["2012 外円", "2016 外–中", "2020 中円", "2024 中–内", "2028 内円", "2032 内円内"];
    legend.forEach((str, i) => text(svg, 72, -96 + i * 4.8, str, { class: "reticle-legend", "text-anchor": "start" }));
  }
}

/**
 * 主星周辺の拡大図。歳差による極距離の年変化を径方向の目盛りで示す。
 * @param {SVGSVGElement} svg
 * @param {object} p
 * @param {{x:number,y:number,r:number}} p.star 現在の視位置 (deg)
 * @param {Array<{year:number, r:number}>} p.track 年ごとの平均極距離 (deg)
 * @param {boolean} p.showRings Sky-Watcher の 3 重円を描くか
 */
export function drawZoom(svg, { star, track, showRings }) {
  svg.replaceChildren();
  const half = 0.06; // 表示半幅 [deg]
  const scale = 100 / half;
  svg.setAttribute("viewBox", "-100 -100 200 200");

  // 主星を中心とし、極方向が上になるよう回転させる
  const ang = (Math.atan2(star.x, star.y) * 180) / Math.PI; // 真上から時計回り
  el("rect", { x: -100, y: -100, width: 200, height: 200, class: "fov-bg" }, svg);
  const root = el("g", { transform: `rotate(${-ang + 180}) translate(${-star.x * scale}, ${star.y * scale})` }, svg);

  if (showRings) {
    for (const c of YEAR_CIRCLES) {
      el("circle", { r: c.r * scale, class: "reticle-ring zoom" }, root);
    }
  }
  // 極から主星への動径
  const ux = star.x / star.r;
  const uy = -star.y / star.r;
  const rMin = star.r - half * 1.6;
  const rMax = star.r + half * 1.6;
  el("line", { x1: ux * rMin * scale, y1: uy * rMin * scale, x2: ux * rMax * scale, y2: uy * rMax * scale, class: "radial" }, root);

  // 年ごとの位置 (現在の時角方向へ投影)
  const nx = -uy;
  const ny = ux;
  for (const t of track) {
    const major = t.year % 4 === 0;
    const len = major ? 6 : 3;
    const cx = ux * t.r * scale;
    const cy = uy * t.r * scale;
    el("line", { x1: cx - nx * len, y1: cy - ny * len, x2: cx + nx * len, y2: cy + ny * len, class: major ? "track-tick major" : "track-tick" }, root);
  }

  el("circle", { cx: star.x * scale, cy: -star.y * scale, r: 16, fill: "url(#star-glow)", class: "star-halo" }, root);
  el("circle", { cx: star.x * scale, cy: -star.y * scale, r: 4.5, class: "star-core" }, root);

  // ラベルは回転させずに描く (回転後の座標を計算)
  const rot = ((-ang + 180) * Math.PI) / 180;
  const toScreen = (x, y) => {
    const tx = x - star.x * scale;
    const ty = y + star.y * scale;
    return [tx * Math.cos(rot) - ty * Math.sin(rot), tx * Math.sin(rot) + ty * Math.cos(rot)];
  };
  // 回転後は動径が縦になるので、目盛りの右に年、左に年度円の名前を置く
  for (const t of track) {
    if (t.year % 4 !== 0) continue;
    const [, sy] = toScreen(ux * t.r * scale, uy * t.r * scale);
    if (Math.abs(sy) > 78) continue;
    text(svg, 10, sy, String(t.year), { class: "track-label", "text-anchor": "start" });
  }
  if (showRings) {
    for (const c of YEAR_CIRCLES) {
      const [, sy] = toScreen(ux * c.r * scale, uy * c.r * scale);
      if (Math.abs(sy) > 78) continue;
      text(svg, -10, sy - 5, `${c.year}年円`, { class: "ring-label", "text-anchor": "end" });
    }
  }
  text(svg, 0, -88, "↑ 極の方向", { class: "zoom-caption" });
  text(svg, -94, 92, `拡大 ±${(half * 60).toFixed(1)}′`, { class: "zoom-caption", "text-anchor": "start" });
}
