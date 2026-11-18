
import { Op } from "sequelize";
import { Producto, Categoria } from "../models/index.js";
import fs from "fs";
import path from "path";

const API_UPLOADS = "/uploads/products";
const DIRECTORIO_UPLOADS = path.resolve(
    process.cwd(),
    "public",
    "uploads",
    "products"
);

const includeCategoria = {
    model: Categoria,
    as: "categoria",
    attributes: ["id", "nombre", "descripcion"],
};

// --------------------------------------------------
// UTILIDADES MULTIMEDIA
// --------------------------------------------------

// Elimina archivos que Multer ya guardó cuando falla una operación.
function limpiarArchivos(files = []) {
    for (const file of files) {
        const filePath = path.join(
            DIRECTORIO_UPLOADS,
            path.basename(file.filename)
        );

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

// Convierte y valida el JSON enviado desde FormData.
function obtenerControlPortadas(valor) {
    if (!valor) return null;

    try {
        const control =
            typeof valor === "string" ? JSON.parse(valor) : valor;

        if (
            !control ||
            !Array.isArray(control.existentes) ||
            !Array.isArray(control.indicesNuevasPrincipales)
        ) {
            throw new Error("Formato de controlPortadas inválido.");
        }

        return control;
    } catch {
        throw new Error("No se pudo interpretar controlPortadas.");
    }
}

// Construye la URL pública de una imagen nueva.
function urlImagen(file) {
    return `${API_UPLOADS}/${file.filename}`;
}

// Normaliza las imágenes y garantiza una única portada.
// Si no se seleccionó ninguna, conserva la portada anterior
// o elige la primera imagen disponible.
function normalizarImagenes(imagenes, portadaPreferida = null) {
    if (imagenes.length === 0) return [];

    let indicePrincipal = imagenes.findIndex(
        (img) => img.url === portadaPreferida
    );

    if (indicePrincipal === -1) {
        indicePrincipal = imagenes.findIndex((img) => img.isMain);
    }

    if (indicePrincipal === -1) {
        indicePrincipal = 0;
    }

    return imagenes.map((img, idx) => ({
        ...img,
        isMain: idx === indicePrincipal,
    }));
}

// --------------------------------------------------
// MÉTODOS DE LECTURA
// --------------------------------------------------

async function listar(req, res, next) {
    try {
        const { categoria, search, activo } = req.query;
        const where = {};

        if (activo !== "false") {
            where.activo = true;
        }

        if (categoria) {
            where.categoria_id = Number(categoria);
        }

        if (search) {
            where.nombre = {
                [Op.like]: `%${search}%`,
            };
        }

        const productos = await Producto.findAll({
            where,
            include: [includeCategoria],
            order: [["id", "DESC"]],
        });

        res.json({
            ok: true,
            productos,
        });
    } catch (e) {
        next(e);
    }
}

async function obtener(req, res, next) {
    try {
        const producto = await Producto.findByPk(req.params.id, {
            include: [includeCategoria],
        });

        if (!producto || !producto.activo) {
            return res.status(404).json({
                ok: false,
                message: "Producto no encontrado",
            });
        }

        res.json({
            ok: true,
            producto,
        });
    } catch (e) {
        next(e);
    }
}

async function listarAdmin(req, res, next) {
    try {
        const productos = await Producto.findAll({
            include: [includeCategoria],
            order: [["id", "DESC"]],
        });

        res.json({
            ok: true,
            productos,
        });
    } catch (e) {
        next(e);
    }
}

// --------------------------------------------------
// CREAR PRODUCTO
// --------------------------------------------------

async function crear(req, res, next) {
    try {
        const {
            nombre,
            categoria_id,
            precio,
            stock,
            descripcion,
        } = req.body;

        if (
            !nombre ||
            !categoria_id ||
            precio === undefined ||
            precio === "" ||
            stock === undefined ||
            stock === ""
        ) {
            limpiarArchivos(req.files);

            return res.status(400).json({
                ok: false,
                message: "Nombre, categoría, precio y stock son obligatorios.",
            });
        }

        const control = obtenerControlPortadas(
            req.body.controlPortadas
        );

        const archivos = req.files || [];

        // Construcción de las imágenes nuevas.
        let imagenes = archivos.map((file, index) => ({
            url: urlImagen(file),
            isMain: control
                ? control.indicesNuevasPrincipales[index] === true
                : index === 0,
        }));

        // Selección de la portada.
        imagenes = normalizarImagenes(
            imagenes,
            null
        );

        const nuevoProducto = await Producto.create({
            nombre,
            descripcion,
            categoria_id: Number(categoria_id),
            precio: Number(precio),
            stock: Number(stock),
            images: imagenes,
        });

        res.status(201).json({
            ok: true,
            producto: nuevoProducto,
        });
    } catch (e) {
        limpiarArchivos(req.files);

        next(e);
    }
}

// --------------------------------------------------
// ACTUALIZAR PRODUCTO
// --------------------------------------------------

async function actualizar(req, res, next) {
    try {
        const producto = await Producto.findByPk(req.params.id);

        if (!producto) {
            limpiarArchivos(req.files);

            return res.status(404).json({
                ok: false,
                message: "Producto no encontrado",
            });
        }

        const {
            nombre,
            categoria_id,
            precio,
            stock,
            descripcion,
        } = req.body;

        const control = obtenerControlPortadas(
            req.body.controlPortadas
        );

        const archivos = req.files || [];

        const imagenesActuales = (producto.images || []).map(
            (img) => ({ ...img })
        );

        // Conservamos las imágenes que ya están en el servidor.
        let imagenes = imagenesActuales;

        // Aplicamos la selección de portada enviada desde React.
        if (control) {
            const seleccionadas = new Map(
                control.existentes.map((img) => [
                    img.url,
                    img.isMain === true,
                ])
            );

            imagenes = imagenes.map((img) => ({
                ...img,
                isMain: seleccionadas.has(img.url)
                    ? seleccionadas.get(img.url)
                    : img.isMain,
            }));
        }

        // Incorporamos las imágenes nuevas.
        const imagenesNuevas = archivos.map((file, index) => ({
            url: urlImagen(file),
            isMain: control
                ? control.indicesNuevasPrincipales[index] === true
                : imagenes.length === 0 && index === 0,
        }));

        imagenes = [...imagenes, ...imagenesNuevas];

        // Determinamos la portada seleccionada.
        const portadaExistente = imagenes.find(
            (img) => img.isMain === true
        );

        imagenes = normalizarImagenes(
            imagenes,
            portadaExistente?.url || null
        );

        const datosActualizados = {
            ...(nombre !== undefined && { nombre }),
            ...(descripcion !== undefined && { descripcion }),
            ...(categoria_id !== undefined && {
                categoria_id: Number(categoria_id),
            }),
            ...(precio !== undefined && {
                precio: Number(precio),
            }),
            ...(stock !== undefined && {
                stock: Number(stock),
            }),
            images: imagenes,
        };

        await producto.update(datosActualizados);

        res.json({
            ok: true,
            producto,
        });
    } catch (e) {
        limpiarArchivos(req.files);

        next(e);
    }
}

// --------------------------------------------------
// ELIMINAR IMAGEN INDIVIDUAL
// --------------------------------------------------

async function eliminarImagenIndividual(req, res, next) {
    try {
        const { productoId, imageUrl } = req.body;

        if (!productoId || !imageUrl) {
            return res.status(400).json({
                ok: false,
                message: "productoId e imageUrl son requeridos.",
            });
        }

        const producto = await Producto.findByPk(productoId);

        if (!producto) {
            return res.status(404).json({
                ok: false,
                message: "Producto no encontrado.",
            });
        }

        /*********************************************
        const imagenesActuales = producto.images || [];

        // Verificamos que la imagen pertenezca al producto.
        const imagen = imagenesActuales.find(
            (img) => img.url === imageUrl
        );

        if (!imagen) {
            return res.status(404).json({
                ok: false,
                message: "La imagen no pertenece a este producto.",
            });
        }

        // Validamos que la URL pertenezca a nuestro directorio.
        const prefijo = `${API_UPLOADS}/`;

        if (!imageUrl.startsWith(prefijo)) {
            return res.status(400).json({
                ok: false,
                message: "Ruta de imagen inválida.",
            });
        }

        const nombreArchivo = imageUrl.slice(prefijo.length);

        // No permitimos rutas ni subdirectorios.
        if (
            !nombreArchivo ||
            nombreArchivo !== path.basename(nombreArchivo)
        ) {
            return res.status(400).json({
                ok: false,
                message: "Nombre de archivo inválido.",
            });
        }

        const filePath = path.resolve(
            DIRECTORIO_UPLOADS,
            nombreArchivo
        );

        // Verificación adicional para evitar path traversal.
        if (!filePath.startsWith(`${DIRECTORIO_UPLOADS}${path.sep}`)) {
            return res.status(400).json({
                ok: false,
                message: "Ruta de archivo no permitida.",
            });
        }

        // Quitamos la imagen del array.
        let nuevasImagenes = imagenesActuales
            .filter((img) => img.url !== imageUrl)
            .map((img) => ({ ...img }));

        // Si se eliminó la portada, elegimos otra.
        if (imagen.isMain && nuevasImagenes.length > 0) {
            nuevasImagenes[0].isMain = true;
        }

        // Garantizamos una sola imagen principal.
        nuevasImagenes = normalizarImagenes(
            nuevasImagenes,
            nuevasImagenes.find((img) => img.isMain)?.url || null
        );
        

        // Primero actualizamos la base de datos.
        await producto.update({
            images: nuevasImagenes,
        });

        // Después eliminamos el archivo físico.
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        */


        // Borrado físico seguro usando basename
        const filePath = path.join(
            DIRECTORIO_UPLOADS,
            path.basename(imageUrl)
        );

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Filtrado lógico y reasignación automática de portada si es necesario
        const actuales = Array.isArray(producto.images)
            ? producto.images
            : [];

        const filtradas = actuales.filter((img) => img.url !== imageUrl);
        const imagenesNormalizadas = normalizarImagenes(filtradas, null);

        await producto.update({ images: imagenesNormalizadas });


        res.json({
            ok: true,
            message: "Imagen eliminada correctamente.",
            //imagenes: nuevasImagenes,
            imagenes: imagenesNormalizadas,
        });
    } catch (e) {
        next(e);
    }
}

// --------------------------------------------------
// DESACTIVAR PRODUCTO
// --------------------------------------------------

async function eliminar(req, res, next) {
    try {
        const producto = await Producto.findByPk(req.params.id);

        if (!producto) {
            return res.status(404).json({
                ok: false,
                message: "Producto no encontrado",
            });
        }

        await producto.update({
            activo: false,
        });

        res.json({
            ok: true,
            message: "Producto desactivado",
        });
    } catch (e) {
        next(e);
    }
}

export {
    listar,
    obtener,
    listarAdmin,
    crear,
    actualizar,
    eliminarImagenIndividual,
    eliminar,
};
