"use client";

// Login y registro en 3 pasos (diseño "Acceso"): cuenta → RUT → primera descarga real.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import Sitio from "@/components/Sitio";
import { api, descargar, setToken } from "@/lib/api";

export default function AccesoPage() {
  return (
    <Sitio fondo="bg-fondo">
      <Suspense><Acceso /></Suspense>
    </Sitio>
  );
}

function Acceso() {
  const params = useSearchParams();
  const [modo, setModo] = useState<"login" | "registro">(params.get("registro") ? "registro" : "login");

  return (
    <section className="flex justify-center px-5 pb-24 pt-16 md:px-8">
      <div className="flex w-full max-w-[520px] flex-col gap-6">
        <div className="inline-flex gap-1 self-start rounded-xl bg-[#E9EDF5] p-1">
          {(["login", "registro"] as const).map((m) => (
            <button key={m} onClick={() => setModo(m)}
                    className={`rounded-[9px] px-[18px] py-2.5 text-[15px] font-bold ${modo === m ? "bg-white text-azul shadow-card" : "text-tinta-3"}`}>
              {m === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          ))}
        </div>
        {modo === "login" ? <Login irRegistro={() => setModo("registro")} /> : <Registro />}
        <span className="text-center text-xs leading-relaxed text-tinta-4">aSIIstente es un servicio privado independiente. No está afiliado ni es operado por el SII ni por la TGR.</span>
      </div>
    </section>
  );
}

function Caja({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-5 rounded-xl2 border border-borde bg-white p-7 shadow-flot md:p-10">{children}</div>;
}

function Login({ irRegistro }: { irRegistro: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setCargando(true);
    try {
      const form = new URLSearchParams({ username: email, password });
      const t = await api("/api/auth/login", { method: "POST", auth: false, body: form,
        headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      setToken(t.access_token);
      router.push("/panel");
    } catch (err: any) { setError(err.message); } finally { setCargando(false); }
  }

  return (
    <Caja>
      <div className="flex flex-col gap-1.5"><h1 className="text-[30px] font-extrabold tracking-[-0.02em] text-azul">Bienvenido de vuelta</h1><span className="text-[15px] text-tinta-3">Entra a tu panel para ver tus RUT.</span></div>
      <form onSubmit={entrar} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>Correo</span><input className="campo" type="email" placeholder="tu@correo.cl" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>Contraseña</span><input className="campo" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="rounded-xl bg-rojo-claro p-3 text-sm text-rojo">{error}</p>}
        <button className="btn-azul" disabled={cargando}>{cargando ? "Entrando…" : "Entrar"}</button>
        <Link href="/recuperar" className="text-center text-sm font-semibold text-azul">¿Olvidaste tu contraseña?</Link>
      </form>
      <span className="text-center text-sm text-tinta-3">¿No tienes cuenta? <button onClick={irRegistro} className="font-bold text-azul">Créala gratis</button></span>
    </Caja>
  );
}

function Registro() {
  const [paso, setPaso] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [rut, setRut] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [empresa, setEmpresa] = useState<any>(null);
  const [trabajo, setTrabajo] = useState<any>(null);
  const [descarga, setDescarga] = useState<any>(null);
  const timer = useRef<any>(null);
  useEffect(() => () => clearInterval(timer.current), []);

  async function crearCuenta(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setCargando(true);
    try {
      const t = await api("/api/auth/registro", { method: "POST", auth: false,
        body: JSON.stringify({ email, password, acepto_terminos: acepta }) });
      setToken(t.access_token);
      setPaso(2);
    } catch (err: any) { setError(err.message); } finally { setCargando(false); }
  }

  async function conectar(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setCargando(true);
    try {
      const emp = await api("/api/empresas", { method: "POST", body: JSON.stringify({ rut, clave }) });
      setClave("");
      setEmpresa(emp);
      setPaso(3);
      // la creación encola la primera sincronización; esperamos el trabajo
      timer.current = setInterval(async () => {
        const ts = await api("/api/trabajos");
        const t = ts.find((x: any) => x.rut === emp.rut && x.tipo === "rcv");
        if (t && (t.estado === "ok" || t.estado === "error")) {
          clearInterval(timer.current);
          setTrabajo(t);
          if (t.estado === "ok") {
            const ds = await api(`/api/empresas/${emp.id}/rcv/descargas`);
            setDescarga(ds[0] || null);
          }
        }
      }, 2500);
    } catch (err: any) { setError(err.message); } finally { setCargando(false); }
  }

  const bar = (n: number) => (paso >= n ? "bg-azul" : "bg-borde");
  const lab = (n: number) => (paso >= n ? "text-azul" : "text-tinta-5");

  return (
    <Caja>
      <div className="grid grid-cols-3 gap-2">
        {["1. Tu cuenta", "2. Tu RUT", "3. Primera descarga"].map((t, i) => (
          <div key={t} className="flex flex-col gap-2"><span className={`h-1 rounded-sm ${bar(i + 1)}`} /><span className={`text-xs font-bold ${lab(i + 1)}`}>{t}</span></div>
        ))}
      </div>

      {paso === 1 && (
        <form onSubmit={crearCuenta} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5"><h1 className="text-[30px] font-extrabold tracking-[-0.02em] text-azul">Crea tu cuenta gratis</h1><span className="text-[15px] text-tinta-3">1 RUT, tu RCV cada día. Sin tarjeta.</span></div>
          <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>Correo</span><input className="campo" type="email" placeholder="tu@correo.cl" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>Contraseña</span><input className="campo" type="password" placeholder="Mínimo 8 caracteres" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-tinta-2">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-azul" />
            <span>Acepto los <Link href="/legal#terminos">Términos de servicio</Link> y la <Link href="/legal#privacidad">Política de privacidad</Link>. Autorizo a aSIIstente a consultar el SII y la TGR en mi nombre, solo en modo lectura.</span>
          </label>
          {error && <p className="rounded-xl bg-rojo-claro p-3 text-sm text-rojo">{error}</p>}
          <button className="btn-azul" disabled={!acepta || cargando}>{cargando ? "Creando…" : "Continuar"}</button>
        </form>
      )}

      {paso === 2 && (
        <form onSubmit={conectar} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5"><h1 className="text-[30px] font-extrabold tracking-[-0.02em] text-azul">Conecta tu primer RUT</h1><span className="text-[15px] text-tinta-3">Podrás agregar más después desde el panel.</span></div>
          <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>RUT de la empresa</span><input className="campo" placeholder="77.218.696-7" value={rut} onChange={(e) => setRut(e.target.value)} required /></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold"><span>Clave tributaria</span><input className="campo" type="password" placeholder="••••••••" value={clave} autoComplete="off" onChange={(e) => setClave(e.target.value)} required /></label>
          <div className="flex flex-col gap-1.5 rounded-xl bg-fondo px-4 py-3.5 text-[13px] leading-relaxed text-tinta-2">
            <span className="font-bold text-tinta">Cómo cuidamos tu clave</span>
            <span>Se guarda cifrada y solo se usa para consultar. Te recomendamos usar una clave tributaria distinta a tu Clave Única. <Link href="/seguridad">Más detalle</Link></span>
          </div>
          {error && <p className="rounded-xl bg-rojo-claro p-3 text-sm text-rojo">{error}</p>}
          <div className="flex gap-2.5">
            <Link href="/panel" className="btn-borde !px-[18px] !py-[13px] !text-[15px] !text-tinta-2">Saltar</Link>
            <button className="btn-azul flex-1" disabled={cargando}>{cargando ? "Conectando…" : "Conectar y descargar"}</button>
          </div>
        </form>
      )}

      {paso === 3 && !trabajo && (
        <div className="flex flex-col items-center gap-[18px] py-4 text-center">
          <span className="spinner h-[52px] w-[52px]" />
          <div className="flex flex-col gap-1.5"><span className="text-[22px] font-extrabold">Haciendo tu primera descarga…</span><span className="text-sm text-tinta-3">Consultando el RCV de este mes para {empresa?.rut}</span></div>
          <span className="text-xs text-tinta-4">Suele tardar entre 20 y 60 segundos. Puedes <Link href="/panel">ir al panel</Link> y seguirá en segundo plano.</span>
        </div>
      )}

      {paso === 3 && trabajo?.estado === "ok" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-verde-claro"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B8A4C" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg></span>
            <div className="flex flex-col"><h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-azul">Listo. Tu RCV ya está descargado</h1><span className="text-sm text-tinta-3">{empresa?.rut}</span></div>
          </div>
          {descarga ? (
            <button type="button" onClick={() => descargar(`/api/empresas/${empresa.id}/rcv/descargas/${descarga.id}/csv`, `RCV_${descarga.operacion}_${empresa.rut}_${descarga.periodo}.csv`).catch((e) => setError(e.message))}
                    className="flex w-full items-center justify-between rounded-xl border border-borde p-4 text-left text-sm hover:bg-fondo">
              <div className="flex flex-col gap-0.5"><span className="font-bold">RCV_{descarga.operacion}_{empresa.rut}_{descarga.periodo}.csv</span><span className="text-tinta-4">{descarga.n_docs} documentos · hace unos segundos</span></div>
              <span className="font-bold text-azul">Descargar</span>
            </button>
          ) : (
            <p className="rounded-xl bg-fondo p-4 text-sm text-tinta-2">{trabajo.resultado?.resumen || "Sin documentos nuevos en este período."}</p>
          )}
          <p className="text-[15px] leading-relaxed text-tinta-2">Desde ahora aSIIstente lo hará una vez al día. Si quieres cada hora o cada 10 minutos, más documentos o más RUT, mira los planes.</p>
          <Link href="/panel" className="btn-azul">Ir a mi panel</Link>
          <Link href="/precios" className="text-center text-[15px] font-bold">Ver planes</Link>
        </div>
      )}

      {paso === 3 && trabajo?.estado === "error" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rojo-claro"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg></span>
            <div className="flex flex-col"><h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-azul">La primera descarga falló</h1><span className="text-sm text-tinta-3">{empresa?.rut}</span></div>
          </div>
          <p className="rounded-xl bg-rojo-claro p-3 text-sm text-rojo">{trabajo.error}</p>
          <p className="text-[15px] leading-relaxed text-tinta-2">Tu cuenta y tu RUT quedaron creados. Puedes corregir la clave desde el panel y volver a intentar.</p>
          <Link href="/panel" className="btn-azul">Ir a mi panel</Link>
        </div>
      )}
    </Caja>
  );
}
