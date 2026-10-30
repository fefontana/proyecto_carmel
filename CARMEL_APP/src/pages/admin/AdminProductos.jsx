import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { formatearPrecio } from "../../utils/format";
import { Cargando, ErrorAviso, Vacio } from "../../components/Estado";

const formVacio = {
    nombre: "",
    categoria_id: "",
    precio: "",
    stock: "",
    descripcion: "",
    imagen_url: "",
};

export default function AdminProductos() {
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [editando, setEditando] = useState(null); // null | "nuevo" | producto
    const [form, setForm] = useState(formVacio);
    const [guardando, setGuardando] = useState(false);

    async function cargar() {
        setCargando(true);
        setError("");
        try {
            const [prods, cats] = await Promise.all([
                api.listarProductosAdmin(),
                api.listarCategorias(),
            ]);
            setProductos(prods.productos);
            setCategorias(cats.categorias);
        } catch (err) {
            setError(err.message);
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        cargar();
    }, []);

    function abrirNuevo() {
        setForm(formVacio);
        setEditando("nuevo");
    }

    function abrirEditar(producto) {
        setForm({
            nombre: producto.nombre,
            categoria_id: producto.categoria_id,
            precio: producto.precio,
            stock: producto.stock,
            descripcion: producto.descripcion || "",
            imagen_url: producto.imagen_url || "",
        });
        setEditando(producto);
    }

    async function guardar(e) {
        e.preventDefault();
        setGuardando(true);
        setError("");
        const payload = {
            ...form,
            categoria_id: Number(form.categoria_id),
            precio: Number(form.precio),
            stock: Number(form.stock),
        };
        try {
            if (editando === "nuevo") {
                await api.crearProducto(payload);
            } else {
                await api.actualizarProducto(editando.id, payload);
            }
            setEditando(null);
            await cargar();
        } catch (err) {
            setError(err.message);
        } finally {
            setGuardando(false);
        }
    }

    async function toggleActivo(producto) {
        setError("");
        try {
            if (producto.activo) {
                await api.eliminarProducto(producto.id);
            } else {
                await api.actualizarProducto(producto.id, { activo: true });
            }
            await cargar();
        } catch (err) {
            setError(err.message);
        }
    }

    if (cargando) return <Cargando mensaje="Cargando productos..." />;

    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-ink/55">
                    {productos.length} productos en el catálogo
                </p>
                <button onClick={abrirNuevo} className="btn-primary">
                    + Nuevo producto
                </button>
            </div>

            {error && (
                <div className="mb-4">
                    <ErrorAviso mensaje={error} />
                </div>
            )}

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

                    <div>
                        <label className="field-label">Nombre</label>
                        <input
                            required
                            className="input-field"
                            value={form.nombre}
                            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="field-label">Categoría</label>
                        <select
                            required
                            className="input-field"
                            value={form.categoria_id}
                            onChange={(e) =>
                                setForm({ ...form, categoria_id: e.target.value })
                            }
                        >
                            <option value="">Seleccionar...</option>
                            {categorias.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="field-label">Precio</label>
                        <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            className="input-field"
                            value={form.precio}
                            onChange={(e) => setForm({ ...form, precio: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="field-label">Stock</label>
                        <input
                            required
                            type="number"
                            min="0"
                            className="input-field"
                            value={form.stock}
                            onChange={(e) => setForm({ ...form, stock: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="field-label">URL de imagen (opcional)</label>
                        <input
                            className="input-field"
                            value={form.imagen_url}
                            onChange={(e) => setForm({ ...form, imagen_url: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="field-label">Descripción</label>
                        <textarea
                            rows={3}
                            className="input-field"
                            value={form.descripcion}
                            onChange={(e) =>
                                setForm({ ...form, descripcion: e.target.value })
                            }
                        />
                    </div>

                    <div className="flex gap-2 md:col-span-2">
                        <button type="submit" disabled={guardando} className="btn-primary">
                            {guardando ? "Guardando..." : "Guardar"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditando(null)}
                            className="btn-ghost"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            )}

            {productos.length === 0 ? (
                <Vacio
                    titulo="Todavía no hay productos"
                    descripcion="Creá el primero con el botón de arriba."
                />
            ) : (
                <div className="overflow-hidden rounded-xl2 border border-line">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-forest-50 text-xs uppercase tracking-wide text-ink/50">
                            <tr>
                                <th className="px-4 py-3">Producto</th>
                                <th className="hidden px-4 py-3 md:table-cell">Categoría</th>
                                <th className="px-4 py-3">Precio</th>
                                <th className="px-4 py-3">Stock</th>
                                <th className="px-4 py-3">Estado</th>
                                <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {productos.map((p) => (
                                <tr key={p.id} className={!p.activo ? "opacity-50" : ""}>
                                    <td className="px-4 py-3 font-medium text-ink">{p.nombre}</td>
                                    <td className="hidden px-4 py-3 text-ink/60 md:table-cell">
                                        {p.categoria?.nombre}
                                    </td>
                                    <td className="px-4 py-3">{formatearPrecio(p.precio)}</td>
                                    <td className="px-4 py-3">{p.stock}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.activo ? "bg-forest-100 text-forest-800" : "bg-line text-ink/60"}`}
                                        >
                                            {p.activo ? "Activo" : "Inactivo"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => abrirEditar(p)}
                                                className="btn-ghost !px-3 !py-1.5"
                                            >
                                                ✎
                                            </button>
                                            <button
                                                onClick={() => toggleActivo(p)}
                                                className="btn-ghost !px-3 !py-1.5"
                                            >
                                                {p.activo ? "✅" : "🚫"}
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
