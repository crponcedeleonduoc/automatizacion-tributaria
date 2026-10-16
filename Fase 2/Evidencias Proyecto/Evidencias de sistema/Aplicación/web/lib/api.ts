// Cliente mínimo de la API. El token vive en localStorage (solo en el navegador).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
export const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP || "56900000000";

export function waLink(texto = "Hola, quiero saber más de aSIIstente") {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("asiistente_token");
  } catch {
    return null;
  }
}

export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem("asiistente_token", t);
    else localStorage.removeItem("asiistente_token");
  } catch {}
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

async function leerError(r: Response): Promise<string> {
  try {
    const j = await r.json();
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) return j.detail.map((d: any) => d.msg).join("; ");
  } catch {}
  return `Error ${r.status}`;
}

export async function api<T = any>(
  ruta: string,
  opciones: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = { ...(opciones.headers as any) };
  if (!(opciones.body instanceof FormData) && !(opciones.body instanceof URLSearchParams)) {
    headers["Content-Type"] = "application/json";
  }
  if (opciones.auth !== false) {
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const r = await fetch(`${API_URL}${ruta}`, { ...opciones, headers });
  if (r.status === 401 && opciones.auth !== false) {
    setToken(null);
    if (typeof window !== "undefined" && !location.pathname.startsWith("/acceso")) {
      location.href = "/acceso";
    }
  }
  if (!r.ok) throw new ApiError(r.status, await leerError(r));
  if (r.status === 204) return undefined as T;
  return r.json();
}

export function clp(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return "$" + Math.round(n).toLocaleString("es-CL");
}

export function fecha(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

export function periodoLegible(p: string) {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${meses[parseInt(p.slice(4)) - 1]} ${p.slice(0, 4)}`;
}

/** Descarga un archivo de la API autenticado (los <a href> no llevan el token). */
export async function descargar(ruta: string, nombre: string) {
  const t = getToken();
  const r = await fetch(`${API_URL}${ruta}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!r.ok) throw new ApiError(r.status, await leerError(r));
  const cd = r.headers.get("content-disposition") || "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(cd);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = m ? decodeURIComponent(m[1]) : nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
