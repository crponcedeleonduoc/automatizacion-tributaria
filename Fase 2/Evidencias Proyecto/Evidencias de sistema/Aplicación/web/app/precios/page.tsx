"use client";

import Link from "next/link";
import { useState } from "react";
import Sitio from "@/components/Sitio";
import Faq from "@/components/Faq";
import { waLink } from "@/lib/api";

const FILAS = [
  ["Precio", "$0", "$9.990/mes", "$29.990/mes"],
  ["RUT", "1", "1", "Hasta 20 RUT"],
  ["Documentos", "RCV", "RCV + TGR + F29", "RCV + TGR + F29 + todos los próximos"],
  ["Frecuencia de actualización", "1 vez al día", "Cada hora", "Cada 10 minutos (tiempo real)"],
  ["Historial", "Mes actual", "12 meses", "Ilimitado"],
  ["Alertas por correo", "—", "Sí", "Sí, configurables"],
  ["Exportación", "CSV", "CSV + PDF", "CSV + PDF + carpeta compartida"],
  ["Soporte", "Correo", "Correo", "WhatsApp prioritario"],
];

const FAQ: [string, string][] = [
  ["¿Puedo cancelar cuando quiera?", "Sí. Cancelas desde el panel en un clic, sin llamadas ni permanencia. Tu plan sigue activo hasta el fin del período pagado."],
  ["¿Emiten factura?", "Sí. Emitimos factura electrónica afecta a IVA a nombre del RUT que indiques. Llega a tu correo el mismo día del cobro."],
  ["¿Qué pasa si supero el límite de RUT?", "Te avisamos por correo y en el panel. Puedes subir de plan al momento o escribirnos por WhatsApp para un plan a medida. Nunca dejamos de monitorear los RUT que ya tenías."],
  ["¿Cómo pago?", "Con tarjeta de crédito o débito a través de WebPay. El cobro es automático cada mes o cada año según tu elección."],
];

export default function Precios() {
  const [anual, setAnual] = useState(false);
  const suf = anual ? "/año · IVA incl." : "/mes · IVA incl.";
  return (
    <Sitio>
      <section className="px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto flex max-w-sitio flex-col gap-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="kicker">Precios</span>
            <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-azul md:text-[52px]">Un plan para cada tamaño de cartera</h1>
            <p className="max-w-[560px] text-[17px] text-tinta-2">Precios en pesos chilenos, IVA incluido. Parte gratis y sube cuando lo necesites.</p>
            <div className="mt-2 inline-flex gap-1 rounded-xl bg-[#E9EDF5] p-1">
              <button onClick={() => setAnual(false)} className={`rounded-[9px] px-[18px] py-2.5 text-[15px] font-bold ${!anual ? "bg-white text-azul shadow-card" : "text-tinta-3"}`}>Mensual</button>
              <button onClick={() => setAnual(true)} className={`rounded-[9px] px-[18px] py-2.5 text-[15px] font-bold ${anual ? "bg-white text-azul shadow-card" : "text-tinta-3"}`}>Anual <span className="ml-1 text-xs font-bold text-naranja">2 meses gratis</span></button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Plan nombre="Gratis" desc="Para conocer tu RCV sin entrar al SII." precio="$0" suf="" cta="Crear cuenta gratis" href="/acceso?registro=1"
                  items={["1 RUT", "RCV", "Actualización 1 vez al día", "Historial del mes actual", "Exportación CSV", "Soporte por correo"]} />
            <Plan nombre="Pyme" desc="Para saber cómo está tu empresa hoy." precio={anual ? "$99.900" : "$9.990"} suf={suf} cta="Empezar con Pyme" href="/acceso?registro=1&plan=pyme"
                  items={["1 RUT", "RCV + TGR + F29", "Actualización cada hora", "Historial 12 meses", "Alertas por correo", "Exportación CSV + PDF", "Soporte por correo"]} />
            <Plan nombre="Contador" desc="Para estudios que administran muchos RUT." precio={anual ? "$299.900" : "$29.990"} suf={suf} cta="Empezar con Contador" href="/acceso?registro=1&plan=contador" popular
                  items={["Hasta 20 RUT", "RCV + TGR + F29 + todos los próximos", "Cada 10 minutos (tiempo real)", "Historial ilimitado", "Alertas configurables", "CSV + PDF + carpeta compartida", "WhatsApp prioritario"]} />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-borde">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAFBFD] text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4">
                <tr><th className="p-4">Comparación detallada</th><th className="p-4">Gratis</th><th className="p-4">Pyme</th><th className="p-4 text-azul">Contador</th></tr>
              </thead>
              <tbody>
                {FILAS.map(([k, g, p, c]) => (
                  <tr key={k} className="border-t border-borde-suave"><td className="p-4 font-semibold">{k}</td><td className="p-4 text-tinta-2">{g}</td><td className="p-4 text-tinta-2">{p}</td><td className="p-4 font-semibold text-tinta">{c}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 rounded-2xl bg-fondo p-8 md:flex-row">
            <span className="text-[17px] font-semibold text-tinta">¿Más de 20 RUT o necesitas integración? Escríbenos por WhatsApp</span>
            <a href={waLink("Hola, necesito un plan para más de 20 RUT")} target="_blank" rel="noreferrer" className="btn-azul">Abrir WhatsApp</a>
          </div>

          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-8">
            <h2 className="titulo">Preguntas sobre el cobro</h2>
            <Faq items={FAQ} />
          </div>
        </div>
      </section>
    </Sitio>
  );
}

function Plan({ nombre, desc, precio, suf, cta, href, items, popular }: { nombre: string; desc: string; precio: string; suf: string; cta: string; href: string; items: string[]; popular?: boolean }) {
  return (
    <div className={`relative flex flex-col gap-5 rounded-xl2 bg-white p-8 ${popular ? "border-2 border-azul shadow-flot" : "border border-borde"}`}>
      {popular && <span className="absolute -top-3.5 left-8 rounded-full bg-naranja px-3 py-1 text-xs font-bold text-white">Más popular</span>}
      <div className="flex flex-col gap-1"><span className="text-2xl font-extrabold">{nombre}</span><span className="text-sm text-tinta-3">{desc}</span></div>
      <div className="flex items-baseline gap-1"><span className="text-[40px] font-extrabold tracking-[-0.02em] text-azul">{precio}</span><span className="text-sm text-tinta-4">{suf}</span></div>
      <Link href={href} className={popular ? "btn-azul" : "btn-borde-azul"}>{cta}</Link>
      <ul className="flex flex-col gap-2.5 text-[15px] text-tinta-2">
        {items.map((i) => <li key={i} className="flex gap-2.5"><span className="font-bold text-naranja">✓</span>{i}</li>)}
      </ul>
    </div>
  );
}
