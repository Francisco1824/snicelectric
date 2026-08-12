# SNIC'ELECTRIC v10 - conexión Supabase

Esta versión conecta el login, clientes (sincronización), inspecciones e informes de trabajo con Supabase. Inventario, cotizaciones, facturas y otros módulos conservan temporalmente su UI/localStorage para evitar romper la versión v9 durante la migración.

## Publicación en GitHub Pages
Sube el contenido de esta carpeta al repositorio. No necesitas servidor.

## Seguridad
El frontend usa únicamente la publishable key. Nunca coloques una service_role/secret key en GitHub.

## Pruebas realizadas
- Auth Supabase
- roles/permisos mediante RPC
- clientes
- inspecciones
- informes de trabajo
- Storage de fotografías
- tabla archivos con RLS
