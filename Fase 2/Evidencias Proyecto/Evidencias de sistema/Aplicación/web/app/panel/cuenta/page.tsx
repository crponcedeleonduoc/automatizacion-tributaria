"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PanelMarco from "@/components/PanelMarco";
import { api, waLink } from "@/lib/api";

export default function Cuenta() {
  const [yo, setYo] = useState<any>(null);
  const [planes, setPlanes] = useState<any[]>([]);
  useEffect(() => { api("/api/auth/yo").then(setYo).catch(() => {}); api("/api/planes", { auth: false }).then(setPlanes).catch(() => {}); }, []);
  const plan = planes.find((p) => p.codigo === yo?.plan);
  return (
    <PanelMarco titulo="Configuración" sub={yo?.email}>
      <div className="grid gap-6 md:grid-cols-2">
        {yo && <Perfil yo={yo} conCorreo={!!plan?.alertas_correo} onGuardado={setYo} />}
        <Password />
        <div className="tarjeta flex flex-col gap-3">
          <span className="text-lg font-extrabold">Tu plan</span>
          <span className="text-3xl font-extrabold text-azul">{plan?.nombre || "…"}</span>
          <p className="text-sm text-tinta-3">El cambio de plan y el pago con WebPay se habilitan en la siguiente versión. Mientras tanto, escríbenos por WhatsApp y lo activamos a mano.</p>
          <div className="flex gap-2.5"><Link href="/precios" className="btn-borde-azul !py-3 !text-sm">Ver planes</Link><a href={waLink("Hola, quiero cambiar mi plan de aSIIstente")} target="_blank" rel="noreferrer" className="btn-azul !py-3 !text-sm">Cambiar por WhatsApp</a></div>
        </div>
        <div className="tarjeta flex flex-col gap-3">
          <span className="text-lg font-extrabold">Tus datos</span>
          <p className="text-sm text-tinta-3">Puedes eliminar cualquier RUT (con su clave y su historial) desde la pestaña Ajustes de cada empresa. Para cerrar la cuenta completa, escribe a privacidad@asiistente.cl y lo hacemos dentro de 2 días hábiles.</p>
        </div>
      </div>
    </PanelMarco>
  );
}

function Perfil({ yo, conCorreo, onGuardado }: { yo: any; conCorreo: boolean; onGuardado: (u: any) => void }) {
  const [nombre, setNombre] = useState(yo.nombre || "");
  const [correos, setCorreos] = useState<boolean>(yo.recibir_correos);
  const [msg, setMsg] = useState("");
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    try { const u = await api("/api/auth/yo", { method: "PUT", body: JSON.stringify({ nombre, recibir_correos: correos }) }); onGuardado(u); setMsg("Guardado."); }
    catch (err: any) { setMsg(err.message); }
  }
  return (
    <form onSubmit={guardar} className="tarjeta flex flex-col gap-4">
      <span className="text-lg font-extrabold">Perfil y avisos</span>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Nombre<input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre o el de tu oficina" /></label>
      <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" className="mt-0.5" checked={correos} onChange={(e) => setCorreos(e.target.checked)} />
        <span><b>Recibir alertas por correo</b><br /><span className="text-tinta-3">Facturas reclamadas, deuda TGR que sube, F29 vencidos sin declarar y claves rechazadas, a {yo.email}.{!conCorreo && " Tu plan actual solo avisa por correo si el SII rechaza una clave; las demás alertas quedan en el panel."}</span></span></label>
      {msg && <p className={`text-sm ${msg === "Guardado." ? "text-verde" : "text-rojo"}`}>{msg}</p>}
      <button className="btn-azul self-start !py-3 !text-sm">Guardar</button>
    </form>
  );
}

function Password() {
  const [actual, setActual] = useState(""); const [nueva, setNueva] = useState(""); const [rep, setRep] = useState("");
  const [msg, setMsg] = useState(""); const [ok, setOk] = useState(false);
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); setOk(false);
    if (nueva !== rep) { setMsg("Las contraseñas nuevas no coinciden"); return; }
    try { await api("/api/auth/yo/password", { method: "PUT", body: JSON.stringify({ actual, nueva }) }); setOk(true); setMsg("Contraseña actualizada."); setActual(""); setNueva(""); setRep(""); }
    catch (err: any) { setMsg(err.message); }
  }
  return (
    <form onSubmit={guardar} className="tarjeta flex flex-col gap-4">
      <span className="text-lg font-extrabold">Cambiar contraseña</span>
      <input className="campo" type="password" placeholder="Contraseña actual" value={actual} onChange={(e) => setActual(e.target.value)} required autoComplete="current-password" />
      <input className="campo" type="password" placeholder="Nueva contraseña (mínimo 8)" value={nueva} onChange={(e) => setNueva(e.target.value)} minLength={8} required autoComplete="new-password" />
      <input className="campo" type="password" placeholder="Repite la nueva" value={rep} onChange={(e) => setRep(e.target.value)} minLength={8} required autoComplete="new-password" />
      {msg && <p className={`text-sm ${ok ? "text-verde" : "text-rojo"}`}>{msg}</p>}
      <button className="btn-azul self-start !py-3 !text-sm">Actualizar</button>
    </form>
  );
}
