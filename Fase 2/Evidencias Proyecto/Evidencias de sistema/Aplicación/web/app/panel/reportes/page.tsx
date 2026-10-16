"use client";

// Reportes PDF personalizables: plantillas (bloques, columnas, período) + generación + historial.
import { useCallback, useEffect, useState } from "react";
import PanelMarco, { hace } from "@/components/PanelMarco";
import { api, clp, descargar, fecha, periodoLegible } from "@/lib/api";

type Catalogo = { bloques: Record<string, { nombre: string; descripcion: string; columnas: Record<string, string> }>; defecto: any };
const ORDEN = ["resumen", "tgr", "f29", "rcv"];

export default function Reportes() {
  const [cat, setCat] = useState<Catalogo | null>(null);
  const [plantillas, setPlantillas] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [reportes, setReportes] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);          // plantilla en edición
  const [empresaId, setEmpresaId] = useState("");
  const [msg, setMsg] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [c, p, e, r] = await Promise.all([
        api("/api/reportes/catalogo", { auth: false }), api("/api/reportes/plantillas"),
        api("/api/empresas"), api("/api/reportes")]);
      setCat(c); setPlantillas(p); setEmpresas(e); setReportes(r);
      setSel((s: any) => s ? p.find((x: any) => x.id === s.id) || p[0] : p[0]);
      setEmpresaId((id) => id || e[0]?.id || "");
    } catch (err: any) { setMsg(err.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!reportes.some((r) => r.estado === "pendiente" || r.estado === "corriendo")) return;
    const i = setInterval(() => api("/api/reportes").then(setReportes).catch(() => {}), 3000);
    return () => clearInterval(i);
  }, [reportes]);

  function setCfg(fn: (c: any) => any) {
    setSel((s: any) => ({ ...s, config: fn(structuredClone(s.config)) }));
  }

  async function guardar() {
    setGuardando(true); setMsg("");
    try {
      await api(`/api/reportes/plantillas/${sel.id}`, { method: "PUT", body: JSON.stringify({ nombre: sel.nombre, config: sel.config }) });
      setMsg("Plantilla guardada."); await cargar();
    } catch (err: any) { setMsg(err.message); } finally { setGuardando(false); }
  }

  async function nueva() {
    const p = await api("/api/reportes/plantillas", { method: "POST", body: JSON.stringify({ nombre: "Nueva plantilla", config: cat?.defecto }) });
    await cargar(); setSel(p);
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar la plantilla "${sel.nombre}"?`)) return;
    await api(`/api/reportes/plantillas/${sel.id}`, { method: "DELETE" }); setSel(null); await cargar();
  }

  async function generar() {
    if (!empresaId) { setMsg("Elige una empresa."); return; }
    setMsg("");
    try {
      await api("/api/reportes/generar", { method: "POST", body: JSON.stringify({ empresa_id: empresaId, plantilla_id: sel.id, config: sel.config, nombre: sel.config.titulo }) });
      setMsg("Generando el PDF… aparece abajo en unos segundos.");
      setReportes(await api("/api/reportes"));
    } catch (err: any) { setMsg(err.message); }
  }

  const cfg = sel?.config;

  return (
    <PanelMarco titulo="Reportes" sub="Arma una plantilla una vez y genera el PDF cuantas veces quieras"
      acciones={<button onClick={nueva} className="btn-borde !px-4 !py-[11px] !text-sm">+ Nueva plantilla</button>}>
      {msg && <p className="rounded-xl bg-azul-claro px-4 py-3 text-sm text-azul">{msg}</p>}

      <div className="grid items-start gap-6 xl:grid-cols-[260px_1fr]">
        {/* lista de plantillas */}
        <div className="overflow-hidden rounded-2xl border border-borde bg-white">
          <div className="border-b border-borde px-5 py-3.5 font-extrabold">Mis plantillas</div>
          {plantillas.map((p) => (
            <button key={p.id} onClick={() => setSel(p)} className={`flex w-full flex-col items-start border-b border-borde-suave px-5 py-3 text-left hover:bg-fondo ${sel?.id === p.id ? "bg-azul-claro" : ""}`}>
              <span className="text-sm font-bold">{p.nombre}</span>
              <span className="text-xs text-tinta-4">{p.config?.titulo} · {hace(p.actualizado)}</span>
            </button>
          ))}
        </div>

        {/* editor */}
        {sel && cat && (
          <div className="flex flex-col gap-5">
            <div className="tarjeta flex flex-col gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>Nombre de la plantilla</span>
                  <input className="campo" value={sel.nombre} onChange={(e) => setSel({ ...sel, nombre: e.target.value })} /></label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>Título en el PDF</span>
                  <input className="campo" value={cfg.titulo} onChange={(e) => setCfg((c) => ({ ...c, titulo: e.target.value }))} /></label>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">Período de la información</span>
                <div className="flex flex-wrap items-center gap-2">
                  {[["todo", "Todo lo disponible"], ["ultimos_meses", "Últimos N meses"], ["rango", "Rango de períodos"]].map(([m, t]) => (
                    <button key={m} onClick={() => setCfg((c) => ({ ...c, periodo: { modo: m, meses: c.periodo?.meses || 12, desde: c.periodo?.desde || "202101", hasta: c.periodo?.hasta || periodoActual() } }))}
                            className={`rounded-lg px-3 py-2 text-sm font-bold ${cfg.periodo?.modo === m ? "bg-azul text-white" : "border border-borde-campo text-tinta-2"}`}>{t}</button>
                  ))}
                  {cfg.periodo?.modo === "ultimos_meses" && (
                    <input type="number" min={1} max={120} className="campo !w-24" value={cfg.periodo.meses} onChange={(e) => setCfg((c) => ({ ...c, periodo: { ...c.periodo, meses: parseInt(e.target.value) || 1 } }))} />
                  )}
                  {cfg.periodo?.modo === "rango" && (
                    <><input className="campo !w-28" placeholder="AAAAMM" value={cfg.periodo.desde} onChange={(e) => setCfg((c) => ({ ...c, periodo: { ...c.periodo, desde: e.target.value } }))} />
                      <span className="text-tinta-4">a</span>
                      <input className="campo !w-28" placeholder="AAAAMM" value={cfg.periodo.hasta} onChange={(e) => setCfg((c) => ({ ...c, periodo: { ...c.periodo, hasta: e.target.value } }))} /></>
                  )}
                </div>
              </div>
            </div>

            {/* bloques */}
            {ORDEN.map((k) => {
              const b = cat.bloques[k]; const bc = cfg.bloques[k]; const cols = Object.entries(b.columnas);
              return (
                <div key={k} className={`tarjeta flex flex-col gap-3 ${bc.activo ? "" : "opacity-60"}`}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={bc.activo} onChange={(e) => setCfg((c) => { c.bloques[k].activo = e.target.checked; return c; })} className="mt-1 h-[18px] w-[18px] accent-azul" />
                    <div><div className="font-extrabold">{b.nombre}</div><div className="text-sm text-tinta-3">{b.descripcion}</div></div>
                  </label>
                  {bc.activo && cols.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-borde-suave pt-3">
                      <span className="text-xs font-bold uppercase tracking-wide text-tinta-4">Columnas (en el orden en que las marques)</span>
                      <div className="flex flex-wrap gap-2">
                        {cols.map(([id, nombre]) => {
                          const on = (bc.columnas || []).includes(id);
                          return (
                            <button key={id} onClick={() => setCfg((c) => { const l: string[] = c.bloques[k].columnas || []; c.bloques[k].columnas = on ? l.filter((x) => x !== id) : [...l, id]; return c; })}
                                    className={`rounded-md px-2.5 py-1.5 text-xs font-bold ${on ? "bg-azul text-white" : "border border-borde-campo text-tinta-3"}`}>{nombre}</button>
                          );
                        })}
                      </div>
                      {k === "f29" && (
                        <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-tinta-3">Incluir:</span>
                          {[["no_declarado", "No declarados"], ["observado", "Observados"]].map(([v, t]) => {
                            const on = (bc.incluir || []).includes(v);
                            return <button key={v} onClick={() => setCfg((c) => { const l: string[] = c.bloques.f29.incluir || []; c.bloques.f29.incluir = on ? l.filter((x) => x !== v) : [...l, v]; return c; })} className={`rounded-md px-2.5 py-1.5 text-xs font-bold ${on ? "bg-naranja text-white" : "border border-borde-campo text-tinta-3"}`}>{t}</button>;
                          })}</div>
                      )}
                      {k === "rcv" && (
                        <div className="flex items-center gap-2 text-sm"><span className="text-tinta-3">Operación:</span>
                          {["AMBAS", "COMPRA", "VENTA"].map((v) => <button key={v} onClick={() => setCfg((c) => { c.bloques.rcv.operacion = v; return c; })} className={`rounded-md px-2.5 py-1.5 text-xs font-bold ${bc.operacion === v ? "bg-azul text-white" : "border border-borde-campo text-tinta-3"}`}>{v === "AMBAS" ? "Compras y ventas" : v === "COMPRA" ? "Compras" : "Ventas"}</button>)}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="tarjeta flex flex-col gap-2">
              <span className="font-extrabold">Notas al final del reporte</span>
              <textarea className="campo min-h-[90px]" placeholder="Comentarios del contador, próximos pasos, contacto…" value={cfg.notas || ""} onChange={(e) => setCfg((c) => ({ ...c, notas: e.target.value }))} />
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-azul/30 bg-azul-claro p-4">
              <button onClick={guardar} disabled={guardando} className="btn-borde-azul !py-3 !text-sm">{guardando ? "Guardando…" : "Guardar plantilla"}</button>
              <select className="campo !w-auto !py-3" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.razon_social || e.rut} · {e.rut}</option>)}
              </select>
              <button onClick={generar} className="btn-azul !py-3 !text-sm">Generar PDF</button>
              <button onClick={eliminar} className="ml-auto text-sm font-bold text-rojo">Eliminar plantilla</button>
            </div>
          </div>
        )}
      </div>

      {/* historial */}
      <div className="overflow-hidden rounded-2xl border border-borde bg-white">
        <div className="border-b border-borde px-5 py-3.5 font-extrabold">Reportes generados</div>
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[#FAFBFD] text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><tr><th className="px-5 py-2.5">Fecha</th><th className="px-5 py-2.5">Reporte</th><th className="px-5 py-2.5">Empresa</th><th className="px-5 py-2.5">Período</th><th className="px-5 py-2.5 text-right">Total deuda</th><th className="px-5 py-2.5">Estado</th><th className="px-5 py-2.5"></th></tr></thead>
          <tbody>
            {reportes.map((r) => { const e = empresas.find((x) => x.id === r.empresa_id); return (
              <tr key={r.id} className="border-t border-borde-suave">
                <td className="px-5 py-2.5 text-tinta-3">{fecha(r.creado)}</td>
                <td className="px-5 py-2.5 font-semibold">{r.nombre}</td>
                <td className="px-5 py-2.5">{e?.razon_social || e?.rut || "—"}</td>
                <td className="px-5 py-2.5 text-tinta-3">{r.desde ? `${periodoLegible(r.desde)} – ${periodoLegible(r.hasta)}` : "—"}</td>
                <td className="px-5 py-2.5 text-right font-semibold">{r.resumen?.total !== undefined ? clp(r.resumen.total) : "—"}</td>
                <td className={`px-5 py-2.5 font-bold ${r.estado === "ok" ? "text-verde" : r.estado === "error" ? "text-rojo" : "text-ambar"}`} title={r.error || ""}>{r.estado}</td>
                <td className="px-5 py-2.5 text-right">
                  {r.tiene_pdf && <button onClick={() => descargar(`/api/reportes/${r.id}/pdf`, `${r.nombre}.pdf`)} className="chip">PDF ↓</button>}
                  <button onClick={async () => { if (confirm("¿Eliminar este reporte?")) { await api(`/api/reportes/${r.id}`, { method: "DELETE" }); cargar(); } }} className="ml-2 text-xs text-tinta-4 hover:text-rojo">Borrar</button>
                </td>
              </tr>); })}
            {reportes.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-tinta-4">Todavía no has generado reportes.</td></tr>}
          </tbody>
        </table>
      </div>
    </PanelMarco>
  );
}

function periodoActual() { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`; }
