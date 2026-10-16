/* Общий модуль: данные Open-Meteo (бесплатно, без ключа) */
const OM = (() => {
  const PLACES = {
    "Минск":[53.9006,27.5590], "Брест — Центр":[52.0976,23.7000], "Брест — Восток":[52.1050,23.7450],
    "Брест — Южный":[52.0650,23.7100], "Брест — Киевка":[52.0850,23.6550]
  };
  const snow = c => (c>=71&&c<=77)||c===85||c===86;
  const rain = c => (c>=51&&c<=67)||(c>=80&&c<=82)||c>=95;
  const cond = c => (c===0||c===1)?"clear":c===2?"partly":c===3?"cloudy":(c===45||c===48)?"fog":snow(c)?"snow":c>=95?"storm":rain(c)?"rain":"cloudy";
  const DIRS = ["северный","северо-восточный","восточный","юго-восточный","южный","юго-западный","западный","северо-западный"];
  const dir = a => DIRS[Math.round(a/45)%8];
  const coords = d => (d.lat && d.lon) ? [+d.lat, +d.lon] : (PLACES[d.city] || [52.0976, 23.7]);

  async function get(lat, lon, tz){
    const u = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day" +
      "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min&wind_speed_unit=ms&forecast_days=3&timezone=" + encodeURIComponent(tz || "Europe/Minsk");
    const r = await fetch(u); if (!r.ok) throw new Error("Open-Meteo " + r.status);
    const j = await r.json(), H = j.hourly, cur = j.current.time.slice(0,13);
    let i0 = H.time.findIndex(t => t.slice(0,13) === cur); if (i0 < 0) i0 = 0;
    const hours = [];
    for (let i=i0; i<H.time.length && hours.length<48; i++)
      hours.push({t:H.time[i], temp:H.temperature_2m[i], p:H.precipitation_probability[i], mm:H.precipitation[i], c:H.weather_code[i], w:H.wind_speed_10m[i]});
    return {cur:j.current, hours, daily:j.daily, now:j.current.time};
  }

  const isRain = h => rain(h.c) || ((h.p||0) >= 50 && (h.mm||0) >= 0.1 && !snow(h.c));
  const endOf = t => new Date(Date.parse(t + ":00Z") + 3600000).toISOString().slice(0,16);
  function rainWin(hours){
    let a = hours.findIndex(isRain); if (a < 0) return null;
    let b = a; while (b+1 < hours.length && isRain(hours[b+1])) b++;
    let p = 0; for (let i=a; i<=b; i++) p = Math.max(p, hours[i].p != null ? hours[i].p : (rain(hours[i].c) ? 100 : 0));
    return {from:hours[a].t, to:endOf(hours[b].t), p, nowRain:a===0};
  }
  function label(w, now){
    const day = s => s.slice(0,10), hm = s => s.slice(11,16), today = day(now);
    const tom = new Date(Date.parse(today + "T00:00:00Z") + 864e5).toISOString().slice(0,10);
    const dn = s => day(s)===today ? "" : (day(s)===tom ? "завтра " : s.slice(8,10) + "." + s.slice(5,7) + " ");
    const to = (day(w.to)===day(w.from) || (w.nowRain && day(w.to)===today)) ? hm(w.to) : dn(w.to) + hm(w.to);
    const text = w.nowRain ? "сейчас, до " + to : dn(w.from) + "с " + hm(w.from) + " до " + to;
    return {text, full: w.p + "% · " + text};
  }
  function apply(d, w){
    const c = w.cur, D = w.daily, sp = c.wind_speed_10m;
    d.cond = cond(c.weather_code); d.temp = Math.round(c.temperature_2m); d.night = Math.round(D.temperature_2m_min[0]);
    d.wind = sp < 1 ? "штиль" : Math.round(sp) + " м/с, " + dir(c.wind_direction_10m);
    d.tcond = cond(D.weather_code[1]); d.ttemp = Math.round(D.temperature_2m_max[1]);
    const rw = rainWin(w.hours);
    d.note = rw ? "Дождь " + label(rw, w.now).text + " (до " + rw.p + "%)" : "Дождя в ближайшие 48 часов не ожидается";
  }
  return {PLACES, cond, coords, get, rainWin, label, apply};
})();
