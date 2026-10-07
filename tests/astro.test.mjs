// 参照値は astropy (TETE 座標, IAU2006A 視恒星時) で計算したもの。
// 差の主因は UT1−UTC (本ツールは UT1 ≈ UTC) で、時角で 0.5 秒未満。
import { test } from "node:test";
import assert from "node:assert/strict";
import { STARS, timeContext, starPosition, fieldPosition, clockReading, RAD2DEG } from "../docs/js/astro.js";

const LON = 139.7;
const CASES = [
  { iso: "2012-01-01T00:00:00Z", star: "polaris", ra: 41.991052, dec: 89.321121, ha: 13.184781 },
  { iso: "2020-01-01T00:00:00Z", star: "polaris", ra: 44.484153, dec: 89.351107, ha: 13.022181 },
  { iso: "2028-01-01T00:00:00Z", star: "polaris", ra: 47.627492, dec: 89.385642, ha: 12.817272 },
  { iso: "2026-10-07T12:00:00Z", star: "polaris", ra: 47.119462, dec: 89.374062, ha: 19.248792 },
  { iso: "2020-01-01T00:00:00Z", star: "sigmaOct", ra: 320.994519, dec: -88.877075, ha: 18.588157 },
  { iso: "2026-10-07T12:00:00Z", star: "sigmaOct", ra: 322.824234, dec: -88.847266, ha: 0.868474 },
];

for (const c of CASES) {
  test(`${c.star} @ ${c.iso} は astropy と一致する`, () => {
    const p = starPosition(STARS[c.star], timeContext(new Date(c.iso)), LON);
    const cosDec = Math.cos(c.dec / RAD2DEG);
    assert.ok(Math.abs((p.ra * RAD2DEG - c.ra) * cosDec) * 3600 < 1, "RA cosδ within 1″");
    assert.ok(Math.abs(p.dec * RAD2DEG - c.dec) * 3600 < 1, "Dec within 1″");
    assert.ok(Math.abs((p.ha * RAD2DEG) / 15 - c.ha) * 3600 < 1, "HA within 1 s");
  });
}

test("Sky-Watcher の年度円と北極星の平均極距離が概ね一致する", () => {
  for (const [year, r] of [[2012, 0.681], [2020, 0.65], [2028, 0.616]]) {
    const p = starPosition(STARS.polaris, timeContext(new Date(Date.UTC(year, 0, 1))), 0, { mean: true });
    assert.ok(Math.abs(p.polarDistance * RAD2DEG - r) < 0.006, `${year}`);
  }
});

test("時計位置: 北天・倒立像では時角 0h で 6 時、6h で 3 時", () => {
  const at = (haHours) => clockReading(fieldPosition({ ha: (haHours * 15) / RAD2DEG, polarDistance: 0.01 }, false, true));
  assert.ok(Math.abs(at(0) - 6) < 1e-9);
  assert.ok(Math.abs(at(6) - 3) < 1e-9);
  assert.ok(Math.abs(at(18) - 9) < 1e-9);
});

test("時計位置: 南天・倒立像では時角 6h で 9 時", () => {
  const r = clockReading(fieldPosition({ ha: (90) / RAD2DEG, polarDistance: 0.01 }, true, true));
  assert.ok(Math.abs(r - 9) < 1e-9);
});
