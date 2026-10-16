"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import PanelMarco, { Kpi, hace } from "@/components/PanelMarco";
import { api, clp, descargar, fecha, periodoLegible } from "@/lib/api";

type Tab = "rcv" | "tgr" | "f29" | "alertas" | "actividad" | "ajustes";

export default function EmpresaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [e, setE] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("rcv");
  const [yo, setYo] = useState<any>(null);
  const [msg, setMsg] = useState("");

  const cargar = useCallback(async () => {
    try { setE(await api(`/api/empresas/${id}`)); } catch { router.replace("/panel"); }
  }, [id, router]);
  useEffect(() => { cargar(); api("/api/auth/yo").then(setYo).catch(() => {}); const i = setInterval(cargar, 15000); return () => clearInterval(i); }, [cargar]);

  async function sincronizar(tipo: string) {
    setMsg("");
    try { await api(`/api/empresas/${id}/sincronizar/${tipo}`, { method: "POST" }); setMsg(`Consulta ${tipo.toUpperCase()} encolada.`); }
    catch (err: any) { setMsg(err.message); }
  }

  const docs: string[] = yo?.plan === "gratis" ? ["rcv"] : ["rcv", "tgr", "f29"];

  return (
    <PanelMarco titulo={e?.razon_social || e?.rut || "…"} sub={e && <><Link href="/panel">Mis RUT</Link> · {e.rut} · RCV {hace(e.ultima_rcv)}</>}
      acciones={<>
        <Link href="/panel/reportes" className="btn-azul !px-4 !py-3 !text-sm">Generar reporte</Link>
        {["rcv", "tgr", "f29"].map((t) => (
          <button key={t} onClick={() => sincronizar(t)} disabled={!docs.includes(t) || e?.credencial_invalida}
                  title={!docs.includes(t) ? "No incluido en tu plan" : ""} className="btn-borde !px-4 !py-[11px] !text-sm">Actualizar {t.toUpperCase()}</button>
        ))}
      </>}>

      {msg && <p className="rounded-xl bg-azul-claro px-4 py-3 text-sm text-azul">{msg}</p>}
      {e?.credencial_invalida && <p className="rounded-xl bg-rojo-claro px-4 py-3 text-sm text-rojo">El SII rechazó la clave tributaria de este RUT. Actualízala en Ajustes para reanudar las consultas.</p>}
      {e?.ultimo_error && !e?.credencial_invalida && <p className="rounded-xl bg-naranja-claro px-4 py-3 text-sm text-naranja-texto">Último error: {e.ultimo_error}</p>}

      {e && (
        <div className="grid gap-4 md:grid-cols-4">
          <Kpi t="Documentos este mes" v={e.docs_mes} />
          <Kpi t="Deuda TGR" v={e.deuda_tgr === null ? "—" : clp(e.deuda_tgr)} alerta={!!e.deuda_tgr} />
          <Kpi t="Alertas sin leer" v={e.alertas_sin_leer} alerta={e.alertas_sin_leer > 0} />
          <Kpi t="Última TGR / F29" v={<span className="text-base">{hace(e.ultima_tgr)} / {hace(e.ultima_f29)}</span>} />
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-xl bg-[#E9EDF5] p-1">
        {([["rcv", "RCV"], ["tgr", "Deuda TGR"], ["f29", "F29"], ["alertas", "Alertas"], ["actividad", "Actividad"], ["ajustes", "Ajustes"]] as [Tab, string][]).map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-[9px] px-4 py-2 text-sm font-bold ${tab === k ? "bg-white text-azul shadow-card" : "text-tinta-3"}`}>{t}</button>
        ))}
      </div>

      {tab === "rcv" && <TabRcv id={id} rut={e?.rut} />}
      {tab === "tgr" && <TabTgr id={id} />}
      {tab === "f29" && <TabF29 id={id} />}
      {tab === "alertas" && <TabAlertas id={id} recargar={cargar} />}
      {tab === "actividad" && <TabActividad id={id} />}
      {tab === "ajustes" && e && <TabAjustes e={e} recargar={cargar} />}
    </PanelMarco>
  );
}

function Caja({ children, titulo, extra }: { children: React.ReactNode; titulo?: string; extra?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-borde bg-white">
      {titulo && <div className="flex items-center justify-between border-b border-borde px-5 py-3.5"><span className="font-extrabold">{titulo}</span>{extra}</div>}
      {children}
    </div>
  );
}

function TabRcv({ id, rut }: { id: string; rut?: string }) {
  const [resumen, setResumen] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [descargas, setDescargas] = useState<any[]>([]);
  const [operacion, setOperacion] = useState("VENTA");
  useEffect(() => {
    api(`/api/empresas/${id}/rcv/resumen`).then(setResumen).catch(() => {});
    api(`/api/empresas/${id}/rcv/descargas`).then(setDescargas).catch(() => {});
  }, [id]);
  useEffect(() => { api(`/api/empresas/${id}/rcv?operacion=${operacion}&limite=300`).then(setDocs).catch(() => {}); }, [id, operacion]);

  const periodos = Array.from(new Set(resumen.map((r) => r.periodo))).sort().reverse().slice(0, 6);
  const tot = (p: string, op: string, k: string) => resumen.filter((r) => r.periodo === p && r.operacion === op && r.estado === "REGISTRO").reduce((s, r) => s + r[k], 0);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-6">
        <Caja titulo="Resumen por período">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><tr><th className="px-5 py-2.5">Período</th><th className="px-5 py-2.5 text-right">Ventas</th><th className="px-5 py-2.5 text-right">IVA débito</th><th className="px-5 py-2.5 text-right">Compras</th><th className="px-5 py-2.5 text-right">IVA crédito</th></tr></thead>
              <tbody>
                {periodos.map((p) => (
                  <tr key={p} className="border-t border-borde-suave"><td className="px-5 py-3 font-semibold">{periodoLegible(p)}</td><td className="px-5 py-3 text-right">{clp(tot(p, "VENTA", "total"))}</td><td className="px-5 py-3 text-right">{clp(tot(p, "VENTA", "iva"))}</td><td className="px-5 py-3 text-right">{clp(tot(p, "COMPRA", "total"))}</td><td className="px-5 py-3 text-right">{clp(tot(p, "COMPRA", "iva"))}</td></tr>
                ))}
                {periodos.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-tinta-4">Aún no hay datos. Apreta “Actualizar RCV”.</td></tr>}
              </tbody>
            </table>
          </div>
        </Caja>
        <Caja titulo="Documentos" extra={
          <div className="flex gap-1 rounded-lg bg-[#E9EDF5] p-0.5">{["VENTA", "COMPRA"].map((op) => <button key={op} onClick={() => setOperacion(op)} className={`rounded-md px-3 py-1 text-xs font-bold ${operacion === op ? "bg-white text-azul" : "text-tinta-3"}`}>{op === "VENTA" ? "Ventas" : "Compras"}</button>)}</div>}>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-[#FAFBFD] text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><tr><th className="px-5 py-2.5">Folio</th><th className="px-5 py-2.5">{operacion === "VENTA" ? "Receptor" : "Proveedor"}</th><th className="px-5 py-2.5">Fecha</th><th className="px-5 py-2.5 text-right">Total</th><th className="px-5 py-2.5">Estado</th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-t border-borde-suave">
                    <td className="px-5 py-2.5 font-mono text-xs">{d.tipo_doc}-{d.folio}</td>
                    <td className="max-w-[260px] truncate px-5 py-2.5">{d.razon_social}<span className="block text-xs text-tinta-4">{d.rut}</span></td>
                    <td className="px-5 py-2.5 text-tinta-3">{d.fecha_emision}</td>
                    <td className="px-5 py-2.5 text-right font-semibold">{clp(d.total)}</td>
                    <td className="px-5 py-2.5"><Estado e={d.estado} acuse={d.fecha_acuse} /></td>
                  </tr>
                ))}
                {docs.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-tinta-4">Sin documentos.</td></tr>}
              </tbody>
            </table>
          </div>
        </Caja>
      </div>
      <div className="flex flex-col gap-6">
      <DescargaMasiva id={id} rut={rut} />
      <Caja titulo="Descargas CSV">
        <div className="flex max-h-[600px] flex-col divide-y divide-borde-suave overflow-auto">
          {descargas.map((d) => (
            <button key={d.id} type="button" onClick={() => descargar(`/api/empresas/${id}/rcv/descargas/${d.id}/csv`, `RCV_${d.operacion}_${d.estado}_${rut}_${d.periodo}.csv`)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-[13px] hover:bg-fondo">
              <div className="flex min-w-0 flex-col"><span className="truncate font-semibold">RCV_{d.operacion}_{d.estado}_{rut}_{d.periodo}.csv</span><span className="text-xs text-tinta-4">{d.n_docs} docs · {fecha(d.creado)}</span></div><span className="font-bold text-azul">↓</span>
            </button>
          ))}
          {descargas.length === 0 && <span className="p-5 text-sm text-tinta-4">Todavía no hay archivos.</span>}
        </div>
      </Caja>
      </div>
    </div>
  );
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function SelectorPeriodo({ v, onChange, min }: { v: string; onChange: (p: string) => void; min: number }) {
  const hoy = new Date();
  const anios = Array.from({ length: hoy.getFullYear() - min + 1 }, (_, i) => hoy.getFullYear() - i);
  return (
    <div className="flex gap-1.5">
      <select className="campo !w-auto !py-2 !text-sm" value={v.slice(4)} onChange={(e) => onChange(v.slice(0, 4) + e.target.value)}>
        {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
      </select>
      <select className="campo !w-auto !py-2 !text-sm" value={v.slice(0, 4)} onChange={(e) => onChange(e.target.value + v.slice(4))}>
        {anios.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );
}

function DescargaMasiva({ id, rut }: { id: string; rut?: string }) {
  const hoy = new Date();
  const actual = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const [desde, setDesde] = useState(`${hoy.getFullYear() - 1}01`);
  const [hasta, setHasta] = useState(actual);
  const [ops, setOps] = useState<string[]>(["COMPRA", "VENTA"]);
  const [lista, setLista] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const cargar = useCallback(() => api(`/api/empresas/${id}/rcv/historico`).then(setLista).catch(() => {}), [id]);
  useEffect(() => { cargar(); }, [cargar]);
  const activo = lista.some((t) => t.estado === "pendiente" || t.estado === "corriendo");
  useEffect(() => { if (!activo) return; const i = setInterval(cargar, 4000); return () => clearInterval(i); }, [activo, cargar]);
  const n = (parseInt(hasta.slice(0, 4)) - parseInt(desde.slice(0, 4))) * 12 + parseInt(hasta.slice(4)) - parseInt(desde.slice(4)) + 1;

  async function lanzar() {
    setMsg(""); setEnviando(true);
    try { await api(`/api/empresas/${id}/rcv/historico`, { method: "POST", body: JSON.stringify({ desde, hasta, operaciones: ops }) }); cargar(); }
    catch (e: any) { setMsg(e.message); } finally { setEnviando(false); }
  }
  const tog = (o: string) => setOps((a) => a.includes(o) ? a.filter((x) => x !== o) : [...a, o]);

  return (
    <Caja titulo="Descarga masiva">
      <div className="flex flex-col gap-4 p-5">
        <p className="text-[13px] text-tinta-3">Todos los RCV de un rango de meses en un solo ZIP: un CSV por mes, operación y estado, más un consolidado por operación.</p>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-[0.06em] text-tinta-4">Desde</label><SelectorPeriodo v={desde} onChange={setDesde} min={2014} />
          <label className="mt-1 text-xs font-bold uppercase tracking-[0.06em] text-tinta-4">Hasta</label><SelectorPeriodo v={hasta} onChange={setHasta} min={2014} />
        </div>
        <div className="flex gap-4 text-sm">
          {["COMPRA", "VENTA"].map((o) => <label key={o} className="flex items-center gap-2"><input type="checkbox" checked={ops.includes(o)} onChange={() => tog(o)} />{o === "COMPRA" ? "Compras" : "Ventas"}</label>)}
        </div>
        {msg && <p className="text-sm text-rojo">{msg}</p>}
        <button onClick={lanzar} disabled={enviando || activo || n < 1 || ops.length === 0 || hasta > actual} className="btn-azul !py-2.5 !text-sm">
          {activo ? "Descarga en curso…" : n >= 1 ? `Descargar ${n} mes${n !== 1 ? "es" : ""}` : "Rango inválido"}
        </button>
        {n > 1 && !activo && <span className="text-xs text-tinta-4">Tarda ≈ {Math.max(1, Math.round(n * 10 / 60))} min. Puedes cerrar esta página; el ZIP queda en la lista.</span>}
      </div>
      {lista.length > 0 && (
        <div className="flex flex-col divide-y divide-borde-suave border-t border-borde">
          {lista.map((t) => {
            const r = t.resultado || {}; const p = t.parametros || {};
            const pct = r.total ? Math.round(100 * (r.progreso || 0) / r.total) : 0;
            return (
              <div key={t.id} className="flex flex-col gap-1.5 px-5 py-3 text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{periodoLegible(p.desde)} → {periodoLegible(p.hasta)}<span className="ml-2 text-xs font-normal text-tinta-4">{(p.operaciones || []).map((o: string) => o === "COMPRA" ? "compras" : "ventas").join(" + ")}</span></span>
                  {t.estado === "ok" && t.tiene_archivo && <button type="button" onClick={() => descargar(`/api/empresas/${id}/rcv/historico/${t.id}/zip`, `RCV_${rut}_${p.desde}-${p.hasta}.zip`)} className="font-bold text-azul">ZIP ↓</button>}
                  {t.estado === "error" && <span className="font-bold text-rojo">error</span>}
                </div>
                {(t.estado === "corriendo" || t.estado === "pendiente") && (
                  <div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-borde"><div className="h-full bg-azul transition-all" style={{ width: `${pct}%` }} /></div><span className="text-xs text-tinta-4">{r.progreso || 0}/{r.total || "?"}</span></div>
                )}
                <span className="text-xs text-tinta-4" title={t.error || ""}>{t.error || r.resumen || (t.estado === "pendiente" ? "En cola…" : "")}{r.tamano ? ` · ${(r.tamano / 1024).toFixed(0)} KB` : ""} · {fecha(t.creado)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Caja>
  );
}

function Estado({ e, acuse }: { e: string; acuse?: string }) {
  const m: Record<string, [string, string]> = { REGISTRO: ["Aceptada", "bg-verde-claro text-verde"], PENDIENTE: ["Pendiente", "bg-naranja-claro text-naranja-texto"], RECLAMADO: ["Reclamada", "bg-rojo-claro text-rojo"], NO_INCLUIR: ["No incluir", "bg-borde text-tinta-3"] };
  const [t, c] = m[e] || [e, "bg-borde"];
  return <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${c}`} title={acuse ? `Acuse: ${acuse}` : ""}>{t}</span>;
}

function TabTgr({ id }: { id: string }) {
  const [certs, setCerts] = useState<any[]>([]);
  useEffect(() => { api(`/api/empresas/${id}/tgr`).then(setCerts).catch(() => {}); }, [id]);
  const ult = certs[0];
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
      <Caja titulo={ult ? `Certificado del ${ult.fecha_emision || fecha(ult.creado)}` : "Deuda TGR"}>
        {!ult && <p className="p-6 text-sm text-tinta-4">Aún no hay certificados. Apreta “Actualizar TGR” (tarda 1 a 2 minutos).</p>}
        {ult && (
          <div className="flex flex-col gap-4 p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Kpi t="Deuda morosa" v={clp(ult.total_morosa)} alerta={ult.total_morosa > 0} />
              <Kpi t="Deuda no vencida" v={clp(ult.total_no_vencida)} />
              <Kpi t="Giros" v={ult.n_giros} />
            </div>
            {ult.lineas?.length > 0 && (
              <table className="w-full text-left text-[13px]">
                <thead className="text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><tr><th className="py-2">Form.</th><th className="py-2">Folio</th><th className="py-2">Vence</th><th className="py-2 text-right">Neta</th><th className="py-2 text-right">Multa</th><th className="py-2 text-right">Total</th></tr></thead>
                <tbody>{ult.lineas.map((l: any, i: number) => <tr key={i} className="border-t border-borde-suave"><td className="py-2">{l.formulario}</td><td className="py-2 font-mono text-xs">{l.folio}</td><td className="py-2 text-tinta-3">{l.vencimiento}</td><td className="py-2 text-right">{clp(l.neta)}</td><td className="py-2 text-right">{clp(l.multa)}</td><td className="py-2 text-right font-semibold">{clp(l.total)}</td></tr>)}</tbody>
              </table>
            )}
            {ult.tiene_pdf && <button type="button" onClick={() => descargar(`/api/empresas/${id}/tgr/${ult.id}/pdf`, `TGR_${ult.fecha_emision || ult.id}.pdf`)} className="btn-borde-azul self-start !py-3 !text-sm">Descargar certificado PDF</button>}
          </div>
        )}
      </Caja>
      <Caja titulo="Historial">
        <div className="divide-y divide-borde-suave">
          {certs.map((c) => <div key={c.id} className="flex justify-between px-5 py-3 text-[13px]"><span className="text-tinta-3">{fecha(c.creado)}</span><span className={`font-semibold ${c.total_morosa ? "text-rojo" : "text-verde"}`}>{c.total_morosa ? clp(c.total_morosa) : "Sin deuda"}</span></div>)}
          {certs.length === 0 && <span className="block p-5 text-sm text-tinta-4">Sin consultas todavía.</span>}
        </div>
      </Caja>
    </div>
  );
}

function TabF29({ id }: { id: string }) {
  const [filas, setFilas] = useState<any[]>([]);
  const [gestion, setGestion] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [msg, setMsg] = useState("");
  const cargar = useCallback(() => {
    api(`/api/empresas/${id}/f29`).then(setFilas).catch(() => {});
    api(`/api/empresas/${id}/f29/gestion`).then(setGestion).catch(() => {});
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);
  const est: Record<string, [string, string]> = { declarado: ["Declarado", "bg-verde-claro text-verde"], no_declarado: ["Sin declarar", "bg-rojo-claro text-rojo"], observado: ["Observado", "bg-naranja-claro text-naranja-texto"], sin_periodo: ["—", "text-tinta-4"] };

  async function guardar() {
    try {
      await api(`/api/empresas/${id}/f29/gestion/${edit.periodo}`, { method: "PUT", body: JSON.stringify({
        monto: edit.monto === "" || edit.monto === null ? null : Number(edit.monto),
        monto_multa: edit.monto_multa === "" || edit.monto_multa === null ? null : Number(edit.monto_multa),
        estado: edit.estado, prioridad: edit.prioridad, accion: edit.accion,
        fecha_compromiso: edit.fecha_compromiso || null, fecha_cierre: edit.fecha_cierre || null, comentario: edit.comentario || "" }) });
      setEdit(null); setMsg("Guardado."); cargar();
    } catch (err: any) { setMsg(err.message); }
  }

  const totalMulta = gestion.reduce((s, g) => s + (g.monto_multa || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {msg && <p className="rounded-xl bg-azul-claro px-4 py-3 text-sm text-azul">{msg}</p>}
      <Caja titulo={`Seguimiento de F29 no declarados / observados · ${gestion.length} período(s)`} extra={<span className="text-sm font-bold">{totalMulta ? `Con multa: ${clp(totalMulta)}` : ""}</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#FAFBFD] text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><tr><th className="px-4 py-2.5">Período</th><th className="px-4 py-2.5">SII</th><th className="px-4 py-2.5 text-right">Monto</th><th className="px-4 py-2.5 text-right">Con multa</th><th className="px-4 py-2.5">Estado</th><th className="px-4 py-2.5">Prioridad</th><th className="px-4 py-2.5">Acción</th><th className="px-4 py-2.5">Comentario</th><th className="px-4 py-2.5"></th></tr></thead>
            <tbody>
              {gestion.map((g) => (
                <tr key={g.periodo} className="border-t border-borde-suave">
                  <td className="px-4 py-2.5 font-semibold">{periodoLegible(g.periodo)}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-md px-2 py-0.5 text-xs font-bold ${est[g.estado_sii]?.[1]}`}>{g.estado_sii === "no_declarado" ? "ND" : "OBS"}</span></td>
                  <td className="px-4 py-2.5 text-right">{g.monto !== null ? clp(g.monto) : <span className="text-tinta-4">auto</span>}</td>
                  <td className="px-4 py-2.5 text-right">{g.monto_multa !== null ? clp(g.monto_multa) : "—"}{g.fuente_multa && <span className="ml-1 text-[10px] text-tinta-4">({g.fuente_multa})</span>}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-md px-2 py-0.5 text-xs font-bold ${g.estado === "Cerrada" ? "bg-verde-claro text-verde" : "bg-naranja-claro text-naranja-texto"}`}>{g.estado}</span></td>
                  <td className={`px-4 py-2.5 font-bold ${g.prioridad === "Alta" ? "text-rojo" : g.prioridad === "Media" ? "text-ambar" : "text-tinta-3"}`}>{g.prioridad}</td>
                  <td className="px-4 py-2.5">{g.accion}</td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-tinta-3" title={g.comentario}>{g.comentario}</td>
                  <td className="px-4 py-2.5"><button onClick={() => setEdit({ ...g })} className="chip">Editar</button></td>
                </tr>
              ))}
              {gestion.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-tinta-4">Sin períodos pendientes. Apreta “Actualizar F29” para leer la matriz del SII.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-xs text-tinta-4">Monto “auto” = IVA de compras del período según el RCV. El monto con multa lo determina el SII; ingrésalo aquí hasta que se extraiga automáticamente.</p>
      </Caja>

      <Caja titulo="Matriz de estados F29">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[#FAFBFD] text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><tr><th className="px-5 py-2.5">Período</th><th className="px-5 py-2.5">Estado</th><th className="px-5 py-2.5">Folio</th><th className="px-5 py-2.5">Archivo</th></tr></thead>
          <tbody>
            {filas.map((f) => { const [t, c] = est[f.estado] || [f.estado, ""]; return (
              <tr key={f.periodo} className="border-t border-borde-suave"><td className="px-5 py-3 font-semibold">{periodoLegible(f.periodo)}</td><td className="px-5 py-3"><span className={`rounded-md px-2 py-0.5 text-xs font-bold ${c}`}>{t}</span></td><td className="px-5 py-3 font-mono text-xs">{f.folio || "—"}</td><td className="px-5 py-3">{f.tiene_pdf ? <button type="button" onClick={() => descargar(`/api/empresas/${id}/f29/${f.periodo}/pdf`, `F29_${f.periodo}.pdf`)} className="font-bold text-azul">F29_{f.periodo}.pdf ↓</button> : "—"}</td></tr>); })}
            {filas.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-tinta-4">Aún no hay datos. Apreta “Actualizar F29” (tarda 1 a 3 minutos).</td></tr>}
          </tbody>
        </table>
      </Caja>

      {edit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-tinta/50 p-4" onClick={() => setEdit(null)}>
          <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[560px] flex-col gap-4 rounded-xl2 bg-white p-7 shadow-flot">
            <h2 className="text-2xl font-extrabold text-azul">F29 {periodoLegible(edit.periodo)}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold"><span>Monto (vacío = auto)</span><input className="campo" type="number" value={edit.monto ?? ""} onChange={(e) => setEdit({ ...edit, monto: e.target.value })} /></label>
              <label className="flex flex-col gap-1 text-sm font-semibold"><span>Monto con multa (SII)</span><input className="campo" type="number" value={edit.monto_multa ?? ""} onChange={(e) => setEdit({ ...edit, monto_multa: e.target.value })} /></label>
              <label className="flex flex-col gap-1 text-sm font-semibold"><span>Estado</span><select className="campo" value={edit.estado} onChange={(e) => setEdit({ ...edit, estado: e.target.value })}><option>Abierta</option><option>Cerrada</option></select></label>
              <label className="flex flex-col gap-1 text-sm font-semibold"><span>Prioridad</span><select className="campo" value={edit.prioridad} onChange={(e) => setEdit({ ...edit, prioridad: e.target.value })}><option>Alta</option><option>Media</option><option>Baja</option></select></label>
              <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2"><span>Acción</span><input className="campo" value={edit.accion} onChange={(e) => setEdit({ ...edit, accion: e.target.value })} /></label>
              <label className="flex flex-col gap-1 text-sm font-semibold"><span>Fecha compromiso</span><input className="campo" placeholder="DD-MM-AAAA" value={edit.fecha_compromiso ?? ""} onChange={(e) => setEdit({ ...edit, fecha_compromiso: e.target.value })} /></label>
              <label className="flex flex-col gap-1 text-sm font-semibold"><span>Fecha cierre</span><input className="campo" placeholder="DD-MM-AAAA" value={edit.fecha_cierre ?? ""} onChange={(e) => setEdit({ ...edit, fecha_cierre: e.target.value })} /></label>
              <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2"><span>Comentario</span><textarea className="campo" value={edit.comentario ?? ""} onChange={(e) => setEdit({ ...edit, comentario: e.target.value })} /></label>
            </div>
            <div className="flex justify-end gap-2.5"><button onClick={() => setEdit(null)} className="btn-borde !py-3 !text-sm">Cancelar</button><button onClick={guardar} className="btn-azul !py-3 !text-sm">Guardar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabAlertas({ id, recargar }: { id: string; recargar: () => void }) {
  const [als, setAls] = useState<any[]>([]);
  const cargar = useCallback(() => api(`/api/empresas/${id}/alertas`).then(setAls).catch(() => {}), [id]);
  useEffect(() => { cargar(); }, [cargar]);
  async function leidas() { await api(`/api/empresas/${id}/alertas/leidas`, { method: "POST" }); cargar(); recargar(); }
  return (
    <Caja titulo="Alertas" extra={<button onClick={leidas} className="chip">Marcar todas leídas</button>}>
      <div className="divide-y divide-borde-suave">
        {als.map((a) => <div key={a.id} className={`flex items-start gap-3 px-5 py-3.5 ${a.leida ? "opacity-60" : ""}`}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.tipo.includes("tgr") || a.tipo.includes("credencial") ? "bg-rojo" : "bg-ambar"}`} /><div className="flex flex-col gap-0.5 text-[13px]"><span className="font-bold">{a.titulo}</span><span className="text-xs text-tinta-4">{fecha(a.creado)}</span></div></div>)}
        {als.length === 0 && <span className="block p-5 text-sm text-tinta-4">Sin alertas.</span>}
      </div>
    </Caja>
  );
}

function TabActividad({ id }: { id: string }) {
  const [filas, setFilas] = useState<any[]>([]);
  useEffect(() => { api(`/api/empresas/${id}/actividad`).then(setFilas).catch(() => {}); }, [id]);
  return (
    <Caja titulo="Registro de cada consulta hecha con este RUT">
      <table className="w-full text-left text-[13px]">
        <thead className="bg-[#FAFBFD] text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><tr><th className="px-5 py-2.5">Fecha y hora</th><th className="px-5 py-2.5">Documento</th><th className="px-5 py-2.5">Resultado</th><th className="px-5 py-2.5">Detalle</th></tr></thead>
        <tbody>
          {filas.map((c, i) => <tr key={i} className="border-t border-borde-suave"><td className="px-5 py-2.5 text-tinta-3">{fecha(c.creado)}</td><td className="px-5 py-2.5 font-semibold">{c.tipo.toUpperCase()}</td><td className={`px-5 py-2.5 font-bold ${c.ok ? "text-verde" : "text-rojo"}`}>{c.ok ? "OK" : "Error"}</td><td className="max-w-[420px] truncate px-5 py-2.5 text-tinta-3" title={c.mensaje}>{c.mensaje} · {Math.round(c.duracion_ms / 1000)} s</td></tr>)}
          {filas.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-tinta-4">Sin consultas todavía.</td></tr>}
        </tbody>
      </table>
    </Caja>
  );
}

function TabAjustes({ e, recargar }: { e: any; recargar: () => void }) {
  const router = useRouter();
  const [clave, setClave] = useState(""); const [msg, setMsg] = useState("");
  async function guardar(ev: React.FormEvent) { ev.preventDefault(); try { await api(`/api/empresas/${e.id}/clave`, { method: "PUT", body: JSON.stringify({ clave }) }); setClave(""); setMsg("Clave actualizada. Se encoló una nueva consulta."); recargar(); } catch (err: any) { setMsg(err.message); } }
  async function eliminar() { if (!confirm(`¿Eliminar ${e.rut} con sus credenciales y todos sus datos? Esta acción no se puede deshacer.`)) return; await api(`/api/empresas/${e.id}`, { method: "DELETE" }); router.replace("/panel"); }
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Programacion e={e} recargar={recargar} />
      <form onSubmit={guardar} className="tarjeta flex flex-col gap-4">
        <span className="text-lg font-extrabold">Cambiar clave tributaria</span>
        <input className="campo" type="password" placeholder="Nueva clave" value={clave} autoComplete="off" onChange={(ev) => setClave(ev.target.value)} required />
        {msg && <p className="text-sm text-azul">{msg}</p>}
        <button className="btn-azul self-start !py-3 !text-sm">Guardar</button>
      </form>
      <div className="tarjeta flex flex-col gap-3 border-rojo/30">
        <span className="text-lg font-extrabold">Revocar acceso</span>
        <p className="text-sm text-tinta-3">Borra la clave, el historial descargado y las alertas de este RUT de forma inmediata.</p>
        <button onClick={eliminar} className="btn self-start border-2 border-rojo !py-3 !text-sm text-rojo hover:bg-rojo-claro">Eliminar este RUT</button>
      </div>
    </div>
  );
}

const FRECUENCIAS: [number, string][] = [[10, "Cada 10 minutos"], [30, "Cada 30 minutos"], [60, "Cada hora"], [180, "Cada 3 horas"], [360, "Cada 6 horas"], [720, "Dos veces al día"], [1440, "Una vez al día"]];
const NOMBRE_MIN: Record<number, string> = { 10: "Contador", 60: "Pyme" };

function Programacion({ e, recargar }: { e: any; recargar: () => void }) {
  const [frec, setFrec] = useState<number>(e.frecuencia_rcv_min);
  const [habil, setHabil] = useState<boolean>(e.solo_horario_habil);
  const [auto, setAuto] = useState<boolean>(e.auto_tgr_f29);
  const [msg, setMsg] = useState(""); const [ok, setOk] = useState(false);
  useEffect(() => { setFrec(e.frecuencia_rcv_min); setHabil(e.solo_horario_habil); setAuto(e.auto_tgr_f29); }, [e]);
  const min = e.frecuencia_minima_plan as number;
  const porDia = habil ? Math.round((15 * 60) / frec) : Math.round(1440 / frec);
  async function guardar(ev: React.FormEvent) {
    ev.preventDefault(); setMsg(""); setOk(false);
    try { await api(`/api/empresas/${e.id}/programacion`, { method: "PUT", body: JSON.stringify({ frecuencia_rcv_min: frec, solo_horario_habil: habil, auto_tgr_f29: auto }) }); setOk(true); setMsg("Programación guardada."); recargar(); }
    catch (err: any) { setMsg(err.message); }
  }
  return (
    <form onSubmit={guardar} className="tarjeta flex flex-col gap-4 md:col-span-2">
      <div className="flex flex-col gap-1"><span className="text-lg font-extrabold">Programación de consultas</span>
        <span className="text-sm text-tinta-3">Tú decides cada cuánto aSIIstente entra al SII con este RUT. Tu plan permite como mínimo {FRECUENCIAS.find(([m]) => m === min)?.[1].toLowerCase() || `cada ${min} min`}.</span></div>
      <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">RCV (registro de compras y ventas)
          <select className="campo" value={frec} onChange={(ev) => setFrec(Number(ev.target.value))}>
            {FRECUENCIAS.map(([m, t]) => <option key={m} value={m} disabled={m < min}>{t}{m < min ? ` · requiere plan ${NOMBRE_MIN[m] || "superior"}` : ""}</option>)}
          </select>
          <span className="text-xs font-normal text-tinta-4">≈ {porDia} consulta{porDia !== 1 ? "s" : ""} al SII por día{habil ? " (solo de 07:00 a 22:00)" : ""}.</span>
        </label>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex items-start gap-2.5"><input type="checkbox" className="mt-0.5" checked={habil} onChange={(ev) => setHabil(ev.target.checked)} /><span><b>Solo en horario hábil</b><br /><span className="text-tinta-3">RCV entre 07:00 y 22:00 hora de Chile. Menos carga en el portal y menos riesgo de bloqueos.</span></span></label>
          <label className="flex items-start gap-2.5"><input type="checkbox" className="mt-0.5" checked={auto} disabled={min > 60} onChange={(ev) => setAuto(ev.target.checked)} /><span><b>TGR y F29 automáticos</b><br /><span className="text-tinta-3">Una vez al día, entre 06:00 y 23:00.{min > 60 ? " Disponible en plan Pyme o Contador." : ""} Siempre puedes consultarlos a mano.</span></span></label>
        </div>
      </div>
      {msg && <p className={`text-sm ${ok ? "text-verde" : "text-rojo"}`}>{msg}</p>}
      <button className="btn-azul self-start !py-3 !text-sm">Guardar programación</button>
    </form>
  );
}
