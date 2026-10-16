import type { Config } from "tailwindcss";

// Tokens tomados del diseño hecho en Claude Design (web asiistente).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        azul: { DEFAULT: "#0047BB", oscuro: "#003A99", claro: "#EEF3FC", borde: "#C9D6F2" },
        naranja: { DEFAULT: "#FF8C42", oscuro: "#F27A2B", claro: "#FFF4EC", borde: "#FFD9C2", texto: "#8A4A18" },
        tinta: { DEFAULT: "#0F1B33", 2: "#3D4760", 3: "#5B6478", 4: "#7A839A", 5: "#9AA3B5" },
        fondo: "#F6F8FC",
        borde: { DEFAULT: "#E6E9F0", suave: "#F0F2F7", campo: "#D5DAE5" },
        verde: { DEFAULT: "#1B8A4C", claro: "#E6F6EC" },
        rojo: { DEFAULT: "#C0392B", claro: "#FDECEA" },
        ambar: "#B8641A",
        wa: { DEFAULT: "#25D366", oscuro: "#1EBE5A" },
      },
      fontFamily: { sans: ["Manrope", "system-ui", "sans-serif"] },
      borderRadius: { xl2: "20px", xl3: "28px" },
      boxShadow: {
        card: "0 1px 3px rgba(15,27,51,0.04)",
        flot: "0 12px 40px rgba(15,27,51,0.06)",
        hero: "0 24px 60px rgba(15,27,51,0.10)",
        azul: "0 16px 40px rgba(0,71,187,0.25)",
      },
      maxWidth: { sitio: "1200px" },
    },
  },
  plugins: [],
};
export default config;
