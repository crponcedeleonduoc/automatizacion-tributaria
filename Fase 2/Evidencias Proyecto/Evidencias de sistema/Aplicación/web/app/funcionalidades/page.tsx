import Link from "next/link";
import Sitio from "@/components/Sitio";
import { waLink } from "@/lib/api";

function Check({ t }: { t: string }) {
  return <span className="flex items-center gap-2.5 text-[15px] text-tinta-2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF8C42" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>{t}</span>;
}

export default function Funcionalidades() {
  return (
    <Sitio>
      <section className="px-5 pb-16 pt-16 md:px-8 md:pt-24">
        <div className="mx-auto flex max-w-sitio flex-col gap-4">
          <span className="kicker">Funcionalidades</span>
          <h1 className="max-w-[820px] text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-azul md:text-[52px]">Cada documento del SII, descargado y ordenado sin que hagas nada</h1>
          <p className="max-w-[620px] text-[17px] leading-relaxed text-tinta-2">Archivos en CSV y PDF, por RUT y por fecha, listos para Excel o tu software contable. Múltiples RUT desde una sola cuenta.</p>
        </div>
      </section>

      {/* RCV */}
      <section className="px-5 py-16 md:px-8">
        <div className="mx-auto grid max-w-sitio items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <span className="kicker">SII · Registro de Compras y Ventas</span>
            <h2 className="titulo">RCV en tiempo real</h2>
            <p className="text-base leading-relaxed text-tinta-2">El registro que sustenta tu IVA, con el estado de cada factura: aceptada, reclamada o pendiente. Tu cliente tiene 8 días para reclamar; aSIIstente revisa cada 10 minutos para que lo sepas al instante.</p>
            <div className="flex flex-col gap-2.5"><Check t="Compras y ventas del mes, en CSV" /><Check t="Estado de aceptación o reclamo por documento" /><Check t="Alerta cuando cambia el estado de una factura" /></div>
          </div>
          <div className="overflow-hidden rounded-xl2 border border-borde bg-white shadow-hero">
            <div className="flex items-center justify-between border-b border-borde px-5 py-3.5"><div className="flex flex-col"><span className="text-[15px] font-bold">RCV · Ventas · septiembre 2026</span><span className="text-xs text-tinta-4">77.218.696-7 · actualizado hace 4 min</span></div></div>
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><tr><th className="px-5 py-2.5">Folio</th><th className="px-5 py-2.5">Receptor</th><th className="px-5 py-2.5 text-right">Monto</th><th className="px-5 py-2.5">Estado</th></tr></thead>
              <tbody>
                {[["4512", "Constructora Andes SpA", "$15.000.000", "Aceptada", "bg-verde-claro text-verde"], ["4513", "Inmobiliaria Sur Ltda.", "$2.380.000", "Pendiente · 5 días", "bg-naranja-claro text-naranja-texto"], ["4514", "Maestranza Pérez EIRL", "$640.220", "Reclamada", "bg-rojo-claro text-rojo"], ["4515", "Comercial Rivas y Cía.", "$1.120.000", "Aceptada", "bg-verde-claro text-verde"]].map(([f, r, m, e, c]) => (
                  <tr key={f} className="border-t border-borde-suave"><td className="px-5 py-3 font-mono text-xs">{f}</td><td className="px-5 py-3 font-semibold">{r}</td><td className="px-5 py-3 text-right">{m}</td><td className="px-5 py-3"><span className={`rounded-md px-2 py-0.5 text-xs font-bold ${c}`}>{e}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* TGR */}
      <section className="bg-fondo px-5 py-16 md:px-8">
        <div className="mx-auto grid max-w-sitio items-center gap-12 lg:grid-cols-2">
          <div className="order-2 flex flex-col gap-3 rounded-xl2 border border-borde bg-white p-6 shadow-hero lg:order-1">
            <div className="flex justify-between text-sm"><span className="font-bold">Deuda TGR · certificado</span><span className="text-tinta-4">actualizado hace 1 h</span></div>
            {[["Ferretería El Tornillo", "Sin deuda", "text-verde", ""], ["Constructora Andes", "$1.240.500", "text-rojo", "Formulario 29 · jun 2026"], ["Comercial Rivas", "Sin deuda", "text-verde", ""]].map(([n, d, c, s]) => (
              <div key={n} className="flex items-center justify-between border-t border-borde-suave py-3 text-[13px]"><span className="font-semibold">{n}</span><div className="flex flex-col items-end"><span className={`font-bold ${c}`}>{d}</span>{s && <span className="text-xs text-tinta-4">{s}</span>}</div></div>
            ))}
            <div className="flex gap-3 text-[13px] font-bold"><span className="text-azul">Descargar certificado PDF</span><span className="text-tinta-4">Ver historial</span></div>
          </div>
          <div className="order-1 flex flex-col gap-4 lg:order-2">
            <span className="kicker">Tesorería General de la República</span>
            <h2 className="titulo">Deuda TGR sin sorpresas</h2>
            <p className="text-base leading-relaxed text-tinta-2">El certificado de deuda de Tesorería, descargado cada día. Si a un cliente le aparece una deuda, te llega una alerta antes de que se transforme en intereses.</p>
            <div className="flex flex-col gap-2.5"><Check t="Certificado en PDF por RUT" /><Check t="Alerta por correo cuando aparece deuda nueva" /><Check t="Historial para ver cuándo se originó" /></div>
          </div>
        </div>
      </section>

      {/* F29 */}
      <section className="px-5 py-16 md:px-8">
        <div className="mx-auto grid max-w-sitio items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <span className="kicker">SII · Formulario 29</span>
            <h2 className="titulo">F29 mes a mes, en PDF</h2>
            <p className="text-base leading-relaxed text-tinta-2">Las declaraciones mensuales de IVA de todos tus RUT en una sola carpeta, con el folio y el estado de cada período. Ideal para cerrar el mes y para responder rápido cuando un cliente pide su declaración.</p>
            <div className="flex flex-col gap-2.5"><Check t="PDF de cada declaración presentada" /><Check t="Aviso si falta la declaración del mes" /><Check t="Historial de 12 meses o ilimitado según plan" /></div>
          </div>
          <div className="overflow-hidden rounded-xl2 border border-borde bg-white shadow-hero">
            <div className="border-b border-borde px-5 py-3.5"><span className="text-[15px] font-bold">F29 · Ferretería El Tornillo Ltda.</span><span className="block text-xs text-tinta-4">77.218.696-7</span></div>
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><tr><th className="px-5 py-2.5">Período</th><th className="px-5 py-2.5">Estado</th><th className="px-5 py-2.5">Folio</th><th className="px-5 py-2.5">Archivo</th></tr></thead>
              <tbody>
                {[["Agosto 2026", "7.812.334.190"], ["Julio 2026", "7.790.021.554"], ["Junio 2026", "7.761.884.002"], ["Mayo 2026", "7.733.412.877"]].map(([p, f], i) => (
                  <tr key={p} className="border-t border-borde-suave"><td className="px-5 py-3 font-semibold">{p}</td><td className="px-5 py-3"><span className="rounded-md bg-verde-claro px-2 py-0.5 text-xs font-bold text-verde">Declarado</span></td><td className="px-5 py-3 font-mono text-xs">{f}</td><td className="px-5 py-3 font-bold text-azul">F29_2026-0{8 - i}.pdf</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* PRÓXIMAMENTE */}
      <section className="bg-fondo px-5 py-24 md:px-8">
        <div className="mx-auto flex max-w-sitio flex-col gap-10">
          <div className="flex max-w-[640px] flex-col gap-3"><span className="kicker">Próximamente</span><h2 className="titulo">Documentos en evaluación</h2><p className="text-base text-tinta-2">Incluidos en el plan Contador cuando estén disponibles. Cuéntanos por WhatsApp cuál necesitas primero.</p></div>
          <div className="grid gap-5 md:grid-cols-3">
            {[["DTE emitidos y recibidos", "Facturas, notas de crédito y débito en XML."], ["F22", "Declaración anual de renta."], ["Declaraciones juradas", "Estado y comprobantes de DJ presentadas."], ["Boletas de honorarios", "Emitidas y recibidas, con retención."], ["Libros contables", "Libros electrónicos disponibles en el SII."], ["Situación tributaria", "Certificado y observaciones vigentes."]].map(([t, d]) => (
              <div key={t} className="flex flex-col gap-2 rounded-2xl border border-dashed border-[#C9D0DF] bg-white p-6"><span className="text-lg font-extrabold">{t}</span><span className="text-[15px] text-tinta-3">{d}</span></div>
            ))}
          </div>
          <a href={waLink("Hola, me interesa que agreguen el documento: ")} target="_blank" rel="noreferrer" className="btn-borde-azul self-start">Pedir un documento por WhatsApp</a>
        </div>
      </section>
    </Sitio>
  );
}
