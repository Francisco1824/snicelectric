import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {

  try {

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Método no permitido"
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const authHeader =
      req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "No autorizado"
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const SUPABASE_URL =
      Deno.env.get("SUPABASE_URL")!;

    const SUPABASE_ANON_KEY =
      Deno.env.get("SUPABASE_ANON_KEY")!;

    const SUPABASE_SERVICE_ROLE_KEY =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;


    /*
     * Cliente usando la sesión del administrador
     */
    const userClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );


    /*
     * Comprobar administrador
     */
    const {
      data: {
        user: adminUser
      },
      error: adminError
    } = await userClient.auth.getUser();


    if (adminError || !adminUser) {
      return new Response(
        JSON.stringify({
          error: "Sesión no válida."
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }


    /*
     * Cliente administrativo
     */
    const adminClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );


    /*
     * Comprobar rol del administrador
     */
    const {
      data: adminProfile,
      error: profileError
    } = await adminClient
      .from("perfiles")
      .select(`
        id,
        rol_id,
        roles (
          id,
          nombre
        )
      `)
      .eq("id", adminUser.id)
      .maybeSingle();


    if (profileError) {
      throw profileError;
    }


    const roleName =
      adminProfile?.roles?.nombre || "";


    if (roleName !== "Administrador") {

      return new Response(
        JSON.stringify({
          error: "Solo un Administrador puede crear usuarios."
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }


    /*
     * Datos enviados desde dashboard.js
     */
    const body = await req.json();

    const email =
      String(body.email || "")
        .trim()
        .toLowerCase();

    const password =
      String(body.password || "");

    const nombre =
      String(body.nombre || "").trim();

    const apellido =
      String(body.apellido || "").trim();

    const documento =
      String(body.documento || "").trim();

    const telefono =
      String(body.telefono || "").trim();

    const rol_id =
      body.rol_id;

    const activo =
      body.activo !== false;


    if (!email) {
      throw new Error(
        "El correo es obligatorio."
      );
    }

    if (password.length < 6) {
      throw new Error(
        "La contraseña debe tener mínimo 6 caracteres."
      );
    }

    if (!nombre) {
      throw new Error(
        "El nombre es obligatorio."
      );
    }

    if (!rol_id) {
      throw new Error(
        "El rol es obligatorio."
      );
    }


    /*
     * Crear usuario en Supabase Auth
     */
    const {
      data: authData,
      error: authError
    } =
      await adminClient.auth.admin.createUser({

        email,

        password,

        email_confirm: true,

        user_metadata: {
          full_name:
            `${nombre} ${apellido}`.trim(),

          document: documento
        }

      });


    if (authError) {
      throw authError;
    }


    const newUser =
      authData.user;


    /*
     * Crear perfil
     */
    const {
      error: insertProfileError
    } =
      await adminClient
        .from("perfiles")
        .insert({

          id: newUser.id,

          nombre,

          apellido,

          documento,

          telefono,

          email,

          rol_id,

          activo

        });


    if (insertProfileError) {

      /*
       * Si falla el perfil,
       * eliminamos el Auth creado.
       */
      await adminClient.auth.admin.deleteUser(
        newUser.id
      );

      throw insertProfileError;
    }


    return new Response(
      JSON.stringify({

        ok: true,

        user: {
          id: newUser.id,

          email: newUser.email,

          nombre,

          apellido,

          rol_id

        }

      }),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );

  } catch (error) {

    console.error(error);

    return new Response(
      JSON.stringify({
        error:
          error?.message ||
          "Error creando usuario."
      }),
      {
        status: 400,

        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );
  }

});
