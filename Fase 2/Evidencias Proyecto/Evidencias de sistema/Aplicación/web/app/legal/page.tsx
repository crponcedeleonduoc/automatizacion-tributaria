import Sitio from "@/components/Sitio";

// Plantillas legales del diseño. Revisar con abogado antes de publicar; los [corchetes] son datos por completar.

const TERMINOS: [string, string][] = [
  ["1. Descripción del servicio", "aSIIstente es una plataforma en la nube que, con autorización del usuario, consulta los portales del Servicio de Impuestos Internos (SII) y de la Tesorería General de la República (TGR) para descargar información tributaria del contribuyente (Registro de Compras y Ventas, certificado de deuda, Formulario 29 y otros que se incorporen) y ponerla a disposición del usuario en archivos CSV y PDF, junto con alertas por correo electrónico. aSIIstente es un servicio privado independiente y no tiene relación con el SII ni con la TGR."],
  ["2. Uso de credenciales bajo autorización del usuario", "El usuario declara ser el titular del RUT ingresado o contar con autorización expresa de su titular, y autoriza a aSIIstente a utilizar la clave tributaria únicamente para consultar y descargar información, en modo de solo lectura. aSIIstente no presentará declaraciones, no realizará pagos ni modificará información ante el SII o la TGR. Las credenciales se almacenan cifradas y pueden ser eliminadas por el usuario en cualquier momento desde el panel."],
  ["3. Límites de responsabilidad", "aSIIstente entrega la información tal como la publican el SII y la TGR, en la frecuencia contratada. La obligación de declarar, pagar y cumplir los plazos tributarios sigue siendo exclusivamente del contribuyente. aSIIstente no responde por multas, intereses ni perjuicios derivados de errores u omisiones en la información publicada por los organismos, de indisponibilidad de sus portales, de bloqueos de clave, ni de decisiones tomadas por el usuario a partir de la información entregada."],
  ["4. Planes y cobros", "Los planes, precios y límites vigentes se publican en la página de Precios. Los precios están en pesos chilenos e incluyen IVA. El cobro es anticipado, mensual o anual, mediante WebPay. Se emite factura electrónica al RUT indicado por el usuario. aSIIstente puede modificar precios con aviso de al menos [30 días]; el cambio aplica desde el siguiente período de facturación."],
  ["5. Cancelación", "El usuario puede cancelar su plan en cualquier momento desde el panel, sin permanencia. El servicio se mantiene activo hasta el fin del período pagado; no se realizan devoluciones proporcionales salvo lo que exija la ley. Al cerrar la cuenta se eliminan las credenciales de inmediato y los datos descargados dentro de [30 días]."],
  ["6. Disponibilidad del servicio", "aSIIstente hará esfuerzos razonables por mantener el servicio disponible de forma continua, pero no garantiza disponibilidad ininterrumpida. La frecuencia de actualización depende de la disponibilidad de los portales del SII y la TGR. Las interrupciones programadas se avisarán con anticipación por correo."],
];

const PRIVACIDAD: [string, string][] = [
  ["1. Qué datos guardamos", "Datos de cuenta: correo electrónico y contraseña (esta última solo como hash). Datos de los RUT conectados: RUT, razón social y clave tributaria cifrada. Información tributaria descargada: RCV, certificados TGR, F29 y los documentos que se incorporen. Registro de actividad: fecha, hora, documento y resultado de cada consulta. Datos de facturación: RUT y razón social para la emisión de factura; los datos de tarjeta los procesa WebPay y no pasan por aSIIstente."],
  ["2. Para qué los usamos", "Exclusivamente para prestar el servicio: consultar el SII y la TGR en nombre del usuario, generar los archivos, enviar alertas, emitir facturas y dar soporte. No vendemos ni cedemos datos a terceros. No usamos la información tributaria para fines distintos a mostrarla al usuario que la conectó."],
  ["3. Por cuánto tiempo", "Las credenciales se conservan mientras el RUT esté conectado y se eliminan de inmediato al desconectarlo. La información descargada se conserva según el historial del plan (mes actual, 12 meses o ilimitado) y se elimina dentro de [30 días] tras cerrar la cuenta. Los datos de facturación se conservan por el plazo que exige la normativa tributaria."],
  ["4. Cómo solicitar acceso, rectificación o eliminación", "Desde el panel puedes eliminar cualquier RUT, su historial o la cuenta completa sin intervención nuestra. Para ejercer los derechos de acceso, rectificación, cancelación u oposición que reconoce la Ley 19.628 (y la Ley 21.719 desde su entrada en vigencia), escribe a privacidad@asiistente.cl; respondemos dentro de [2 días hábiles]."],
  ["5. Seguridad y terceros", "Los datos se alojan en [V2Networks, Chile] con cifrado en reposo y en tránsito, respaldos cifrados y acceso restringido. Los proveedores que intervienen son: [proveedor de nube] (infraestructura), WebPay (pagos) y [proveedor de correo] (envío de alertas). Detalle en la página de Seguridad."],
];

export default function Legal() {
  return (
    <Sitio>
      <section className="px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto flex max-w-[880px] flex-col gap-16">
          <div className="flex flex-col gap-3"><span className="kicker">Legal</span><h1 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-azul">Términos de servicio y Política de privacidad</h1><p className="text-sm text-tinta-4">Plantillas con la estructura y puntos clave. Revisar con abogado antes de publicar.</p></div>
          <Bloque id="terminos" titulo="Términos de servicio" sub="Última actualización: [fecha] · aSIIstente SpA, RUT [RUT de la empresa]" items={TERMINOS} />
          <Bloque id="privacidad" titulo="Política de privacidad" sub="Conforme a la Ley 19.628 sobre protección de la vida privada · Última actualización: [fecha]" items={PRIVACIDAD} />
        </div>
      </section>
    </Sitio>
  );
}

function Bloque({ id, titulo, sub, items }: { id: string; titulo: string; sub: string; items: [string, string][] }) {
  return (
    <div id={id} className="flex scroll-mt-24 flex-col gap-8">
      <div className="flex flex-col gap-1"><h2 className="text-[30px] font-extrabold tracking-[-0.02em] text-azul">{titulo}</h2><span className="text-sm text-tinta-4">{sub}</span></div>
      {items.map(([t, d]) => <div key={t} className="flex flex-col gap-2"><h3 className="text-lg font-extrabold">{t}</h3><p className="text-[15px] leading-[1.7] text-tinta-2">{d}</p></div>)}
    </div>
  );
}
