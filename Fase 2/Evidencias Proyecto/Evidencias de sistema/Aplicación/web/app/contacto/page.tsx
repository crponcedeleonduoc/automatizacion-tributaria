import Sitio, { IconoWA } from "@/components/Sitio";
import { waLink } from "@/lib/api";

export default function Contacto() {
  return (
    <Sitio>
      <section className="px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto flex max-w-sitio flex-col gap-12">
          <div className="flex flex-col gap-3"><span className="kicker">Contacto</span><h1 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-azul md:text-[52px]">Hablemos por WhatsApp</h1><p className="max-w-[620px] text-[17px] text-tinta-2">Es nuestro canal principal. Respondemos personas, no bots, y en horario hábil normalmente en menos de una hora.</p></div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col items-start gap-4 rounded-xl2 bg-azul p-8 text-white shadow-azul">
              <span className="text-2xl font-extrabold">WhatsApp</span>
              <a href={waLink()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2.5 rounded-xl bg-wa px-6 py-4 text-base font-bold !text-white hover:bg-wa-oscuro"><IconoWA size={22} /> Abrir chat de WhatsApp</a>
              <span className="text-sm text-white/70">Se abre con el mensaje “Hola, quiero saber más de aSIIstente” ya escrito.</span>
            </div>
            <div className="flex flex-col gap-6">
              {[["Horario de atención", "Lunes a viernes, 9:00 a 18:00", "Hora de Chile continental. Los mensajes fuera de horario se responden el siguiente día hábil. Clientes del plan Contador tienen atención prioritaria."], ["Correo", "hola@asiistente.cl", "Para facturación, integraciones o temas que prefieras por escrito. Respondemos dentro de un día hábil."], ["Seguridad", "seguridad@asiistente.cl", "Si encontraste algo que debamos saber sobre el manejo de datos o credenciales."]].map(([t, v, d]) => (
                <div key={t} className="flex flex-col gap-1 border-t border-borde pt-5"><span className="kicker">{t}</span><span className="text-lg font-extrabold">{v}</span><span className="text-[15px] text-tinta-3">{d}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Sitio>
  );
}
