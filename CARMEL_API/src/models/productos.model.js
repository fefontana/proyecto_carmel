import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Producto = sequelize.define(
  "Producto",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    categoria_id: { type: DataTypes.INTEGER, allowNull: false },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    precio: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    imagen_url: { type: DataTypes.STRING(255), allowNull: true },
    
    // NUEVO CAMPO POR MULTER: Guarda la colección de imágenes del producto con sus metadatos (url, isMain)
    images: { 
      type: DataTypes.JSON, 
      allowNull: true, 
      defaultValue: [] 
    },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "productos" },
);

export default Producto;
