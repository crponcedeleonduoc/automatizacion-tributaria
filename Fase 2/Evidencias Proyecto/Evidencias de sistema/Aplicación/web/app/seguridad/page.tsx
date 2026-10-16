import Sitio from "@/components/Sitio";
import { waLink } from "@/lib/api";

const PUNTOS = [
  ["Cifrado", "Cifrada en reposo y en tránsito", "Tu clave tributaria se guarda en nuestra base de datos cifrada (Fernet: AES-128-CBC con autenticación HMAC-SHA256) con una clave de aplicación que no vive en la base de datos. Nunca está en texto plano en disco. Toda la comunicación entre tu navegador, aSIIstente y el SII viaja por TLS."],
  ["Solo lectura", "aSIIstente nunca declara, paga ni modifica nada a tu nombre", "Usamos tu clave únicamente para consultar y descargar información: RCV, certificado de deuda TGR y F29. No presentamos declaraciones, no aceptamos ni reclamamos facturas, no hacemos pagos ni cambiamos datos de tu contribuyente. El código bloquea por diseño cualquier operación cuyo nombre sugiera escritura."],
  ["Control", "Revocas el acceso cuando quieras", "Desde el panel puedes eliminar la clave de cualquier RUT, borrar su historial descargado o cerrar la cuenta completa. La eliminación es inmediata; los respaldos se purgan dentro de [30 días]."],
  ["Trazabilidad", "Ves cada consulta hecha con tu RUT", "El registro de actividad muestra fecha, hora, documento consultado y resultado de cada acceso al SII o a la TGR. Si algo no te cuadra, lo ves ahí."],
  ["Infraestructura", "Servidores en Chile con respaldos", "Alojado en [V2Networks, Chile] con respaldos diarios cifrados, acceso al servidor restringido al equipo de aSIIstente con autenticación de dos factores, y registro de todos los accesos administrativos."],
  ["Recomendación", "Usa una clave tributaria distinta a tu Clave Única", "El SII permite tener una clave tributaria propia, separada de la Clave Única del Estado. Te recomendamos usar esa: así lo que nos confías sirve solo para el SII y no para otros trámites."],
  ["Independencia", "No tenemos relación con el SII ni la TGR", "aSIIstente es un servicio privado independiente. No está afiliado ni es operado por el Servicio de Impuestos Internos ni por la Tesorería General de la República de Chile. Accedemos a sus portales con tu autorización, en tu nombre."],
];

export default function Seguridad() {
  return (
    <Sitio>
      <section className="px-5 pb-16 pt-16 md:px-8 md:pt-24">
        <div className="mx-auto flex max-w-sitio flex-col gap-4">
          <span className="kicker">Seguridad</span>
          <h1 className="max-w-[860px] text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-azul md:text-[52px]">Nos confías tu clave tributaria. Esto es exactamente lo que hacemos con ella.</h1>
          <p className="max-w-[620px] text-[17px] leading-relaxed text-tinta-2">Sin frases grandilocuentes. Cada punto de esta página describe algo concreto que puedes verificar desde tu panel.</p>
        </div>
      </section>
      <section className="px-5 pb-24 md:px-8">
        <div className="mx-auto flex max-w-[880px] flex-col">
          {PUNTOS.map(([k, t, d], i) => (
            <div key={t} className={`grid gap-3 border-t border-borde py-8 md:grid-cols-[160px_1fr] md:gap-8 ${i === PUNTOS.length - 1 ? "border-b" : ""}`}>
              <span className="kicker">{k}</span>
              <div className="flex flex-col gap-2"><span className="text-xl font-extrabold">{t}</span><p className="text-[15px] leading-relaxed text-tinta-3">{d}</p>
                {k === "Trazabilidad" && (
                  <table className="mt-2 w-full text-left text-[13px]">
                    <thead className="text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-4"><tr><th className="py-2">Fecha y hora</th><th className="py-2">RUT</th><th className="py-2">Documento</th><th className="py-2">Resultado</th></tr></thead>
                    <tbody>{[["03-09-2026 11:40:12", "RCV ventas"], ["03-09-2026 11:30:09", "RCV ventas"], ["03-09-2026 11:00:02", "Deuda TGR"]].map(([f, d2]) => <tr key={f} className="border-t border-borde-suave"><td className="py-2 text-tinta-3">{f}</td><td className="py-2">77.218.696-7</td><td className="py-2">{d2}</td><td className="py-2 font-bold text-verde">OK</td></tr>)}</tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="px-5 pb-24 md:px-8">
        <div className="mx-auto flex max-w-sitio flex-col items-start justify-between gap-6 rounded-xl3 bg-fondo p-10 md:flex-row md:items-center">
          <div className="flex flex-col gap-2"><span className="text-2xl font-extrabold text-azul">¿Tienes una pregunta que no está aquí?</span><span className="text-tinta-2">Escríbenos por WhatsApp o a seguridad@asiistente.cl y te respondemos con detalle.</span></div>
          <a href={waLink("Hola, tengo una pregunta de seguridad sobre aSIIstente")} target="_blank" rel="noreferrer" className="btn-azul">WhatsApp</a>
        </div>
      </section>
    </Sitio>
  );
}
