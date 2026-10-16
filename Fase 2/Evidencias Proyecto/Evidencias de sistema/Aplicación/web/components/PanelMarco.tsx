"use client";

// Marco del panel de usuario (diseño "Panel"): sidebar azul + contenido.
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getToken, setToken } from "@/lib/api";

const NOMBRE_PLAN: Record<string, string> = { gratis: "Plan Gratis", pyme: "Plan Pyme", contador: "Plan Contador" };
const FREC: Record<string, string> = { gratis: "1 vez al día", pyme: "desde cada hora", contador: "desde cada 10 min" };
const MAX: Record<string, number> = { gratis: 1, pyme: 1, contador: 20 };

export default function PanelMarco({ children, titulo, sub, acciones }: { children: React.ReactNode; titulo: string; sub?: React.ReactNode; acciones?: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [yo, setYo] = useState<any>(null);
  const [nEmp, setNEmp] = useState(0);

  useEffect(() => {
    if (!getToken()) { router.replace("/acceso"); return; }
    api("/api/auth/yo").then(setYo).catch(() => {});
    api("/api/empresas").then((e) => setNEmp(e.length)).catch(() => {});
  }, [router]);

  const NAV = [["/panel", "Mis RUT"], ["/panel/reportes", "Reportes"], ["/panel/alertas", "Alertas"], ["/panel/actividad", "Registro de actividad"], ["/panel/cuenta", "Configuración"]];
  if (yo?.es_admin) NAV.push(["/panel/admin", "Administración"]);
  const iniciales = (yo?.nombre || yo?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="grid min-h-screen bg-fondo text-tinta lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-8 bg-azul p-5 text-white lg:sticky lg:top-0 lg:h-screen">
        <Link href="/" className="px-2 py-1"><Image src="/logo-blanco.png" alt="aSIIstente" width={160} height={40} className="h-10 w-auto" /></Link>
        <nav className="flex flex-col gap-1 text-[15px] font-semibold">
          {NAV.map(([h, t]) => (
            <Link key={h} href={h} className={`rounded-[10px] px-3 py-2.5 !text-white ${path === h ? "bg-white/15" : "!text-white/75 hover:bg-white/10 hover:!text-white"}`}>{t}</Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 rounded-xl bg-white/10 p-4">
          <span className="text-xs font-bold text-naranja">{NOMBRE_PLAN[yo?.plan] || "Plan"}</span>
          <span className="text-sm text-white/85">{nEmp} de {MAX[yo?.plan] || 1} RUT · {FREC[yo?.plan] || ""}</span>
          <Link href="/precios" className="text-[13px] font-bold !text-white">Administrar plan →</Link>
        </div>
        <div className="flex items-center gap-2.5 text-[13px]">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-naranja font-extrabold">{iniciales}</span>
          <div className="flex min-w-0 flex-col"><span className="truncate font-bold">{yo?.nombre || yo?.email || "…"}</span>
            <button onClick={() => { setToken(null); router.replace("/"); }} className="text-left text-white/65 hover:text-white">Cerrar sesión</button></div>
        </div>
      </aside>
      <main className="flex min-w-0 flex-col gap-7 p-5 md:p-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="flex flex-col gap-1"><h1 className="text-[30px] font-extrabold tracking-[-0.02em]">{titulo}</h1>{sub && <span className="text-sm text-tinta-3">{sub}</span>}</div>
          {acciones && <div className="flex flex-wrap gap-2.5">{acciones}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}

export function Kpi({ t, v, alerta }: { t: string; v: React.ReactNode; alerta?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 rounded-[14px] border bg-white p-5 ${alerta ? "border-naranja-borde" : "border-borde"}`}>
      <span className="text-xs font-semibold text-tinta-4">{t}</span>
      <span className={`text-[28px] font-extrabold tracking-[-0.02em] ${alerta ? "text-ambar" : ""}`}>{v}</span>
    </div>
  );
}

export function hace(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "hace segundos";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}
