# API CARMEL — Contrato Backend ↔ Frontend

Contrato de la API REST de CARMEL e-commerce. Es la **fuente única de verdad** para que el
desarrollo de backend y frontend avancen **en paralelo**: el frontend programa contra estos
ejemplos (mockeando con axios lo que aún no exista) mientras el backend implementa.

---

## 1. Convenciones generales

| Aspecto       | Valor                                                                        |
|---------------|------------------------------------------------------------------------------|
| Base URL      | `http://localhost:3000/api` (configurable con `VITE_API_URL` en el frontend) |
| Content-Type  | `application/json`                                                           |
| Autenticación | `Authorization: Bearer <JWT>` en las rutas que lo indican                    |

**Envelope de respuesta** (todas las rutas lo respetan):

```json
{ "ok": true, "message": "...", "...": "datos" }
```

**Códigos de error estándar:**

| Código | Cuándo                                               |
|--------|------------------------------------------------------|
| `400`  | Datos inválidos o faltantes en el request            |
| `401`  | Sin token, token inválido o credenciales incorrectas |
| `403`  | Autenticado pero sin el rol requerido                |
| `404`  | Recurso inexistente                                  |
| `409`  | Conflicto (ej. email ya registrado)                  |
| `500`  | Error interno del servidor                           |

Formato de error:

```json
{ "ok": false, "message": "Descripción legible del error" }
```

**Roles**: `cliente`, `administrador` (las rutas de admin aceptan además `admin` y `distribuidor`).

---

## 2. Auth — Endpoints existentes

### 2.1 `POST /auth/register` — Registro

Público. 📧 Dispara **mail de bienvenida** (evento 1, sección 6).

**Request**

```json
{
  "nombre": "Ana",
  "apellido": "García",
  "email": "ana@mail.com",
  "telefono": "2664551234",
  "password": "secreto123"
}
```

| Campo                                     | Requerido | Validación          |
|-------------------------------------------|-----------|---------------------|
| `nombre`, `apellido`, `email`, `password` | sí        | presentes           |
| `password`                                | sí        | mínimo 6 caracteres |
| `telefono`                                | no        | —                   |

**Response `201`**

```json
{
  "ok": true,
  "message": "Usuario registrado correctamente",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id": 3,
    "nombre": "Ana",
    "apellido": "García",
    "email": "ana@mail.com",
    "telefono": "2664551234",
    "rol": "cliente"
  }
}
```

**Errores**: `400` campos faltantes o contraseña corta · `409` email ya registrado.

### 2.2 `POST /auth/login` — Login

Público.

**Request**

```json
{ "email": "ana@mail.com", "password": "secreto123" }
```

**Response `200`**

```json
{
  "ok": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id": 3,
    "nombre": "Ana",
    "apellido": "García",
    "email": "ana@mail.com",
    "telefono": "2664551234",
    "rol": "cliente"
  }
}
```

**Errores**: `400` campos faltantes · `401` credenciales incorrectas (mismo mensaje si el usuario no existe o está inactivo).

### 2.3 `GET /auth/me` — Usuario autenticado

Requiere token.

**Response `200`**

```json
{
  "ok": true,
  "usuario": {
    "id": 3,
    "nombre": "Ana",
    "apellido": "García",
    "email": "ana@mail.com",
    "telefono": "2664551234",
    "activo": true,
    "rol": "cliente"
  }
}
```

**Errores**: `401` token requerido / inválido / vencido.

---

## 3. Auth — Endpoints NUEVOS (recupero de contraseña)

Flujo con **código numérico de 6 dígitos** enviado por mail. Los implementa el dev backend
(sección 8) y los consume el dev frontend (sección 5).

### 3.1 `POST /auth/forgot-password` — Solicitar código

Público. 📧 Dispara **mail con el código** (evento 2, sección 6).

**Request**

```json
{ "email": "ana@mail.com" }
```

**Response `200` (SIEMPRE, exista o no el email)**

```json
{
  "ok": true,
  "message": "Si el email está registrado, te enviamos un código para restablecer tu contraseña."
}
```

> ⚠️ La respuesta es genérica a propósito: **no se debe revelar si el email existe**
> (evita enumeración de usuarios). El frontend muestra el mensaje y navega a la
> pantalla de reset sin esperar más información.

**Comportamiento interno (normativo para backend):**

- Genera un código de **6 dígitos**, lo guarda **hasheado** con expiración de **15 minutos**.
- Un nuevo pedido de código **invalida los anteriores** del usuario.
- Máximo **5 intentos** de uso por código (sección 3.2); agotados, el código queda inutilizable.
- Si el email no existe, responde igual y no envía nada.

### 3.2 `POST /auth/reset-password` — Restablecer con código

Público.

**Request**

```json
{
  "email": "ana@mail.com",
  "codigo": "483920",
  "password": "nuevaClave123"
}
```

| Campo | Requerido | Validación |
|---|---|---|
| `email` | sí | — |
| `codigo` | sí | 6 dígitos, válido, no expirado, con intentos disponibles |
| `password` | sí | mínimo 6 caracteres |

**Response `200`**

```json
{ "ok": true, "message": "Contraseña actualizada correctamente" }
```

**Errores**: `400` campos faltantes, contraseña corta, o código **inválido / expirado / sin
intentos** (mismo mensaje genérico: `"Código inválido o expirado. Solicitá uno nuevo."`).

**Comportamiento interno (normativo para backend):**

- El código es de **un solo uso**: al restablecer, se invalida.
- Actualiza `password_hash` del usuario.

---

## 4. Órdenes — Endpoints existentes

Todas requieren token.

### 4.1 `POST /ordenes` — Confirmar pedido

Convierte el carrito del usuario en una orden, descuenta stock y vacía el carrito
(transaccional). 📧 Dispara **doble notificación** (evento 3, sección 6).

**Request**

```json
{ "metodo_pago": "efectivo" }
```

Valores válidos de `metodo_pago`: `efectivo`, `débito`, `debito`, `crédito`, `credito`,
`Mercado Pago`, `mercado_pago`.

**Response `201`**

```json
{
  "ok": true,
  "message": "Compra confirmada",
  "orden": {
    "id": 12,
    "codigo": "T-3F9A1B2C4D",
    "estado": "confirmado",
    "total": "8500.00",
    "metodo_pago": "efectivo",
    "created_at": "2026-10-28T14:30:00.000Z"
  }
}
```

**Errores**: `400` método de pago inválido · `400` usuario sin carrito · `400` carrito vacío ·
`400` stock insuficiente (`"Stock insuficiente para <producto>"`).

### 4.2 `GET /ordenes` — Mis órdenes

**Response `200`**

```json
{
  "ok": true,
  "ordenes": [
    {
      "id": 12,
      "usuario_id": 3,
      "codigo": "T-3F9A1B2C4D",
      "estado": "confirmado",
      "total": "8500.00",
      "metodo_pago": "efectivo",
      "created_at": "2026-10-28T14:30:00.000Z",
      "items": [
        {
          "id": 30,
          "orden_id": 12,
          "producto_id": 5,
          "cantidad": 2,
          "precio_unitario": "4250.00",
          "subtotal": "8500.00",
          "producto": { "id": 5, "nombre": "Miel milleflores 1kg", "imagen_url": "..." }
        }
      ]
    }
  ]
}
```

Ordenadas por fecha descendente.

### 4.3 `GET /ordenes/{id}` — Detalle de mi orden

**Response `200`**: `{ "ok": true, "orden": { ...misma forma que un elemento de 4.2, con producto completo... } }`

**Errores**: `404` si no existe o no pertenece al usuario autenticado.

### 4.4 `GET /ordenes/admin/todas` — Listar todas (ADMIN)

Requiere rol `administrador` (o `admin`/`distribuidor`). Query params opcionales:
`?usuario_id=3&estado=pendiente`.

**Response `200`**: `{ "ok": true, "ordenes": [...] }` — cada orden incluye además:

```json
"usuario": { "id": 3, "nombre": "Ana", "apellido": "García", "email": "ana@mail.com", "telefono": "2664551234" }
```

**Errores**: `403` sin permisos.

### 4.5 `PUT /ordenes/admin/{id}/estado` — Cambiar estado (ADMIN)

Requiere rol `administrador` (o `admin`/`distribuidor`). 📧 Dispara **mail de novedad al
cliente** (evento 4, sección 6).

**Request**

```json
{ "estado": "entregado" }
```

Valores válidos de `estado`: `pendiente`, `confirmado`, `entregado`.

**Response `200`**: `{ "ok": true, "orden": { ...orden actualizada... } }`

**Errores**: `400` estado inválido · `404` orden inexistente · `403` sin permisos.

---

## 5. Flujo de recupero de contraseña — vista Frontend

Pantallas nuevas (rutas **públicas**, junto a `Login` y `Register` en `RutasProtegidas`):

```
Login.jsx ──"¿Olvidaste tu contraseña?"──▶ /recuperar-password ──OK──▶ /reset-password ──OK──▶ /login
                                             │                             │
                                   POST /auth/forgot-password     POST /auth/reset-password
                                     { email }                  { email, codigo, password }
```

**Pantalla 1 — `/recuperar-password`** (`RecuperarPassword.jsx`)
- Input `email` + botón "Enviar código".
- Llama a `forgot-password`; muestre el mensaje genérico de la respuesta (sin indicar si el email existe o no) y navega a `/reset-password` llevando el email (ej. en `state` de react-router).

**Pantalla 2 — `/reset-password`** (`ResetPassword.jsx`)
- Inputs: `email` (prellenado), `codigo` (6 dígitos), `password` (nueva, mín. 6) + botón "Restablecer".
- En `400` muestra `error.message` ("Código inválido o expirado. Solicitá uno nuevo.") y ofrece reenviar código (vuelve a pantalla 1).
- En `200` redirige a `/login` con mensaje de éxito.

**Integración con `client.js`** — agregar al objeto `api`:

```js
// Auth — recupero de contraseña
forgotPassword: (payload) => http.post("/auth/forgot-password", payload),
resetPassword: (payload) => http.post("/auth/reset-password", payload),
```

Mientras el backend no esté listo, el frontend puede mockear ambas funciones
(misma firma, devuelven el envelope de las secciones 3.1/3.2).

**Estado visual de órdenes** — el enum canónico es `pendiente | confirmado | entregado`
(consumido por `Estado.jsx` / `AdminPedidos.jsx`).

---

## 6. Eventos de notificación por mail (Módulo B)

Comportamiento **100% backend, invisible para el frontend**: los endpoints responden igual
con o sin SMTP activo (los mails son *fire-and-forget*, sección 8.3).

| # | Evento                 | Endpoint disparador              | Destinatario            | Contenido                                                                                   |
|---|------------------------|----------------------------------|-------------------------|---------------------------------------------------------------------------------------------|
| 1 | Registro exitoso       | `POST /auth/register`            | Cliente                 | Bienvenida, confirmación de registro                                                        |
| 2 | Recupero de contraseña | `POST /auth/forgot-password`     | Cliente                 | Código de 6 dígitos (vence en 15 min)                                                       |
| 3 | Pedido confirmado      | `POST /ordenes`                  | Cliente + Administrador | Al cliente: comprobante (código, ítems, total). Al admin: aviso de nuevo pedido a gestionar |
| 4 | Cambio de estado       | `PUT /ordenes/admin/{id}/estado` | Cliente                 | "Tu pedido está en preparación / fue enviado / fue entregado" (según estado)                |

---

## 7. Reparto de trabajo en paralelo

| Módulo B           | Dev Backend                                                                        | Dev Frontend                                                                                               |
|--------------------|------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| Mails 1, 3, 4      | Servicio Nodemailer + hooks en `register`, `crear orden`, `actualizarEstado`       | — (nada; es transparente)                                                                                  |
| Mail 2 + endpoints | `POST /auth/forgot-password`, `POST /auth/reset-password`, tabla `password_resets` | Pantallas `/recuperar-password` y `/reset-password`, link en `Login`, métodos en `client.js`, mock inicial |
| Contrato           | Cualquier desvío de este doc se negocia **acá primero**, no por chat               | Ídem                                                                                                       |

Punto de sincronización sugerido: una demo integrando reset-password real cuando ambos lados
estén listos (los mocks evitan bloqueo hasta entonces).

---

## 8. Apéndice técnico (Backend)

### 8.1 Tabla nueva — agregar a `database.sql`

```sql
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  codigo_hash VARCHAR(255) NOT NULL,
  expira_at DATETIME NOT NULL,
  intentos INT NOT NULL DEFAULT 0,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_resets_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_password_resets_usuario (usuario_id)
) ENGINE=InnoDB;
```

### 8.2 Variables de entorno — agregar a `.env.example`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=usuario@carmel.com
SMTP_PASS=clave_de_aplicacion
MAIL_FROM="CARMEL <no-reply@carmel.com>"
APP_URL=http://localhost:5173
```

### 8.3 Regla de envío no bloqueante

El hook de mail se dispara **después** de confirmar la operación principal (post-commit /
post-respuesta). Un fallo de SMTP **nunca** altera la respuesta HTTP: solo se loguea.
Todo endpoint de este contrato responde idéntico con o sin SMTP configurado.
