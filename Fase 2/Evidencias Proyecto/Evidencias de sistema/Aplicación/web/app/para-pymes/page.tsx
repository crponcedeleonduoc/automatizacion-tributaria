import Link from "next/link";
import Sitio from "@/components/Sitio";

export default function ParaPymes() {
  return (
    <Sitio>
      <section className="px-5 pb-16 pt-16 md:px-8 md:pt-24">
        <div className="mx-auto grid max-w-sitio items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col items-start gap-5">
            <span className="kicker">Para dueños de pymes</span>
            <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-azul md:text-[52px]">Sabe cómo está tu empresa hoy, sin llamar al contador</h1>
            <p className="max-w-[520px] text-[17px] leading-relaxed text-tinta-2">Tus ventas, tus compras, si le debes plata a Tesorería y si tus facturas fueron aceptadas. En un panel simple, sin entender el portal del SII.</p>
            <div className="flex flex-wrap gap-3"><Link href="/acceso?registro=1" className="btn-azul">Probar gratis</Link><Link href="/#demo" className="btn-borde-naranja">Ver demo con mi RUT</Link></div>
          </div>
          <div className="flex flex-col gap-4 rounded-xl2 border border-borde bg-white p-6 shadow-hero">
            <div className="flex flex-col"><span className="text-xs text-tinta-4">Ferretería El Tornillo Ltda. · 77.218.696-7</span><span className="text-xl font-extrabold">¿Cómo está mi empresa hoy?</span><span className="text-xs text-tinta-4">Actualizado hace 6 min</span></div>
            <div className="grid grid-cols-2 gap-3">
              {[["Ventas septiembre", "$38.410.220", "47 facturas", ""], ["Compras septiembre", "$21.905.870", "112 documentos", ""], ["Deuda con Tesorería", "Sin deuda", "Certificado de hoy", "text-verde"], ["Facturas sin respuesta", "3", "Quedan 5 días para reclamo", "text-ambar"]].map(([t, v, s, c]) => (
                <div key={t} className="flex flex-col gap-0.5 rounded-xl border border-borde p-3.5"><span className="text-xs font-semibold text-tinta-4">{t}</span><span className={`text-xl font-extrabold ${c}`}>{v}</span><span className="text-xs text-tinta-3">{s}</span></div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-fondo px-4 py-3 text-[13px]"><span>F29 de agosto presentado el 12 de septiembre</span><span className="font-bold text-azul">Ver PDF</span></div>
          </div>
        </div>
      </section>

      <section className="bg-fondo px-5 py-24 md:px-8">
        <div className="mx-auto grid max-w-sitio items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <span className="kicker">Caso de uso · factoring</span>
            <h2 className="titulo">Vendiste $15 millones a 60 días. Necesitas la plata ahora.</h2>
            <p className="text-base leading-relaxed text-tinta-2">Una ferretería le vende $15.000.000 a una constructora que paga a 60 días. Para hacer factoring, la empresa de factoring pide que la factura esté aceptada en el SII. El cliente tiene 8 días para reclamarla. Revisar una vez al día no sirve: cada hora que pasa es un día más sin caja.</p>
          </div>
          <ol className="flex flex-col gap-3">
            {[["bg-azul", "Factura emitida", "1 sep · $15.000.000 · Constructora Andes SpA"], ["bg-naranja", "8 días para reclamo", "aSIIstente revisa el RCV cada 10 minutos"], ["bg-verde", "Aceptada", "3 sep, 11:40 · alerta al correo al instante"], ["bg-azul", "Factoring el mismo día", "Con el RCV como respaldo, la plata llega esa semana"]].map(([c, t, s]) => (
              <li key={t} className="flex items-start gap-4 rounded-xl border border-borde bg-white p-4"><span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${c}`} /><div className="flex flex-col"><span className="text-sm font-bold">{t}</span><span className="text-[13px] text-tinta-4">{s}</span></div></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto grid max-w-sitio gap-6 md:grid-cols-3">
          {[["Sin depender del contador", "Tu contador sigue haciendo su trabajo. Tú simplemente ves los números cuando los necesitas, sin esperar respuesta."], ["Sin aprender el portal", "Nada de menús del SII. Ventas, compras, deuda y facturas con nombre y apellido, en español de a pie."], ["Sin sorpresas de Tesorería", "Si aparece una deuda TGR te llega un correo ese mismo día, antes de que sume intereses."]].map(([t, d]) => (
            <div key={t} className="tarjeta flex flex-col gap-3"><span className="text-xl font-extrabold">{t}</span><p className="text-[15px] leading-relaxed text-tinta-3">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-24 md:px-8">
        <div className="mx-auto flex max-w-sitio flex-col items-start justify-between gap-8 rounded-xl3 bg-fondo p-10 md:flex-row md:items-center md:p-16">
          <div className="flex flex-col gap-3"><h2 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-azul md:text-[40px]">Plan Pyme: $9.990/mes</h2><p className="text-[17px] text-tinta-2">RCV, TGR y F29 cada hora, 12 meses de historial y alertas por correo. O empieza gratis con tu RCV diario.</p></div>
          <div className="flex shrink-0 flex-wrap gap-3"><Link href="/acceso?registro=1" className="btn-azul">Crear cuenta gratis</Link><Link href="/precios" className="btn-borde-azul">Ver planes</Link></div>
        </div>
      </section>
    </Sitio>
  );
}
