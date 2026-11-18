import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer"; // 1. Importamos Multer
import routes from "./routes/index.js";

const app = express();

// Configuración ultra básica de Multer (guarda temporalmente en esta carpeta)
//const uploadTest = multer({ dest: "public/uploads/test/" });
app.use(express.static("public"));
// ...entonces dejamos asi después de app.use(express.json());

//app.use("/uploads", express.static(path.join(process.cwd(), "public/uploads")));
// Al usar path.join(process.cwd(), "public/uploads") te asegurás de que funcione sin importar desde qué subcarpeta se ejecute Node).

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
  }),
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "API CARMEL - Productos de mi tierra",
  });
 });

// 2. RUTA HELLO WORLD (Colocada antes de tus rutas oficiales para pruebas aisladas)
/*
app.post("/api/test-upload", uploadTest.single("archivoDePrueba"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, message: "No se recibió ningún archivo" });
  }

  console.log("¡Multer funcionando! Datos del archivo:", req.file);

  res.json({
    ok: true,
    message: "¡Hello World de Multer Exitoso!",
    fileData: {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      sizeInBytes: req.file.size,
      savedAs: req.file.filename
    }
  });
});
*/
app.use("/api", routes);

app.use((req, res) => {
  res.status(404).json({ ok: false, message: "Ruta no encontrada" });
});

// Tu manejador de errores atrapará automáticamente si Multer tira algún error (ej. tamaño excedido)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    ok: false,
    message: err.message || "Error interno del servidor",
  });
});

export default app;
