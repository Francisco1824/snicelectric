import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS"
};

Deno.serve(async (req) => {

  if(req.method === "OPTIONS"){
    return new Response(
      "ok",
      {
        headers:corsHeaders
      }
    );
  }

  try{

    /*
     * --------------------------------------------------
     * 1. Obtener token del administrador actual
     * --------------------------------------------------
     */

    const authHeader =
      req.headers.get("Authorization");

    if(!authHeader){

      return new Response(
        JSON.stringify({
          error:"No autenticado."
        }),
        {
          status:401,
          headers:{
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );
    }

    const token =
      authHeader.replace(
        "Bearer ",
        ""
      );

    /*
     * --------------------------------------------------
     * 2. Cliente normal
     * --------------------------------------------------
     */

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      )!;

    const publishableKey =
      Deno.env.get(
        "SUPABASE_ANON_KEY"
      ) ||
      Deno.env.get(
        "SUPABASE_PUBLISHABLE_KEY"
      )!;

    const supabase =
      createClient(
        supabaseUrl,
        publishableKey,
        {
          global:{
            headers:{
              Authorization:
                `Bearer ${token}`
            }
          }
        }
      );

    /*
     * --------------------------------------------------
     * 3. Identificar usuario actual
     * --------------------------------------------------
     */

    const {
      data:{
        user:currentUser
      },
      error:userError
    }=
      await supabase.auth.getUser();

    if(
      userError ||
      !currentUser
    ){

      return new Response(
        JSON.stringify({
          error:"Sesión inválida."
        }),
        {
          status:401,
          headers:{
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );
    }

    /*
     * --------------------------------------------------
     * 4. Cliente administrativo
     * --------------------------------------------------
     */

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    if(!serviceRoleKey){

      throw new Error(
        "Falta SUPABASE_SERVICE_ROLE_KEY."
      );
    }

    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey
      );

    /*
     * --------------------------------------------------
     * 5. Comprobar que quien crea el usuario
     *    es Administrador
     * --------------------------------------------------
     */

    const {
      data:role,
      error:roleError
    }=
      await admin.rpc(
        "mi_rol",
        {
          p_user_id:currentUser.id
        }
      );

    /*
     * Si tu RPC mi_rol no acepta p_user_id,
     * usamos el perfil directamente.
     */

    let currentRole=role;

    if(roleError){

      const {
        data:profile
      }=
        await admin
          .from("perfiles")
          .select("rol_id")
          .eq(
            "id",
            currentUser.id
          )
          .maybeSingle();

      if(profile?.rol_id){

        const {
          data:r
        }=
          await admin
            .from("roles")
            .select("nombre")
            .eq(
              "id",
              profile.rol_id
            )
            .maybeSingle();

        currentRole=r?.nombre;
      }
    }

    if(
      String(currentRole)
        .toLowerCase()
        !==
      "administrador"
    ){

      return new Response(
        JSON.stringify({
          error:
            "Solo un Administrador puede crear usuarios."
        }),
        {
          status:403,
          headers:{
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );
    }

    /*
     * --------------------------------------------------
     * 6. Recibir datos
     * --------------------------------------------------
     */

    const body =
      await req.json();

    const {
      nombre,
      apellido,
      documento,
      telefono,
      email,
      password,
      rol_id,
      activo=true
    }=body;

    /*
     * --------------------------------------------------
     * 7. Validaciones
     * --------------------------------------------------
     */

    if(!nombre){

      throw new Error(
        "El nombre es obligatorio."
      );
    }

    if(!email){

      throw new Error(
        "El correo es obligatorio."
      );
    }

    if(!password){

      throw new Error(
        "La contraseña es obligatoria."
      );
    }

    if(password.length < 6){

      throw new Error(
        "La contraseña debe tener al menos 6 caracteres."
      );
    }

    if(!rol_id){

      throw new Error(
        "Debes seleccionar un rol."
      );
    }

    /*
     * --------------------------------------------------
     * 8. Comprobar rol
     * --------------------------------------------------
     */

    const {
      data:roleData,
      error:roleDataError
    }=
      await admin
        .from("roles")
        .select("id,nombre")
        .eq("id",rol_id)
        .maybeSingle();

    if(
      roleDataError ||
      !roleData
    ){

      throw new Error(
        "El rol seleccionado no existe."
      );
    }

    /*
     * --------------------------------------------------
     * 9. Crear usuario en Auth
     * --------------------------------------------------
     */

    const {
      data:authData,
      error:authError
    }=
      await admin.auth.admin.createUser({

        email,

        password,

        email_confirm:true,

        user_metadata:{
          full_name:
            `${nombre} ${apellido||""}`
              .trim(),

          document:
            documento || "",

          phone:
            telefono || ""
        }

      });

    if(authError){

      throw authError;
    }

    const newUser=
      authData.user;

    if(!newUser){

      throw new Error(
        "Supabase no devolvió el usuario creado."
      );
    }

    /*
     * --------------------------------------------------
     * 10. Crear perfil
     * --------------------------------------------------
     */

    const {
      error:profileError
    }=
      await admin
        .from("perfiles")
        .insert({

          id:newUser.id,

          nombre,

          apellido:
            apellido || null,

          documento:
            documento || null,

          telefono:
            telefono || null,

          email,

          rol_id,

          activo:
            activo !== false

        });

    if(profileError){

      /*
       * Si falla el perfil,
       * eliminamos el usuario Auth
       * para no dejar datos incompletos.
       */

      await admin.auth.admin.deleteUser(
        newUser.id
      );

      throw profileError;
    }

    /*
     * --------------------------------------------------
     * 11. Respuesta
     * --------------------------------------------------
     */

    return new Response(

      JSON.stringify({

        ok:true,

        user:{
          id:newUser.id,

          email:newUser.email,

          nombre,

          apellido,

          rol_id,

          rol:roleData.nombre
        }

      }),

      {
        status:200,

        headers:{
          ...corsHeaders,
          "Content-Type":
            "application/json"
        }
      }

    );

  }catch(error){

    console.error(
      "crear-usuario:",
      error
    );

    return new Response(

      JSON.stringify({

        error:
          error?.message ||
          "No se pudo crear el usuario."

      }),

      {
        status:400,

        headers:{
          ...corsHeaders,
          "Content-Type":
            "application/json"
        }
      }

    );
  }

});