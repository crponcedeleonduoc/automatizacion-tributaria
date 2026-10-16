"use client";

import { useState } from "react";

export default function Faq({ items, abierto = 0 }: { items: [string, string][]; abierto?: number }) {
  const [open, setOpen] = useState(abierto);
  return (
    <div className="flex flex-col border-t border-borde">
      {items.map(([q, a], i) => {
        const on = open === i;
        return (
          <div key={q} className="border-b border-borde">
            <button onClick={() => setOpen(on ? -1 : i)}
                    className="flex w-full items-center justify-between gap-4 py-[22px] text-left text-lg font-bold text-tinta">
              <span>{q}</span><span className="shrink-0 text-[22px] text-naranja">{on ? "−" : "+"}</span>
            </button>
            {on && <p className="pb-[22px] pr-10 text-base leading-[1.65] text-tinta-3">{a}</p>}
          </div>
        );
      })}
    </div>
  );
}
