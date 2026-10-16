"use client";

// Bloque "Descarga tu RCV con un clic" (diseño Inicio › DEMO REAL), conectado a /api/demo/rcv.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { API_URL, api, clp, waLink } from "@/lib/api";

type Estado = "form" | "loading" | "done" | "error";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function periodoActual() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nombrePeriodo(p: string) {
  return `${MESES[parseInt(p.slice(4)) - 1]} ${p.slice(0, 4)}`;
}

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF8C42" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
);

export default function DemoRCV() {
  const [estado, setEstado] = useState<Estado>("form");
  const [rut, setRut] = useState("");
  const [clave, setClave] = useState("");
  const [operacion, setOperacion] = useState<"VENTA" | "COMPRA">("VENTA");
  const [error, setError] = useState("");
  const [trabajo, setTrabajo] = useState<any>(null);
  const [paso, setPaso] = useState(0);
  const timer = useRef<any>(null);
  const periodo = periodoActual();

  useEffect(() => () => clearInterval(timer.current), []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEstado("loading");
    setPaso(0);
    try {
      const t = await api("/api/demo/rcv", {
        method: "POST", auth: false,
        body: JSON.stringify({ rut, clave, periodo, operacion }),
      });
      setClave("");
      let ticks = 0;
      timer.current = setInterval(async () => {
        ticks++;
        setPaso(Math.min(2, Math.floor(ticks / 4)));
        try {
          const j = await api(`/api/demo/rcv/${t.id}`, { auth: false });
          if (j.estado === "ok") { clearInterval(timer.current); setTrabajo(j); setEstado("done"); }
          else if (j.estado === "error") { clearInterval(timer.current); setError(j.error || "No pudimos consultar el SII."); setEstado("error"); }
        } catch (err: any) { clearInterval(timer.current); setError(err.message); setEstado("error"); }
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      setEstado("error");
    }
  }

  const rutShown = rut || "77.218.696-7";
  const esClave = /clave|rut|incorrect|rechaz/i.test(error);

  return (
    <section id="demo" className="scroll-mt-20 px-5 pb-24 pt-6 md:px-8">
      <div className="mx-auto grid max-w-sitio items-center gap-10 rounded-xl3 bg-azul p-8 text-white md:p-16 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-5">
          <span className="kicker">Demo real, sin cuenta</span>
          <h2 className="text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em] md:text-[42px]">Descarga tu RCV de este mes con un clic</h2>
          <p className="max-w-[460px] text-[17px] leading-relaxed text-white/80">
            Ingresa tu RUT y clave tributaria. aSIIstente consulta el SII y te entrega el Registro de Compras y Ventas de {nombrePeriodo(periodo)} en CSV. No guardamos tu clave en la demo.
          </p>
          <div className="flex flex-col gap-2.5 text-[15px] text-white/90">
            <span className="flex items-center gap-2.5"><Check />Acceso de solo lectura</span>
            <span className="flex items-center gap-2.5"><Check />Cifrado en tránsito (TLS)</span>
            <span className="flex items-center gap-2.5"><Check />Te recomendamos usar tu clave tributaria, no la Clave Única</span>
          </div>
        </div>

        <div className="flex min-h-[380px] flex-col justify-center rounded-xl2 bg-white p-7 text-tinta shadow-[0_24px_60px_rgba(0,0,0,0.2)] md:p-9">
          {estado === "form" && (
            <form onSubmit={enviar} className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-1">
                <span className="text-xl font-extrabold tracking-[-0.01em]">Tu RCV de {nombrePeriodo(periodo)}</span>
                <span className="text-sm text-tinta-3">Compras o ventas con estado de aceptación o reclamo.</span>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>RUT</span>
                <input className="campo" placeholder="77.218.696-7" value={rut} onChange={(e) => setRut(e.target.value)} required />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>Clave tributaria</span>
                <input className="campo" type="password" placeholder="••••••••" value={clave} autoComplete="off" onChange={(e) => setClave(e.target.value)} required />
              </label>
              <div className="flex gap-2 rounded-[10px] bg-fondo p-1">
                {(["VENTA", "COMPRA"] as const).map((op) => (
                  <button type="button" key={op} onClick={() => setOperacion(op)}
                          className={`flex-1 rounded-lg py-2 text-sm font-bold ${operacion === op ? "bg-white text-azul shadow-card" : "text-tinta-3"}`}>
                    {op === "VENTA" ? "Ventas" : "Compras"}
                  </button>
                ))}
              </div>
              <button className="btn-naranja !justify-between !text-left"><span>Descargar mi RCV</span><span>→</span></button>
              <p className="text-xs leading-relaxed text-tinta-4">Solo consultamos. Nunca declaramos, pagamos ni modificamos nada a tu nombre. <Link href="/seguridad">Cómo cuidamos tu clave</Link></p>
            </form>
          )}

          {estado === "loading" && (
            <div className="flex flex-col items-center gap-[22px] py-3 text-center">
              <span className="spinner h-[52px] w-[52px]" />
              <div className="flex flex-col gap-1.5">
                <span className="text-xl font-extrabold">Consultando el SII…</span>
                <span className="text-sm text-tinta-3">RUT {rutShown} · {nombrePeriodo(periodo)}</span>
              </div>
              <div className="flex w-full max-w-[300px] flex-col items-start gap-2.5 text-sm text-tinta-2">
                {["Ingresando al portal", "Abriendo Registro de Compras y Ventas", `Descargando ${operacion === "VENTA" ? "ventas" : "compras"}…`].map((t, i) => (
                  <span key={t} className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 rounded-full ${i < paso ? "bg-verde" : i === paso ? "bg-naranja" : "bg-borde"}`} />{t}
                  </span>
                ))}
              </div>
              <span className="text-xs text-tinta-4">Suele tardar entre 20 y 40 segundos.</span>
            </div>
          )}

          {estado === "done" && trabajo && (
            <div className="flex flex-col gap-[18px]">
              <div className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-verde-claro">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B8A4C" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                <div className="flex flex-col"><span className="text-xl font-extrabold">Tu RCV está listo</span><span className="text-sm text-tinta-3">RUT {trabajo.rut} · {nombrePeriodo(periodo)}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5 rounded-xl border border-borde p-3.5">
                  <span className="text-xs font-semibold text-tinta-4">{operacion === "VENTA" ? "Ventas" : "Compras"}</span>
                  <span className="text-lg font-extrabold">{trabajo.resultado.n_docs} documentos</span>
                  <span className="text-[13px] text-tinta-3">{clp(trabajo.resultado.total)}</span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-xl border border-borde p-3.5">
                  <span className="text-xs font-semibold text-tinta-4">IVA del período</span>
                  <span className="text-lg font-extrabold">{clp(trabajo.resultado.iva)}</span>
                  <span className="text-[13px] text-tinta-3">según el SII</span>
                </div>
              </div>
              {trabajo.tiene_archivo ? (
                <a className="btn-azul !justify-between" href={`${API_URL}/api/demo/rcv/${trabajo.id}/csv`}>
                  <span className="truncate">Descargar RCV_{trabajo.rut}_{periodo}.csv</span><span>↓</span>
                </a>
              ) : (
                <div className="flex items-center gap-2.5 rounded-[10px] bg-naranja-claro px-3.5 py-2.5 text-sm text-naranja-texto">
                  <span className="h-2 w-2 rounded-full bg-naranja" />El SII no tiene documentos de {operacion === "VENTA" ? "venta" : "compra"} para este período.
                </div>
              )}
              <div className="flex flex-col gap-2.5 border-t border-borde pt-4">
                <span className="text-sm leading-relaxed text-tinta-2">¿Quieres que esto pase solo, todos los días? Crea tu cuenta gratis y aSIIstente lo hará por ti.</span>
                <Link href="/acceso?registro=1" className="btn-borde-azul self-start !px-[18px] !py-[11px] !text-[15px]">Crear cuenta gratis y automatizarlo</Link>
                <button onClick={() => { setEstado("form"); setTrabajo(null); }} className="self-start text-xs text-tinta-4 underline">Probar con otro RUT</button>
              </div>
            </div>
          )}

          {estado === "error" && (
            <div className="flex flex-col gap-[18px]">
              <div className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rojo-claro">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </span>
                <div className="flex flex-col"><span className="text-xl font-extrabold">{esClave ? "El SII rechazó la clave" : "No pudimos completar la consulta"}</span><span className="text-sm text-tinta-3">RUT {rutShown}</span></div>
              </div>
              <p className="text-[15px] leading-relaxed text-tinta-2">{error}{esClave && " Revisa mayúsculas y que no estés usando tu Clave Única. Tras varios intentos fallidos el SII puede bloquear la clave temporalmente."}</p>
              <div className="flex flex-wrap gap-2.5">
                <button onClick={() => setEstado("form")} className="btn-azul !px-[18px] !py-[13px] !text-[15px]">Intentar de nuevo</button>
                <a href="https://www.sii.cl" target="_blank" rel="noreferrer" className="btn-borde !px-[18px] !py-[11px] !text-[15px] !text-azul">Recuperar clave en sii.cl</a>
              </div>
              <a href={waLink("Hola, la demo me da error")} target="_blank" rel="noreferrer" className="text-sm">¿Necesitas ayuda? Escríbenos por WhatsApp</a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
