import Link from "next/link";
import Sitio from "@/components/Sitio";
import Faq from "@/components/Faq";

const GRUPOS: [string, [string, string][]][] = [
  ["Sobre el servicio", [
    ["¿Qué hace exactamente aSIIstente?", "Se conecta al SII y a la TGR con tu clave tributaria y descarga automáticamente tu RCV, el certificado de deuda TGR y tus F29. Los deja en CSV y PDF, ordenados por RUT y fecha, y te avisa por correo cuando algo cambia."],
    ["¿Necesito instalar algo?", "No. Es 100% en la nube: creas una cuenta, ingresas tu RUT y clave, y listo."],
    ["¿Cada cuánto se actualiza la información?", "Tú lo programas por cada RUT desde el panel, dentro de lo que permite tu plan: una vez al día (Gratis), desde cada hora (Pyme) o desde cada 10 minutos (Contador). Puedes limitarlo a horario hábil, y siempre puedes apretar “Actualizar ahora”."],
    ["¿Puedo administrar varios RUT?", "Sí, desde una sola cuenta. El plan Contador incluye hasta 20 RUT; si necesitas más, escríbenos por WhatsApp."],
    ["¿En qué formato recibo los archivos?", "CSV para el RCV y PDF para F29 y certificados TGR. En el plan Contador también se sincronizan a una carpeta compartida."],
  ]],
  ["Seguridad y clave", [
    ["¿Es seguro darles mi clave tributaria?", "La guardamos cifrada y solo la usamos para consultar. Puedes borrarla cuando quieras y ver cada consulta que se hizo con tu RUT. Detalle completo en la página de Seguridad."],
    ["¿Pueden declarar o pagar algo a mi nombre?", "No. El acceso es de solo lectura. Nunca declaramos, pagamos, aceptamos ni reclamamos facturas."],
    ["¿Debo usar mi Clave Única?", "Te recomendamos no hacerlo. Crea una clave tributaria propia en el SII, distinta a tu Clave Única, y usa esa."],
    ["¿El SII puede bloquear mi clave por tantas consultas?", "Estamos probados haciendo 144 consultas de RCV al día por RUT sin bloqueos. Si el SII rechazara una consulta, te avisamos y pausamos hasta que lo resuelvas."],
  ]],
  ["Planes y cobro", [
    ["¿Puedo cancelar cuando quiera?", "Sí, desde el panel, sin permanencia. Tu plan sigue activo hasta el fin del período pagado."],
    ["¿Emiten factura?", "Sí, factura electrónica afecta a IVA al RUT que indiques."],
    ["¿Qué pasa si supero el límite de mi plan?", "Te avisamos y puedes subir de plan al momento. No dejamos de monitorear los RUT que ya tenías."],
    ["¿Cómo pago?", "Con tarjeta de crédito o débito por WebPay, mensual o anual (el anual tiene 2 meses gratis)."],
  ]],
];

export default function PreguntasFrecuentes() {
  return (
    <Sitio>
      <section className="px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto flex max-w-[880px] flex-col gap-12">
          <div className="flex flex-col gap-3"><span className="kicker">Preguntas frecuentes</span><h1 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-azul md:text-[52px]">Lo que nos preguntan</h1></div>
          {GRUPOS.map(([t, items], i) => (
            <div key={t} className="flex flex-col gap-4"><h2 className="text-2xl font-extrabold">{t}</h2><Faq items={items} abierto={i === 0 ? 0 : -1} /></div>
          ))}
          <div className="flex flex-col items-start gap-3 rounded-xl3 bg-fondo p-8"><span className="text-xl font-extrabold text-azul">¿No encontraste tu respuesta?</span><Link href="/contacto" className="btn-azul">Ir a contacto</Link></div>
        </div>
      </section>
    </Sitio>
  );
}
