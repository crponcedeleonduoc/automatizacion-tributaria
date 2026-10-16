"use client";

// Marco de las páginas públicas: cabecera + pie + botón WhatsApp (del diseño "Cabecera" y "Pie").
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken, setToken, waLink } from "@/lib/api";

const NAV = [
  { href: "/funcionalidades", t: "Funcionalidades" },
  { href: "/precios", t: "Precios" },
  { href: "/para-contadores", t: "Para contadores" },
  { href: "/para-pymes", t: "Para pymes" },
  { href: "/seguridad", t: "Seguridad" },
];

export function IconoWA({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 2.5 1 3 .8 3.6.7.5-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.7-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
    </svg>
  );
}

export function Cabecera() {
  const path = usePathname();
  const [logueado, setLogueado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  useEffect(() => setLogueado(!!getToken()), []);

  return (
    <header className="sticky top-0 z-50 bg-azul">
      <div className="contenedor flex h-[72px] items-center justify-between gap-6">
        <Link href="/" className="flex h-[72px] items-center">
          <Image src="/logo-blanco.png" alt="aSIIstente" width={180} height={44} priority className="h-11 w-auto" />
        </Link>
        <nav className="hidden gap-7 text-[15px] font-semibold lg:flex">
          {NAV.map((n) => {
            const on = path === n.href;
            return (
              <Link key={n.href} href={n.href}
                    className={`border-b-2 py-1.5 !text-white/80 hover:!text-white ${on ? "border-naranja !text-white" : "border-transparent"}`}>
                {n.t}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          {logueado ? (
            <>
              <Link href="/panel" className="rounded-[10px] px-3.5 py-2.5 text-[15px] font-semibold !text-white hover:bg-white/10">Mi panel</Link>
              <button onClick={() => { setToken(null); location.href = "/"; }}
                      className="rounded-[10px] bg-white px-[18px] py-[11px] text-[15px] font-bold text-azul hover:bg-naranja hover:text-white">
                Salir
              </button>
            </>
          ) : (
            <>
              <Link href="/acceso" className="hidden rounded-[10px] px-3.5 py-2.5 text-[15px] font-semibold !text-white hover:bg-white/10 sm:block">Iniciar sesión</Link>
              <Link href="/acceso?registro=1" className="rounded-[10px] bg-white px-[18px] py-[11px] text-[15px] font-bold !text-azul hover:bg-naranja hover:!text-white">Probar gratis</Link>
            </>
          )}
          <button onClick={() => setAbierto(!abierto)} aria-label="Menú" className="ml-1 text-white lg:hidden">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
      </div>
      {abierto && (
        <nav className="flex flex-col gap-1 border-t border-white/15 px-5 py-3 lg:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setAbierto(false)} className="rounded-lg px-3 py-2.5 font-semibold !text-white/90 hover:bg-white/10">{n.t}</Link>
          ))}
          <Link href="/acceso" className="rounded-lg px-3 py-2.5 font-semibold !text-white/90 hover:bg-white/10">Iniciar sesión</Link>
        </nav>
      )}
    </header>
  );
}

export function Pie() {
  return (
    <>
      <footer className="bg-azul text-white">
        <div className="contenedor grid gap-12 py-16 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="flex flex-col items-start gap-4">
            <Image src="/logo-blanco.png" alt="aSIIstente" width={200} height={48} className="h-12 w-auto" />
            <p className="max-w-[340px] text-[15px] leading-relaxed text-white/80">Tu RCV, deuda TGR y F29 descargados automáticamente, para todos tus RUT.</p>
            <a href={waLink()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2.5 rounded-[10px] bg-wa px-4 py-[11px] text-[15px] font-bold !text-white hover:bg-wa-oscuro">
              <IconoWA /> Escríbenos por WhatsApp
            </a>
          </div>
          <Col titulo="Producto" links={[["/funcionalidades", "Funcionalidades"], ["/precios", "Precios"], ["/para-contadores", "Para contadores"], ["/para-pymes", "Para pymes"], ["/panel", "Panel de usuario"]]} />
          <Col titulo="Empresa" links={[["/seguridad", "Seguridad"], ["/preguntas-frecuentes", "Preguntas frecuentes"], ["/contacto", "Contacto"]]} />
          <Col titulo="Legal" links={[["/legal#terminos", "Términos de servicio"], ["/legal#privacidad", "Política de privacidad"]]} />
        </div>
        <div className="contenedor flex flex-wrap justify-between gap-6 border-t border-white/20 py-6 pb-10 text-[13px] leading-relaxed text-white/70">
          <p className="max-w-[820px]">aSIIstente es un servicio privado independiente. No está afiliado ni es operado por el Servicio de Impuestos Internos ni por la Tesorería General de la República de Chile.</p>
          <span>© {new Date().getFullYear()} aSIIstente SpA</span>
        </div>
      </footer>
      <a href={waLink()} target="_blank" rel="noreferrer" aria-label="WhatsApp"
         className="fixed bottom-7 right-7 z-[60] flex h-[60px] w-[60px] items-center justify-center rounded-full bg-wa !text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:bg-wa-oscuro">
        <IconoWA size={30} />
      </a>
    </>
  );
}

function Col({ titulo, links }: { titulo: string; links: [string, string][] }) {
  return (
    <div className="flex flex-col gap-3 text-[15px]">
      <span className="mb-1 font-bold">{titulo}</span>
      {links.map(([h, t]) => <Link key={h} href={h} className="!text-white/80 hover:!text-white">{t}</Link>)}
    </div>
  );
}

export default function Sitio({ children, fondo = "bg-white" }: { children: React.ReactNode; fondo?: string }) {
  return (
    <div className={`flex min-h-screen flex-col ${fondo}`}>
      <Cabecera />
      <main className="flex-1">{children}</main>
      <Pie />
    </div>
  );
}
