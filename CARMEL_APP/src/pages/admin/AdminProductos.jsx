
import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { formatearPrecio } from "../../utils/format";
import { Cargando, ErrorAviso, Vacio } from "../../components/Estado";

const API_URL = "http://localhost:3000";

const formVacio = {
    nombre: "",
    categoria_id: "",
    precio: "",
    stock: "",
    descripcion: "",
};

export default function AdminProductos() {
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState(formVacio);
    const [guardando, setGuardando] = useState(false);

    // Imágenes almacenadas en el servidor
    const [imagenesExistentes, setImagenesExistentes] = useState([]);

    // Imágenes nuevas seleccionadas localmente
    const [imagenesNuevas, setImagenesNuevas] = useState([]);

    // --------------------------------------------------
    // CARGA DE PRODUCTOS Y CATEGORÍAS
    // --------------------------------------------------

    async function cargar() {
        setCargando(true);
        setError("");

        try {
            const [prods, cats] = await Promise.all([
                api.listarProductosAdmin(),
                api.listarCategorias(),
            ]);

            setProductos(prods.productos || []);
            setCategorias(cats.categorias || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        cargar();
    }, []);

    // --------------------------------------------------
    // LIBERACIÓN DE URLS TEMPORALES
    // --------------------------------------------------

    function liberarImagenesNuevas(imagenes) {
        imagenes.forEach((img) => {
            URL.revokeObjectURL(img.previewUrl);
        });
    }

    // --------------------------------------------------
    // APERTURA DE FORMULARIOS
    // --------------------------------------------------

    function abrirNuevo() {
        liberarImagenesNuevas(imagenesNuevas);

        setForm({ ...formVacio });
        setImagenesExistentes([]);
        setImagenesNuevas([]);
        setEditando("nuevo");
        setError("");
    }

    function abrirEditar(producto) {
        liberarImagenesNuevas(imagenesNuevas);

        setForm({
            nombre: producto.nombre || "",
            categoria_id: producto.categoria_id || "",
            precio: producto.precio ?? "",
            stock: producto.stock ?? "",
            descripcion: producto.descripcion || "",
        });

        setImagenesExistentes(
            (producto.images || []).map((img) => ({ ...img }))
        );

        setImagenesNuevas([]);
        setEditando(producto);
        setError("");
    }

    function cancelarEdicion() {
        liberarImagenesNuevas(imagenesNuevas);

        setImagenesNuevas([]);
        setImagenesExistentes([]);
        setEditando(null);
        setForm({ ...formVacio });
        setError("");
    }

    // --------------------------------------------------
    // SELECCIÓN DE NUEVAS IMÁGENES
    // --------------------------------------------------

    function handleFileChange(e) {
        const archivos = Array.from(e.target.files || []);

        if (archivos.length === 0) return;

        const permitidos = archivos.filter((file) =>
            file.type.startsWith("image/")
        );

        if (permitidos.length !== archivos.length) {
            setError("Solo se permiten archivos de imagen.");
        }

        const yaHayPrincipal =
            imagenesExistentes.some((img) => img.isMain) ||
            imagenesNuevas.some((img) => img.isMain);

        const mapeadas = permitidos.map((file, idx) => ({
            fileObject: file,
            previewUrl: URL.createObjectURL(file),
            isMain: !yaHayPrincipal && idx === 0,
        }));

        setImagenesNuevas((prev) => [...prev, ...mapeadas]);

        // Permite seleccionar nuevamente el mismo archivo
        e.target.value = "";
    }

    // --------------------------------------------------
    // SELECCIÓN EXCLUSIVA DE IMAGEN PRINCIPAL
    // --------------------------------------------------

    function handleMarcarPrincipal(tipo, indexTarget) {
        setImagenesExistentes((prev) =>
            prev.map((img, idx) => ({
                ...img,
                isMain: tipo === "existente" && idx === indexTarget,
            }))
        );

        setImagenesNuevas((prev) =>
            prev.map((img, idx) => ({
                ...img,
                isMain: tipo === "nueva" && idx === indexTarget,
            }))
        );
    }

    // --------------------------------------------------
    // ELIMINACIÓN DE IMAGEN EXISTENTE EN EL SERVIDOR
    // --------------------------------------------------

    async function handleEliminarExistente(imageUrl) {
        if (!editando || editando === "nuevo") return;

        const confirmar = window.confirm(
            "¿Seguro que querés eliminar permanentemente esta imagen del servidor?"
        );

        if (!confirmar) return;

        setError("");

        try {

            const token = localStorage.getItem("carmel_token"); //TOKEN_KEY
            
            const res = await fetch(
                `${API_URL}/api/productos/media/delete`,
                {
                    method: "DELETE",
                    headers: { 
                        "Content-Type": "application/json",
                        ...(token && { Authorization: `Bearer ${token}` }),
                    },
                    body: JSON.stringify({
                        productoId: editando.id,
                        imageUrl,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok || !data.ok) {
                throw new Error(
                    data.message || "No se pudo eliminar la imagen."
                );
            }

            setImagenesExistentes(data.imagenes || []);
        } catch (err) {
            setError(err.message);
        }
    }

    // --------------------------------------------------
    // ELIMINACIÓN DE IMAGEN NUEVA
    // --------------------------------------------------

    function handleQuitarNueva(indexTarget) {
        setImagenesNuevas((prev) => {
            const imagen = prev[indexTarget];

            if (imagen) {
                URL.revokeObjectURL(imagen.previewUrl);
            }

            return prev.filter((_, idx) => idx !== indexTarget);
        });
    }

    // --------------------------------------------------
    // GUARDAR PRODUCTO
    // --------------------------------------------------

    async function guardar(e) {
        e.preventDefault();

        if (!editando || guardando) return;

        setGuardando(true);
        setError("");

        try {
            const formData = new FormData();

            // Campos del producto
            formData.append("nombre", form.nombre);
            formData.append("categoria_id", form.categoria_id);
            formData.append("precio", form.precio);
            formData.append("stock", form.stock);
            formData.append("descripcion", form.descripcion);

            // Archivos binarios
            imagenesNuevas.forEach((img) => {
                formData.append("images", img.fileObject);
            });

            // Control de imágenes y portada
            const controlPortadas = {
                existentes: imagenesExistentes.map((img) => ({
                    url: img.url,
                    isMain: img.isMain,
                })),

                indicesNuevasPrincipales: imagenesNuevas.map(
                    (img) => img.isMain
                ),
            };

            formData.append(
                "controlPortadas",
                JSON.stringify(controlPortadas)
            );

            const esNuevo = editando === "nuevo";

            const url = esNuevo
                ? `${API_URL}/api/productos`
                : `${API_URL}/api/productos/${editando.id}`;

            // 1. Recuperamos el token de sesión del administrador
            const token = localStorage.getItem("carmel_token");

            const res = await fetch(url, {
                method: esNuevo ? "POST" : "PUT",
                headers: {
                    // 2. Enviamos el Bearer Token sin declarar Content-Type
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: formData,
            });

            const data = await res.json();

            if (!res.ok || !data.ok) {
                throw new Error(
                    data.message || "Error al procesar el producto."
                );
            }

            liberarImagenesNuevas(imagenesNuevas);

            setImagenesNuevas([]);
            setImagenesExistentes([]);
            setEditando(null);
            setForm({ ...formVacio });

            await cargar();
        } catch (err) {
            setError(err.message);
        } finally {
            setGuardando(false);
        }
    }

    // --------------------------------------------------
    // ACTIVAR / DESACTIVAR PRODUCTO
    // --------------------------------------------------

    async function toggleActivo(producto) {
        setError("");

        try {
            if (producto.activo) {
                await api.eliminarProducto(producto.id);
            } else {
                await api.actualizarProducto(producto.id, {
                    activo: true,
                });
            }

            await cargar();
        } catch (err) {
            setError(err.message);
        }
    }

    // --------------------------------------------------
    // ESTADO DE CARGA
    // --------------------------------------------------

    if (cargando) {
        return <Cargando mensaje="Cargando productos..." />;
    }

    // --------------------------------------------------
    // RENDERIZADO
    // --------------------------------------------------

    return (
        <div>
            {/* CABECERA */}
            <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-ink/55">
                    {productos.length} productos en el catálogo
                </p>

                <button
                    onClick={abrirNuevo}
                    className="btn-primary"
                    disabled={guardando}
                >
                    + Nuevo producto
                </button>
            </div>

            {/* ERRORES */}
            {error && (
                <div className="mb-4">
                    <ErrorAviso mensaje={error} />
                </div>
            )}

            {/* FORMULARIO DE ALTA / EDICIÓN */}
            {editando && (
                <form
                    onSubmit={guardar}
                    className="card mb-6 grid gap-3 p-5 md:grid-cols-2"
                >
                    <h3 className="font-display text-lg font-semibold text-ink md:col-span-2">
                        {editando === "nuevo"
                            ? "Nuevo producto"
                            : `Editar: ${editando.nombre}`}
                    </h3>

                    {/* NOMBRE */}
                    <div>
                        <label className="field-label">
                            Nombre
                        </label>

                        <input
                            required
                            className="input-field"
                            value={form.nombre}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    nombre: e.target.value,
                                })
                            }
                        />
                    </div>

                    {/* CATEGORÍA */}
                    <div>
                        <label className="field-label">
                            Categoría
                        </label>

                        <select
                            required
                            className="input-field"
                            value={form.categoria_id}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    categoria_id: e.target.value,
                                })
                            }
                        >
                            <option value="">
                                Seleccionar...
                            </option>

                            {categorias.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* PRECIO */}
                    <div>
                        <label className="field-label">
                            Precio
                        </label>

                        <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            className="input-field"
                            value={form.precio}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    precio: e.target.value,
                                })
                            }
                        />
                    </div>

                    {/* STOCK */}
                    <div>
                        <label className="field-label">
                            Stock
                        </label>

                        <input
                            required
                            type="number"
                            min="0"
                            step="1"
                            className="input-field"
                            value={form.stock}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    stock: e.target.value,
                                })
                            }
                        />
                    </div>

                    {/* GALERÍA DE IMÁGENES */}
                    <div className="md:col-span-2 border-t border-line pt-3 mt-1">
                        <label className="field-label font-semibold text-forest-800">
                            Galería de imágenes del producto
                        </label>

                        <p className="mb-3 text-xs text-ink/55">
                            Podés seleccionar varias imágenes. Elegí una
                            como portada principal.
                        </p>

                        {/* INPUT DE ARCHIVOS */}
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleFileChange}
                            className="input-field mb-4"
                        />

                        {/* GALERÍA */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">

                            {/* IMÁGENES EXISTENTES */}
                            {imagenesExistentes.map((img, idx) => (
                                <div
                                    key={`ex-${idx}`}
                                    className="relative aspect-square overflow-hidden rounded-lg border border-line bg-gray-50 p-1.5 shadow-sm"
                                >
                                    <img
                                        src={`${API_URL}${img.url}`}
                                        alt="Imagen del producto"
                                        className="absolute inset-0 z-0 h-full w-full object-cover"
                                    />

                                    {/* INDICADOR DE PORTADA */}
                                    {img.isMain && (
                                        <span className="absolute bottom-2 left-2 z-10 rounded bg-forest-700 px-2 py-1 text-xs text-white">
                                            Principal
                                        </span>
                                    )}

                                    {/* SELECCIONAR PRINCIPAL */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleMarcarPrincipal(
                                                "existente",
                                                idx
                                            )
                                        }
                                        className="absolute bottom-2 right-2 z-10 rounded bg-white px-2 py-1 text-xs shadow"
                                    >
                                        {img.isMain ? "★" : "☆"}
                                    </button>

                                    {/* ELIMINAR */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleEliminarExistente(img.url)
                                        }
                                        className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white hover:bg-red-700"
                                        aria-label="Eliminar imagen"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}

                            {/* IMÁGENES NUEVAS */}
                            {imagenesNuevas.map((img, idx) => (
                                <div
                                    key={`new-${idx}`}
                                    className="relative aspect-square overflow-hidden rounded-lg border border-forest-300 bg-forest-50 p-1.5 shadow-sm"
                                >
                                    <img
                                        src={img.previewUrl}
                                        alt="Vista previa"
                                        className="absolute inset-0 z-0 h-full w-full object-cover"
                                    />

                                    {/* INDICADOR DE PORTADA */}
                                    {img.isMain && (
                                        <span className="absolute bottom-2 left-2 z-10 rounded bg-forest-700 px-2 py-1 text-xs text-white">
                                            Principal
                                        </span>
                                    )}

                                    {/* SELECCIONAR PRINCIPAL */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleMarcarPrincipal(
                                                "nueva",
                                                idx
                                            )
                                        }
                                        className="absolute bottom-2 right-2 z-10 rounded bg-white px-2 py-1 text-xs shadow"
                                    >
                                        {img.isMain ? "★" : "☆"}
                                    </button>

                                    {/* ELIMINAR */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleQuitarNueva(idx)
                                        }
                                        className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-xs font-bold text-white hover:bg-ink"
                                        aria-label="Quitar imagen"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* DESCRIPCIÓN */}
                    <div className="md:col-span-2">
                        <label className="field-label">
                            Descripción
                        </label>

                        <textarea
                            rows={3}
                            className="input-field"
                            value={form.descripcion}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    descripcion: e.target.value,
                                })
                            }
                        />
                    </div>

                    {/* ACCIONES */}
                    <div className="flex flex-wrap gap-3 md:col-span-2">
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={guardando}
                        >
                            {guardando
                                ? "Guardando..."
                                : "Guardar"}
                        </button>

                        <button
                            type="button"
                            onClick={cancelarEdicion}
                            className="btn-ghost"
                            disabled={guardando}
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            )}

            {/* LISTADO DE PRODUCTOS */}
            {productos.length === 0 ? (
                <Vacio mensaje="No hay productos registrados." />
            ) : (
                <div className="card overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-line text-ink/55">
                                <th className="p-3">Producto</th>
                                <th className="p-3">Categoría</th>
                                <th className="p-3">Precio</th>
                                <th className="p-3">Stock</th>
                                <th className="p-3">Estado</th>
                                <th className="p-3">Acciones</th>
                            </tr>
                        </thead>

                        <tbody>
                            {productos.map((p) => (
                                <tr
                                    key={p.id}
                                    className="border-b border-line last:border-0"
                                >
                                    <td className="p-3 font-medium">
                                        {p.nombre}
                                    </td>

                                    <td className="p-3">
                                        {p.categoria?.nombre || "—"}
                                    </td>

                                    <td className="p-3">
                                        {formatearPrecio(p.precio)}
                                    </td>

                                    <td className="p-3">
                                        {p.stock} u.
                                    </td>

                                    <td className="p-3">
                                        {p.activo ? (
                                            <span className="text-green-700">
                                                Activo
                                            </span>
                                        ) : (
                                            <span className="text-red-600">
                                                Inactivo
                                            </span>
                                        )}
                                    </td>

                                    <td className="p-3">
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    abrirEditar(p)
                                                }
                                                className="btn-ghost"
                                            >
                                                Editar
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleActivo(p)
                                                }
                                                className="btn-ghost"
                                            >
                                                {p.activo
                                                    ? "Desactivar"
                                                    : "Activar"}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
