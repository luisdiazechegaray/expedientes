/* Pantallas de la aplicación. */
"use strict";
const GRUPOS = [["vencido", "Vencido"], ["hoy", "Hoy"], ["manana", "Mañana"], ["semana", "Esta semana"],
  ["mes", "Próximos 30 días"], ["despues", "Más adelante"], ["sin", "Sin fecha"]];
const MARCAS = { juicio: "JUICIO", plazo: "PLAZO", prueba: "PRUEBA", cita: "CITA", tarea: "TAREA" };
function grupoDe(d) { if (d === null) return "sin"; if (d < 0) return "vencido"; if (d === 0) return "hoy"; if (d === 1) return "manana"; if (d <= 7) return "semana"; if (d <= 30) return "mes"; return "despues"; }
function claseFila(x, d) {
  if (x.tipo === "cita") return "cita";
  if (x.tipo === "tarea") return d !== null && d < 0 ? "rojo" : "";
  if (d < 0) return "vencido"; if (d <= 2) return "rojo"; if (d <= 7) return "ambar"; return "verde";
}
function titulo(t, volver) {
  $("#titulo").innerHTML = (volver ? `<a class="barra-volver" href="javascript:history.back()">‹</a> ` : "") + esc(t);
  document.title = t;
}
function marcarPestana(p) { document.querySelectorAll(".pestanas a").forEach((a) => a.classList.toggle("activa", a.dataset.p === p)); }
function filaItem(x) {
  const d = dias(x.fecha);
  const meta = [x.ref ? `<span class="ref">${esc(x.ref)}</span>${x.cliente ? " · " + esc(x.cliente) : ""}` : (x.enFicha || x.tipo === "cita" ? "" : "Despacho"),
    x.fecha ? fecha(x.fecha) : "", x.obs && x.tipo === "cita" ? esc(x.obs) : ""].filter(Boolean).join(" · ");
  const dentro = `<div class="cuando">${cuenta_atras(d)}${x.hora ? `<br><b>${esc(x.hora)}</b>` : ""}</div>
    <div class="cuerpo"><div class="t"><span class="marca m-${x.clase}">${MARCAS[x.clase]}</span>${esc(x.texto)}</div><div class="m">${meta}</div></div>`;
  return x.exp_id ? `<a class="fila ${claseFila(x, d)}" href="#/exp/${x.exp_id}">${dentro}</a>` : `<div class="fila ${claseFila(x, d)}">${dentro}</div>`;
}

/* ---------- Qué tengo que hacer ---------- */
function vistaInicio() {
  titulo("Qué tengo que hacer"); marcarPestana("inicio");
  const items = q("SELECT * FROM movil_quehacer ORDER BY orden");
  const g = Object.fromEntries(GRUPOS.map(([k]) => [k, []]));
  for (const x of items) g[grupoDe(dias(x.fecha))].push(x);
  const semana = g.manana.length + g.semana.length;
  let h = `<div class="contadores">
    <div class="contador ${g.vencido.length ? "alerta" : ""}"><b>${g.vencido.length}</b><small>vencido</small></div>
    <div class="contador"><b>${g.hoy.length}</b><small>hoy</small></div>
    <div class="contador"><b>${semana}</b><small>7 días</small></div></div>`;
  for (const [k, nombre] of GRUPOS) {
    if (!g[k].length) continue;
    h += `<div class="grupo ${k === "vencido" || k === "hoy" ? "alerta" : ""}">${nombre} · ${g[k].length}</div>` + g[k].map(filaItem).join("");
  }
  const rev = q("SELECT * FROM movil_revisar");
  if (rev.length) {
    h += `<div class="grupo">A revisar · ${rev.length}</div>` + rev.map((r) => `<a class="fila" href="#/exp/${r.exp_id}"><div class="cuerpo">
      <div class="t"><span class="ref" style="font-family:var(--mono);color:var(--verde)">${esc(r.ref)}</span> ${esc(r.cliente || "")}</div>
      <div class="m">${esc(r.descripcion)} · ${r.ultimo ? "sin movimiento desde " + fecha(r.ultimo) : "sin movimiento"}</div></div></a>`).join("");
  }
  if (!items.length && !rev.length) h += `<div class="vacio">No hay nada pendiente.</div>`;
  $("#vista").innerHTML = h;
}

/* ---------- Expedientes ---------- */
let filtroExp = "abiertos", textoExp = "";
function vistaExpedientes() {
  titulo("Expedientes"); marcarPestana("expedientes");
  $("#vista").innerHTML = `<input class="buscar" id="b" type="search" placeholder="Buscar: cliente, contrario, juzgado, autos…" value="${esc(textoExp)}">
    <div class="filtro">${[["abiertos", "Abiertos"], ["suspendidos", "Suspendidos"], ["cerrados", "Cerrados"], ["todos", "Todos"]]
      .map(([k, n]) => `<button data-f="${k}" class="${filtroExp === k ? "activo" : ""}">${n}</button>`).join("")}</div><div id="res"></div>`;
  const filas = q(`SELECT e.*, c.nombre AS cliente FROM expedientes e LEFT JOIN clientes c ON c.id=e.cliente_id ORDER BY e.referencia DESC`);
  const pintarLista = () => {
    const t = sinAcentos(textoExp).split(/\s+/).filter(Boolean);
    const est = { abiertos: "abierto", suspendidos: "suspendido", cerrados: "cerrado" }[filtroExp];
    const r = filas.filter((e) => (!est || e.estado === est) && t.every((p) => sinAcentos([e.referencia, e.cliente, e.descripcion, e.contrario, e.organo, e.numero_procedimiento, e.materia, e.designacion_icam].join(" ")).includes(p)));
    $("#res").innerHTML = r.length ? r.map((e) => `<a class="fila" href="#/exp/${e.id}"><div class="cuerpo">
      <div class="t">${esc(e.cliente || "—")}</div>
      <div class="m"><span class="ref">${esc(e.referencia)}</span> · ${esc(e.descripcion)}${e.contrario ? " · c/ " + esc(e.contrario) : ""}${e.estado !== "abierto" ? ` · <span class="marca e-${e.estado}">${e.estado}</span>` : ""}</div></div></a>`).join("")
      : `<div class="vacio">Ningún expediente coincide.</div>`;
  };
  $("#b").addEventListener("input", (ev) => { textoExp = ev.target.value; pintarLista(); });
  document.querySelectorAll(".filtro button").forEach((b) => b.onclick = () => { filtroExp = b.dataset.f; vistaExpedientes(); });
  pintarLista();
}

/* ---------- Ficha de expediente ---------- */
function vistaExpediente(id) {
  const e = q1(`SELECT e.*, c.nombre AS cliente, c.telefono AS cli_tel, c.email AS cli_email, c.id AS cli_id
    FROM expedientes e LEFT JOIN clientes c ON c.id=e.cliente_id WHERE e.id=?`, [id]);
  if (!e) { $("#vista").innerHTML = `<div class="vacio">Ese expediente no está en la copia.</div>`; return; }
  titulo(e.referencia, true); marcarPestana("expedientes");
  const dato = (n, v) => v ? `<dt>${n}</dt><dd>${v}</dd>` : "";
  const tel = (t) => t ? `<a href="tel:${esc(String(t).replace(/[^\d+]/g, ""))}">${esc(t)}</a>` : "";
  const mail = (m) => m ? `<a href="mailto:${esc(m)}">${esc(m)}</a>` : "";
  let h = `<div class="tarjeta cab-exp"><div class="ref">${esc(e.referencia)} <span class="marca e-${e.estado}">${esc(e.estado)}</span></div>
    <div class="cli">${e.cli_id ? `<a href="#/cli/${e.cli_id}" style="color:inherit">${esc(e.cliente)}</a>` : "—"}</div>
    <div class="des">${esc(e.descripcion)}</div></div>`;

  // Lo que hay por delante
  const venc = q(`SELECT * FROM vencimientos WHERE expediente_id=? AND estado='pendiente' ORDER BY fecha_limite, hora_limite`, [id]);
  const conPrueba = new Set(venc.filter((v) => v.juicio_id).map((v) => v.juicio_id));
  const tar = q(`SELECT * FROM tareas WHERE expediente_id=? AND estado='pendiente' ORDER BY fecha_limite IS NULL, fecha_limite`, [id])
    .filter((t) => !(t.vencimiento_id && conPrueba.has(t.vencimiento_id)));
  if (venc.length || tar.length) {
    h += `<div class="tarjeta"><h2>Por delante</h2>` +
      venc.map((v) => filaItem({ tipo: "vencimiento", clase: v.juicio_id ? "prueba" : /^(juicio|vista|conciliaci|comparecencia|señalamiento)/i.test(v.descripcion) ? "juicio" : "plazo",
        fecha: v.fecha_limite, hora: v.hora_limite, texto: v.descripcion.toUpperCase() === "JUICIO" ? (e.organo || "Juicio") : v.descripcion, ref: null, exp_id: null, enFicha: true })).join("") +
      tar.map((t) => filaItem({ tipo: "tarea", clase: "tarea", fecha: t.fecha_limite, texto: t.texto, ref: null, exp_id: null, enFicha: true })).join("") + `</div>`;
  }

  // Datos
  h += `<div class="tarjeta"><h2>Datos</h2><dl class="datos">
    ${dato("Materia", esc(e.materia))}${dato("Contrario", esc(e.contrario))}
    ${dato("Letrado contrario", [esc(e.letrado_contrario), tel(e.letrado_contrario_telefono), mail(e.letrado_contrario_email)].filter(Boolean).join("<br>"))}
    ${dato("Órgano", esc(e.organo))}${dato("Autos", esc(e.numero_procedimiento))}
    ${dato("Designación", e.designacion_icam ? esc(e.designacion_icam) + (e.fecha_designacion ? " · " + fecha(e.fecha_designacion) : "") : "")}
    ${dato("Cliente", [tel(e.cli_tel), mail(e.cli_email)].filter(Boolean).join("<br>"))}
    ${dato("Apertura", fecha(e.fecha_apertura))}${dato("Cierre", fecha(e.fecha_cierre))}
    ${dato("Carpeta", esc(e.carpeta_relativa || e.ruta_carpeta))}${dato("Notas", esc(e.notas).replace(/\n/g, "<br>"))}
  </dl></div>`;

  // Cronología: anotaciones y documentos juntos
  const marc = Object.fromEntries(q(`SELECT * FROM documentos_marcados WHERE expediente_id=?`, [id]).map((m) => [m.ruta_relativa.replace(/\\/g, "/"), m]));
  const docs = q(`SELECT * FROM movil_documentos WHERE expediente_id=?`, [id]).map((d) => {
    const rel = (d.subcarpeta ? d.subcarpeta + "/" : "") + d.nombre, m = marc[rel] || {};
    return { k: "doc", fecha: (m.fecha_documento || d.fecha).slice(0, 10), hora: d.fecha.slice(11), d, m };
  });
  const act = q(`SELECT * FROM actuaciones WHERE expediente_id=?`, [id]).map((a) => ({ k: "act", fecha: a.fecha.slice(0, 10), hora: (a.creado || "").slice(11, 16), a }));
  const todo = [...act, ...docs].sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora) * (ordenCrono === "desc" ? -1 : 1));
  h += `<div class="tarjeta"><h2>Cronología · ${act.length} anotaciones · ${docs.length} documentos
    <a href="javascript:void(0)" id="orden" style="float:right;text-transform:none;letter-spacing:0">${ordenCrono === "desc" ? "↓ lo último primero" : "↑ lo primero primero"}</a></h2>`;
  if (!todo.length) h += `<div class="vacio">Sin anotaciones ni documentos.</div>`;
  else {
    h += `<div class="crono">`; let dia = null;
    for (const x of todo) {
      if (x.fecha !== dia) { dia = x.fecha; h += `<div class="dia">${fecha(dia)}</div>`; }
      if (x.k === "act") h += `<div class="item nota"><small>${esc(x.a.tipo || "Nota")}</small><br>${esc(x.a.descripcion)}</div>`;
      else { const [cl, et] = familia(x.d.nombre);
        h += `<div class="item"><button class="doc" data-ruta="${esc(x.d.ruta)}"><span class="ic ${cl}">${esc(et)}</span><span class="nom">${esc(x.m.descripcion || x.d.nombre)}${x.d.subcarpeta || x.m.descripcion ? `<span class="sub">${esc([x.d.subcarpeta, x.m.descripcion ? x.d.nombre : ""].filter(Boolean).join(" · "))}</span>` : ""}</span></button></div>`; }
    }
    h += `</div>`;
  }
  h += `</div>`;

  // Economía y turno de oficio
  const mov = q(`SELECT * FROM movimientos WHERE expediente_id=? AND anulado=0 ORDER BY fecha`, [id]);
  if (mov.length) {
    const tot = (t) => mov.filter((m) => m.tipo === t).reduce((s, m) => s + m.importe, 0);
    h += `<div class="tarjeta"><h2>Economía</h2><table class="mov">${mov.map((m) => `<tr><td style="width:78px">${fecha(m.fecha)}</td>
      <td>${esc(m.tipo)} · ${esc(m.concepto)}</td><td class="dinero">${euros(m.importe)}</td></tr>`).join("")}</table>
      <p style="font-size:13px;margin:8px 0 0">Minutado ${euros(tot("minuta"))} · Cobrado ${euros(tot("cobro"))}</p></div>`;
  }
  const just = q(`SELECT * FROM justificaciones_icam WHERE expediente_id=? AND anulado=0 ORDER BY fecha_envio`, [id]);
  if (just.length) h += `<div class="tarjeta"><h2>Turno de oficio · justificaciones</h2>${just.map((j) => `<div style="padding:4px 0">${fecha(j.fecha_envio)} · ${j.insostenibilidad ? "Insostenibilidad" : j.actuacion + "ª actuación"}${j.documentos ? `<br><small style="color:var(--tinta-40)">${esc(j.documentos)}</small>` : ""}</div>`).join("")}</div>`;

  $("#vista").innerHTML = h;
  $("#orden").onclick = () => { ordenCrono = ordenCrono === "desc" ? "asc" : "desc"; vistaExpediente(id); };
  document.querySelectorAll(".doc").forEach((b) => b.onclick = () => abrirDocumento(b.dataset.ruta));
}

/* ---------- Clientes ---------- */
let textoCli = "";
function vistaClientes() {
  titulo("Clientes"); marcarPestana("clientes");
  $("#vista").innerHTML = `<input class="buscar" id="b" type="search" placeholder="Buscar: nombre, NIF, teléfono…" value="${esc(textoCli)}"><div id="res" class="lista-simple"></div>`;
  const filas = q(`SELECT c.*, (SELECT count(*) FROM expedientes e WHERE e.cliente_id=c.id) AS n,
    (SELECT count(*) FROM expedientes e WHERE e.cliente_id=c.id AND e.estado='abierto') AS ab FROM clientes c ORDER BY c.nombre`);
  const pintarLista = () => {
    const t = sinAcentos(textoCli).split(/\s+/).filter(Boolean);
    const r = filas.filter((c) => t.every((p) => sinAcentos([c.nombre, c.nif, c.telefono, c.email].join(" ")).includes(p)));
    $("#res").innerHTML = r.map((c) => `<a class="fila" href="#/cli/${c.id}"><div class="cuerpo"><div class="t">${esc(c.nombre)}</div>
      <div class="m">${c.n} expediente${c.n === 1 ? "" : "s"}${c.ab ? ` (${c.ab} abierto${c.ab === 1 ? "" : "s"})` : ""}${c.telefono ? " · " + esc(c.telefono) : ""}</div></div></a>`).join("") || `<div class="vacio">Ningún cliente coincide.</div>`;
  };
  $("#b").addEventListener("input", (ev) => { textoCli = ev.target.value; pintarLista(); });
  pintarLista();
}
function vistaCliente(id) {
  const c = q1(`SELECT * FROM clientes WHERE id=?`, [id]);
  if (!c) { $("#vista").innerHTML = `<div class="vacio">Ese cliente no está en la copia.</div>`; return; }
  titulo(c.nombre, true); marcarPestana("clientes");
  const dato = (n, v) => v ? `<dt>${n}</dt><dd>${v}</dd>` : "";
  const exps = q(`SELECT * FROM expedientes WHERE cliente_id=? ORDER BY referencia DESC`, [id]);
  $("#vista").innerHTML = `<div class="tarjeta"><div class="cab-exp"><div class="cli">${esc(c.nombre)}</div></div><dl class="datos" style="margin-top:8px">
    ${dato("NIF", esc(c.nif))}${dato("Teléfono", c.telefono ? `<a href="tel:${esc(c.telefono.replace(/[^\d+]/g, ""))}">${esc(c.telefono)}</a>` : "")}
    ${dato("Email", c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : "")}${dato("Domicilio", esc(c.domicilio))}
    ${dato("Contacto", esc(c.contacto))}${dato("Observaciones", esc(c.observaciones).replace(/\n/g, "<br>"))}</dl></div>
    <div class="grupo">Expedientes · ${exps.length}</div>` + exps.map((e) => `<a class="fila" href="#/exp/${e.id}"><div class="cuerpo">
    <div class="t">${esc(e.descripcion)}</div><div class="m"><span class="ref">${esc(e.referencia)}</span> · <span class="marca e-${e.estado}">${e.estado}</span>${e.organo ? " · " + esc(e.organo) : ""}</div></div></a>`).join("");
}

/* ---------- Más ---------- */
function vistaMas() {
  titulo("Más"); marcarPestana("mas");
  const docs = META.copia_documentos ? fecha(META.copia_documentos) + " a las " + META.copia_documentos.slice(11) : "sin datos";
  $("#vista").innerHTML = `<div class="tarjeta"><h2>Datos</h2><dl class="datos">
    <dt>Gestor</dt><dd>${fecha(META.generado)} a las ${esc((META.generado || "").slice(11))}<br><small style="color:var(--tinta-40)">${esc(META.equipo)}</small></dd>
    <dt>Documentos</dt><dd>copia de L: a OneDrive del ${docs}</dd>
    <dt>Cuenta</dt><dd>${PRUEBA ? "modo de prueba" : esc(cuenta?.username || "—")}</dd></dl>
    <p style="font-size:13px;color:var(--tinta-70);line-height:1.45">Solo consulta: desde aquí no se cambia nada. Los datos los pone al día el gestor
    del despacho cada 15 minutos mientras está abierto; los documentos, la copia semanal de los viernes.</p>
    <button class="boton" id="act">⟳ Actualizar ahora</button></div>
    ${PRUEBA ? "" : `<div class="tarjeta"><button class="boton sec" id="salir">Cerrar sesión y borrar los datos de este teléfono</button></div>`}`;
  $("#act").onclick = () => actualizar(false);
  if (!PRUEBA) $("#salir").onclick = async () => { if (!confirm("¿Cerrar sesión y borrar los datos guardados en este teléfono?")) return; await borrarLocal(); await msalApp.logoutRedirect({ account: cuenta }); };
}

/* ---------- Navegación y arranque ---------- */
function pintar() {
  if (!DB) return;
  const h = location.hash.replace(/^#/, "") || "/";
  let m;
  if ((m = h.match(/^\/exp\/(\d+)/))) vistaExpediente(+m[1]);
  else if ((m = h.match(/^\/cli\/(\d+)/))) vistaCliente(+m[1]);
  else if (h.startsWith("/expedientes")) vistaExpedientes();
  else if (h.startsWith("/clientes")) vistaClientes();
  else if (h.startsWith("/mas")) vistaMas();
  else vistaInicio();
  window.scrollTo(0, 0);
}
function portada(texto, boton) {
  titulo("Expedientes");
  $("#vista").innerHTML = `<div class="portada"><img src="logo-192.png" alt=""><h2>Expedientes</h2><p>${texto}</p>${boton || ""}</div>`;
}
async function arrancar() {
  if ("serviceWorker" in navigator && !PRUEBA) navigator.serviceWorker.register("sw.js").catch(() => {});
  SQL = await initSqlJs({ locateFile: (f) => f });
  window.addEventListener("hashchange", pintar);
  $("#btn-actualizar").onclick = () => actualizar(false);
  if (!PRUEBA) {
    if (C.clientId === "PENDIENTE") { portada("Falta registrar la aplicación en Microsoft."); return; }
    try { await iniciarMsal(); } catch (e) { portada("No se ha podido conectar con Microsoft: " + esc(e.message)); return; }
    if (!cuenta) {
      portada("Consulta de los expedientes del despacho, solo lectura. Entra con la cuenta de Microsoft de tu OneDrive personal.",
        `<button class="boton" id="entrar">Entrar con Microsoft</button>`);
      $("#entrar").onclick = () => msalApp.loginRedirect({ scopes: C.scopes, prompt: "select_account" });
      return;
    }
  }
  $("#pestanas").hidden = false; $("#btn-actualizar").hidden = false;
  const local = PRUEBA ? null : await leerLocal();
  if (local) { await abrirBase(local); pintar(); actualizar(true); }       // abre al momento y actualiza por detrás
  else { portada("Descargando los datos del gestor…"); await actualizar(true); if (!DB) portada("No se han podido descargar los datos. Comprueba la conexión y pulsa ⟳."); }
}
arrancar();
