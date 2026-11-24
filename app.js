/* Expedientes — consulta en el móvil (solo lectura).
   Lee la copia gestor-movil.db que el gestor deja en OneDrive y la abre en el teléfono. */
"use strict";
const C = window.CONFIG;
const PRUEBA = new URLSearchParams(location.search).has("prueba");
const $ = (s) => document.querySelector(s);
let DB = null, META = {}, SQL = null, msalApp = null, cuenta = null;
let ordenCrono = "desc";

/* ---------- utilidades ---------- */
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sinAcentos = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fecha(iso) { if (!iso) return ""; const [a, m, d] = iso.slice(0, 10).split("-"); return `${+d} ${MESES[+m - 1]} ${a}`; }
function hoyISO() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
function dias(iso) { if (!iso) return null; return Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(hoyISO())) / 864e5); }
function cuenta_atras(d) { if (d === null) return "—"; if (d < 0) return `${-d} d. tarde`; if (d === 0) return "HOY"; if (d === 1) return "mañana"; return `en ${d} días`; }
function euros(c) { return (c / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }
function q(sql, p = []) { const st = DB.prepare(sql); st.bind(p); const r = []; while (st.step()) r.push(st.getAsObject()); st.free(); return r; }
function q1(sql, p = []) { return q(sql, p)[0] || null; }
function aviso(t, ms = 3500) { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), ms); }
function familia(nombre) {
  const e = (nombre.split(".").pop() || "").toLowerCase();
  if (e === "pdf") return ["pdf", "PDF"]; if (["doc", "docx", "rtf", "odt"].includes(e)) return ["word", "W"];
  if (["xls", "xlsx", "csv"].includes(e)) return ["excel", "X"]; if (["jpg", "jpeg", "png", "heic", "gif"].includes(e)) return ["imagen", "IMG"];
  if (["msg", "eml"].includes(e)) return ["correo", "@"]; return ["", e.slice(0, 3).toUpperCase() || "?"];
}

/* ---------- guardado local (para abrir sin cobertura) ---------- */
function idb() { return new Promise((ok, ko) => { const r = indexedDB.open("expedientes", 1); r.onupgradeneeded = () => r.result.createObjectStore("datos"); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
async function guardarLocal(buf) { const d = await idb(); return new Promise((ok) => { const t = d.transaction("datos", "readwrite"); t.objectStore("datos").put(buf, "base"); t.oncomplete = ok; t.onerror = ok; }); }
async function leerLocal() { try { const d = await idb(); return await new Promise((ok) => { const r = d.transaction("datos").objectStore("datos").get("base"); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); }); } catch { return null; } }
async function borrarLocal() { try { const d = await idb(); d.transaction("datos", "readwrite").objectStore("datos").clear(); } catch {} }

/* ---------- Microsoft / OneDrive ---------- */
async function iniciarMsal() {
  msalApp = new msal.PublicClientApplication({
    auth: { clientId: C.clientId, authority: C.authority, redirectUri: location.origin + location.pathname },
    cache: { cacheLocation: "localStorage" },
  });
  await msalApp.initialize();
  const r = await msalApp.handleRedirectPromise();
  cuenta = r?.account || msalApp.getAllAccounts()[0] || null;
}
async function token() {
  try { return (await msalApp.acquireTokenSilent({ scopes: C.scopes, account: cuenta })).accessToken; }
  catch { await msalApp.acquireTokenRedirect({ scopes: C.scopes, account: cuenta }); return null; }
}
const rutaGraph = (ruta) => "/me/drive/root:/" + ruta.split("/").map(encodeURIComponent).join("/") + ":";
async function graph(ruta) {
  const t = await token(); if (!t) throw new Error("Hay que volver a entrar con tu cuenta de Microsoft.");
  const r = await fetch("https://graph.microsoft.com/v1.0" + ruta, { headers: { Authorization: "Bearer " + t } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`OneDrive ha respondido ${r.status}.`);
  return r.json();
}
async function descargarBase() {
  if (PRUEBA) { const r = await fetch("gestor-movil.db", { cache: "no-store" }); return r.arrayBuffer(); }
  const item = await graph(rutaGraph(C.rutaBase) + "?select=id,@microsoft.graph.downloadUrl");
  if (!item) throw new Error("No encuentro la copia del gestor en tu OneDrive (carpeta «Gestor movil»).");
  const r = await fetch(item["@microsoft.graph.downloadUrl"]);
  if (!r.ok) throw new Error("No se ha podido descargar la copia del gestor.");
  return r.arrayBuffer();
}
async function abrirDocumento(ruta) {
  if (PRUEBA) { aviso("En la prueba no se abren documentos: " + ruta.split("/").pop()); return; }
  aviso("Abriendo…", 2500);
  try {
    const item = await graph(rutaGraph(ruta) + "?select=name,webUrl,file,@microsoft.graph.downloadUrl");
    if (!item) { aviso(`Este documento aún no está en tu copia de OneDrive${META.copia_documentos ? " (última copia: " + META.copia_documentos.slice(0, 10).split("-").reverse().join("/") + ")" : ""}.`, 5000); return; }
    // Se descarga el archivo y lo abre el visor del teléfono. El enlace web de OneDrive
    // lo intercepta la aplicación OneDrive de Android, que no sabe abrirlo.
    const url = item["@microsoft.graph.downloadUrl"];
    if (!url) { location.href = item.webUrl; return; }
    const r = await fetch(url);
    if (!r.ok) throw new Error("No se ha podido descargar el documento.");
    const tipo = (item.file && item.file.mimeType) || r.headers.get("content-type") || "application/octet-stream";
    const blob = new Blob([await r.arrayBuffer()], { type: tipo });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = u; a.download = item.name || ruta.split("/").pop();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 120000);
    aviso("Descargado: pulsa «Abrir» en el aviso de descarga.", 6000);
  } catch (e) { aviso(e.message, 5000); }
}

/* ---------- carga de datos ---------- */
async function abrirBase(buf) {
  DB = new SQL.Database(new Uint8Array(buf));
  META = Object.fromEntries(q("SELECT clave, valor FROM movil_meta").map((r) => [r.clave, r.valor]));
  pintarEstado();
}
function pintarEstado() {
  const e = $("#estado-datos"); if (!META.generado) { e.hidden = true; return; }
  const [f, h] = META.generado.split(" ");
  const d = -dias(f);
  e.hidden = false; e.className = "estado-datos" + (d >= 1 ? " viejo" : "");
  e.textContent = `Datos del gestor: ${d === 0 ? "hoy" : d === 1 ? "ayer" : fecha(f)} a las ${h}` + (d >= 1 ? " · pulsa ⟳ para actualizar" : "");
}
async function actualizar(silencioso) {
  const b = $("#btn-actualizar"); b.disabled = true; b.textContent = "…";
  try { const buf = await descargarBase(); await abrirBase(buf); await guardarLocal(buf); if (!silencioso) aviso("Datos actualizados."); pintar(); }
  catch (e) { if (!silencioso || !DB) aviso(e.message, 5000); }
  finally { b.disabled = false; b.textContent = "⟳"; }
}
