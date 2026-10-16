// Portada. Port fiel de "Inicio.dc.html" (Claude Design) con la demo conectada a la API.
import Link from "next/link";
import Sitio from "@/components/Sitio";
import DemoRCV from "@/components/DemoRCV";
import Faq from "@/components/Faq";
import { waLink } from "@/lib/api";

const FAQ_INICIO: [string, string][] = [
  ["¿Necesito darles mi clave del SII?", "Sí, la clave tributaria del RUT que quieres monitorear. Se guarda cifrada y solo se usa para consultar. Te recomendamos usar una clave tributaria distinta a tu Clave Única."],
  ["¿aSIIstente puede declarar o pagar algo a mi nombre?", "No. El acceso es de solo lectura: descargamos información, nunca declaramos, pagamos ni modificamos nada."],
  ["¿Cuántos RUT puedo administrar?", "El plan Gratis y Pyme incluyen 1 RUT. El plan Contador incluye hasta 20 RUT. Si necesitas más, escríbenos por WhatsApp."],
  ["¿En qué formato recibo los archivos?", "CSV para el RCV y PDF para F29 y certificados TGR, ordenados por RUT y fecha. En el plan Contador también en una carpeta compartida."],
  ["¿Puedo cancelar cuando quiera?", "Sí. Cancelas desde el panel y puedes eliminar tus credenciales y datos en ese mismo momento."],
];

export default function Inicio() {
  return (
    <Sitio>
      {/* HERO */}
      <section className="px-5 pb-16 pt-16 md:px-8 md:pt-24">
        <div className="mx-auto grid max-w-sitio items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div className="flex flex-col items-start gap-6">
            <span className="kicker">Automatización tributaria · Chile</span>
            <h1 className="text-[42px] font-extrabold leading-[1.05] tracking-[-0.03em] text-azul md:text-[60px]">Deja de entrar al SII todos los días</h1>
            <p className="max-w-[520px] text-lg leading-relaxed text-tinta-2 md:text-xl">aSIIstente descarga tu RCV, deuda TGR y F29 automáticamente, cada 10 minutos, para todos tus RUT.</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link href="/acceso?registro=1" className="btn-azul">Probar gratis</Link>
              <a href="#demo" className="btn-borde-naranja">Ver demo con mi RUT</a>
            </div>
            <p className="text-sm text-tinta-4">Plan gratis para 1 RUT. Sin tarjeta.</p>
          </div>
          <MockPanel />
        </div>
      </section>

      {/* CONFIANZA */}
      <section className="px-5 pb-16 md:px-8">
        <div className="mx-auto grid max-w-sitio items-center gap-8 border-y border-borde py-8 md:grid-cols-2 md:gap-12">
          <div className="flex flex-wrap items-center gap-4">
            {[1, 2, 3, 4].map((i) => <span key={i} className="flex h-10 w-[120px] items-center justify-center rounded-lg bg-[#EEF1F6] text-xs font-semibold text-tinta-5">[logo cliente]</span>)}
          </div>
          <div className="grid grid-cols-3 gap-6">
            <Metrica v="[X]" t="RUT monitoreados" /><Metrica v="[X]" t="consultas al día" /><Metrica v="144" t="consultas/día sin bloqueos (dato real)" />
          </div>
        </div>
      </section>

      <DemoRCV />

      {/* EL PROBLEMA */}
      <section className="px-5 pb-24 md:px-8">
        <div className="mx-auto flex max-w-sitio flex-col gap-10">
          <Encabezado kicker="El problema" titulo="Entrar al SII a mano cuesta más de lo que parece" />
          <div className="grid gap-6 md:grid-cols-3">
            <Tarjeta icono={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0047BB" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>} titulo="Tiempo repetitivo">Un contador con 20 clientes entra 20 veces al portal, con 20 claves, cada mes. Son horas que nadie factura.</Tarjeta>
            <Tarjeta icono={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0047BB" strokeWidth="2"><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v4M12 17v.5" /></svg>} titulo="Omisiones que terminan en multas">Una deuda TGR que nadie vio o un F29 fuera de plazo se convierten en intereses y multas para tu cliente.</Tarjeta>
            <Tarjeta icono={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0047BB" strokeWidth="2"><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>} titulo="Información que llega tarde">Para hacer factoring necesitas saber hoy si la factura fue aceptada. Revisar una vez al día no sirve.</Tarjeta>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="bg-fondo px-5 py-24 md:px-8">
        <div className="mx-auto flex max-w-sitio flex-col gap-10">
          <Encabezado kicker="Cómo funciona" titulo="Tres pasos y te olvidas del portal" />
          <div className="grid gap-6 md:grid-cols-3">
            <Paso n="1" titulo="Conecta tu RUT">Crea tu cuenta e ingresa RUT y clave tributaria. Puedes sumar todos los RUT que administres.</Paso>
            <Paso n="2" titulo="aSIIstente consulta el SII">Cada 10 minutos, cada hora o una vez al día según tu plan. Sin que entres al portal.</Paso>
            <Paso n="3" titulo="Recibe archivos y alertas">CSV y PDF ordenados por RUT y fecha, listos para Excel o tu software contable. Alertas por correo cuando algo cambia.</Paso>
          </div>
        </div>
      </section>

      {/* DOCUMENTOS */}
      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto flex max-w-sitio flex-col gap-10">
          <Encabezado kicker="Documentos" titulo="Lo que descarga por ti" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Doc org="SII" titulo="RCV">Registro de Compras y Ventas con estado de aceptación o reclamo de cada factura.</Doc>
            <Doc org="TGR" titulo="Deuda TGR">Certificado de deuda de la Tesorería General de la República.</Doc>
            <Doc org="SII" titulo="F29">Declaraciones mensuales de IVA, en PDF, mes a mes.</Doc>
            <Doc org="Próximamente" titulo="DTE, F22 y más" pronto>Declaraciones juradas, boletas de honorarios, libros contables y situación tributaria.</Doc>
          </div>
          <Link href="/funcionalidades" className="self-start text-[15px] font-bold">Ver todas las funcionalidades →</Link>
        </div>
      </section>

      {/* CASO FACTORING */}
      <section className="px-5 pb-24 md:px-8">
        <div className="mx-auto grid max-w-sitio items-center gap-10 rounded-3xl border border-borde p-8 shadow-card md:p-14 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
          <div className="flex flex-col gap-4">
            <span className="kicker">Caso real</span>
            <h2 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em] text-azul md:text-[36px]">$15 millones a 60 días. La ferretería no puede esperar.</h2>
            <p className="text-base leading-[1.65] text-tinta-2">Una ferretería vende $15.000.000 a una constructora que paga a 60 días. Para hacer factoring necesita demostrar que la factura fue aceptada. Con aSIIstente consultando cada 10 minutos, sabe al instante cuando eso pasa y cede la factura el mismo día.</p>
            <Link href="/para-pymes" className="text-[15px] font-bold">Ver más casos para pymes →</Link>
          </div>
          <div className="relative grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-0">
            <span className="absolute left-[8%] right-[8%] top-[14px] hidden h-0.5 bg-borde md:block" />
            <Hito color="bg-azul" t="Factura emitida" s="1 sep · $15.000.000" />
            <Hito color="bg-naranja" t="8 días para reclamo" s="aSIIstente revisa cada 10 min" />
            <Hito color="bg-verde" t="Aceptada" s="3 sep, 11:40 · alerta al correo" />
            <Hito color="bg-azul" t="Factoring" s="Mismo día, con respaldo" />
          </div>
        </div>
      </section>

      {/* COMPARATIVA */}
      <section className="bg-fondo px-5 py-24 md:px-8">
        <div className="mx-auto flex max-w-sitio flex-col gap-10">
          <Encabezado kicker="Comparativa" titulo="Más consultas por menos plata" />
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-2.5 rounded-2xl bg-azul p-8 text-white shadow-azul">
              <span className="text-sm font-bold text-naranja">aSIIstente · Plan Contador</span>
              <span className="text-[40px] font-extrabold tracking-[-0.02em]">$29.990<span className="text-base font-semibold text-white/70">/mes</span></span>
              <span className="text-[15px] text-white/85">Hasta 20 RUT · consultas cada 10 minutos</span>
              <span className="text-[15px] text-white/85">≈ 2.880 consultas de RCV al día (144 por RUT)</span>
              <span className="mt-2 text-[13px] text-white/60">IVA incluido</span>
            </div>
            <Competidor nombre="BaseAPI" precio="$19.990" suf="/mes" l1="500 consultas al mes" l2="≈ 16 consultas al día" />
            <Competidor nombre="SimpleAPI" precio="5 UF" suf=" + IVA/mes" l1="≈ $204.000/mes · 10.000 consultas" l2="Orientado a desarrolladores" />
          </div>
          <p className="text-[13px] text-tinta-4">Precios de referencia de competidores a la fecha de publicación. aSIIstente está probado haciendo 144 consultas de RCV al día por RUT sin bloqueos.</p>
        </div>
      </section>

      {/* SEGURIDAD RESUMEN */}
      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto grid max-w-sitio items-start gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div className="flex flex-col gap-4">
            <span className="kicker">Seguridad</span>
            <h2 className="titulo">Tu clave, cuidada</h2>
            <p className="text-base leading-relaxed text-tinta-2">Nos confías tu clave tributaria. Esto es lo que hacemos con ella, sin exagerar.</p>
            <Link href="/seguridad" className="text-[15px] font-bold">Leer la página de seguridad →</Link>
          </div>
          <div className="flex flex-col">
            <Punto n="01" t="Cifrada en reposo y en tránsito">Credenciales cifradas en la base de datos con una clave que no vive en ella, y TLS en cada conexión.</Punto>
            <Punto n="02" t="Solo lectura">aSIIstente nunca declara, paga ni modifica nada a tu nombre.</Punto>
            <Punto n="03" t="Tú tienes el control" ultimo>Revoca el acceso y borra tus datos cuando quieras desde el panel. Ves cada consulta hecha con tu RUT.</Punto>
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section className="px-5 pb-24 md:px-8">
        <div className="mx-auto flex max-w-sitio flex-col gap-10">
          <Encabezado kicker="Testimonios" titulo="Lo que dicen quienes ya lo usan" />
          <div className="grid gap-6 md:grid-cols-3">
            {[["[Testimonio de contador]", "[Nombre, Estudio contable]"], ["[Testimonio de dueño de pyme]", "[Nombre, Empresa]"], ["[Testimonio de contador]", "[Nombre, Estudio contable]"]].map(([q, n], i) => (
              <div key={i} className="flex flex-col justify-between gap-4 rounded-2xl bg-fondo p-7">
                <p className="text-base leading-relaxed text-tinta-2">“{q}”</p>
                <div className="flex items-center gap-3"><span className="h-10 w-10 rounded-full bg-[#DDE3EF]" /><span className="text-sm font-bold">{n}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 pb-24 md:px-8">
        <div className="mx-auto flex max-w-[880px] flex-col gap-10">
          <Encabezado kicker="Preguntas frecuentes" titulo="Lo que nos preguntan antes de partir" />
          <Faq items={FAQ_INICIO} />
          <Link href="/preguntas-frecuentes" className="text-[15px] font-bold">Ver todas las preguntas →</Link>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-5 pb-24 md:px-8">
        <div className="mx-auto flex max-w-sitio flex-col items-start justify-between gap-8 rounded-xl3 bg-fondo p-10 md:flex-row md:items-center md:p-16">
          <div className="flex flex-col gap-3">
            <h2 className="text-[36px] font-extrabold leading-[1.05] tracking-[-0.03em] text-azul md:text-[44px]">Empieza gratis hoy</h2>
            <p className="text-[17px] text-tinta-2">1 RUT, tu RCV cada día, sin tarjeta. Sube de plan cuando lo necesites.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link href="/acceso?registro=1" className="btn-azul">Crear cuenta gratis</Link>
            <a href={waLink()} target="_blank" rel="noreferrer" className="btn-borde-azul">Hablar por WhatsApp</a>
          </div>
        </div>
      </section>
    </Sitio>
  );
}

/* ---------- piezas ---------- */

function MockPanel() {
  const filas = [
    ["Ferretería El Tornillo Ltda.", "77.218.696-7", "hace 4 min", "hace 1 h", "ago 2026", false],
    ["Constructora Andes SpA", "76.554.120-3", "hace 6 min", "Deuda $1.240.500", "ago 2026", true],
    ["Comercial Rivas y Cía.", "78.902.331-K", "hace 9 min", "hace 1 h", "ago 2026", false],
  ] as const;
  return (
    <div className="rounded-xl2 border border-borde bg-fondo p-5 shadow-hero">
      <div className="overflow-hidden rounded-[14px] border border-borde bg-white">
        <div className="flex items-center justify-between border-b border-borde px-[18px] py-3.5">
          <div className="flex flex-col gap-0.5"><span className="text-[11px] font-semibold text-tinta-4">Panel</span><span className="text-[15px] font-bold">Mis RUT</span></div>
          <span className="rounded-lg bg-azul px-3 py-[7px] text-xs font-bold text-white">Actualizar ahora</span>
        </div>
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-borde-suave px-[18px] py-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><span>RUT</span><span>RCV</span><span>TGR</span><span>F29</span></div>
        {filas.map(([n, r, a, b, c, deuda]) => (
          <div key={r} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center border-b border-borde-suave px-[18px] py-3 text-[13px] last:border-0">
            <div className="flex flex-col"><span className="font-bold">{n}</span><span className="text-xs text-tinta-4">{r}</span></div>
            <span className="font-semibold text-verde">{a}</span>
            <span className={deuda ? "font-semibold text-rojo" : "text-tinta-4"}>{b}</span>
            <span className="text-tinta-4">{c}</span>
          </div>
        ))}
      </div>
      <div className="mt-3.5 flex items-start gap-3 rounded-xl border border-naranja-borde border-l-4 border-l-naranja bg-white px-4 py-3">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-naranja" />
        <div className="flex flex-col gap-0.5 text-[13px]"><span className="font-bold">Factura N° 4.512 aceptada por Constructora Andes</span><span className="text-tinta-4">RCV · 77.218.696-7 · hace 4 minutos</span></div>
      </div>
    </div>
  );
}

function Encabezado({ kicker, titulo, texto }: { kicker: string; titulo: string; texto?: string }) {
  return (
    <div className="flex max-w-[640px] flex-col gap-3">
      <span className="kicker">{kicker}</span>
      <h2 className="titulo">{titulo}</h2>
      {texto && <p className="text-base leading-relaxed text-tinta-2">{texto}</p>}
    </div>
  );
}

function Metrica({ v, t }: { v: string; t: string }) {
  return <div className="flex flex-col gap-1"><span className="text-[28px] font-extrabold tracking-[-0.02em] text-azul">{v}</span><span className="text-sm text-tinta-3">{t}</span></div>;
}

function Tarjeta({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-borde bg-white p-7 shadow-card">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-azul-claro">{icono}</span>
      <span className="text-xl font-extrabold tracking-[-0.01em]">{titulo}</span>
      <p className="text-[15px] leading-relaxed text-tinta-3">{children}</p>
    </div>
  );
}

function Paso({ n, titulo, children }: { n: string; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5">
      <span className="text-[48px] font-extrabold leading-none tracking-[-0.03em] text-naranja">{n}</span>
      <span className="text-xl font-extrabold">{titulo}</span>
      <p className="text-[15px] leading-relaxed text-tinta-3">{children}</p>
    </div>
  );
}

function Doc({ org, titulo, children, pronto }: { org: string; titulo: string; children: React.ReactNode; pronto?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 rounded-2xl p-7 ${pronto ? "border border-dashed border-[#C9D0DF] bg-fondo" : "border border-borde"}`}>
      <span className={`text-[13px] font-bold ${pronto ? "text-tinta-4" : "text-naranja"}`}>{org}</span>
      <span className={`font-extrabold tracking-[-0.01em] ${pronto ? "text-lg" : "text-2xl"}`}>{titulo}</span>
      <p className="text-[15px] leading-relaxed text-tinta-3">{children}</p>
    </div>
  );
}

function Hito({ color, t, s }: { color: string; t: string; s: string }) {
  return (
    <div className="relative flex flex-col items-center gap-3 text-center">
      <span className={`h-[30px] w-[30px] rounded-full border-[5px] border-white shadow-[0_0_0_1px_#E6E9F0] ${color}`} />
      <span className="text-sm font-bold">{t}</span>
      <span className="text-[13px] text-tinta-4">{s}</span>
    </div>
  );
}

function Competidor({ nombre, precio, suf, l1, l2 }: { nombre: string; precio: string; suf: string; l1: string; l2: string }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-borde bg-white p-8">
      <span className="text-sm font-bold text-tinta-4">{nombre}</span>
      <span className="text-[40px] font-extrabold tracking-[-0.02em] text-tinta-2">{precio}<span className="text-base font-semibold text-tinta-5">{suf}</span></span>
      <span className="text-[15px] text-tinta-3">{l1}</span><span className="text-[15px] text-tinta-3">{l2}</span>
    </div>
  );
}

function Punto({ n, t, children, ultimo }: { n: string; t: string; children: React.ReactNode; ultimo?: boolean }) {
  return (
    <div className={`flex gap-5 border-t border-borde py-6 ${ultimo ? "border-b" : ""}`}>
      <span className="w-8 shrink-0 text-[15px] font-extrabold text-naranja">{n}</span>
      <div className="flex flex-col gap-1"><span className="text-lg font-extrabold">{t}</span><span className="text-[15px] leading-relaxed text-tinta-3">{children}</span></div>
    </div>
  );
}
