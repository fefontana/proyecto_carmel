//const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
// Quitamos "/api" del final si existe para apuntar a la raíz del servidor (http://localhost:3000)
const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/api\/?$/, "");

const iconosPorCategoria = {
  miel: "🍯",
  "dulce de leche": "🫙",
};

export default function ProductoImagen({ producto, className = "" }) {
  const nombreCategoria = producto?.categoria?.nombre?.toLowerCase() || "";
  const icono = iconosPorCategoria[nombreCategoria] || "🌿";

  // 1. Buscamos la imagen que tenga isMain: true dentro del nuevo array de Multer.
  // Si no hay ninguna marcada como principal, tomamos la primera del array como respaldo.
  const imagenPrincipal = producto?.images?.find(img => img.isMain) || producto?.images?.[0];
  // 2. Definimos la URL final: priorizamos el nuevo esquema, luego el viejo string por compatibilidad, o null.
  const rutaCruda = imagenPrincipal?.url || producto?.imagen_url;
  // 3. Si es una ruta local (/uploads/...), le pegamos el dominio del backend adelante
  const urlFinal = rutaCruda
    ? rutaCruda.startsWith("http")
      ? rutaCruda
      : `${BASE_URL}${rutaCruda}`
    : null;
  // 4. Si encontramos una imagen válida, la renderizamos
  if (urlFinal) {
  //if (producto?.imagen_url) {
    return (
      <img
        src={urlFinal}
        alt={producto?.nombre || "Producto"}
        className={`h-full w-full object-cover ${className}`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-forest-50 text-4xl ${className}`}
    >
      {icono}
    </div>
  );
}
