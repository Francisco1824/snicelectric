/* SNIC'ELECTRIC - Supabase client */

const SNIC_SUPABASE_URL = 'https://kqygenlkwpfscfcxbaxv.supabase.co';
const SNIC_SUPABASE_KEY = 'sb_publishable__4mR0xpN-sMZatWOpQuDDg_n0kgDBIz';

window.snicSupabase = window.supabase.createClient(
  SNIC_SUPABASE_URL,
  SNIC_SUPABASE_KEY
);

window.snicAuth = {

  async user(){
    const {
      data:{user},
      error
    } = await snicSupabase.auth.getUser();

    if(error) throw error;

    return user;
  },

  async role(){

    const {
      data,
      error
    } = await snicSupabase.rpc('mi_rol');

    if(error) throw error;

    return data;
  },

  async permissions(){

    const codes=[
      'dashboard',
      'clientes',
      'inventario',
      'ordenes',
      'inspecciones',
      'informes',
      'cotizaciones',
      'facturas',
      'trimestrales',
      'reportes',
      'administracion',
      'configuracion'
    ];

    const out={};

    for(const code of codes){

      const {data,error}=
        await snicSupabase.rpc(
          'tengo_permiso',
          {
            p_codigo:code,
            p_accion:'ver'
          }
        );

      if(error){
        console.warn(
          'Permiso',
          code,
          error.message
        );

        out[code]=false;
      }else{
        out[code]=!!data;
      }
    }

    return out;
  },

  async require(){

    const u=await this.user();

    if(!u){
      location.href='login.html';
      return null;
    }

    let role='Técnico';

    try{
      role=await this.role()||role;
    }catch(e){
      console.warn(
        'No se pudo obtener el rol:',
        e.message
      );
    }

    let profile=null;

    try{

      const r=
        await snicSupabase
          .from('perfiles')
          .select(
            'id,nombre,apellido,email,rol_id'
          )
          .eq('id',u.id)
          .maybeSingle();

      profile=r.data;

    }catch(e){

      console.warn(
        'No se pudo obtener perfil:',
        e.message
      );

    }

    const local={

      id:u.id,

      name:
        profile?.nombre
          ? `${profile.nombre} ${profile.apellido||''}`.trim()
          : (
              u.user_metadata?.full_name ||
              u.email
            ),

      document:
        u.user_metadata?.document || '',

      roleId:
        role==='Administrador'
          ? 'admin'
          : role==='Administrativo'
            ? 'administrativo'
            : 'tecnico',

      roleName:role,

      email:u.email

    };

    sessionStorage.setItem(
      'snic_user',
      JSON.stringify(local)
    );

    return local;
  },

  async logout(){

    await snicSupabase.auth.signOut();

    sessionStorage.removeItem('snic_user');
    sessionStorage.removeItem('snic_auth_v2');

    location.href='login.html';
  },

  async syncClientsToLocal(){

    const {
      data,
      error
    }=
      await snicSupabase
        .from('clientes')
        .select('*')
        .order('nombre');

    if(error) throw error;

    const db=
      JSON.parse(
        localStorage.getItem('snic_db')||'{}'
      );

    db.clientes=(data||[]).map(c=>({

      id:c.id,

      nombre:
        c.razon_social ||
        [c.nombre,c.apellido]
          .filter(Boolean)
          .join(' '),

      doc:
        c.numero_documento || '',

      telefono:
        c.telefono || '',

      email:
        c.email || '',

      direccion:
        c.direccion || '',

      ciudad:
        c.ciudad || '',

      activo:
        c.activo!==false

    }));

    localStorage.setItem(
      'snic_db',
      JSON.stringify(db)
    );

    return db.clientes;
  },

  /*
   * Crear un usuario real de Supabase.
   *
   * La creación se realiza mediante
   * una Edge Function para no exponer
   * claves administrativas en el navegador.
   */
  async createUser(payload){

    const {
      data,
      error
    }=
      await snicSupabase.functions.invoke(
        'crear-usuario',
        {
          body:payload
        }
      );

    if(error){
      throw error;
    }

    if(data?.error){
      throw new Error(data.error);
    }

    return data;
  }

};
