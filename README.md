# SNIC'ELECTRIC — versión fusionada

Esta versión une el sitio corporativo y el sistema de gestión en un único proyecto para GitHub Pages.

## Un solo login
- `admin` / `admin123` — Administrador
- `tecnico` / `tecnico123` — Técnico
- `administrativo` / `admin123` — Administrativo

El mismo inicio de sesión da acceso al sitio administrativo y a inspecciones.

## Estructura
- `index.html`: sitio corporativo
- `login.html`: único acceso
- `dashboard.html`: panel principal
- `clientes`, `inventario`, `cotizaciones`, `facturas`, `reportes`, administración y configuración
- `inspecciones.html` y `formulario.html`: inspecciones
- `usuarios.html`: usuarios/técnicos
- `reportes.html`: reportes de inspección
- `ordenes.html`: órdenes de servicio
- `assets/img`: identidad visual

## GitHub Pages
Sube todo el contenido al repositorio y activa Pages desde `main` / `/root`.

## Nota
Esta versión sigue siendo estática: los datos se almacenan en `localStorage`. El login es de demostración y no debe considerarse seguridad de producción. Para varios dispositivos y usuarios, conecta Firebase/Supabase u otro backend y sustituye las credenciales demo por autenticación real.


## V2
- OS-XXXDDMM-NN: últimos 3 dígitos del documento del usuario + día/mes + consecutivo diario.
- Informes de trabajo en obra con fecha, horario, actividades, materiales, observaciones y hasta 6 fotos.
- Técnico ve sus registros; administrador ve todos.


## V4
- Informe de trabajo en obra: eliminado el campo Orden de servicio.
- Inventario: códigos automáticos. Servicio = `SV-000`, `SV-001`...; cualquier otra unidad = `PRD-0000`, `PRD-0001`... Los consecutivos son independientes.


## V7
- Orden de servicio: cliente obligatorio y seleccionado exclusivamente desde Clientes; la OS conserva `clientId` y los datos registrados del cliente.
- Informe de trabajo: cliente obligatorio seleccionado exclusivamente desde Clientes; guarda `clientId` y los datos registrados del cliente.
- Se eliminó la referencia a Orden de Servicio del informe de trabajo.


## V8
- Inspecciones: cliente obligatorio seleccionado desde el módulo Clientes.
- Se eliminó la referencia a Orden de Servicio del formulario de inspección.
- No se puede guardar una inspección sin un cliente registrado.


## V9
- Inspección corregida para usar el registro real de Clientes del sistema.
- Se eliminó visualmente Orden de Servicio del formulario de inspección.
- El cliente de inspección se selecciona de Clientes y es obligatorio.
