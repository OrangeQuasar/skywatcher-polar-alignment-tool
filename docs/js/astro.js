// 天文計算モジュール
// 固有運動 → 年周光行差 → 歳差 (IAU 2006) → 章動 (IAU 1980 主要項) で視位置を求め、
// 視恒星時 (GAST) から時角を計算する。

const DEG = Math.PI / 180;
const ARCSEC = DEG / 3600;
const TWO_PI = 2 * Math.PI;

// TT - UTC (秒)。2017年以降は TAI-UTC = 37 s。
const TT_MINUS_UTC = 69.184;

// J2000.0 (ICRS) カタログ。pmRA は μα* = μα cosδ (mas/yr)。
export const STARS = {
  polaris: { name: "Polaris (α UMi)", ra: hms(2, 31, 49.09), dec: dms(1, 89, 15, 50.8), pmRA: 44.48, pmDec: -11.85, mag: 2.0 },
  sigmaOct: { name: "σ Oct", ra: hms(21, 8, 46.86357), dec: dms(-1, 88, 57, 23.3983), pmRA: 26.323, pmDec: 4.721, mag: 5.47 },
  chiOct: { name: "χ Oct", ra: hms(18, 54, 47.14062), dec: dms(-1, 87, 36, 21.0359), pmRA: -36.555, pmDec: -135.715, mag: 5.28 },
  tauOct: { name: "τ Oct", ra: hms(23, 28, 3.7855), dec: dms(-1, 87, 28, 55.967), pmRA: 16.782, pmDec: 11.957, mag: 5.5 },
  upsilonOct: { name: "υ Oct", ra: hms(22, 31, 37.5152), dec: dms(-1, 85, 58, 2.11), pmRA: -37.556, pmDec: 61.431, mag: 5.75 },
};

function hms(h, m, s) {
  return (h + m / 60 + s / 3600) * 15 * DEG;
}
function dms(sign, d, m, s) {
  return sign * (d + m / 60 + s / 3600) * DEG;
}

export function normAngle(a) {
  a %= TWO_PI;
  return a < 0 ? a + TWO_PI : a;
}

/** Date → ユリウス日 (UTC) */
export function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// ---------- ベクトル・行列 ----------
function vecFromRaDec(ra, dec) {
  const c = Math.cos(dec);
  return [c * Math.cos(ra), c * Math.sin(ra), Math.sin(dec)];
}
function raDecFromVec([x, y, z]) {
  const r = Math.hypot(x, y, z);
  return { ra: normAngle(Math.atan2(y, x)), dec: Math.asin(z / r) };
}
function mulMV(m, v) {
  return m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
}
function mulMM(a, b) {
  return a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
}
// 座標軸の回転 (SOFA の R1/R2/R3 と同じ符号規約)
function rot1(t) {
  const c = Math.cos(t), s = Math.sin(t);
  return [[1, 0, 0], [0, c, s], [0, -s, c]];
}
function rot2(t) {
  const c = Math.cos(t), s = Math.sin(t);
  return [[c, 0, -s], [0, 1, 0], [s, 0, c]];
}
function rot3(t) {
  const c = Math.cos(t), s = Math.sin(t);
  return [[c, s, 0], [-s, c, 0], [0, 0, 1]];
}

// ---------- 歳差・章動 ----------

/** IAU 2006 平均黄道傾斜角 (rad) */
function meanObliquity(t) {
  return (84381.406 - 46.836769 * t - 0.0001831 * t * t + 0.0020034 * t ** 3 - 0.000000576 * t ** 4 - 0.0000000434 * t ** 5) * ARCSEC;
}

/** IAU 2006 歳差行列 (J2000 平均赤道 → 日付の平均赤道) */
function precessionMatrix(t) {
  const zeta = (2.650545 + 2306.083227 * t + 0.2988499 * t ** 2 + 0.01801828 * t ** 3 - 0.000005971 * t ** 4 - 0.0000003173 * t ** 5) * ARCSEC;
  const z = (-2.650545 + 2306.077181 * t + 1.0927348 * t ** 2 + 0.01826837 * t ** 3 - 0.000028596 * t ** 4 - 0.0000002904 * t ** 5) * ARCSEC;
  const theta = (2004.191903 * t - 0.4294934 * t ** 2 - 0.04182264 * t ** 3 - 0.000007089 * t ** 4 - 0.0000001274 * t ** 5) * ARCSEC;
  return mulMM(rot3(-z), mulMM(rot2(theta), rot3(-zeta)));
}

// IAU 1980 章動の主要項 [D, M, M', F, Ω, Δψ0, Δψ1, Δε0, Δε1] (単位 0.0001")
const NUTATION_TERMS = [
  [0, 0, 0, 0, 1, -171996, -174.2, 92025, 8.9],
  [-2, 0, 0, 2, 2, -13187, -1.6, 5736, -3.1],
  [0, 0, 0, 2, 2, -2274, -0.2, 977, -0.5],
  [0, 0, 0, 0, 2, 2062, 0.2, -895, 0.5],
  [0, 1, 0, 0, 0, 1426, -3.4, 54, -0.1],
  [0, 0, 1, 0, 0, 712, 0.1, -7, 0],
  [-2, 1, 0, 2, 2, -517, 1.2, 224, -0.6],
  [0, 0, 0, 2, 1, -386, -0.4, 200, 0],
  [0, 0, 1, 2, 2, -301, 0, 129, -0.1],
  [-2, -1, 0, 2, 2, 217, -0.5, -95, 0.3],
  [-2, 0, 1, 0, 0, -158, 0, 0, 0],
  [-2, 0, 0, 2, 1, 129, 0.1, -70, 0],
  [0, 0, -1, 2, 2, 123, 0, -53, 0],
  [2, 0, 0, 0, 0, 63, 0, 0, 0],
  [0, 0, 1, 0, 1, 63, 0.1, -33, 0],
  [2, 0, -1, 2, 2, -59, 0, 26, 0],
  [0, 0, -1, 0, 1, -58, -0.1, 32, 0],
  [0, 0, 1, 2, 1, -51, 0, 27, 0],
];

/** 章動 (Δψ, Δε) [rad] */
function nutation(t) {
  const D = (297.85036 + 445267.11148 * t - 0.0019142 * t * t + t ** 3 / 189474) * DEG;
  const M = (357.52772 + 35999.05034 * t - 0.0001603 * t * t - t ** 3 / 300000) * DEG;
  const Mp = (134.96298 + 477198.867398 * t + 0.0086972 * t * t + t ** 3 / 56250) * DEG;
  const F = (93.27191 + 483202.017538 * t - 0.0036825 * t * t + t ** 3 / 327270) * DEG;
  const Om = (125.04452 - 1934.136261 * t + 0.0020708 * t * t + t ** 3 / 450000) * DEG;
  let dpsi = 0, deps = 0;
  for (const [d, m, mp, f, om, p0, p1, e0, e1] of NUTATION_TERMS) {
    const arg = d * D + m * M + mp * Mp + f * F + om * Om;
    dpsi += (p0 + p1 * t) * Math.sin(arg);
    deps += (e0 + e1 * t) * Math.cos(arg);
  }
  return { dpsi: dpsi * 1e-4 * ARCSEC, deps: deps * 1e-4 * ARCSEC };
}

function nutationMatrix(eps0, dpsi, deps) {
  return mulMM(rot1(-(eps0 + deps)), mulMM(rot3(-dpsi), rot1(eps0)));
}

/** 地球の公転速度 / c を日付の真の赤道座標で返す (年周光行差用) */
function earthVelocityOverC(t, eps) {
  const M = (357.52911 + 35999.05029 * t - 0.0001537 * t * t) * DEG;
  const L0 = (280.46646 + 36000.76983 * t + 0.0003032 * t * t) * DEG;
  const C = ((1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(M) + (0.019993 - 0.000101 * t) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M)) * DEG;
  const sunLon = L0 + C;
  const e = 0.016708634 - 0.000042037 * t;
  const peri = (102.93735 + 1.71946 * t) * DEG;
  const kappa = 20.49552 * ARCSEC;
  // 黄道座標での速度方向 (太陽黄経 L に対し L-90°)、離心率による補正付き
  const vx = kappa * (Math.sin(sunLon) - e * Math.sin(peri));
  const vy = -kappa * (Math.cos(sunLon) - e * Math.cos(peri));
  return [vx, vy * Math.cos(eps), vy * Math.sin(eps)];
}

/**
 * 時刻に依存する量をまとめて計算する。
 * @param {Date} date
 */
export function timeContext(date) {
  const jdUtc = julianDate(date);
  const jdTt = jdUtc + TT_MINUS_UTC / 86400;
  const t = (jdTt - 2451545.0) / 36525; // TT ユリウス世紀
  const eps0 = meanObliquity(t);
  const { dpsi, deps } = nutation(t);
  const P = precessionMatrix(t);
  const N = nutationMatrix(eps0, dpsi, deps);

  // 地球回転角 → GMST (IAU 2006) → GAST。UT1 ≈ UTC とする。
  const du = jdUtc - 2451545.0;
  const era = TWO_PI * ((0.779057273264 + 0.00273781191135448 * du + du) % 1);
  const gmst = era + (0.014506 + 4612.156534 * t + 1.3915817 * t * t - 0.00000044 * t ** 3 - 0.000029956 * t ** 4) * ARCSEC;
  const gast = normAngle(gmst + dpsi * Math.cos(eps0 + deps));

  return {
    date, jdUtc, jdTt, t,
    yearsSinceJ2000: (jdTt - 2451545.0) / 365.25,
    NP: mulMM(N, P),
    velocity: earthVelocityOverC(t, eps0 + deps),
    gast,
    gmst: normAngle(gmst),
    dpsi, deps,
  };
}

/** 固有運動を適用した J2000 赤道座標ベクトル */
function applyProperMotion(star, years) {
  const { ra, dec } = star;
  const masToRad = ARCSEC / 1000;
  const p = vecFromRaDec(ra, dec);
  const eRa = [-Math.sin(ra), Math.cos(ra), 0];
  const eDec = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
  const a = star.pmRA * masToRad * years;
  const d = star.pmDec * masToRad * years;
  return p.map((v, i) => v + a * eRa[i] + d * eDec[i]);
}

/**
 * 星の位置を計算する。
 * @param {object} star STARS の要素
 * @param {ReturnType<typeof timeContext>} ctx
 * @param {number} longitude 東経 (deg)
 * @param {{mean?: boolean}} opts mean=true なら章動・光行差を除いた平均位置
 */
export function starPosition(star, ctx, longitude, opts = {}) {
  let v = applyProperMotion(star, ctx.yearsSinceJ2000);
  if (opts.mean) {
    v = mulMV(precessionMatrix(ctx.t), v);
  } else {
    v = mulMV(ctx.NP, v);
    const n = Math.hypot(...v);
    v = v.map((x, i) => x / n + ctx.velocity[i]);
  }
  const { ra, dec } = raDecFromVec(v);
  const lst = normAngle(ctx.gast + longitude * DEG);
  const ha = normAngle(lst - ra);
  return { ra, dec, ha, lst, polarDistance: Math.PI / 2 - Math.abs(dec) };
}

/**
 * 天の極を中心とした視野内の位置 (deg)。x: 右, y: 上。
 * 極の方向を向き、天頂を上にした肉眼での見え方を基準とし、
 * inverted=true で極望の倒立像 (180°回転) にする。
 */
export function fieldPosition(pos, southern, inverted) {
  const r = pos.polarDistance / DEG;
  let x = (southern ? 1 : -1) * r * Math.sin(pos.ha);
  let y = r * Math.cos(pos.ha);
  if (inverted) {
    x = -x;
    y = -y;
  }
  return { x, y, r };
}

/** 視野内の位置を、0 時を真上とする 12 時間時計の読み (0〜12) に変換する */
export function clockReading({ x, y }) {
  const angle = normAngle(Math.atan2(x, y)); // 真上から時計回り
  return (angle / TWO_PI) * 12;
}

export const RAD2DEG = 1 / DEG;
export const DEG2RAD = DEG;
