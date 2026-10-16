"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PanelMarco, { hace } from "@/components/PanelMarco";
import { api } from "@/lib/api";

export default function Alertas() {
  const [als, setAls] = useState<any[]>([]);
  useEffect(() => {
    api("/api/empresas").then(async (es: any[]) => {
      const all = (await Promise.all(es.map((e) => api(`/api/empresas/${e.id}/alertas`).then((a: any[]) => a.map((x) => ({ ...x, rut: e.rut, nombre: e.razon_social, eid: e.id })))))).flat();
      all.sort((a, b) => (a.creado < b.creado ? 1 : -1));
      setAls(all);
    }).catch(() => {});
  }, []);
  return (
    <PanelMarco titulo="Alertas" sub="Todo lo que cambió en tu cartera">
      <div className="overflow-hidden rounded-2xl border border-borde bg-white">
        {als.map((a) => (
          <Link key={a.id} href={`/panel/empresa/${a.eid}`} className={`flex items-start gap-3 border-b border-borde-suave px-5 py-3.5 !text-tinta hover:bg-fondo ${a.leida ? "opacity-60" : ""}`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.tipo.includes("tgr") || a.tipo.includes("credencial") ? "bg-rojo" : "bg-ambar"}`} />
            <div className="flex flex-col gap-0.5 text-[13px]"><span className="font-bold">{a.titulo}</span><span className="text-xs text-tinta-4">{a.nombre || a.rut} · {a.rut} · {hace(a.creado)}</span></div>
          </Link>
        ))}
        {als.length === 0 && <p className="p-8 text-center text-sm text-tinta-4">Sin alertas. Cuando aparezca una factura reclamada, una deuda TGR o un F29 sin declarar, lo verás aquí y en tu correo.</p>}
      </div>
    </PanelMarco>
  );
}
