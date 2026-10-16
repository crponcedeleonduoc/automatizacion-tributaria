"use client";

import { useCallback, useEffect, useState } from "react";
import PanelMarco from "@/components/PanelMarco";
import { api, fecha } from "@/lib/api";

const TABS: [string, string][] = [["", "Todas"], ["rcv", "RCV"], ["tgr", "TGR"], ["f29", "F29"], ["rcv_historico", "Descargas masivas"]];
const ESTADOS: [string, string][] = [["", "Todos"], ["ok", "OK"], ["error", "Error"], ["pendiente", "Pendientes"]];
const PAGINA = 50;

export default function Actividad() {
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [ts, setTs] = useState<any[]>([]);
  const [fin, setFin] = useState(false);
  const [resumen, setResumen] = useState<Record<string, Record<string, number>>>({});
  const [cargando, setCargando] = useState(false);

  const q = useCallback((desde: number) => {
    const p = new URLSearchParams({ limite: String(PAGINA), desde: String(desde) });
    if (tipo) p.set("tipo", tipo);
    if (estado) p.set("estado", estado);
    return api(`/api/trabajos?${p}`);
  }, [tipo, estado]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [lista, res] = await Promise.all([q(0), api("/api/trabajos/resumen")]);
      setTs(lista); setFin(lista.length < PAGINA); setResumen(res);
    } catch {} finally { setCargando(false); }
  }, [q]);

  useEffect(() => { cargar(); const i = setInterval(cargar, 15000); return () => clearInterval(i); }, [cargar]);

  async function mas() {
    setCargando(true);
    try { const lista = await q(ts.length); setTs((a) => [...a, ...lista]); setFin(lista.length < PAGINA); }
    catch {} finally { setCargando(false); }
  }

  const suma = (m: Record<string, number> | undefined) => Object.values(m || {}).reduce((a, b) => a + b, 0);
  const total = (t: string) => t ? suma(resumen[t]) : Object.values(resumen).reduce((s, m) => s + suma(m), 0);
  const errores = (t: string) => t ? resumen[t]?.error || 0 : Object.values(resumen).reduce((s, m) => s + (m.error || 0), 0);
  const dur = (t: any) => t.terminado ? `${Math.max(1, Math.round((new Date(t.terminado).getTime() - new Date(t.creado).getTime()) / 1000))} s` : "…";

  return (
    <PanelMarco titulo="Registro de actividad" sub="Cada consulta que aSIIstente hizo con tus RUT, por documento">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-borde bg-white p-1">
          {TABS.map(([v, t]) => (
            <button key={v} onClick={() => setTipo(v)} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${tipo === v ? "bg-azul text-white" : "text-tinta-3 hover:bg-fondo"}`}>
              {t}<span className={`rounded-md px-1.5 text-[11px] ${tipo === v ? "bg-white/20" : "bg-fondo text-tinta-4"}`}>{total(v)}</span>
              {errores(v) > 0 && <span className="h-2 w-2 rounded-full bg-rojo" title={`${errores(v)} con error`} />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-tinta-4">Estado</span>
          <select className="campo !w-auto !py-2 !text-sm" value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-borde bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[#FAFBFD] text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><tr><th className="px-5 py-2.5">Creado</th><th className="px-5 py-2.5">RUT</th>{!tipo && <th className="px-5 py-2.5">Documento</th>}<th className="px-5 py-2.5">Origen</th><th className="px-5 py-2.5">Estado</th><th className="px-5 py-2.5">Resultado</th><th className="px-5 py-2.5">Duración</th></tr></thead>
          <tbody>
            {ts.map((t) => (
              <tr key={t.id} className="border-t border-borde-suave"><td className="px-5 py-2.5 text-tinta-3">{fecha(t.creado)}</td><td className="px-5 py-2.5 font-semibold">{t.rut}</td>{!tipo && <td className="px-5 py-2.5">{t.tipo === "rcv_historico" ? "RCV masivo" : t.tipo.toUpperCase()}</td>}
                <td className="px-5 py-2.5 text-tinta-4">{t.origen === "scheduler" ? "Automática" : "Manual"}</td>
                <td className={`px-5 py-2.5 font-bold ${t.estado === "ok" ? "text-verde" : t.estado === "error" ? "text-rojo" : "text-ambar"}`}>{t.estado}</td>
                <td className="max-w-[420px] truncate px-5 py-2.5 text-tinta-3" title={t.error || t.resultado?.resumen}>{t.error || t.resultado?.resumen || "—"}</td>
                <td className="px-5 py-2.5 text-tinta-4">{dur(t)}</td></tr>
            ))}
            {ts.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-tinta-4">{cargando ? "Cargando…" : "No hay consultas con este filtro."}</td></tr>}
          </tbody>
        </table>
        {!fin && ts.length > 0 && (
          <div className="border-t border-borde p-3 text-center"><button onClick={mas} disabled={cargando} className="btn-borde !py-2 !text-sm">{cargando ? "Cargando…" : `Ver ${PAGINA} más`}</button></div>
        )}
      </div>
    </PanelMarco>
  );
}
