import { STARS, timeContext, starPosition, fieldPosition, clockReading, RAD2DEG } from "./astro.js";
import { drawReticle, drawZoom, YEAR_CIRCLES } from "./reticle.js";

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "polar-scope-settings";

const els = {
  lat: $("lat"),
  lon: $("lon"),
  datetime: $("datetime"),
  live: $("live"),
  inverted: $("inverted"),
  geolocate: $("geolocate"),
  now: $("now"),
  nightMode: $("night-mode"),
  reticle: $("reticle"),
  zoom: $("zoom"),
  zoomWrap: $("zoom-wrap"),
  status: $("status"),
};

// ---------- 設定の保存 ----------
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}
function saveSettings() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lat: els.lat.value, lon: els.lon.value, inverted: els.inverted.checked, night: els.nightMode.checked }),
    );
  } catch {
    /* プライベートモード等では保存しない */
  }
}

// ---------- 書式 ----------
const pad = (n, w = 2) => String(n).padStart(w, "0");

function formatHms(hours, withSign = false) {
  const sign = hours < 0 ? "-" : withSign ? "+" : "";
  let s = Math.round(Math.abs(hours) * 3600);
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return `${sign}${pad(h)}<sup>h</sup>${pad(m)}<sup>m</sup>${pad(s)}<sup>s</sup>`;
}

function formatDms(deg) {
  const sign = deg < 0 ? "−" : "+";
  let s = Math.round(Math.abs(deg) * 36000) / 10;
  const d = Math.floor(s / 3600);
  s -= d * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return `${sign}${pad(d)}°${pad(m)}′${s.toFixed(1).padStart(4, "0")}″`;
}

function formatClock(reading) {
  let minutes = Math.round(reading * 60) % 720;
  const h = Math.floor(minutes / 60);
  const m = minutes - h * 60;
  return { text: `${h}:${pad(m)}`, h, m };
}

function toLocalInputValue(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function decimalYear(d) {
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (d.getTime() - start) / (end - start);
}

/** Sky-Watcher の 3 重円のどこに置けばよいか */
function ringGuide(r) {
  const [c2012, c2020, c2028] = YEAR_CIRCLES;
  const describe = (a, b) => {
    const f = (a.r - r) / (a.r - b.r);
    return `${a.year}円と${b.year}円の間（${b.year}円寄り ${Math.round(f * 100)}%）`;
  };
  if (r > c2012.r) return `${c2012.year}円より外側`;
  if (r >= c2020.r) return describe(c2012, c2020);
  if (r >= c2028.r) return describe(c2020, c2028);
  return `${c2028.year}円より内側（${((c2028.r - r) * 60).toFixed(1)}′）`;
}

// ---------- 計算と描画 ----------
let trackCache = { key: "", track: [] };

function polarisTrack(lon, southern) {
  const key = `${southern}`;
  if (trackCache.key === key) return trackCache.track;
  const track = [];
  for (let year = 2008; year <= 2036; year++) {
    const ctx = timeContext(new Date(Date.UTC(year, 0, 1)));
    const p = starPosition(STARS.polaris, ctx, lon, { mean: true });
    track.push({ year, r: p.polarDistance * RAD2DEG });
  }
  trackCache = { key, track };
  return track;
}

function currentDate() {
  if (els.live.checked) return new Date();
  const d = new Date(els.datetime.value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function update() {
  const lat = parseFloat(els.lat.value);
  const lon = parseFloat(els.lon.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    els.status.textContent = "緯度・経度を正しく入力してください。";
    return;
  }
  els.status.textContent = "";

  const date = currentDate();
  if (els.live.checked) els.datetime.value = toLocalInputValue(date);

  const southern = lat < 0;
  const inverted = els.inverted.checked;
  const ctx = timeContext(date);

  const mainKey = southern ? "sigmaOct" : "polaris";
  const keys = southern ? ["sigmaOct", "chiOct", "tauOct", "upsilonOct"] : ["polaris"];
  const positions = Object.fromEntries(keys.map((k) => [k, starPosition(STARS[k], ctx, lon)]));
  const main = positions[mainKey];
  const field = fieldPosition(main, southern, inverted);
  const clock = formatClock(clockReading(field));

  // 数値表示
  const haHours = (main.ha * RAD2DEG) / 15;
  $("star-name").textContent = southern ? "はちぶんぎ座σ星" : "北極星";
  $("out-ha").innerHTML = formatHms(haHours);
  $("out-ha-deg").textContent = `${(main.ha * RAD2DEG).toFixed(3)}°`;
  $("out-clock").textContent = clock.text;
  $("out-clock-desc").textContent = `${clock.h}時${clock.m}分の位置（0時を真上にした${inverted ? "極望の倒立像" : "肉眼"}）`;
  $("out-pd").textContent = `${(main.polarDistance * RAD2DEG).toFixed(4)}°`;
  $("out-pd-arcmin").textContent = `${(main.polarDistance * RAD2DEG * 60).toFixed(2)}′`;
  $("out-ra").innerHTML = formatHms((main.ra * RAD2DEG) / 15);
  $("out-dec").textContent = formatDms(main.dec * RAD2DEG);
  $("out-lst").innerHTML = formatHms((main.lst * RAD2DEG) / 15);
  $("out-utc").textContent = date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  $("out-epoch").textContent = decimalYear(date).toFixed(3);

  const ringRow = $("ring-row");
  if (southern) {
    ringRow.hidden = true;
  } else {
    ringRow.hidden = false;
    $("out-ring").textContent = ringGuide(main.polarDistance * RAD2DEG);
  }

  // 図
  const stars = keys.map((k) => {
    const f = fieldPosition(positions[k], southern, inverted);
    return { label: southern ? STARS[k].name : "Polaris", x: f.x, y: f.y, mag: STARS[k].mag, primary: k === mainKey };
  });
  drawReticle(els.reticle, { southern, stars });

  els.zoomWrap.hidden = southern;
  if (!southern) {
    // 年ごとの平均極距離に、現在の章動・光行差による差分を加えて目盛りを揃える
    const mean = starPosition(STARS.polaris, ctx, lon, { mean: true });
    const offset = (main.polarDistance - mean.polarDistance) * RAD2DEG;
    const track = polarisTrack(lon, southern).map((t) => ({ year: t.year, r: t.r + offset }));
    drawZoom(els.zoom, { star: field, track, showRings: true });
  }

  $("view-caption").textContent = inverted
    ? "極望をのぞいた見え方（倒立像）。レチクルの 0 を真上に合わせてください。"
    : "肉眼で天の極を見上げたときの見え方（正立像）。";
}

// ---------- イベント ----------
function setNightMode(on) {
  document.documentElement.dataset.night = on ? "true" : "false";
}

function init() {
  const s = loadSettings();
  if (s.lat != null) els.lat.value = s.lat;
  if (s.lon != null) els.lon.value = s.lon;
  // ?lat=..&lon=.. で観測地を指定できる
  const params = new URLSearchParams(location.search);
  if (params.has("lat")) els.lat.value = params.get("lat");
  if (params.has("lon")) els.lon.value = params.get("lon");
  if (s.inverted != null) els.inverted.checked = s.inverted;
  if (s.night != null) els.nightMode.checked = s.night;
  setNightMode(els.nightMode.checked);
  els.datetime.value = toLocalInputValue(new Date());

  for (const e of [els.lat, els.lon, els.inverted]) {
    e.addEventListener("input", () => {
      saveSettings();
      update();
    });
  }
  els.datetime.addEventListener("input", () => {
    els.live.checked = false;
    update();
  });
  els.live.addEventListener("change", update);
  els.now.addEventListener("click", () => {
    els.live.checked = true;
    update();
  });
  els.nightMode.addEventListener("change", () => {
    setNightMode(els.nightMode.checked);
    saveSettings();
  });
  for (const btn of document.querySelectorAll("[data-shift]")) {
    btn.addEventListener("click", () => {
      const d = currentDate();
      els.live.checked = false;
      els.datetime.value = toLocalInputValue(new Date(d.getTime() + Number(btn.dataset.shift) * 60000));
      update();
    });
  }
  els.geolocate.addEventListener("click", () => {
    if (!navigator.geolocation) {
      els.status.textContent = "このブラウザは位置情報に対応していません。";
      return;
    }
    els.status.textContent = "現在地を取得中…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        els.lat.value = pos.coords.latitude.toFixed(4);
        els.lon.value = pos.coords.longitude.toFixed(4);
        saveSettings();
        update();
      },
      (err) => {
        els.status.textContent = `位置情報を取得できませんでした: ${err.message}`;
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  });

  update();
  setInterval(() => {
    if (els.live.checked) update();
  }, 1000);
}

init();
