"use strict";

/* ---------- Utilidades ---------- */
const $ = (s) => document.querySelector(s);
const ARS = (n) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const hoy = () => new Date().toISOString().slice(0, 10);
const fmtFecha = (f) => f.split("-").reverse().join("/");
const sumar = (lista, cond = () => true) => lista.filter(cond).reduce((t, m) => t + m.monto, 0);

const CATS = {
  comida: "#f59e0b", transporte: "#3b82f6", ocio: "#a855f7", hogar: "#10b981",
  salud: "#ef4444", trabajo: "#14b8a6", otros: "#94a3b8"
};

/* ---------- Estado ---------- */
let S = { movs: [], ahorros: [], metas: [] };
try { S = { ...S, ...JSON.parse(localStorage.getItem("finanzas-pro")) }; } catch { /* sin datos */ }

// Migra la versión anterior (una sola meta) al formato de varias metas
if (S.meta) {
  if (S.meta.monto > 0 || S.ahorros.length) S.metas.push({ id: 1, nombre: S.meta.nombre, monto: S.meta.monto || 1, limite: "" });
  delete S.meta;
}
S.ahorros = S.ahorros.map((a, i) => ({ id: Date.now() + i, metaId: S.metas[0]?.id, fecha: hoy(), ...a }));

let mes = hoy().slice(0, 7);
let editId = null;

function guardar() {
  try { localStorage.setItem("finanzas-pro", JSON.stringify(S)); } catch { /* sin almacenamiento */ }
  render();
}

/* ---------- Render ---------- */
function render() {
  const delMes = S.movs.filter((m) => m.fecha.startsWith(mes));
  const ing = sumar(delMes, (m) => m.tipo === "ingreso");
  const gas = sumar(delMes, (m) => m.tipo === "gasto");
  const ahorrado = sumar(S.ahorros);
  const disponible = sumar(S.movs, (m) => m.tipo === "ingreso") - sumar(S.movs, (m) => m.tipo === "gasto") - ahorrado;

  $("#kpis").innerHTML = [
    ["Disponible", disponible, disponible < 0 ? "bad" : ""],
    ["Ingresos del mes", ing, "ok"],
    ["Gastos del mes", gas, "bad"],
    ["Ahorrado", ahorrado, ""]
  ].map(([k, v, c]) => `<div class="kpi"><small>${k}</small><b class="${c}">${ARS(v)}</b></div>`).join("");

  const q = $("#q").value.trim().toLowerCase();
  const tipo = $("#ft").value;
  const visibles = delMes
    .filter((m) => (tipo === "todos" || m.tipo === tipo) && `${m.desc} ${m.cat}`.toLowerCase().includes(q))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);

  $("#lista").innerHTML = visibles.map((m) => `
    <div class="fila">
      <div class="info"><strong>${esc(m.desc)}</strong><small>${esc(m.cat)} · ${fmtFecha(m.fecha)}</small></div>
      <b class="${m.tipo === "ingreso" ? "ok" : "bad"}">${m.tipo === "ingreso" ? "+" : "−"} ${ARS(m.monto)}</b>
      <button data-edit="${m.id}">Editar</button>
      <button data-del="${m.id}" aria-label="Eliminar ${esc(m.desc)}">✕</button>
    </div>`).join("") || `<p class="vacio">No hay movimientos para mostrar.</p>`;

  const porCat = {};
  delMes.filter((m) => m.tipo === "gasto").forEach((m) => { porCat[m.cat] = (porCat[m.cat] || 0) + m.monto; });
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);

  let acum = 0;
  $("#dona").style.background = cats.length
    ? `conic-gradient(${cats.map(([c, v]) => {
        const ini = acum; acum += (v / gas) * 100;
        return `${CATS[c] || CATS.otros} ${ini}% ${acum}%`;
      }).join(",")})`
    : "var(--line)";
  $("#leyenda").innerHTML = cats.map(([c, v]) =>
    `<li><i style="background:${CATS[c] || CATS.otros}"></i>${esc(c)}<b>${Math.round((v / gas) * 100)}%</b></li>`
  ).join("") || `<li>Sin gastos este mes.</li>`;

  renderAhorros();
}

/* ---------- Formulario ---------- */
function salirEdicion() {
  editId = null;
  $("#f").reset();
  $("#f").fecha.value = hoy();
  $("#tituloForm").textContent = "Nuevo movimiento";
  $("#cancelar").hidden = true;
}

$("#f").addEventListener("submit", (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  const datos = { desc: d.desc.trim(), monto: Number(d.monto), tipo: d.tipo, cat: d.cat, fecha: d.fecha };
  if (!datos.desc || !(datos.monto > 0)) return;

  if (editId) S.movs = S.movs.map((m) => (m.id === editId ? { ...m, ...datos } : m));
  else S.movs.push({ id: Date.now(), ...datos });

  mes = datos.fecha.slice(0, 7);
  $("#mes").value = mes;
  salirEdicion();
  guardar();
});

$("#cancelar").addEventListener("click", salirEdicion);

$("#lista").addEventListener("click", (e) => {
  const { edit, del } = e.target.dataset;
  if (edit) {
    const m = S.movs.find((x) => x.id === Number(edit));
    const f = $("#f");
    f.desc.value = m.desc; f.monto.value = m.monto; f.tipo.value = m.tipo; f.cat.value = m.cat; f.fecha.value = m.fecha;
    editId = m.id;
    $("#tituloForm").textContent = "Editar movimiento";
    $("#cancelar").hidden = false;
    f.desc.focus();
    f.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (del && confirm("¿Eliminar este movimiento?")) {
    S.movs = S.movs.filter((m) => m.id !== Number(del));
    if (editId === Number(del)) salirEdicion();
    guardar();
  }
});

/* ---------- Filtros ---------- */
$("#mes").addEventListener("change", (e) => { if (e.target.value) { mes = e.target.value; render(); } });
$("#q").addEventListener("input", render);
$("#ft").addEventListener("change", render);

/* ---------- Pestañas ---------- */
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
  $("#vista-gastos").hidden = t.dataset.vista !== "gastos";
  $("#vista-ahorros").hidden = t.dataset.vista !== "ahorros";
}));

/* ---------- Ahorros ---------- */
const totalMeta = (id) => sumar(S.ahorros, (a) => a.metaId === id);
const disponibleTotal = () =>
  sumar(S.movs, (m) => m.tipo === "ingreso") - sumar(S.movs, (m) => m.tipo === "gasto") - sumar(S.ahorros);

function renderAhorros() {
  const cumplidas = S.metas.filter((m) => totalMeta(m.id) >= m.monto).length;
  $("#kpisAh").innerHTML = [
    ["Total ahorrado", ARS(sumar(S.ahorros)), ""],
    ["Metas activas", S.metas.length - cumplidas, ""],
    ["Metas cumplidas", cumplidas, "ok"]
  ].map(([k, v, c]) => `<div class="kpi"><small>${k}</small><b class="${c}">${v}</b></div>`).join("");

  $("#metas").innerHTML = S.metas.map((m) => {
    const ah = totalMeta(m.id);
    const falta = Math.max(0, m.monto - ah);
    const pct = Math.max(0, Math.min(100, Math.round((ah / m.monto) * 100)));
    let sugerencia = "";
    if (m.limite && falta > 0) {
      const ms = new Date(m.limite) - new Date();
      const meses = Math.max(1, Math.ceil(ms / (30.44 * 864e5)));
      sugerencia = ms < 0 ? "Fecha límite vencida" : `Sugerido: ${ARS(Math.ceil(falta / meses))} por mes hasta el ${fmtFecha(m.limite)}`;
    }
    return `
      <article class="panel meta" data-meta="${m.id}">
        <div class="meta-top">
          <h3>${esc(m.nombre)}</h3>
          <button class="ghost" data-delmeta="1" aria-label="Eliminar meta ${esc(m.nombre)}">✕</button>
        </div>
        <b class="meta-monto">${ARS(ah)} <small>de ${ARS(m.monto)}</small></b>
        <div class="progreso"><i style="width:${pct}%"></i></div>
        <p class="meta-info">${pct}%${falta ? ` · faltan ${ARS(falta)}` : " · ¡Meta cumplida! 🎉"}</p>
        ${sugerencia ? `<p class="meta-info">${sugerencia}</p>` : ""}
        <div class="fila2">
          <input type="number" min="1" placeholder="Monto" aria-label="Monto a aportar o retirar">
          <button class="primary" data-ah="1">Aportar</button>
          <button class="ghost" data-ah="-1">Retirar</button>
        </div>
      </article>`;
  }).join("") || `<p class="vacio panel">Creá tu primera meta de ahorro.</p>`;

  const nombres = Object.fromEntries(S.metas.map((m) => [m.id, m.nombre]));
  $("#listaAh").innerHTML = S.ahorros.slice().sort((a, b) => b.id - a.id).map((a) => `
    <div class="fila">
      <div class="info"><strong>${esc(nombres[a.metaId] || "Meta eliminada")}</strong><small>${a.monto > 0 ? "Aporte" : "Retiro"} · ${fmtFecha(a.fecha)}</small></div>
      <b class="${a.monto > 0 ? "ok" : "bad"}">${a.monto > 0 ? "+" : "−"} ${ARS(Math.abs(a.monto))}</b>
      <button data-delah="${a.id}" aria-label="Eliminar movimiento">✕</button>
    </div>`).join("") || `<p class="vacio">Todavía no hay movimientos de ahorro.</p>`;
}

$("#fMeta").addEventListener("submit", (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  S.metas.push({ id: Date.now(), nombre: d.nombre.trim(), monto: Number(d.monto), limite: d.limite || "" });
  e.target.reset();
  guardar();
});

$("#metas").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  const card = b && b.closest("[data-meta]");
  if (!card) return;
  const id = Number(card.dataset.meta);

  if (b.dataset.delmeta) {
    if (!confirm("¿Eliminar esta meta? Se borra su historial y el dinero vuelve a tu saldo disponible.")) return;
    S.metas = S.metas.filter((m) => m.id !== id);
    S.ahorros = S.ahorros.filter((a) => a.metaId !== id);
    return guardar();
  }

  if (b.dataset.ah) {
    const monto = Number(card.querySelector("input").value);
    const signo = Number(b.dataset.ah);
    if (!(monto > 0)) return alert("Ingresá un monto válido.");
    if (signo > 0 && monto > disponibleTotal()) return alert("No tenés tanto saldo disponible.");
    if (signo < 0 && monto > totalMeta(id)) return alert("No tenés tanto ahorrado en esta meta.");
    S.ahorros.push({ id: Date.now(), metaId: id, monto: monto * signo, fecha: hoy() });
    guardar();
  }
});

$("#listaAh").addEventListener("click", (e) => {
  const id = Number(e.target.dataset.delah);
  const a = S.ahorros.find((x) => x.id === id);
  if (!a) return;
  if (a.monto > 0 && totalMeta(a.metaId) - a.monto < 0) return alert("No podés eliminar este aporte porque la meta quedaría en negativo.");
  if (a.monto < 0 && disponibleTotal() + a.monto < 0) return alert("No podés eliminar este retiro: tu saldo disponible quedaría en negativo.");
  if (!confirm("¿Eliminar este movimiento de ahorro?")) return;
  S.ahorros = S.ahorros.filter((x) => x.id !== id);
  guardar();
});

/* ---------- Exportar CSV y datos de ejemplo ---------- */
$("#csv").addEventListener("click", () => {
  const filas = [["fecha", "tipo", "categoria", "descripcion", "monto"]]
    .concat(S.movs.map((m) => [m.fecha, m.tipo, m.cat, `"${m.desc.replace(/"/g, '""')}"`, m.monto]));
  const blob = new Blob(["\uFEFF" + filas.map((f) => f.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "movimientos.csv" });
  a.click();
  URL.revokeObjectURL(a.href);
});

$("#demo").addEventListener("click", () => {
  if (S.movs.length && !confirm("Esto agrega movimientos de ejemplo a los que ya tenés. ¿Continuar?")) return;
  const dia = (n) => `${mes}-${String(n).padStart(2, "0")}`;
  const ejemplo = [
    ["Sueldo", 850000, "ingreso", "trabajo", 1], ["Alquiler", 280000, "gasto", "hogar", 3],
    ["Supermercado", 96000, "gasto", "comida", 5], ["SUBE y combustible", 42000, "gasto", "transporte", 8],
    ["Cena con amigos", 38000, "gasto", "ocio", 12], ["Farmacia", 21000, "gasto", "salud", 14],
    ["Proyecto freelance", 150000, "ingreso", "trabajo", 15], ["Verdulería", 24000, "gasto", "comida", 18],
    ["Streaming", 9500, "gasto", "ocio", 20]
  ];
  ejemplo.forEach(([desc, monto, tipo, cat, d], i) => S.movs.push({ id: Date.now() + i, desc, monto, tipo, cat, fecha: dia(d) }));
  if (!S.metas.length) {
    const id = Date.now() + 99;
    S.metas.push({ id, nombre: "Viaje", monto: 600000, limite: `${Number(mes.slice(0, 4)) + 1}-${mes.slice(5)}-28` });
    S.ahorros.push({ id: id + 1, metaId: id, monto: 120000, fecha: dia(16) });
  }
  guardar();
});

/* ---------- Tema ---------- */
const guardado = (() => { try { return localStorage.getItem("tema"); } catch { return null; } })();
document.documentElement.dataset.theme = guardado || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
$("#tema").addEventListener("click", () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("tema", t); } catch { /* sin almacenamiento */ }
});

/* ---------- Inicio ---------- */
$("#cat").innerHTML = Object.keys(CATS).map((c) => `<option>${c}</option>`).join("");
$("#mes").value = mes;
$("#f").fecha.value = hoy();
render();