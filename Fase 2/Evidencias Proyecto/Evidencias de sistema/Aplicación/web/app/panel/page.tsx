"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PanelMarco, { Kpi, hace } from "@/components/PanelMarco";
import { api, clp } from "@/lib/api";

export default function Panel() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [trabajos, setTrabajos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [agregar, setAgregar] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [msg, setMsg] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [e, t] = await Promise.all([api("/api/empresas"), api("/api/trabajos")]);
      setEmpresas(e); setTrabajos(t);
      const als = (await Promise.all(e.slice(0, 10).map((x: any) => api(`/api/empresas/${x.id}/alertas`).then((a: any[]) => a.map((al) => ({ ...al, rut: x.rut })))))).flat();
      als.sort((a, b) => (a.creado < b.creado ? 1 : -1));
      setAlertas(als.slice(0, 6));
    } catch {} finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); const i = setInterval(cargar, 15000); return () => clearInterval(i); }, [cargar]);

  async function actualizarTodo() {
    setRefrescando(true); setMsg("");
    try {
      await Promise.all(empresas.filter((e) => !e.credencial_invalida).map((e) => api(`/api/empresas/${e.id}/sincronizar/rcv`, { method: "POST" })));
      setMsg("Consultas encoladas. Se actualizan en segundos.");
    } catch (err: any) { setMsg(err.message); } finally { setRefrescando(false); setTimeout(cargar, 3000); }
  }

  const corriendo = trabajos.filter((t) => t.estado === "pendiente" || t.estado === "corriendo").length;
  const hoy = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const ultima = empresas.map((e) => e.ultima_rcv).filter(Boolean).sort().pop();

  return (
    <PanelMarco titulo="Mis RUT" sub={`${hoy.charAt(0).toUpperCase() + hoy.slice(1)} · última actualización ${hace(ultima)}`}
      acciones={<>
        <button onClick={actualizarTodo} disabled={refrescando || !empresas.length} className="btn-azul !px-4 !py-3 !text-sm">
          {refrescando && <span className="spinner h-3.5 w-3.5 !border-2 !border-white/40" style={{ borderTopColor: "#fff" }} />}{refrescando ? "Actualizando…" : "Actualizar ahora"}
        </button>
        <button onClick={() => setAgregar(true)} className="btn-borde !px-4 !py-[11px] !text-sm">+ Agregar RUT</button>
      </>}>

      {msg && <p className="rounded-xl bg-azul-claro px-4 py-3 text-sm text-azul">{msg}</p>}

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi t="RUT monitoreados" v={empresas.length} />
        <Kpi t="Consultas en curso" v={corriendo} />
        <Kpi t="Alertas sin revisar" v={empresas.reduce((s, e) => s + e.alertas_sin_leer, 0)} alerta={empresas.some((e) => e.alertas_sin_leer > 0)} />
        <Kpi t="Documentos este mes" v={empresas.reduce((s, e) => s + e.docs_mes, 0)} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-2xl border border-borde bg-white">
          <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr_0.9fr] border-b border-borde bg-[#FAFBFD] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><span>Contribuyente</span><span>RCV</span><span>Deuda TGR</span><span>F29</span><span>Ver</span></div>
          {cargando && <div className="p-8 text-center text-sm text-tinta-4">Cargando…</div>}
          {!cargando && empresas.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <span className="text-lg font-bold">Aún no tienes RUT conectados</span>
              <span className="text-sm text-tinta-3">Agrega tu primer RUT y aSIIstente hará la primera descarga al instante.</span>
              <button onClick={() => setAgregar(true)} className="btn-azul !text-sm">+ Agregar RUT</button>
            </div>
          )}
          {empresas.map((e) => (
            <div key={e.id} className="grid grid-cols-[1.8fr_1fr_1fr_1fr_0.9fr] items-center border-b border-borde-suave px-5 py-3.5 text-[13px] hover:bg-[#FAFBFD]">
              <div className="flex min-w-0 flex-col gap-0.5"><span className="truncate text-sm font-bold">{e.razon_social || e.rut}</span><span className="text-xs text-tinta-4">{e.rut}</span></div>
              <div className="flex flex-col gap-0.5">
                {e.credencial_invalida ? <span className="font-semibold text-rojo">Clave rechazada</span> : <span className={`font-semibold ${e.ultima_rcv ? "text-verde" : "text-tinta-4"}`}>{hace(e.ultima_rcv)}</span>}
                <span className="text-xs text-tinta-4">{e.docs_mes} docs este mes</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className={`font-semibold ${e.deuda_tgr ? "text-rojo" : e.deuda_tgr === 0 ? "text-verde" : "text-tinta-4"}`}>{e.deuda_tgr === null ? "—" : e.deuda_tgr === 0 ? "Sin deuda" : clp(e.deuda_tgr)}</span>
                <span className="text-xs text-tinta-4">{hace(e.ultima_tgr)}</span>
              </div>
              <div className="flex flex-col gap-0.5"><span className="font-semibold text-tinta-2">{e.ultima_f29 ? "Actualizado" : "—"}</span><span className="text-xs text-tinta-4">{hace(e.ultima_f29)}</span></div>
              <Link href={`/panel/empresa/${e.id}`} className="chip w-fit">Abrir</Link>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3.5 rounded-2xl border border-borde bg-white p-5">
            <div className="flex items-center justify-between"><span className="text-base font-extrabold">Alertas recientes</span><Link href="/panel/alertas" className="text-[13px] font-bold">Ver todas</Link></div>
            {alertas.length === 0 && <span className="text-sm text-tinta-4">Sin alertas por ahora.</span>}
            {alertas.map((a) => (
              <div key={a.id} className="flex items-start gap-3 border-t border-borde-suave py-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.tipo.includes("tgr") || a.tipo.includes("credencial") ? "bg-rojo" : a.tipo.includes("reclamada") || a.tipo.includes("f29") ? "bg-ambar" : "bg-verde"}`} />
                <div className="flex flex-col gap-0.5 text-[13px]"><span className="font-bold leading-snug">{a.titulo}</span><span className="text-xs text-tinta-4">{a.rut} · {hace(a.creado)}</span></div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-borde bg-white p-5">
            <span className="text-base font-extrabold">Últimos trabajos</span>
            {trabajos.slice(0, 5).map((t) => (
              <div key={t.id} className="flex justify-between gap-3 text-[13px]">
                <span className="truncate font-semibold">{t.tipo.toUpperCase()} · {t.rut}</span>
                <span className={`shrink-0 ${t.estado === "ok" ? "text-verde" : t.estado === "error" ? "text-rojo" : "text-ambar"}`}>{t.estado}</span>
              </div>
            ))}
            {trabajos.length === 0 && <span className="text-sm text-tinta-4">Todavía no hay consultas.</span>}
          </div>
        </div>
      </div>

      {agregar && <AgregarRut cerrar={() => { setAgregar(false); cargar(); }} />}
    </PanelMarco>
  );
}

function AgregarRut({ cerrar }: { cerrar: () => void }) {
  const [rut, setRut] = useState(""); const [clave, setClave] = useState(""); const [razon, setRazon] = useState("");
  const [error, setError] = useState(""); const [cargando, setCargando] = useState(false);
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setError(""); setCargando(true);
    try { await api("/api/empresas", { method: "POST", body: JSON.stringify({ rut, clave, razon_social: razon }) }); cerrar(); }
    catch (err: any) { setError(err.message); } finally { setCargando(false); }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-tinta/50 p-4" onClick={cerrar}>
      <form onSubmit={guardar} onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[440px] flex-col gap-4 rounded-xl2 bg-white p-7 shadow-flot">
        <h2 className="text-2xl font-extrabold text-azul">Agregar RUT</h2>
        <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>RUT</span><input className="campo" placeholder="77.218.696-7" value={rut} onChange={(e) => setRut(e.target.value)} required /></label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>Nombre (opcional)</span><input className="campo" placeholder="Ferretería El Tornillo Ltda." value={razon} onChange={(e) => setRazon(e.target.value)} /></label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>Clave tributaria</span><input className="campo" type="password" value={clave} autoComplete="off" onChange={(e) => setClave(e.target.value)} required /></label>
        {error && <p className="rounded-xl bg-rojo-claro p-3 text-sm text-rojo">{error}</p>}
        <div className="flex justify-end gap-2.5"><button type="button" onClick={cerrar} className="btn-borde !py-3 !text-sm">Cancelar</button><button className="btn-azul !py-3 !text-sm" disabled={cargando}>{cargando ? "Guardando…" : "Conectar y descargar"}</button></div>
      </form>
    </div>
  );
}
