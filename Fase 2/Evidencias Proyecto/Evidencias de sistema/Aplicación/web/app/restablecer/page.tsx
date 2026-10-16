"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Sitio from "@/components/Sitio";
import { api, setToken } from "@/lib/api";

export default function RestablecerPage() {
  return <Sitio fondo="bg-fondo"><Suspense><Restablecer /></Suspense></Sitio>;
}

function Restablecer() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [p1, setP1] = useState(""); const [p2, setP2] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (p1 !== p2) { setError("Las contraseñas no coinciden"); return; }
    setCargando(true);
    try {
      const t = await api("/api/auth/restablecer", { method: "POST", auth: false, body: JSON.stringify({ token, password: p1 }) });
      setToken(t.access_token); router.replace("/panel");
    } catch (err: any) { setError(err.message); } finally { setCargando(false); }
  }

  return (
    <section className="flex justify-center px-5 pb-24 pt-16 md:px-8">
      <div className="flex w-full max-w-[520px] flex-col gap-5 rounded-xl2 border border-borde bg-white p-7 shadow-flot md:p-10">
        <div className="flex flex-col gap-1.5"><h1 className="text-[30px] font-extrabold tracking-[-0.02em] text-azul">Nueva contraseña</h1><span className="text-[15px] text-tinta-3">Mínimo 8 caracteres. Al guardar, entras directo a tu panel.</span></div>
        {!token ? (
          <p className="rounded-xl bg-rojo-claro p-4 text-sm text-rojo">Falta el enlace de recuperación. <Link href="/recuperar" className="font-bold underline">Pide uno nuevo</Link>.</p>
        ) : (
          <form onSubmit={guardar} className="flex flex-col gap-5">
            <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>Nueva contraseña</span><input className="campo" type="password" value={p1} onChange={(e) => setP1(e.target.value)} minLength={8} required autoFocus /></label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>Repite la contraseña</span><input className="campo" type="password" value={p2} onChange={(e) => setP2(e.target.value)} minLength={8} required /></label>
            {error && <p className="rounded-xl bg-rojo-claro p-3 text-sm text-rojo">{error} {error.includes("venció") && <Link href="/recuperar" className="font-bold underline">Pedir otro enlace</Link>}</p>}
            <button className="btn-azul" disabled={cargando}>{cargando ? "Guardando…" : "Guardar y entrar"}</button>
          </form>
        )}
      </div>
    </section>
  );
}
