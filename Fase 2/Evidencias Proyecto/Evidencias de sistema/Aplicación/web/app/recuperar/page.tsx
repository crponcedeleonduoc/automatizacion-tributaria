"use client";

import Link from "next/link";
import { useState } from "react";
import Sitio from "@/components/Sitio";
import { api } from "@/lib/api";

export default function Recuperar() {
  const [email, setEmail] = useState("");
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setError(""); setCargando(true);
    try { await api("/api/auth/recuperar", { method: "POST", auth: false, body: JSON.stringify({ email }) }); setListo(true); }
    catch (err: any) { setError(err.message); } finally { setCargando(false); }
  }

  return (
    <Sitio fondo="bg-fondo">
      <section className="flex justify-center px-5 pb-24 pt-16 md:px-8">
        <div className="flex w-full max-w-[520px] flex-col gap-5 rounded-xl2 border border-borde bg-white p-7 shadow-flot md:p-10">
          <div className="flex flex-col gap-1.5"><h1 className="text-[30px] font-extrabold tracking-[-0.02em] text-azul">Recuperar contraseña</h1><span className="text-[15px] text-tinta-3">Te enviamos un enlace para crear una nueva. Vale por 1 hora.</span></div>
          {listo ? (
            <div className="flex flex-col gap-4">
              <p className="rounded-xl bg-verde-claro p-4 text-sm text-verde">Si <b>{email}</b> tiene cuenta en aSIIstente, en un minuto te llega el correo. Revisa también la carpeta de spam.</p>
              <Link href="/acceso" className="btn-borde-azul !py-3 !text-sm self-start">Volver a iniciar sesión</Link>
            </div>
          ) : (
            <form onSubmit={enviar} className="flex flex-col gap-5">
              <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>Correo de tu cuenta</span><input className="campo" type="email" placeholder="tu@correo.cl" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
              {error && <p className="rounded-xl bg-rojo-claro p-3 text-sm text-rojo">{error}</p>}
              <button className="btn-azul" disabled={cargando}>{cargando ? "Enviando…" : "Enviar enlace"}</button>
              <Link href="/acceso" className="text-center text-sm font-semibold text-azul">Volver</Link>
            </form>
          )}
        </div>
      </section>
    </Sitio>
  );
}
