-- SNIC'ELECTRIC - políticas necesarias para Administración y documentos
-- Ejecutar en Supabase SQL Editor como administrador de la base.

-- Lectura de administración
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rol_permisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perfiles_select_authenticated ON public.perfiles;
CREATE POLICY perfiles_select_authenticated ON public.perfiles
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS roles_select_authenticated ON public.roles;
CREATE POLICY roles_select_authenticated ON public.roles
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS permisos_select_authenticated ON public.permisos;
CREATE POLICY permisos_select_authenticated ON public.permisos
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS rol_permisos_select_authenticated ON public.rol_permisos;
CREATE POLICY rol_permisos_select_authenticated ON public.rol_permisos
FOR SELECT TO authenticated USING (true);

-- Los detalles deben poder consultarse y modificarse junto con cotizaciones/facturas.
ALTER TABLE public.cotizacion_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factura_detalles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cotizacion_detalles_select_authenticated ON public.cotizacion_detalles;
CREATE POLICY cotizacion_detalles_select_authenticated ON public.cotizacion_detalles
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cotizacion_detalles_insert_authenticated ON public.cotizacion_detalles;
CREATE POLICY cotizacion_detalles_insert_authenticated ON public.cotizacion_detalles
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS cotizacion_detalles_update_authenticated ON public.cotizacion_detalles;
CREATE POLICY cotizacion_detalles_update_authenticated ON public.cotizacion_detalles
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cotizacion_detalles_delete_authenticated ON public.cotizacion_detalles;
CREATE POLICY cotizacion_detalles_delete_authenticated ON public.cotizacion_detalles
FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS factura_detalles_select_authenticated ON public.factura_detalles;
CREATE POLICY factura_detalles_select_authenticated ON public.factura_detalles
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS factura_detalles_insert_authenticated ON public.factura_detalles;
CREATE POLICY factura_detalles_insert_authenticated ON public.factura_detalles
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS factura_detalles_update_authenticated ON public.factura_detalles;
CREATE POLICY factura_detalles_update_authenticated ON public.factura_detalles
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS factura_detalles_delete_authenticated ON public.factura_detalles;
CREATE POLICY factura_detalles_delete_authenticated ON public.factura_detalles
FOR DELETE TO authenticated USING (true);

-- Administración de perfiles/roles/permisos.
-- La aplicación ya restringe la entrada al módulo por el permiso Administración.
-- Estas políticas permiten que un usuario autenticado pueda actualizar los registros
-- administrativos sin exponer una service_role key en GitHub Pages.
DROP POLICY IF EXISTS perfiles_update_authenticated ON public.perfiles;
CREATE POLICY perfiles_update_authenticated ON public.perfiles
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS roles_insert_authenticated ON public.roles;
CREATE POLICY roles_insert_authenticated ON public.roles
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS roles_update_authenticated ON public.roles;
CREATE POLICY roles_update_authenticated ON public.roles
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS rol_permisos_insert_authenticated ON public.rol_permisos;
CREATE POLICY rol_permisos_insert_authenticated ON public.rol_permisos
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS rol_permisos_delete_authenticated ON public.rol_permisos;
CREATE POLICY rol_permisos_delete_authenticated ON public.rol_permisos
FOR DELETE TO authenticated USING (true);
