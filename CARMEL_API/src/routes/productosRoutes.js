import { Router } from "express";
const router = Router();
import * as c from "../controllers/productosController.js";
import { auth, requireRole } from "../middleware/auth.js";

// Importacion del middleware para subida múltiple de imagenes de productos
import { uploadProductImages } from "../utils/upload.js";

router.get("/", c.listar);
router.get(
  "/admin/todos",
  auth,
  requireRole("administrador", "admin", "distribuidor"),
  c.listarAdmin,
);
router.get("/:id", c.obtener);
// Inyecto codigo para modificar la CREACIÓN de producto con multer
router.post(
  "/",
  auth,
  requireRole("administrador", "admin", "distribuidor"),
  uploadProductImages, // <--- Agrego intercept de cambios de imágenes
  c.crear,
);
// Inyectado en la ACTUALIZACIÓN de producto (para editar imágenes)
router.put(
  "/:id",
  auth,
  requireRole("administrador", "admin", "distribuidor"),
  uploadProductImages, // <--- Aquí intercepta los cambios de imágenes
  c.actualizar,
);
router.delete(
  "/media/delete",
  auth,
  requireRole("administrador", "admin", "distribuidor"),
  c.eliminarImagenIndividual
);
router.delete(
  "/:id",
  auth,
  requireRole("administrador", "admin", "distribuidor"),
  c.eliminar,
);

export default router;
