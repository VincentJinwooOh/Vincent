/* ------------------------------------------------------------------
 * solar.js — 태양 위치 계산 엔진 (NOAA Solar Calculator / Meeus 근사식)
 * 지구과학 6학년 "계절의 변화" 수업용. 브라우저·Node 모두에서 동작.
 * 정확도: 남중 고도 ±0.01°, 일출·일몰 ±1분 수준 (2000~2100년)
 * ------------------------------------------------------------------ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Solar = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const sin = d => Math.sin(d * RAD), cos = d => Math.cos(d * RAD), tan = d => Math.tan(d * RAD);
  const asin = x => Math.asin(Math.max(-1, Math.min(1, x))) * DEG;
  const acos = x => Math.acos(Math.max(-1, Math.min(1, x))) * DEG;
  const mod = (a, n) => ((a % n) + n) % n;

  /** 달력 날짜(그레고리력) → 율리우스일(0h UT) */
  function julianDay(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  /** 율리우스 세기 T 로부터 태양 적위(deg)와 균시차(min) 계산 */
  function solarParams(T) {
    const L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
    const M = mod(357.52911 + T * (35999.05029 - 0.0001537 * T), 360);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const C = sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T))
            + sin(2 * M) * (0.019993 - 0.000101 * T) + sin(3 * M) * 0.000289;
    const trueLong = L0 + C;
    const omega = 125.04 - 1934.136 * T;
    const lambda = trueLong - 0.00569 - 0.00478 * sin(omega);
    const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const eps = eps0 + 0.00256 * cos(omega);
    const decl = asin(sin(eps) * sin(lambda));
    const y = tan(eps / 2) ** 2;
    const eot = 4 * DEG * (y * sin(2 * L0) - 2 * e * sin(M) + 4 * e * y * sin(M) * cos(2 * L0)
              - 0.5 * y * y * sin(4 * L0) - 1.25 * e * e * sin(2 * M));
    return { decl, eot };
  }

  /** 대기 굴절 보정(deg). 고도 h(deg)에 더한다. NOAA 식. */
  function refraction(h) {
    if (h > 85) return 0;
    const t = tan(h);
    let r;
    if (h > 5) r = 58.1 / t - 0.07 / t ** 3 + 0.000086 / t ** 5;
    else if (h > -0.575) r = 1735 + h * (-518.2 + h * (103.4 + h * (-12.79 + h * 0.711)));
    else r = -20.774 / t;
    return r / 3600;
  }

  /**
   * 하루의 요약값: 남중 시각·고도, 일출·일몰, 낮의 길이
   * @param {number} y,m,d  지방 달력 날짜
   * @param {number} lat 위도(북+), lon 경도(동+), tz 시간대(시, 한국 +9)
   */
  function dayInfo(y, m, d, lat, lon, tz) {
    const jd0 = julianDay(y, m, d);
    // 1차 근사: 현지 정오(UT 기준)에서 계산
    let T = (jd0 + 0.5 - tz / 24 - 2451545) / 36525;
    let { decl, eot } = solarParams(T);
    let noon = 720 - 4 * lon - eot + tz * 60;        // 남중 시각(지방시, 분)
    // 2차: 실제 남중 시각으로 재계산(정밀도 향상)
    T = (jd0 + noon / 1440 - tz / 24 - 2451545) / 36525;
    ({ decl, eot } = solarParams(T));
    noon = 720 - 4 * lon - eot + tz * 60;
    const cosHA = cos(90.833) / (cos(lat) * cos(decl)) - tan(lat) * tan(decl);
    let ha = null, sunrise = null, sunset = null, dayLength = null;
    if (cosHA >= -1 && cosHA <= 1) {
      ha = acos(cosHA);
      sunrise = noon - 4 * ha; sunset = noon + 4 * ha; dayLength = 8 * ha;
    } else if (cosHA < -1) { dayLength = 1440; }     // 백야
    else { dayLength = 0; }                             // 극야
    const meridianAlt = 90 - Math.abs(lat - decl);      // 남중 고도(기하학적)
    return { decl, eot, noon, sunrise, sunset, dayLength, meridianAlt,
             meridianAltApparent: meridianAlt + refraction(meridianAlt) };
  }

  /** 특정 시각(지방시 분)의 태양 고도·방위각 */
  function position(y, m, d, minutes, lat, lon, tz) {
    const jd0 = julianDay(y, m, d);
    const T = (jd0 + minutes / 1440 - tz / 24 - 2451545) / 36525;
    const { decl, eot } = solarParams(T);
    const tst = mod(minutes + eot + 4 * lon - 60 * tz, 1440);   // 진태양시(분)
    const ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;    // 시간각
    const cosZ = sin(lat) * sin(decl) + cos(lat) * cos(decl) * cos(ha);
    const zenith = acos(cosZ);
    const alt = 90 - zenith;
    let az;
    const denom = cos(lat) * sin(zenith);
    if (Math.abs(denom) < 1e-9) az = 180;
    else {
      const a = acos(((sin(lat) * cosZ) - sin(decl)) / denom);
      az = ha > 0 ? mod(a + 180, 360) : mod(540 - a, 360);
    }
    return { alt, altApparent: alt + refraction(alt), az, decl, eot, ha };
  }

  /** 분 → "HH:MM" */
  function fmtTime(min) {
    if (min == null) return '—';
    const m = Math.round(mod(min, 1440));
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  /** 분 → "H시간 M분" */
  function fmtDuration(min) {
    if (min == null) return '—';
    const m = Math.round(min);
    return Math.floor(m / 60) + '시간 ' + String(m % 60).padStart(2, '0') + '분';
  }

  return { julianDay, solarParams, dayInfo, position, refraction, fmtTime, fmtDuration };
});
