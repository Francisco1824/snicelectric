# SNIC'ELECTRIC - Sistema administrativo V3

Incluye:
- Sitio público: index.html + style.css + responsive.css + script.js.
- Login administrativo con usuarios y roles.
- Dashboard.
- Clientes: crear, editar y eliminar.
- Inventario: productos/materiales/servicios, código, categoría, unidad, costo, precio, stock y stock mínimo.
- Cotizaciones: los productos del inventario aparecen para seleccionarlos y tomar automáticamente precio/descripcion.
- Facturas: igual que cotizaciones; al crear una factura no anulada, descuenta del stock los productos utilizados.
- Edición e impresión de cotizaciones y facturas.
- Reportes: ventas, cotizado, cotizaciones aceptadas, alertas de stock, ventas por cliente y resumen.
- Administración: usuarios, roles y permisos.
- Configuración: empresa, NIT, teléfono, correo, IVA, moneda y prefijos de documentos.
- Persistencia local con localStorage.

Acceso DEMO:
Usuario: admin
Contraseña: admin123

Importante:
Esta es una aplicación frontend de demostración. La autenticación y los datos están en el navegador y no deben considerarse seguros para producción. Para una instalación empresarial real conviene conectar un backend, base de datos y autenticación segura.

## Descuentos
Las cotizaciones y facturas permiten aplicar descuento por porcentaje o por valor fijo. El descuento se resta antes de calcular el impuesto y se refleja en la impresión del documento.
