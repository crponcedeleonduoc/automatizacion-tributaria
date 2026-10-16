"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import PanelMarco, { Kpi, hace } from "@/components/PanelMarco";
import { api, clp, fecha } from "@/lib/api";

const PLANES = ["gratis", "pyme", "contador"];

export default function Admin() {
  const router = useRouter();
  const [res, setRes] = useState<any>(null);
  const [us, setUs] = useState<any[]>([]);
  const [filtro, setFiltro] = useState("");
  const [correo, setCorreo] = useState("");
  const [msg, setMsg] = useState("");

  const cargar = useCallback(async () => {
    try { const [r, u] = await Promise.all([api("/api/admin/resumen"), api("/api/admin/usuarios")]); setRes(r); setUs(u); }
    catch (e: any) { if (e.status === 403) router.replace("/panel"); }
  }, [router]);
  useEffect(() => { cargar(); }, [cargar]);

  async function cambiar(id: string, datos: any) {
    setMsg("");
    try { await api(`/api/admin/usuarios/${id}`, { method: "PUT", body: JSON.stringify(datos) }); cargar(); }
    catch (e: any) { setMsg(e.message); }
  }
  async function prueba(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    try { await api("/api/admin/correo-prueba", { method: "POST", body: JSON.stringify({ para: correo }) }); setMsg(`Correo de prueba enviado a ${correo}.`); }
    catch (err: any) { setMsg(err.message); }
  }

  const lista = us.filter((u) => !filtro || u.email.includes(filtro) || u.nombre?.toLowerCase().includes(filtro) || u.ruts.some((r: string) => r.includes(filtro)));

  return (
    <PanelMarco titulo="Administración" sub="Usuarios, planes y estado del sistema">
      {res && (
        <div className="grid gap-4 md:grid-cols-4">
          <Kpi t="Usuarios" v={res.usuarios} />
          <Kpi t="RUT conectados" v={res.empresas} alerta={res.credenciales_invalidas > 0} />
          <Kpi t="MRR (planes activos)" v={clp(res.mrr_clp)} />
          <Kpi t="Consultas 24 h" v={<span>{res.trabajos_24h?.ok || 0} ok{res.trabajos_24h?.error ? <span className="text-base text-rojo"> · {res.trabajos_24h.error} error</span> : null}</span>} alerta={(res.trabajos_24h?.error || 0) > 0} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-2xl border border-borde bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-borde px-5 py-3">
            <span className="font-extrabold">Usuarios</span>
            <input className="campo !w-64 !py-2 !text-sm" placeholder="Buscar correo, nombre o RUT" value={filtro} onChange={(e) => setFiltro(e.target.value.toLowerCase())} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#FAFBFD] text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><tr><th className="px-5 py-2.5">Usuario</th><th className="px-5 py-2.5">RUT</th><th className="px-5 py-2.5">Plan</th><th className="px-5 py-2.5">Última consulta</th><th className="px-5 py-2.5">Estado</th></tr></thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.id} className={`border-t border-borde-suave ${!u.activo ? "opacity-50" : ""}`}>
                    <td className="px-5 py-2.5"><div className="font-semibold">{u.email}{u.es_admin && <span className="ml-2 rounded bg-azul-claro px-1.5 text-[10px] font-bold text-azul">ADMIN</span>}</div><div className="text-xs text-tinta-4">{u.nombre || "—"} · desde {fecha(u.creado)}</div></td>
                    <td className="px-5 py-2.5 text-xs">{u.ruts.length ? u.ruts.join(", ") : <span className="text-tinta-4">ninguno</span>}</td>
                    <td className="px-5 py-2.5">
                      <select className="campo !w-auto !py-1.5 !text-xs" value={u.plan} onChange={(e) => cambiar(u.id, { plan: e.target.value })}>
                        {PLANES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-2.5 text-tinta-3">{u.ultima_consulta ? hace(u.ultima_consulta) : "nunca"}</td>
                    <td className="px-5 py-2.5">
                      <button onClick={() => cambiar(u.id, { activo: !u.activo })} className={`text-xs font-bold ${u.activo ? "text-rojo" : "text-verde"}`}>{u.activo ? "Desactivar" : "Activar"}</button>
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-tinta-4">Sin usuarios.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="tarjeta flex flex-col gap-3">
            <span className="text-lg font-extrabold">Correo</span>
            <div className="flex items-center gap-2 text-sm"><span className={`h-2.5 w-2.5 rounded-full ${res?.smtp ? "bg-verde" : "bg-rojo"}`} />{res?.smtp ? "SMTP configurado" : "SMTP no configurado (SMTP_HOST en .env)"}</div>
            <span className="text-sm text-tinta-3">{res?.alertas_sin_enviar ?? 0} alerta(s) pendientes de envío.</span>
            <form onSubmit={prueba} className="flex gap-2">
              <input className="campo !py-2 !text-sm" type="email" placeholder="correo@destino.cl" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
              <button className="btn-borde-azul shrink-0 !py-2 !text-sm" disabled={!res?.smtp}>Probar</button>
            </form>
          </div>
          {res && (
            <div className="tarjeta flex flex-col gap-2 text-sm">
              <span className="text-lg font-extrabold">Por plan</span>
              {PLANES.map((p) => <div key={p} className="flex justify-between"><span className="capitalize">{p}</span><b>{res.usuarios_por_plan?.[p] || 0}</b></div>)}
              {res.credenciales_invalidas > 0 && <span className="mt-2 text-rojo">{res.credenciales_invalidas} RUT con clave rechazada por el SII.</span>}
            </div>
          )}
          {msg && <p className={`text-sm ${msg.startsWith("Correo de prueba") ? "text-verde" : "text-rojo"}`}>{msg}</p>}
        </div>
      </div>
    </PanelMarco>
  );
}
