(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(+n||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const today=()=>new Date().toISOString().slice(0,10);
let user=JSON.parse(sessionStorage.getItem('snic_user')||'null');
if(!user){location.href='login.html';return}
let db=JSON.parse(localStorage.getItem('snic_db')||'{}');
db.clientes??=[];db.inventario??=[];db.cotizaciones??=[];db.facturas??=[];db.users??=[];db.roles??=[];db.config??={};
db.config={empresa:"SNIC'ELECTRIC",nit:"",telefono:"+57 305 4044326",email:"snicelectric@gmail.com",iva:19,prefijoCot:"COT",prefijoFac:"FAC",moneda:"COP",...db.config};
const role={name:user.roleName||'Técnico',permissions:[]};
const isAdmin=user.roleId==='admin'||role.name.toLowerCase()==='administrador';
const can=p=>isAdmin||role.permissions.includes(p);
const save=()=>localStorage.setItem('snic_db',JSON.stringify(db));
async function loadInventoryFromSupabase(){
 try{
   const {data,error}=await snicSupabase.from('productos').select('id,codigo,tipo,nombre,descripcion,categoria_id,unidad,precio_compra,precio_venta,stock_actual,stock_minimo,activo,created_by,created_at,updated_at').eq('activo',true).order('created_at',{ascending:true});
   if(error) throw error;
   db.inventario=(data||[]).map(p=>({
     id:p.id,codigo:p.codigo,tipo:p.tipo,nombre:p.nombre,descripcion:p.descripcion||'',
     categoria_id:p.categoria_id||null, categoria:'',
     unidad:p.unidad||'unidad',stock:Number(p.stock_actual)||0,min:Number(p.stock_minimo)||0,
     costo:Number(p.precio_compra)||0,precio:Number(p.precio_venta)||0,activo:p.activo!==false
   }));
   save();
   return db.inventario;
 }catch(e){
   console.error('Inventario Supabase:',e);
   throw e;
 }
}
async function deleteInventoryFromSupabase(id){
 const {data,error}=await snicSupabase.from('productos').update({activo:false,updated_at:new Date().toISOString()}).eq('id',id).select().single();
 if(error) throw error;
 return data;
}
(async()=>{try{await snicAuth.syncClientsToLocal();db=JSON.parse(localStorage.getItem('snic_db')||'{}')}catch(e){console.warn('No se pudieron sincronizar clientes:',e.message)}
try{await loadInventoryFromSupabase()}catch(e){console.warn('No se pudo cargar inventario:',e.message)}
try{const perms=await snicAuth.permissions();role.permissions=Object.keys(perms).filter(k=>perms[k]);
$$('#mainNav button').forEach(b=>{const code=b.dataset.view==='inicio'?'dashboard':b.dataset.view;b.style.display=(isAdmin||perms[code])?'':'none'});
}catch(e){console.warn('Permisos:',e.message);}
})();
const allowedViews=['inicio','clientes','inventario','cotizaciones','facturas','reportes','administracion','configuracion','ordenes','inspecciones','informes','trimestrales'];
$$('#mainNav button').forEach(b=>{if(!can(b.dataset.view==='inicio'?'dashboard':b.dataset.view)){b.style.display='none'} b.onclick=()=>nav(b.dataset.view)});
function nav(v){if(!can(v==='inicio'?'dashboard':v)){alert('No tienes permiso para acceder a este módulo.');return}$$('#mainNav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('#pageTitle').textContent={inicio:'Resumen',clientes:'Clientes',inventario:'Inventario',cotizaciones:'Cotizaciones',facturas:'Facturas',reportes:'Reportes',administracion:'Administración',configuracion:'Configuración',ordenes:'Órdenes de servicio',inspecciones:'Inspecciones',informes:'Informes de trabajo',trimestrales:'Informes trimestrales'}[v];render(v);$('.sidebar')?.classList.remove('open')}
function render(v){
 if(['inspecciones','ordenes','informes'].includes(v)){cRoute(v);return}
 if(v==='trimestrales'){if(!can('trimestrales')){alert('No tienes permiso para acceder a este módulo.');return}const c=$('#content');c.innerHTML=quarterly();return}
 const c=$('#content');
 if(v==='administracion'){c.innerHTML='<div class="panel"><p>Cargando administración desde Supabase...</p></div>';loadAdministrationFromSupabase().then(()=>{c.innerHTML=administration();bind(v)}).catch(e=>{c.innerHTML=`<div class="panel"><b>No se pudo cargar Administración:</b> ${esc(e.message)}</div>`});return}
 if(v==='cotizaciones'||v==='facturas'){c.innerHTML='<div class="panel"><p>Cargando documentos desde Supabase...</p></div>';loadDocumentsFromSupabase(v==='cotizaciones'?'quote':'invoice').then(()=>{c.innerHTML=v==='cotizaciones'?quotes():invoices();bind(v)}).catch(e=>{c.innerHTML=`<div class="panel"><b>No se pudieron cargar ${v}:</b> ${esc(e.message)}</div>`});return}
 c.innerHTML={inicio:home,clientes:clients,inventario:inventory,reportes:reports,configuracion:settings}[v]();bind(v);
 if(v==='inventario'){loadInventoryFromSupabase().then(()=>{c.innerHTML=inventory();bind(v)}).catch(e=>{c.insertAdjacentHTML('beforeend',`<div class="panel" style="margin-top:18px"><b>Error cargando inventario:</b> ${esc(e.message)}</div>`)})}
}
function cRoute(v){
 const c=$('#content');
 const pages={inspecciones:'inspecciones.html',ordenes:'ordenes.html',informes:'informes-trabajo.html'};
 if(!can(v)){alert('No tienes permiso para acceder a este módulo.');return}
 const target=pages[v];
 if(target){location.href=target}
}
function quarterly(){return `<div class="page"><div class="cards"><div class="card"><i class="fa-solid fa-bolt"></i><div class="num">Inspecciones</div><div class="kpi">Gestionadas desde el módulo técnico</div></div><div class="card"><i class="fa-solid fa-file-lines"></i><div class="num">Informes</div><div class="kpi">Informes de trabajo</div></div><div class="card"><i class="fa-solid fa-chart-column"></i><div class="num">Trimestral</div><div class="kpi">Resumen general</div></div></div><div class="panel" style="margin-top:18px"><h3>Informe trimestral</h3><p>Utiliza el módulo de reportes para filtrar y generar el informe del periodo.</p><button class="btn" onclick="window.location.href='reportes.html'">Abrir reportes</button></div></div>`}
function home(){const stock=db.inventario.reduce((a,x)=>a+(+x.stock||0),0),low=db.inventario.filter(x=>(+x.stock||0)<=(+x.min||0)).length;return `<div class="page"><div class="cards"><div class="card"><i class="fa-solid fa-users"></i><div class="num">${db.clientes.length}</div><div class="kpi">Clientes</div></div><div class="card"><i class="fa-solid fa-boxes-stacked"></i><div class="num">${db.inventario.length}</div><div class="kpi">Productos · ${stock} unidades</div></div><div class="card"><i class="fa-solid fa-file-signature"></i><div class="num">${db.cotizaciones.length}</div><div class="kpi">Cotizaciones</div></div><div class="card"><i class="fa-solid fa-file-invoice-dollar"></i><div class="num">${money(db.facturas.reduce((a,x)=>a+(+x.total||0),0))}</div><div class="kpi">Facturado</div></div></div><div class="grid2" style="margin-top:18px"><div class="panel"><h3>Inventario</h3><p>${low?`Hay <b>${low}</b> productos en nivel mínimo o inferior.`:'No hay alertas de stock.'}</p><button class="btn secondary" onclick="window._nav('inventario')">Ver inventario</button></div><div class="panel"><h3>Actividad reciente</h3>${[...db.facturas].slice(-5).reverse().map(x=>`<div class="setting-row"><span>${esc(x.numero)} · ${esc(x.clienteNombre)}</span><b>${money(x.total)}</b></div>`).join('')||'<div class="empty">Sin movimientos.</div>'}</div></div></div>`}
function clients(){return `<div class="page"><div class="toolbar"><button class="btn" id="newClient">+ Nuevo cliente</button><input id="clientSearch" class="search" placeholder="Buscar cliente..."></div><div class="panel tablewrap"><table class="table"><thead><tr><th>Nombre / Empresa</th><th>NIT / Cédula</th><th>Teléfono</th><th>Correo</th><th>Acciones</th></tr></thead><tbody>${db.clientes.length?db.clientes.map(x=>`<tr><td>${esc(x.nombre)}</td><td>${esc(x.doc)}</td><td>${esc(x.telefono)}</td><td>${esc(x.email)}</td><td class="actions"><button class="mini" data-edit-client="${x.id}">Editar</button><button class="mini danger" data-del-client="${x.id}">Eliminar</button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No hay clientes registrados.</td></tr>'}</tbody></table></div></div>`}
function inventory(){return `<div class="page"><div class="toolbar"><button class="btn" id="newProduct">+ Nuevo producto</button><input id="invSearch" class="search" placeholder="Buscar código, producto o categoría..."></div><div class="panel tablewrap"><table class="table"><thead><tr><th>Código</th><th>Producto / Servicio</th><th>Categoría</th><th>Stock</th><th>Mínimo</th><th>Precio venta</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${db.inventario.length?db.inventario.map(x=>{let low=(+x.stock||0)<=(+x.min||0);return `<tr><td>${esc(x.codigo)}</td><td>${esc(x.nombre)}</td><td>${esc(x.categoria)}</td><td><b>${x.stock}</b> ${esc(x.unidad)}</td><td>${x.min}</td><td>${money(x.precio)}</td><td><span class="status ${low?'low':'ok'}">${low?'Stock bajo':'Disponible'}</span></td><td class="actions"><button class="mini" data-edit-product="${x.id}">Editar</button><button class="mini danger" data-del-product="${x.id}">Eliminar</button></td></tr>`}).join(''):'<tr><td colspan="8" class="empty">No hay productos. Agrega materiales y servicios para usarlos en cotizaciones y facturas.</td></tr>'}</tbody></table></div></div>`}
function docRows(arr,type){return arr.length?arr.map(x=>`<tr><td>${esc(x.numero)}</td><td>${esc(x.fecha)}</td><td>${esc(x.clienteNombre)}</td><td>${money(x.total)}</td><td><span class="status ${x.estado==='pagada'||x.estado==='aceptada'?'ok':x.estado==='anulada'||x.estado==='rechazada'?'off':''}">${esc(x.estado)}</span></td><td class="actions"><button class="mini" data-edit-${type}="${x.id}">Editar</button><button class="mini" data-print="${type}:${x.id}">Imprimir</button><button class="mini danger" data-del-${type}="${x.id}">Eliminar</button></td></tr>`).join(''):'<tr><td colspan="6" class="empty">No hay documentos.</td></tr>'}
function quotes(){return `<div class="page"><div class="toolbar"><button class="btn" id="newQuote">+ Nueva cotización</button></div><div class="panel tablewrap"><table class="table"><thead><tr><th>Número</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${docRows(db.cotizaciones,'quote')}</tbody></table></div></div>`}
function invoices(){return `<div class="page"><div class="toolbar"><button class="btn" id="newInvoice">+ Nueva factura</button></div><div class="panel tablewrap"><table class="table"><thead><tr><th>Número</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${docRows(db.facturas,'invoice')}</tbody></table></div></div>`}
function reports(){let sales=db.facturas.reduce((a,x)=>a+(+x.total||0),0),quotes=db.cotizaciones.reduce((a,x)=>a+(+x.total||0),0),accepted=db.cotizaciones.filter(x=>x.estado==='aceptada').length,low=db.inventario.filter(x=>(+x.stock||0)<=(+x.min||0));let byClient={};db.facturas.forEach(x=>byClient[x.clienteNombre]=(byClient[x.clienteNombre]||0)+(+x.total||0));let top=Object.entries(byClient).sort((a,b)=>b[1]-a[1]).slice(0,8);return `<div class="page"><div class="toolbar"><button class="btn secondary" onclick="window.print()">Imprimir reporte</button></div><div class="cards"><div class="card"><div class="kpi">Ventas facturadas</div><div class="num">${money(sales)}</div></div><div class="card"><div class="kpi">Cotizado</div><div class="num">${money(quotes)}</div></div><div class="card"><div class="kpi">Cotizaciones aceptadas</div><div class="num">${accepted}</div></div><div class="card"><div class="kpi">Alertas de inventario</div><div class="num">${low.length}</div></div></div><div class="grid2" style="margin-top:18px"><div class="panel report-card"><h3>Ventas por cliente</h3>${top.length?top.map(([n,v])=>`<div class="setting-row"><span>${esc(n)}</span><b>${money(v)}</b></div>`).join(''):'<div class="empty">Sin ventas.</div>'}</div><div class="panel report-card"><h3>Productos con stock bajo</h3>${low.length?low.map(x=>`<div class="setting-row"><span>${esc(x.nombre)} <span class="small">(${x.stock} ${esc(x.unidad)})</span></span><b>${x.min} mín.</b></div>`).join(''):'<div class="empty">Inventario saludable.</div>'}</div></div><div class="panel" style="margin-top:18px"><h3>Resumen de documentos</h3><div class="setting-row"><span>Facturas</span><b>${db.facturas.length}</b></div><div class="setting-row"><span>Cotizaciones</span><b>${db.cotizaciones.length}</b></div><div class="setting-row"><span>Clientes</span><b>${db.clientes.length}</b></div><div class="setting-row"><span>Productos</span><b>${db.inventario.length}</b></div></div></div>`}
function administration(){return `<div class="page"><div class="toolbar"><button class="btn" id="newUser">+ Nuevo usuario</button><button class="btn secondary" id="newRole">+ Nuevo rol</button></div><div class="grid2"><div class="panel tablewrap"><h3>Usuarios</h3><table class="table"><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${db.users.map(u=>`<tr><td>${esc(u.username)}</td><td>${esc(u.name)}</td><td>${esc(db.roles.find(r=>r.id===u.roleId)?.name||'—')}</td><td><span class="status ${u.active?'ok':'off'}">${u.active?'Activo':'Inactivo'}</span></td><td class="actions"><button class="mini" data-edit-user="${u.id}">Editar</button></td></tr>`).join('')}</tbody></table></div><div class="panel tablewrap"><h3>Roles y permisos</h3><table class="table"><thead><tr><th>Rol</th><th>Permisos</th><th>Acciones</th></tr></thead><tbody>${db.roles.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.permissions.includes('all')?'Todos':r.permissions.join(', ')}</td><td><button class="mini" data-edit-role="${r.id}">Editar</button></td></tr>`).join('')}</tbody></table></div></div></div>`}
function settings(){let c=db.config;return `<div class="page"><div class="panel"><h2>Configuración general</h2><p class="small">Estos datos se utilizan en los documentos impresos.</p><form id="settingsForm"><div class="formgrid"><div class="field"><label>Empresa</label><input name="empresa" value="${esc(c.empresa)}"></div><div class="field"><label>NIT</label><input name="nit" value="${esc(c.nit)}"></div><div class="field"><label>Teléfono</label><input name="telefono" value="${esc(c.telefono)}"></div><div class="field"><label>Correo</label><input name="email" value="${esc(c.email)}"></div><div class="field"><label>IVA (%)</label><input name="iva" type="number" value="${c.iva}"></div><div class="field"><label>Moneda</label><select name="moneda"><option ${c.moneda==='COP'?'selected':''}>COP</option><option ${c.moneda==='USD'?'selected':''}>USD</option></select></div><div class="field"><label>Prefijo cotizaciones</label><input name="prefijoCot" value="${esc(c.prefijoCot)}"></div><div class="field"><label>Prefijo facturas</label><input name="prefijoFac" value="${esc(c.prefijoFac)}"></div></div><div class="modalfoot"><button class="btn">Guardar configuración</button></div></form></div></div>`}
function modal(title,html){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=html;$('#modal').classList.add('show')}
function close(){ $('#modal').classList.remove('show') }
function clientForm(item={}){modal(item.id?'Editar cliente':'Nuevo cliente',`<form id="clientForm"><div class="formgrid"><div class="field"><label>Nombre / Empresa *</label><input name="nombre" required value="${esc(item.nombre)}"></div><div class="field"><label>NIT / Cédula</label><input name="doc" value="${esc(item.doc)}"></div><div class="field"><label>Teléfono</label><input name="telefono" value="${esc(item.telefono)}"></div><div class="field"><label>Correo</label><input name="email" value="${esc(item.email)}"></div><div class="field full"><label>Dirección</label><input name="direccion" value="${esc(item.direccion)}"></div></div><div class="modalfoot"><button type="button" class="btn secondary" id="cancel">Cancelar</button><button class="btn">Guardar</button></div></form>`);$('#clientForm').onsubmit=e=>{e.preventDefault();let d=Object.fromEntries(new FormData(e.target));if(item.id)Object.assign(item,d);else db.clientes.push({id:'CLI-'+Date.now(),...d});save();close();render('clientes')}}

function productForm(item={}){
 modal(item.id?'Editar producto':'Nuevo producto',`
 <form id="productForm">
  <div class="formgrid">
   <div class="field"><label>Código</label><input name="codigo" readonly value="${esc(item.codigo||'')}"><small class="small">${item.id?'Código existente.':'Se genera automáticamente en Supabase.'}</small></div>
   <div class="field"><label>Tipo *</label><select name="tipo" required>
     <option value="producto" ${String(item.tipo||'producto').toLowerCase()==='producto'?'selected':''}>Producto / material</option>
     <option value="servicio" ${String(item.tipo||'').toLowerCase()==='servicio'?'selected':''}>Servicio</option>
   </select></div>
   <div class="field"><label>Nombre *</label><input name="nombre" required value="${esc(item.nombre)}"></div>
   <div class="field"><label>Unidad *</label><select name="unidad">${['unidad','metro','rollo','kit','kg','litro','hora','servicio'].map(x=>`<option ${x===(item.unidad||'unidad')?'selected':''}>${x}</option>`).join('')}</select></div>
   <div class="field"><label>Stock actual</label><input name="stock" type="number" min="0" step="0.01" value="${item.stock??0}"></div>
   <div class="field"><label>Stock mínimo</label><input name="min" type="number" min="0" step="0.01" value="${item.min??0}"></div>
   <div class="field"><label>Precio compra</label><input name="costo" type="number" min="0" step="0.01" value="${item.costo??0}"></div>
   <div class="field"><label>Precio venta</label><input name="precio" type="number" min="0" step="0.01" value="${item.precio??0}"></div>
   <div class="field full"><label>Descripción</label><textarea name="descripcion">${esc(item.descripcion)}</textarea></div>
  </div>
  <div class="modalfoot"><button type="button" class="btn secondary" id="cancel">Cancelar</button><button class="btn">Guardar</button></div>
 </form>`);
 $('#productForm').onsubmit=async e=>{
   e.preventDefault();
   const btn=e.target.querySelector('button[type=submit]');
   btn.disabled=true; btn.textContent='Guardando...';
   try{
     const d=Object.fromEntries(new FormData(e.target));
     const payload={
       tipo:d.tipo,nombre:d.nombre.trim(),descripcion:d.descripcion||null,
       unidad:d.unidad||'unidad',precio_compra:Number(d.costo)||0,precio_venta:Number(d.precio)||0,
       stock_actual:Number(d.stock)||0,stock_minimo:Number(d.min)||0
     };
     if(!payload.nombre) throw new Error('El nombre es obligatorio.');
     if(item.id){
       const {data,error}=await snicSupabase.from('productos').update(payload).eq('id',item.id).select().single();
       if(error) throw error;
     }else{
       const {data,error}=await snicSupabase.rpc('crear_producto_inventario',{
         p_tipo:payload.tipo,p_nombre:payload.nombre,p_descripcion:payload.descripcion,
         p_categoria_id:null,p_unidad:payload.unidad,p_precio_compra:payload.precio_compra,
         p_precio_venta:payload.precio_venta,p_stock_actual:payload.stock_actual,p_stock_minimo:payload.stock_minimo
       });
       if(error) throw error;
     }
     await loadInventoryFromSupabase();
     close();render('inventario');
   }catch(err){
     alert('No se pudo guardar el artículo: '+err.message);
     btn.disabled=false;btn.textContent='Guardar';
   }
 };
}
async function detectColumns(table,candidates){
 if(window.__snicCols?.[table]) return window.__snicCols[table];
 window.__snicCols??={};
 const found=[];
 for(const col of candidates){
   try{
     const {error}=await snicSupabase.from(table).select(col).limit(1);
     if(!error) found.push(col);
   }catch(e){}
 }
 window.__snicCols[table]=found;
 return found;
}
function pickColumn(cols,names){return names.find(n=>cols.includes(n))||null}
function setIf(obj,cols,names,value){const c=pickColumn(cols,names);if(c!==null && value!==undefined)obj[c]=value;return c}
async function nextDocumentNumber(type){
 const table=type==='quote'?'cotizaciones':'facturas',prefix=type==='quote'?(db.config.prefijoCot||'COT'):(db.config.prefijoFac||'FAC');
 try{
   const {data,error}=await snicSupabase.from(table).select('*').order('created_at',{ascending:false}).limit(50);
   if(!error && data?.length){
     const numCol=Object.keys(data[0]).find(k=>['numero','numero_documento','codigo'].includes(k));
     const nums=data.map(x=>String(numCol?x[numCol]:'')).map(x=>{const m=x.match(/(\d+)$/);return m?Number(m[1]):0}).filter(Boolean);
     const n=(nums.length?Math.max(...nums):0)+1;
     return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(4,'0')}`;
   }
 }catch(e){}
 return `${prefix}-${new Date().getFullYear()}-0001`;
}
async function loadDocumentsFromSupabase(type){
 const table=type==='quote'?'cotizaciones':'facturas', detailTable=type==='quote'?'cotizacion_detalles':'factura_detalles';
 const {data,error}=await snicSupabase.from(table).select('*').order('created_at',{ascending:false});
 if(error) throw error;
 const details=await snicSupabase.from(detailTable).select('*');
 if(details.error) throw details.error;
 const rows=data||[], ds=details.data||[];
 const idCol='id';
 const clienteCol=rows[0]?pickColumn(Object.keys(rows[0]),['cliente_id','clienteId','id_cliente']):'cliente_id';
 const clienteMap=new Map(db.clientes.map(c=>[String(c.id),c]));
 const detailFk=ds[0]?pickColumn(Object.keys(ds[0]),type==='quote'?['cotizacion_id','cotizacionId','documento_id']:['factura_id','facturaId','documento_id']):null;
 const productCol=ds[0]?pickColumn(Object.keys(ds[0]),['producto_id','product_id','productoId']):null;
 const descCol=ds[0]?pickColumn(Object.keys(ds[0]),['descripcion','detalle','concepto','nombre']):null;
 const qtyCol=ds[0]?pickColumn(Object.keys(ds[0]),['cantidad','qty']):null;
 const priceCol=ds[0]?pickColumn(Object.keys(ds[0]),['precio_unitario','precio','valor_unitario','price']):null;
 const subCol=ds[0]?pickColumn(Object.keys(ds[0]),['subtotal','importe','valor']):null;
 const itemsByDoc=new Map();
 for(const d of ds){const k=detailFk?String(d[detailFk]):'';if(!itemsByDoc.has(k))itemsByDoc.set(k,[]);itemsByDoc.get(k).push({productId:productCol?d[productCol]||'':'',desc:descCol?d[descCol]||'':'',qty:Number(qtyCol?d[qtyCol]:1)||1,price:Number(priceCol?d[priceCol]:0)||0,subtotal:Number(subCol?d[subCol]:0)||0,unit:''})}
 const normalized=rows.map(x=>{
   const keys=Object.keys(x); const get=(names,def='')=>{const c=pickColumn(keys,names);return c?x[c]??def:def};
   const clienteId=get(['cliente_id','clienteId','id_cliente'],null); const c=clienteMap.get(String(clienteId));
   return {id:x[idCol],numero:get(['numero','numero_documento','codigo']),fecha:get(['fecha','fecha_emision','created_at']),clienteId,clienteNombre:c?.nombre||get(['cliente_nombre','razon_social']),validez:get(['validez','fecha_validez','valida_hasta']),vencimiento:get(['vencimiento','fecha_vencimiento']),estado:get(['estado','status'],'pendiente'),tax:Number(get(['impuesto_porcentaje','porcentaje_impuesto','iva','tax'],0))||0,discountType:get(['tipo_descuento','discount_type'],'percent'),discountValue:Number(get(['valor_descuento','descuento_valor','discount_value'],0))||0,subtotal:Number(get(['subtotal'],0))||0,discount:Number(get(['descuento','valor_descuento_total'],0))||0,base:Number(get(['base_gravable','base'],0))||0,taxAmount:Number(get(['impuesto','impuesto_total','tax_amount'],0))||0,total:Number(get(['total','total_documento'],0))||0,items:itemsByDoc.get(String(x[idCol]))||[]};
 });
 if(type==='quote')db.cotizaciones=normalized;else db.facturas=normalized;save();return normalized;
}
async function saveDocumentToSupabase(type,d,item={}){
 const table=type==='quote'?'cotizaciones':'facturas', detailTable=type==='quote'?'cotizacion_detalles':'factura_detalles';
 const candidatesMain=['id','numero','numero_documento','fecha','fecha_emision','cliente_id','clienteId','id_cliente','validez','fecha_validez','valida_hasta','vencimiento','fecha_vencimiento','estado','status','subtotal','descuento','valor_descuento_total','base_gravable','base','impuesto','impuesto_total','impuesto_porcentaje','porcentaje_impuesto','iva','tax','total','total_documento','tipo_descuento','discount_type','valor_descuento','descuento_valor','discount_value','creado_por','created_by','usuario_id','created_at','updated_at'];
 const cols=await detectColumns(table,candidatesMain); const payload={};
 setIf(payload,cols,['numero','numero_documento'],d.numero);setIf(payload,cols,['fecha','fecha_emision'],d.fecha);setIf(payload,cols,['cliente_id','clienteId','id_cliente'],d.clienteId);setIf(payload,cols,type==='quote'?['validez','fecha_validez','valida_hasta']:['vencimiento','fecha_vencimiento'],type==='quote'?d.validez:d.vencimiento);setIf(payload,cols,['estado','status'],d.estado);setIf(payload,cols,['subtotal'],d.subtotal);setIf(payload,cols,['descuento','valor_descuento_total'],d.discount);setIf(payload,cols,['base_gravable','base'],d.base);setIf(payload,cols,['impuesto','impuesto_total','tax_amount'],d.taxAmount);setIf(payload,cols,['impuesto_porcentaje','porcentaje_impuesto','iva','tax'],d.tax);setIf(payload,cols,['total','total_documento'],d.total);setIf(payload,cols,['tipo_descuento','discount_type'],d.discountType);setIf(payload,cols,['valor_descuento','descuento_valor','discount_value'],d.discountValue);setIf(payload,cols,['creado_por','created_by','usuario_id'],user.id);setIf(payload,cols,['updated_at'],new Date().toISOString());
 let saved;
 if(item.id){const r=await snicSupabase.from(table).update(payload).eq('id',item.id).select().single();if(r.error)throw r.error;saved=r.data;const {error:de}=await snicSupabase.from(detailTable).delete().eq(type==='quote'?'cotizacion_id':'factura_id',item.id);if(de)throw de;}else{const r=await snicSupabase.from(table).insert(payload).select().single();if(r.error)throw r.error;saved=r.data;}
 const docId=saved.id; const candidatesDet=['id','cotizacion_id','cotizacionId','factura_id','facturaId','documento_id','producto_id','product_id','productoId','descripcion','detalle','concepto','cantidad','qty','precio_unitario','precio','valor_unitario','price','subtotal','importe','valor','unidad'];
 const dcols=await detectColumns(detailTable,candidatesDet); const fk=pickColumn(dcols,type==='quote'?['cotizacion_id','cotizacionId','documento_id']:['factura_id','facturaId','documento_id']);
 for(const line of d.items){const lp={};setIf(lp,dcols,[fk],docId);setIf(lp,dcols,['producto_id','product_id','productoId'],line.productId||null);setIf(lp,dcols,['descripcion','detalle','concepto','nombre'],line.desc||'');setIf(lp,dcols,['cantidad','qty'],Number(line.qty)||0);setIf(lp,dcols,['precio_unitario','precio','valor_unitario','price'],Number(line.price)||0);setIf(lp,dcols,['subtotal','importe','valor'],(Number(line.qty)||0)*(Number(line.price)||0));setIf(lp,dcols,['unidad'],line.unit||null);const r=await snicSupabase.from(detailTable).insert(lp);if(r.error)throw r.error;}
 return saved;
}
function docForm(type,item={}){
 const q=type==='quote'; let items=JSON.parse(JSON.stringify(item.items||[{productId:'',desc:'',qty:1,price:0,unit:''}]));
 const title=item.id?(q?'Editar cotización':'Editar factura'):(q?'Nueva cotización':'Nueva factura');
 modal(title,`<form id="docForm"><div class="formgrid"><div class="field"><label>Número</label><input name="numero" id="docNumber" required value="${esc(item.numero||'')}" ${item.id?'':'readonly'}></div><div class="field"><label>Fecha</label><input name="fecha" type="date" required value="${item.fecha||today()}"></div><div class="field"><label>Cliente</label><select name="clienteId" required><option value="">Seleccione...</option>${db.clientes.map(c=>`<option value="${c.id}" ${String(c.id)===String(item.clienteId)?'selected':''}>${esc(c.nombre)} · ${esc(c.doc)}</option>`).join('')}</select></div><div class="field"><label>${q?'Válida hasta':'Vencimiento'}</label><input name="${q?'validez':'vencimiento'}" type="date" value="${item.validez||item.vencimiento||today()}"></div><div class="field"><label>Estado</label><select name="estado">${(q?['pendiente','aceptada','rechazada']:['pendiente','pagada','anulada']).map(s=>`<option ${s===(item.estado||'pendiente')?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label>Impuesto (%)</label><input id="docTax" name="tax" type="number" min="0" step="0.01" value="${item.tax??db.config.iva??19}"></div><div class="field"><label>Descuento</label><select id="discountType" name="discountType"><option value="percent" ${((item.discountType||'percent')==='percent')?'selected':''}>Porcentaje (%)</option><option value="amount" ${item.discountType==='amount'?'selected':''}>Valor fijo ($)</option></select></div><div class="field"><label>Valor del descuento</label><input id="discountValue" name="discountValue" type="number" min="0" step="0.01" value="${item.discountValue??0}"></div></div><div class="items"><h3>Productos / servicios del inventario</h3><table class="table"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio venta</th><th>Subtotal</th><th></th></tr></thead><tbody id="docItems"></tbody></table><button type="button" class="btn secondary" id="addDocItem">+ Agregar línea</button></div><div class="totalbox">Subtotal: <b id="docSub">$0</b><br>Descuento: <b id="docDiscount">$0</b><br>Base gravable: <b id="docBase">$0</b><br>Impuesto: <b id="docTaxTotal">$0</b><br><strong>Total: <span id="docTotal">$0</span></strong></div><div class="modalfoot"><button type="button" class="btn secondary" id="cancel">Cancelar</button><button class="btn" id="saveDoc">Guardar documento</button></div></form>`);
 const productOptions=selected=>`<option value="">Manual / servicio</option>${db.inventario.map(p=>`<option value="${p.id}" ${String(p.id)===String(selected)?'selected':''}>${esc(p.codigo)} · ${esc(p.nombre)} · ${money(p.precio)} · stock ${p.stock} ${esc(p.unidad||'')}</option>`).join('')}`;
 function calc(){const sub=items.reduce((a,x)=>a+(Number(x.qty)||0)*(Number(x.price)||0),0),dv=Math.max(0,Number($('#discountValue')?.value)||0),discount=$('#discountType')?.value==='amount'?Math.min(dv,sub):Math.min(sub,sub*dv/100),base=sub-discount,taxRate=Number($('#docTax')?.value)||0,tax=base*taxRate/100,total=base+tax;$('#docSub').textContent=money(sub);$('#docDiscount').textContent=money(discount);$('#docBase').textContent=money(base);$('#docTaxTotal').textContent=money(tax);$('#docTotal').textContent=money(total);return{subtotal:sub,discount,base,tax,total,taxRate};}
 function draw(){ $('#docItems').innerHTML=items.map((x,i)=>{const p=x.productId?db.inventario.find(p=>String(p.id)===String(x.productId)):null;if(p){x.desc=p.nombre;x.unit=p.unidad||'unidad';x.price=Number(p.precio)||0}return `<tr><td><select data-i="${i}" data-k="productId" class="doc-product">${productOptions(x.productId)}</select><input data-i="${i}" data-k="desc" value="${esc(x.desc)}" placeholder="Descripción" ${p?'readonly':''}>${p?`<small class="stock-info">Precio: ${money(p.precio)} · Stock: ${p.stock} ${esc(p.unidad||'')}</small>`:''}</td><td><input data-i="${i}" data-k="qty" type="number" min="0.01" step="0.01" value="${x.qty||1}"></td><td><input data-i="${i}" data-k="price" type="number" min="0" step="0.01" value="${x.price||0}" ${p?'readonly':''}></td><td>${money((Number(x.qty)||0)*(Number(x.price)||0))}</td><td><button type="button" class="mini danger" data-remove="${i}">×</button></td></tr>`}).join('');calc();}
 draw();
 if(!item.id)nextDocumentNumber(type).then(n=>{const el=$('#docNumber');if(el)el.value=n});
 $('#addDocItem').onclick=()=>{items.push({productId:'',desc:'',qty:1,price:0,unit:''});draw()};['docTax','discountType','discountValue'].forEach(id=>{$('#'+id)?.addEventListener('input',calc);$('#'+id)?.addEventListener('change',calc)});
 $('#docItems').addEventListener('change',e=>{const i=e.target.dataset.i,k=e.target.dataset.k;if(i===undefined)return;if(k==='productId'){const p=db.inventario.find(x=>String(x.id)===String(e.target.value));items[+i]=p?{productId:p.id,desc:p.nombre,qty:items[+i].qty||1,price:Number(p.precio)||0,unit:p.unidad||'unidad'}:{productId:'',desc:'',qty:1,price:0,unit:''};draw()}});
 $('#docItems').addEventListener('input',e=>{const i=e.target.dataset.i,k=e.target.dataset.k;if(i===undefined)return;if(k==='price'&&items[+i].productId)return;items[+i][k]=k==='desc'?e.target.value:Number(e.target.value)||0;draw()});
 $('#docItems').addEventListener('click',e=>{if(e.target.dataset.remove!==undefined){items.splice(+e.target.dataset.remove,1);if(!items.length)items.push({productId:'',desc:'',qty:1,price:0,unit:''});draw()}});
 $('#docForm').onsubmit=async e=>{e.preventDefault();const btn=$('#saveDoc');btn.disabled=true;btn.textContent='Guardando...';try{const d=Object.fromEntries(new FormData(e.target));const c=db.clientes.find(x=>String(x.id)===String(d.clienteId));if(!c)throw new Error('Selecciona un cliente registrado.');d.clienteNombre=c.nombre;d.items=items;const t=calc();d.tax=t.taxRate;d.discountType=d.discountType||'percent';d.discountValue=Math.max(0,Number(d.discountValue)||0);d.subtotal=t.subtotal;d.discount=t.discount;d.base=t.base;d.taxAmount=t.tax;d.total=t.total;const saved=await saveDocumentToSupabase(type,d,item);const normalized={...d,id:saved.id,numero:saved.numero||saved.numero_documento||d.numero};if(q){const i=db.cotizaciones.findIndex(x=>x.id===item.id);if(i>=0)db.cotizaciones[i]=normalized;else db.cotizaciones.unshift(normalized)}else{const i=db.facturas.findIndex(x=>x.id===item.id);if(i>=0)db.facturas[i]=normalized;else db.facturas.unshift(normalized)}save();close();await loadDocumentsFromSupabase(type);render(q?'cotizaciones':'facturas')}catch(err){alert('No se pudo guardar: '+err.message);btn.disabled=false;btn.textContent='Guardar documento'}};
}

let adminState={profiles:[],roles:[],permissions:[],rolePermissions:[]};
async function loadAdministrationFromSupabase(){
 const [pr,rr,pe,rp]=await Promise.all([
  snicSupabase.from('perfiles').select('*').order('email'),
  snicSupabase.from('roles').select('*').order('nombre'),
  snicSupabase.from('permisos').select('*').order('nombre'),
  snicSupabase.from('rol_permisos').select('*')
 ]);
 for(const r of [pr,rr,pe,rp])if(r.error)throw r.error;
 adminState={profiles:pr.data||[],roles:rr.data||[],permissions:pe.data||[],rolePermissions:rp.data||[]};return adminState;
}
function administration(){
 const roleName=r=>adminState.roles.find(x=>x.id===r)?.nombre||'—';
 const permsFor=rid=>adminState.rolePermissions.filter(x=>x.rol_id===rid).map(x=>adminState.permissions.find(p=>p.id===x.permiso_id)).filter(Boolean).map(p=>p.nombre||p.codigo).join(', ');
 return `<div class="page"><div class="toolbar"><button class="btn" id="refreshAdmin">↻ Actualizar</button><button class="btn secondary" id="newRole">+ Nuevo rol</button></div><div class="panel" style="margin-bottom:18px"><h3>Usuarios y roles</h3><p class="small">Esta sección está conectada directamente con Supabase. El rol se toma de <b>perfiles → roles</b>; los permisos se toman de <b>rol_permisos</b>.</p></div><div class="grid2"><div class="panel tablewrap"><h3>Usuarios</h3><table class="table"><thead><tr><th>Correo</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${adminState.profiles.length?adminState.profiles.map(u=>`<tr><td>${esc(u.email||'')}</td><td>${esc([u.nombre,u.apellido].filter(Boolean).join(' ')||'—')}</td><td>${esc(roleName(u.rol_id))}</td><td><span class="status ${u.activo!==false?'ok':'off'}">${u.activo!==false?'Activo':'Inactivo'}</span></td><td class="actions"><button class="mini" data-edit-profile="${u.id}">Editar</button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No hay perfiles registrados.</td></tr>'}</tbody></table></div><div class="panel tablewrap"><h3>Roles y permisos</h3><table class="table"><thead><tr><th>Rol</th><th>Permisos</th><th>Acciones</th></tr></thead><tbody>${adminState.roles.length?adminState.roles.map(r=>`<tr><td>${esc(r.nombre)}</td><td>${esc(permsFor(r.id)||'Sin permisos')}</td><td><button class="mini" data-edit-role="${r.id}">Editar</button></td></tr>`).join(''):'<tr><td colspan="3" class="empty">No hay roles registrados.</td></tr>'}</tbody></table></div></div></div>`;
}
function userForm(item={}){
 const roles=adminState.roles;modal('Editar usuario',`<form id="profileForm"><div class="formgrid"><div class="field"><label>Nombre</label><input name="nombre" required value="${esc(item.nombre||'')}"></div><div class="field"><label>Apellido</label><input name="apellido" value="${esc(item.apellido||'')}"></div><div class="field"><label>Documento</label><input name="documento" value="${esc(item.documento||'')}"></div><div class="field"><label>Teléfono</label><input name="telefono" value="${esc(item.telefono||'')}"></div><div class="field"><label>Correo</label><input name="email" type="email" value="${esc(item.email||'')}"></div><div class="field"><label>Rol</label><select name="rol_id">${roles.map(r=>`<option value="${r.id}" ${r.id===item.rol_id?'selected':''}>${esc(r.nombre)}</option>`).join('')}</select></div><div class="field"><label>Estado</label><select name="activo"><option value="true" ${item.activo!==false?'selected':''}>Activo</option><option value="false" ${item.activo===false?'selected':''}>Inactivo</option></select></div></div><div class="modalfoot"><button type="button" class="btn secondary" id="cancel">Cancelar</button><button class="btn">Guardar</button></div></form>`);$('#profileForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));d.activo=d.activo==='true';try{const {error}=await snicSupabase.from('perfiles').update(d).eq('id',item.id);if(error)throw error;close();await loadAdministrationFromSupabase();render('administracion')}catch(err){alert('No se pudo actualizar el usuario: '+err.message)}}}
const perms=['dashboard','clientes','inventario','cotizaciones','facturas','reportes','administracion','configuracion','ordenes','inspecciones','informes','trimestrales'];
const labels={dashboard:'Dashboard',clientes:'Clientes',inventario:'Inventario',cotizaciones:'Cotizaciones',facturas:'Facturas',reportes:'Reportes',administracion:'Administración',configuracion:'Configuración',ordenes:'Órdenes de servicio',inspecciones:'Inspecciones',informes:'Informes de trabajo en obra',trimestrales:'Informes trimestrales'};
function roleForm(item={}){const selected=new Set(adminState.rolePermissions.filter(x=>x.rol_id===item.id).map(x=>x.permiso_id));const codeOf=p=>String(p.codigo||p.nombre||'').toLowerCase().replace(/\s+/g,'_');modal(item.id?'Editar rol':'Nuevo rol',`<form id="roleForm"><div class="formgrid"><div class="field full"><label>Nombre del rol</label><input name="nombre" required value="${esc(item.nombre||'')}"></div><div class="field full"><label>Permisos del rol</label><div class="permission-grid">${adminState.permissions.map(p=>`<label class="check"><input type="checkbox" name="perm" value="${p.id}" ${selected.has(p.id)?'checked':''}> ${esc(p.nombre||p.codigo||'Permiso')}</label>`).join('')}</div></div></div><div class="modalfoot"><button type="button" class="btn secondary" id="cancel">Cancelar</button><button class="btn">Guardar rol</button></div></form>`);$('#roleForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{let rid=item.id;if(rid){const r=await snicSupabase.from('roles').update({nombre:d.nombre}).eq('id',rid);if(r.error)throw r.error}else{const r=await snicSupabase.from('roles').insert({nombre:d.nombre}).select().single();if(r.error)throw r.error;rid=r.data.id}const ids=[...e.target.querySelectorAll('input[name=perm]:checked')].map(x=>x.value);const del=await snicSupabase.from('rol_permisos').delete().eq('rol_id',rid);if(del.error)throw del.error;if(ids.length){const ins=await snicSupabase.from('rol_permisos').insert(ids.map(id=>({rol_id:rid,permiso_id:id})));if(ins.error)throw ins.error}close();await loadAdministrationFromSupabase();render('administracion')}catch(err){alert('No se pudo guardar el rol: '+err.message)}}}
function printDoc(type,id){
 let arr=type==='quote'?db.cotizaciones:db.facturas,x=arr.find(a=>a.id===id);
 if(!x)return;
 let rows=x.items.map(i=>`<tr><td>${esc(i.desc)}</td><td>${i.qty}</td><td>${money(i.price)}</td><td>${money((+i.qty||0)*(+i.price||0))}</td></tr>`).join('');
 const subtotal=Number(x.subtotal)||0;
 const discount=Number(x.discount??0)||0;
 const base=Number(x.base??(subtotal-discount))||0;
 const taxAmount=Number(x.taxAmount??((Number(x.total)||0)-base))||0;
 const total=Number(x.total)||0;
 const discountLabel=x.discountType==='amount'
   ? 'Descuento'
   : `Descuento (${Number(x.discountValue)||0}%)`;
 let w=open('','_blank');
 w.document.write(`<html><head><title>${esc(x.numero)}</title><style>
 body{font-family:Arial;margin:40px;color:#172033}
 header{display:flex;justify-content:space-between;border-bottom:2px solid #1677d2;padding-bottom:18px}
 h1{color:#1677d2}table{width:100%;border-collapse:collapse;margin-top:25px}
 th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}
 .total{text-align:right;margin-top:20px;font-size:17px;line-height:1.8}
 .discount{color:#b42318}
 </style></head><body>
 <header><div><h1>${esc(db.config.empresa)}</h1><p>NIT: ${esc(db.config.nit)} · ${esc(db.config.telefono)} · ${esc(db.config.email)}</p></div>
 <div><h2>${type==='quote'?'COTIZACIÓN':'FACTURA'}</h2><b>${esc(x.numero)}</b><p>Fecha: ${esc(x.fecha)}</p></div></header>
 <h3>Cliente</h3><p>${esc(x.clienteNombre)}</p>
 <table><tr><th>Descripción</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr>${rows}</table>
 <div class="total">
 Subtotal: ${money(subtotal)}<br>
 <span class="discount">${discountLabel}: -${money(discount)}</span><br>
 Base gravable: ${money(base)}<br>
 Impuesto (${Number(x.tax)||0}%): ${money(taxAmount)}<br>
 <b>Total: ${money(total)}</b>
 </div>
 <script>onload=()=>print()<\/script></body></html>`);
 w.document.close()
}
function bind(v){
 $('#cancel')?.addEventListener('click',close);$('#newClient')?.addEventListener('click',()=>clientForm());$('#newProduct')?.addEventListener('click',()=>productForm());$('#newQuote')?.addEventListener('click',()=>db.clientes.length?docForm('quote'):alert('Primero crea un cliente.'));$('#newInvoice')?.addEventListener('click',()=>db.clientes.length?docForm('invoice'):alert('Primero crea un cliente.'));
 $$('[data-edit-client]').forEach(b=>b.onclick=()=>clientForm(db.clientes.find(x=>x.id===b.dataset.editClient)));$$('[data-del-client]').forEach(b=>b.onclick=()=>{if(confirm('¿Eliminar cliente?')){db.clientes=db.clientes.filter(x=>x.id!==b.dataset.delClient);save();render(v)}});
 $$('[data-edit-product]').forEach(b=>b.onclick=()=>productForm(db.inventario.find(x=>x.id===b.dataset.editProduct)));
 $$('[data-del-product]').forEach(b=>b.onclick=async()=>{if(!confirm('¿Eliminar este artículo del inventario?'))return;try{await deleteInventoryFromSupabase(b.dataset.delProduct);await loadInventoryFromSupabase();render('inventario')}catch(e){alert('No se pudo eliminar: '+e.message)}});
 $$('[data-edit-quote]').forEach(b=>b.onclick=async()=>{const x=db.cotizaciones.find(x=>x.id===b.dataset.editQuote);if(x)docForm('quote',x)});
 $$('[data-del-quote]').forEach(b=>b.onclick=async()=>{if(!confirm('¿Eliminar cotización?'))return;try{await deleteDocumentFromSupabase('quote',b.dataset.delQuote);await loadDocumentsFromSupabase('quote');render('cotizaciones')}catch(e){alert('No se pudo eliminar: '+e.message)}});
 $$('[data-edit-invoice]').forEach(b=>b.onclick=async()=>{const x=db.facturas.find(x=>x.id===b.dataset.editInvoice);if(x)docForm('invoice',x)});
 $$('[data-del-invoice]').forEach(b=>b.onclick=async()=>{if(!confirm('¿Eliminar factura?'))return;try{await deleteDocumentFromSupabase('invoice',b.dataset.delInvoice);await loadDocumentsFromSupabase('invoice');render('facturas')}catch(e){alert('No se pudo eliminar: '+e.message)}});
 $$('[data-print]').forEach(b=>b.onclick=()=>{let [t,id]=b.dataset.print.split(':');printDoc(t,id)});
 $$('[data-edit-profile]').forEach(b=>b.onclick=()=>userForm(adminState.profiles.find(x=>x.id===b.dataset.editProfile)));
 $$('[data-edit-role]').forEach(b=>b.onclick=()=>roleForm(adminState.roles.find(x=>x.id===b.dataset.editRole)));
 $('#refreshAdmin')?.addEventListener('click',async()=>{try{await loadAdministrationFromSupabase();render('administracion')}catch(e){alert('No se pudo actualizar: '+e.message)}});
 $('#newRole')?.addEventListener('click',()=>roleCan('administracion')&&roleForm());
 $('#settingsForm')?.addEventListener('submit',e=>{e.preventDefault();let d=Object.fromEntries(new FormData(e.target));d.iva=+d.iva||0;db.config={...db.config,...d};save();alert('Configuración guardada.')});
}
async function deleteDocumentFromSupabase(type,id){const table=type==='quote'?'cotizaciones':'facturas',detailTable=type==='quote'?'cotizacion_detalles':'factura_detalles',fk=type==='quote'?'cotizacion_id':'factura_id';const {error:de}=await snicSupabase.from(detailTable).delete().eq(fk,id);if(de)throw de;const {error}=await snicSupabase.from(table).delete().eq('id',id);if(error)throw error}
function roleCan(v){if(!can(v)){alert('No tienes permiso.');return false}return true}
window._nav=nav;
$('#closeModal').onclick=close;$('#logout').onclick=()=>snicAuth.logout();$('#mobileMenu').onclick=()=>$('.sidebar').classList.toggle('open');
nav('inicio');
})();