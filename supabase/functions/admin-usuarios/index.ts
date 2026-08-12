import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

function getSecretKey() {
  const json = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (parsed?.default) return parsed.default;
      const first = Object.values(parsed).find((v) => typeof v === "string" && v);
      if (first) return first as string;
    } catch (_) {}
  }

  return (
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    ""
  );
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Error desconocido");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({ ok: false, error: "Método no permitido." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const publishableKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY") ??
      "";
    const secretKey = getSecretKey();

    if (!supabaseUrl || !publishableKey || !secretKey) {
      return response({
        ok: false,
        error: "Configuración incompleta de Supabase en la Edge Function.",
      }, 500);
    }

    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) {
      return response({ ok: false, error: "No hay sesión autenticada." }, 401);
    }

    const token = authorization.slice("Bearer ".length).trim();
    if (!token) {
      return response({ ok: false, error: "Token de sesión vacío." }, 401);
    }

    // Cliente con la clave pública: identifica al usuario que hizo la petición.
    const supabaseAuth = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      return response({
        ok: false,
        error: "Sesión inválida o expirada.",
        detail: userError?.message ?? null,
      }, 401);
    }

    // Cliente servidor: SOLO vive dentro de esta función.
    const supabaseAdmin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Autorización real en servidor. No confiamos en sessionStorage ni en el frontend.
    const { data: perfilAdmin, error: perfilError } = await supabaseAdmin
      .from("perfiles")
      .select(`
        id,
        nombre,
        apellido,
        email,
        rol_id,
        activo,
        roles (
          id,
          nombre,
          activo
        )
      `)
      .eq("id", user.id)
      .maybeSingle();

    if (perfilError) {
      return response({
        ok: false,
        error: "No fue posible comprobar el perfil del administrador.",
        detail: perfilError.message,
      }, 500);
    }

    const rol = Array.isArray(perfilAdmin?.roles)
      ? perfilAdmin.roles[0]
      : perfilAdmin?.roles;

    if (
      !perfilAdmin ||
      perfilAdmin.activo !== true ||
      rol?.activo === false ||
      rol?.nombre !== "Administrador"
    ) {
      return response({
        ok: false,
        error: "No tienes permisos de administrador.",
      }, 403);
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }

    const accion = String(body.accion ?? "").trim().toLowerCase();

    // ------------------------------------------------------------
    // LISTAR
    // ------------------------------------------------------------
    if (accion === "listar") {
      const { data, error } = await supabaseAdmin
        .from("perfiles")
        .select(`
          id,
          nombre,
          apellido,
          documento,
          telefono,
          email,
          rol_id,
          activo,
          created_at,
          updated_at,
          roles (
            id,
            nombre,
            activo
          )
        `)
        .order("created_at", { ascending: true });

      if (error) {
        return response({
          ok: false,
          error: "No fue posible cargar los usuarios.",
          detail: error.message,
        }, 500);
      }

      const usuarios = (data ?? []).map((p: any) => {
        const r = Array.isArray(p.roles) ? p.roles[0] : p.roles;
        return {
          id: p.id,
          nombre: p.nombre ?? "",
          apellido: p.apellido ?? "",
          documento: p.documento ?? "",
          telefono: p.telefono ?? "",
          email: p.email ?? "",
          rol_id: p.rol_id ?? null,
          rol: r?.nombre ?? "Sin rol",
          activo: p.activo === true,
          created_at: p.created_at ?? null,
          updated_at: p.updated_at ?? null,
        };
      });

      return response({ ok: true, usuarios });
    }

    // ------------------------------------------------------------
    // VALIDAR ROL
    // ------------------------------------------------------------
    async function obtenerRol(rolId: string) {
      if (!rolId) return null;

      const { data, error } = await supabaseAdmin
        .from("roles")
        .select("id,nombre,activo")
        .eq("id", rolId)
        .maybeSingle();

      if (error) throw error;
      if (!data || data.activo === false) return null;
      return data;
    }

    // ------------------------------------------------------------
    // CREAR
    // ------------------------------------------------------------
    if (accion === "crear") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const nombre = String(body.nombre ?? "").trim();
      const apellido = String(body.apellido ?? "").trim();
      const documento = String(body.documento ?? "").trim();
      const telefono = String(body.telefono ?? "").trim();
      const rolId = String(body.rol_id ?? "").trim();

      if (!email || !password || !nombre || !rolId) {
        return response({
          ok: false,
          error: "Nombre, correo, contraseña y rol son obligatorios.",
        }, 400);
      }

      if (password.length < 6) {
        return response({
          ok: false,
          error: "La contraseña debe tener al menos 6 caracteres.",
        }, 400);
      }

      const rolDestino = await obtenerRol(rolId);
      if (!rolDestino) {
        return response({
          ok: false,
          error: "El rol seleccionado no existe o está inactivo.",
        }, 400);
      }

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: `${nombre} ${apellido}`.trim(),
            document: documento,
          },
        });

      if (authError || !authData.user) {
        return response({
          ok: false,
          error: "No fue posible crear el usuario.",
          detail: authError?.message ?? null,
        }, 400);
      }

      const userId = authData.user.id;

      const { data: perfil, error: perfilInsertError } =
        await supabaseAdmin
          .from("perfiles")
          .insert({
            id: userId,
            nombre,
            apellido: apellido || null,
            documento: documento || null,
            telefono: telefono || null,
            email,
            rol_id: rolDestino.id,
            activo: true,
          })
          .select(`
            id,
            nombre,
            apellido,
            documento,
            telefono,
            email,
            rol_id,
            activo
          `)
          .single();

      if (perfilInsertError) {
        // Rollback del usuario Auth si no se pudo crear su perfil.
        await supabaseAdmin.auth.admin.deleteUser(userId);

        return response({
          ok: false,
          error: "El usuario Auth se creó, pero no pudo crearse su perfil.",
          detail: perfilInsertError.message,
        }, 500);
      }

      return response({
        ok: true,
        message: "Usuario creado correctamente.",
        usuario: {
          ...perfil,
          rol: rolDestino.nombre,
        },
      }, 201);
    }

    // ------------------------------------------------------------
    // ACTUALIZAR
    // ------------------------------------------------------------
    if (accion === "actualizar") {
      const id = String(body.id ?? "").trim();
      if (!id) {
        return response({ ok: false, error: "Falta el id del usuario." }, 400);
      }

      const { data: destino, error: destinoError } = await supabaseAdmin
        .from("perfiles")
        .select("id,nombre,apellido,email,rol_id,activo")
        .eq("id", id)
        .maybeSingle();

      if (destinoError) throw destinoError;
      if (!destino) {
        return response({ ok: false, error: "El usuario no existe." }, 404);
      }

      const cambios: Record<string, unknown> = {};

      if (body.nombre !== undefined) {
        const nombre = String(body.nombre).trim();
        if (!nombre) return response({ ok: false, error: "El nombre es obligatorio." }, 400);
        cambios.nombre = nombre;
      }

      if (body.apellido !== undefined) {
        cambios.apellido = String(body.apellido).trim() || null;
      }

      if (body.documento !== undefined) {
        cambios.documento = String(body.documento).trim() || null;
      }

      if (body.telefono !== undefined) {
        cambios.telefono = String(body.telefono).trim() || null;
      }

      let emailNuevo: string | undefined;
      if (body.email !== undefined) {
        emailNuevo = String(body.email).trim().toLowerCase();
        if (!emailNuevo) {
          return response({ ok: false, error: "El correo es obligatorio." }, 400);
        }
        cambios.email = emailNuevo;
      }

      if (body.rol_id !== undefined) {
        const rolId = String(body.rol_id).trim();
        const rolDestino = await obtenerRol(rolId);
        if (!rolDestino) {
          return response({
            ok: false,
            error: "El rol seleccionado no existe o está inactivo.",
          }, 400);
        }
        cambios.rol_id = rolDestino.id;
      }

      cambios.updated_at = new Date().toISOString();

      if (Object.keys(cambios).length > 0) {
        const { error } = await supabaseAdmin
          .from("perfiles")
          .update(cambios)
          .eq("id", id);

        if (error) {
          return response({
            ok: false,
            error: "No fue posible actualizar el perfil.",
            detail: error.message,
          }, 500);
        }
      }

      const authChanges: Record<string, unknown> = {};

      if (emailNuevo !== undefined) {
        authChanges.email = emailNuevo;
        authChanges.email_confirm = true;
      }

      if (body.password !== undefined && String(body.password).length > 0) {
        const password = String(body.password);
        if (password.length < 6) {
          return response({
            ok: false,
            error: "La contraseña debe tener al menos 6 caracteres.",
          }, 400);
        }
        authChanges.password = password;
      }

      if (
        body.nombre !== undefined ||
        body.apellido !== undefined ||
        body.documento !== undefined
      ) {
        authChanges.user_metadata = {
          full_name: `${body.nombre ?? destino.nombre ?? ""} ${body.apellido ?? destino.apellido ?? ""}`.trim(),
          document: String(body.documento ?? "").trim(),
        };
      }

      if (Object.keys(authChanges).length > 0) {
        const { error } =
          await supabaseAdmin.auth.admin.updateUserById(id, authChanges);

        if (error) {
          return response({
            ok: false,
            error: "El perfil se actualizó, pero falló la actualización de Auth.",
            detail: error.message,
          }, 500);
        }
      }

      return response({
        ok: true,
        message: "Usuario actualizado correctamente.",
      });
    }

    // ------------------------------------------------------------
    // ACTIVAR / DESACTIVAR
    // ------------------------------------------------------------
    if (accion === "estado") {
      const id = String(body.id ?? "").trim();
      const activo = body.activo === true;

      if (!id) {
        return response({ ok: false, error: "Falta el id del usuario." }, 400);
      }

      if (id === user.id && !activo) {
        return response({
          ok: false,
          error: "No puedes desactivar tu propio usuario administrador.",
        }, 400);
      }

      const { error } = await supabaseAdmin
        .from("perfiles")
        .update({
          activo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        return response({
          ok: false,
          error: "No fue posible cambiar el estado del usuario.",
          detail: error.message,
        }, 500);
      }

      return response({
        ok: true,
        message: activo
          ? "Usuario activado correctamente."
          : "Usuario desactivado correctamente.",
      });
    }

    // ------------------------------------------------------------
    // ELIMINAR
    // ------------------------------------------------------------
    if (accion === "eliminar") {
      const id = String(body.id ?? "").trim();

      if (!id) {
        return response({ ok: false, error: "Falta el id del usuario." }, 400);
      }

      if (id === user.id) {
        return response({
          ok: false,
          error: "No puedes eliminar tu propio usuario administrador.",
        }, 400);
      }

      const { data: destino, error: destinoError } = await supabaseAdmin
        .from("perfiles")
        .select("id")
        .eq("id", id)
        .maybeSingle();

      if (destinoError) throw destinoError;
      if (!destino) {
        return response({ ok: false, error: "El usuario no existe." }, 404);
      }

      // Primero intentamos eliminar el perfil para respetar relaciones que
      // apunten a perfiles. Si alguna FK impide el borrado, se informa.
      const { error: perfilDeleteError } = await supabaseAdmin
        .from("perfiles")
        .delete()
        .eq("id", id);

      if (perfilDeleteError) {
        return response({
          ok: false,
          error: "No se pudo eliminar el perfil. Puede tener registros relacionados. Usa Desactivar para conservar la trazabilidad.",
          detail: perfilDeleteError.message,
        }, 409);
      }

      const { error: authDeleteError } =
        await supabaseAdmin.auth.admin.deleteUser(id);

      if (authDeleteError) {
        // El perfil ya fue borrado. Informamos el estado real para no ocultar
        // una inconsistencia de Auth.
        return response({
          ok: false,
          error: "El perfil fue eliminado, pero no se pudo eliminar la cuenta de Auth.",
          detail: authDeleteError.message,
        }, 500);
      }

      return response({
        ok: true,
        message: "Usuario eliminado correctamente.",
      });
    }

    return response({
      ok: false,
      error: `Acción no reconocida: ${accion || "(vacía)"}.`,
    }, 400);
  } catch (error) {
    console.error("admin-usuarios:", error);
    return response({
      ok: false,
      error: "Error interno de la función.",
      detail: normalizeError(error),
    }, 500);
  }
});
