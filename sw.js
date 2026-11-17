const VERSION = "857548eb82ed", CACHE = "horta-app";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
function sinAncla(u){ const x = new URL(u); x.hash = ""; return x.href; }
function clavePagina(u){ const x = new URL(u); x.hash = ""; x.search = ""; return x.href; }
function esPagina(r, u){ return r.mode === "navigate" || r.destination === "document" || /(\.html?|\/)$/.test(u.pathname); }
async function limpia(res){ if (!res.redirected) return res; return new Response(await res.blob(), {status:res.status, statusText:res.statusText, headers:res.headers}); }
async function renueva(c, k, guardada){
  const h = {}, et = guardada && guardada.headers.get("ETag"), lm = guardada && guardada.headers.get("Last-Modified");
  if (et) h["If-None-Match"] = et; else if (lm) h["If-Modified-Since"] = lm;
  const res = await fetch(k, {cache:"no-store", headers:h, credentials:"same-origin"});
  if (res.status === 304 && guardada) return guardada;
  if (res.ok && res.type === "basic") { const l = await limpia(res); await c.put(k, l.clone()).catch(() => {}); return l; }
  return res; }
async function otraPagina(c){ const ks = await c.keys(), k = ks.find(q => /\.html?$|\/$/.test(new URL(q.url).pathname)); return k ? c.match(k) : undefined; }
function pagina(e, r){
  const k = clavePagina(r.url), recarga = r.cache === "reload" || r.cache === "no-cache" || r.cache === "no-store";
  return caches.open(CACHE).then(async c => {
    const m = (await c.match(k)) || (await c.match(k, {ignoreSearch:true}));
    if (m && !recarga) { e.waitUntil(renueva(c, k, m).catch(() => {})); return m; }
    try {
      if (m) return await renueva(c, k, m);
      const res = await fetch(r);
      if (res && res.ok && res.type === "basic") { const cp = res.clone(); e.waitUntil(c.put(k, cp).catch(() => {})); }
      return res;
    } catch(err) { return m || (r.mode === "navigate" && await otraPagina(c)) || Response.error(); }
  });
}
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url), mismo = u.origin === self.location.origin, letras = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (mismo && esPagina(r, u)) e.respondWith(pagina(e, r));
  else if (mismo) {
    e.respondWith(fetch(r).then(res => {
      if (res && res.ok && res.type === "basic") { const cp = res.clone(); caches.open(CACHE).then(c => c.put(sinAncla(r.url), cp)).catch(() => {}); }
      return res;
    }).catch(() => caches.open(CACHE).then(async c => (await c.match(sinAncla(r.url), {ignoreSearch:true})) || Response.error())));
  } else if (letras) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const m = await c.match(r), net = fetch(r).then(res => { if (res && (res.ok || res.type === "opaque")) c.put(r, res.clone()).catch(() => {}); return res; }).catch(() => m || Response.error());
      return m || net;
    }));
  }
});
const AV_CACHE = "horta-avisos";
const avKey = n => new URL(n, self.registration.scope).href;
function avHoy(){ const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
async function avLee(c, n){ try { const r = await c.match(avKey(n)); return r ? await r.json() : null; } catch(e) { return null; } }
async function avAvisar(){
  const c = await caches.open(AV_CACHE), a = await avLee(c, "av5-agenda.json"); if (!a || !a.on || !Array.isArray(a.items)) return;
  const ws = await self.clients.matchAll({type:"window", includeUncontrolled:true}); if (ws.some(w => w.visibilityState === "visible")) return;
  const hoy = avHoy(), env = (await avLee(c, "av5-enviados.json")) || {};
  const L0 = a.items.filter(i => i && i.fecha === hoy && !i.sent && !env[i.id]);
  const h = await cvHoraVe(c, L0, hoy, env, a.items), L = h.L; if (!L.length && !h.M) return;
  const ruta = L.length === 1 && L[0].ruta ? L[0].ruta : "hoxe", titulo = L.length === 1 ? a.titulo1 : String(a.tituloN || "").replace("{n}", L.length);
  if (L.length) await cvAvisa(c, a, L, hoy, titulo, ruta);
  if (h.M) await cvMananaAvisa(c, a, h.M, hoy);
  if (h.resumen) { env["cv:resumen"] = hoy; env["cv:modo"] = h.M ? "manana" : "hoy"; }
  L.forEach(i => { env[i.id] = hoy; }); Object.keys(env).forEach(k => { if (env[k] < hoy) delete env[k]; });
  await c.put(avKey("av5-enviados.json"), new Response(JSON.stringify(env), {headers:{"Content-Type":"application/json"}}));
}
self.addEventListener("periodicsync", e => { if (e.tag === "horta-avisos") e.waitUntil(avAvisar().catch(() => {})); });
self.addEventListener("notificationclick", e => {
  if (e.action) return cvBoton(e);
  e.notification.close(); const d = e.notification.data || {}, url = d.url || self.registration.scope;
  e.waitUntil(self.clients.matchAll({type:"window", includeUncontrolled:true}).then(ws => {
    const w = ws.find(x => "focus" in x); if (w) { w.postMessage({av5:"ir", ruta:d.ruta || "hoxe"}); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
function cvFrases(L){
  const G = new Map(), low = s => s.charAt(0).toLowerCase() + s.slice(1), y = a => a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + " y " + a[a.length - 1];
  const pon = (k, v, n) => { if (!G.has(k)) G.set(k, {n:0, v:[]}); const g = G.get(k); g.n += n || 1; if (v && !g.v.includes(v)) g.v.push(v); };
  const CUENTA = {pedido:["1 pedido", "pedidos"], pedidoM:["1 pedido para mañana", "pedidos para mañana"], cobro:["1 cobro", "cobros"], cosecha:["1 cosecha", "cosechas"], sembrar:["1 siembra", "siembras"], trasplante:["1 trasplante", "trasplantes"], tarea:["1 tarea", "tareas"], otro:["", "avisos"]};
  const UNA = {nacer:"mirar si nació lo sembrado", siembra:"preparar la siembra de mañana", buendia:"buen día para sembrar", plaga:"mirar las plagas", viento:"atar los soportes", semilla:"mirar tus semillas",
    ola:"ola de calor", calor:"mucho calor", granizo:"puede granizar", tormenta:"puede haber tormenta"};
  const corto = s => { const f = low(s.replace(/^Hoy,?\s+/i, "").replace(/[.:]+$/, "")); let x = f.split(/: |\. |, | \(| — /)[0].trim(); if (!/\s/.test(x)) x = f.replace(/: /g, ", ");
    if (x.length > 30) x = x.slice(0, 30).replace(/\s+\S*$/, "") + "…"; return x; };
  (L || []).forEach(i => { const id = String(i.id || ""), t = String(i.titulo || "").trim(); let m;
    if (/^(riego\||rem-riego)/.test(id)) { m = /^Toca regar:\s*(.+?)(?:,\s*unos .*)?$/.exec(t); pon("riego", m ? low(m[1].replace(/^Jardinera /, "la ")) : ""); }
    else if (/^helada[|-]/.test(id) || /: tapa /.test(t)) { m = /tapa (.+)$/.exec(t); pon("tapar", m ? m[1] : "lo delicado"); }
    else if (/^pedido\|/.test(id)) pon(/^Mañana /.test(t) ? "pedidoM" : "pedido");
    else if (/^reparto-/.test(id)) pon("pedido", "", (m = /(\d+) pedidos?/.exec(t)) ? Number(m[1]) : 1);
    else if (/^venta\|/.test(id)) pon("cobro");
    else if (/^(cosecha\||rem-cosecha)/.test(id)) pon("cosecha");
    else if (/^(trasplante\||rem-trasplante)/.test(id)) pon("trasplante");
    else if (/^(tarea\||t-)/.test(id)) pon(({siembra:"sembrar", escalonadas:"sembrar", trasplante:"trasplante", cosecha:"cosecha"})[i.cat] || "tarea");
    else if (/^nacer\|/.test(id)) pon("nacer");
    else if (/^siembra-t\|/.test(id)) pon("siembra");
    else if (/^siembra\|/.test(id)) pon("buendia");
    else if (/^(plaga|viento|semilla|ola|calor|granizo|tormenta)\|/.test(id)) pon(id.split("|")[0]);
    else if (t) pon("otro", corto(t)); });
  const out = []; G.forEach((g, k) => {
    if (k === "riego") out.push(g.v.length > 1 ? `regar ${g.v.length} jardineras` : g.v.length ? "regar " + g.v[0] : "regar");
    else if (k === "tapar") out.push("tapar " + g.v[0]);
    else if (k === "otro" && g.n === 1) out.push(g.v[0]);
    else if (CUENTA[k]) out.push(g.n === 1 ? CUENTA[k][0] : `${g.n} ${CUENTA[k][1]}`);
    else if (UNA[k]) out.push(UNA[k]); });
  return out; }
function cvTitulo(L){ const f = cvFrases(L); if (!f.length) return ""; const tit = a => "Hoy: " + (a.length < 2 ? a[0] : a.slice(0, -1).join(", ") + " y " + a[a.length - 1]);
  const v = [f[0]]; for (let i = 1; i < f.length && tit(v.concat(f[i])).length <= 45; i++) v.push(f[i]);
  let r = f.length - v.length;
  if (r === 1) { if (tit(f).length <= 60) return tit(f); if (v.length > 1) { v.pop(); r = 2; } }
  return r > 0 ? `Hoy: ${v.join(", ")} y ${r} más` : tit(v); }
function cvBotones(L){ try { const N = self.Notification || (typeof Notification !== "undefined" ? Notification : null); return N && N.maxActions > 0 ? L.slice(0, N.maxActions) : undefined; } catch(e) { return undefined; } }
async function cvAvisa(c, a, L, hoy, titulo, ruta){
  const tx = (await avLee(c, "cv-textos.json")) || {}, es = !tx.lang || tx.lang === "es", d = new Date(); d.setDate(d.getDate() + 1);
  const man = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"), ico = a.icon || undefined;
  const urg = L.filter(i => i.id === "helada|" + man || (/^helada-\d{4}-\d{2}-\d{2}$/.test(i.id) && i.fecha === hoy)), resto = L.filter(i => !urg.includes(i));
  for (const i of urg) { const f = String(i.id).slice(7), r = i.ruta || "hoxe";
    await self.registration.showNotification(tx.helada || "A miña horta: esta noche puede helar", {body:es && /tapa (.+)$/.test(i.titulo || "") ? `Tapa ${/tapa (.+)$/.exec(i.titulo)[1]} antes de que oscurezca.` : "• " + i.titulo, tag:"horta-helada-" + f, icon:ico, badge:ico,
      data:{url:a.url + "#" + r, ruta:r, cv:{ids:[i.id], riego:[], fecha:hoy}}, actions:cvBotones([{action:"hecho", title:tx.tapado || "Tapado"}])}); }
  if (!resto.length) return;
  const t = es ? cvTitulo(resto) || titulo : (resto.length === 1 ? a.titulo1 : String(a.tituloN || "").replace("{n}", resto.length)), r = resto.length === 1 && resto[0].ruta ? resto[0].ruta : resto.length === L.length ? ruta : "hoxe";
  const riego = resto.filter(i => /^riego\|/.test(i.id)).map(i => { const m = /unos (\d+(?:[.,]\d+)?) litros/.exec(i.titulo || ""); return {id:i.id, bed:String(i.id).split("|")[1], l:Number(i.l) > 0 ? Number(i.l) : m ? Number(m[1].replace(",", ".")) : 0}; });
  const acts = (riego.length ? [{action:"regado", title:tx.regado || "Regado"}] : []).concat(resto.some(i => !/^(pedido\||venta\||reparto-)/.test(i.id)) ? [{action:"hecho", title:tx.hecho || "Hecho"}] : []);
  await self.registration.showNotification(t, {body:resto.slice(0, 6).map(i => "• " + i.titulo).join("\n"), tag:"horta-hoy-" + hoy, icon:ico, badge:ico,
    data:{url:a.url + "#" + r, ruta:r, cv:{ids:resto.map(i => i.id), riego, fecha:hoy}}, actions:acts.length ? cvBotones(acts) : undefined});
}
async function cvEncola(o){
  const c = await caches.open(AV_CACHE), q = (await avLee(c, "cv-cola.json")) || []; q.push(o);
  await c.put(avKey("cv-cola.json"), new Response(JSON.stringify(q.slice(-50)), {headers:{"Content-Type":"application/json"}}));
  const ws = await self.clients.matchAll({type:"window", includeUncontrolled:true}); ws.forEach(w => { try { w.postMessage({cv:"cola"}); } catch(e) {} });
}
function cvBoton(e){
  e.notification.close(); if (!["hecho", "regado"].includes(e.action)) return; const cv = (e.notification.data || {}).cv || {};
  e.waitUntil(cvEncola({tipo:e.action, ids:Array.isArray(cv.ids) ? cv.ids : [], riego:Array.isArray(cv.riego) ? cv.riego : [], fecha:cv.fecha || avHoy(), en:Date.now()}).catch(() => {}));
}
function cvManSW(){ const d = new Date(); d.setDate(d.getDate() + 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function cvUrgSW(i, hoy, man){ return i.id === "helada|" + man || (/^helada-\d{4}-\d{2}-\d{2}$/.test(i.id) && i.fecha === hoy); }
async function cvHoraVe(c, L, hoy, env, items){
  const tx = (await avLee(c, "cv-textos.json")) || {}, man = cvManSW(), urg = i => cvUrgSW(i, hoy, man), d = new Date(), min = d.getHours() * 60 + d.getMinutes();
  if (typeof tx.hora !== "number") return {L, M:null, resumen:L.some(i => !urg(i))};
  if (min < tx.hora || tx.resumenDia === hoy || env["cv:resumen"] === hoy) return {L:L.filter(urg), M:null, resumen:false};
  if (tx.hora >= 17 * 60) { const M = (items || []).filter(i => i && i.fecha === man && !i.sent); if (M.length) return {L:L.filter(urg), M, resumen:true}; }
  return {L, M:null, resumen:L.some(i => !urg(i))}; }
async function cvMananaAvisa(c, a, M, hoy){
  const tx = (await avLee(c, "cv-textos.json")) || {}, es = !tx.lang || tx.lang === "es", f = es ? cvTitulo(M) : "", ico = a.icon || undefined;
  const t = f ? "Mañana: " + f.replace(/^Hoy: /, "") : M.length === 1 ? (tx.manana1 || "A miña horta: mañana, una cosa") : String(tx.mananaN || "A miña horta: mañana, {n} cosas").replace("{n}", M.length);
  await self.registration.showNotification(t, {body:M.slice(0, 6).map(i => "• " + i.titulo).join("\n"), tag:"horta-hoy-" + hoy, icon:ico, badge:ico,
    data:{url:a.url + "#avisos", ruta:"avisos", cv:{ids:[], riego:[], fecha:hoy}}}); }
