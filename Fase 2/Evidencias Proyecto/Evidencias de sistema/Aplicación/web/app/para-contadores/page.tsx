import Link from "next/link";
import Sitio from "@/components/Sitio";
import { waLink } from "@/lib/api";

export default function ParaContadores() {
  const cartera = [["Ferretería El Tornillo", "—", ""], ["Constructora Andes", "Deuda TGR", "text-rojo"], ["Maestranza Pérez", "Factura reclamada", "text-ambar"], ["Comercial Rivas", "F29 sin declarar", "text-rojo"], ["Inmobiliaria Sur", "—", ""]];
  return (
    <Sitio>
      <section className="px-5 pb-16 pt-16 md:px-8 md:pt-24">
        <div className="mx-auto grid max-w-sitio items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col items-start gap-5">
            <span className="kicker">Para contadores y estudios contables</span>
            <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-azul md:text-[52px]">Todos tus clientes en un panel. Cero entradas al SII.</h1>
            <p className="max-w-[520px] text-[17px] leading-relaxed text-tinta-2">Hasta 20 RUT con sus RCV, deuda TGR y F29 actualizados cada 10 minutos. Descarga masiva a fin de mes y alertas cuando algo se mueve en la cartera.</p>
            <div className="flex flex-wrap gap-3"><Link href="/acceso?registro=1&plan=contador" className="btn-azul">Probar plan Contador</Link><Link href="/precios" className="btn-borde-azul">Ver precios</Link></div>
          </div>
          <div className="overflow-hidden rounded-xl2 border border-borde bg-white shadow-hero">
            <div className="flex items-center justify-between border-b border-borde px-5 py-3.5"><span className="text-[15px] font-bold">Cartera · 18 RUT</span><span className="rounded-lg bg-azul px-3 py-1.5 text-xs font-bold text-white">Descargar todo · sep 2026</span></div>
            <div className="grid grid-cols-[1.6fr_.6fr_.6fr_.6fr_1.2fr] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><span>Cliente</span><span>RCV</span><span>TGR</span><span>F29</span><span>Alertas</span></div>
            {cartera.map(([n, a, c]) => (
              <div key={n} className="grid grid-cols-[1.6fr_.6fr_.6fr_.6fr_1.2fr] items-center border-t border-borde-suave px-5 py-3 text-[13px]"><span className="font-semibold">{n}</span><span className="text-verde">●</span><span className="text-verde">●</span><span className="text-verde">●</span><span className={`font-semibold ${c || "text-tinta-4"}`}>{a}</span></div>
            ))}
            <div className="px-5 py-3 text-[13px] text-tinta-4">+ 13 clientes más</div>
          </div>
        </div>
      </section>

      <section className="bg-fondo px-5 py-24 md:px-8">
        <div className="mx-auto grid max-w-sitio gap-8 md:grid-cols-3">
          {[["01", "Un panel para toda la cartera", "Cada cliente con su RCV, deuda TGR y F29 y la hora de la última actualización. Ves de un vistazo quién tiene algo pendiente."], ["02", "Descarga masiva a fin de mes", "Un clic y bajas los RCV de los 20 RUT en CSV, ordenados por carpeta. También en carpeta compartida para que tu equipo trabaje desde ahí."], ["03", "Alertas que evitan multas", "Correo cuando a un cliente le aparece deuda TGR, le reclaman una factura o falta el F29 del mes. Configurables por cliente y por tipo."]].map(([n, t, d]) => (
            <div key={n} className="flex flex-col gap-3"><span className="text-[15px] font-extrabold text-naranja">{n}</span><span className="text-xl font-extrabold">{t}</span><p className="text-[15px] leading-relaxed text-tinta-3">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto flex max-w-sitio flex-col gap-10">
          <div className="flex max-w-[640px] flex-col gap-3"><span className="kicker">Cierre de mes</span><h2 className="titulo">Un cierre de mes, antes y después</h2><p className="text-base text-tinta-2">Con 20 clientes, entrar al SII uno por uno son horas que nadie factura. Con aSIIstente los archivos ya están en la carpeta cuando llegas.</p></div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-2xl border border-borde p-8"><span className="text-sm font-bold text-tinta-4">Antes</span><span className="text-[40px] font-extrabold tracking-[-0.02em] text-tinta-2">[X] horas</span><span className="text-[15px] text-tinta-3">20 ingresos al portal, 20 claves, descargas manuales, renombrar archivos.</span></div>
            <div className="flex flex-col gap-2 rounded-2xl bg-azul p-8 text-white shadow-azul"><span className="text-sm font-bold text-naranja">Con aSIIstente</span><span className="text-[40px] font-extrabold tracking-[-0.02em]">1 clic</span><span className="text-[15px] text-white/85">Todo descargado y ordenado por RUT y mes. Tu equipo parte revisando, no descargando.</span></div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-24 md:px-8">
        <div className="mx-auto flex max-w-sitio flex-col items-start justify-between gap-8 rounded-xl3 bg-fondo p-10 md:flex-row md:items-center md:p-16">
          <div className="flex flex-col gap-3"><h2 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-azul md:text-[40px]">Plan Contador: $29.990/mes, hasta 20 RUT</h2><p className="text-[17px] text-tinta-2">Cada 10 minutos, historial ilimitado, WhatsApp prioritario. ¿Más de 20 RUT? Escríbenos.</p></div>
          <div className="flex shrink-0 flex-wrap gap-3"><Link href="/acceso?registro=1&plan=contador" className="btn-azul">Probar gratis</Link><a href={waLink("Hola, soy contador y quiero saber más del plan Contador")} target="_blank" rel="noreferrer" className="btn-borde-azul">WhatsApp</a></div>
        </div>
      </section>
    </Sitio>
  );
}
