const STORAGE_KEY="snic_inspections_v2", USERS_KEY="snic_users_v2", AUTH_KEY="snic_auth_v2";

function seedUsers(){
  if(localStorage.getItem(USERS_KEY)) return;
  localStorage.setItem(USERS_KEY,JSON.stringify([{
    id:"u-admin",fullName:"Administrador SNIC Electric",username:"admin",password:"123456",role:"admin",
    document:"",phone:"",email:"snicelectric@gmail.com",license:"",specialty:"Administrador"
  },{
    id:"u-demo",fullName:"Técnico de demostración",username:"tecnico",password:"123456",role:"tecnico",
    document:"1090000000",phone:"3000000000",email:"tecnico@snicelectric.com",license:"TP-00000",specialty:"Electricista residencial"
  }]));
}
function users(){seedUsers();return JSON.parse(localStorage.getItem(USERS_KEY)||"[]")}
function saveUsers(v){localStorage.setItem(USERS_KEY,JSON.stringify(v))}
function inspections(){return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")}
function snicDB(){
  try{return JSON.parse(localStorage.getItem("snic_db")||"{}")}catch(e){return {}}
}
function registeredClients(){
  const db=snicDB(); return Array.isArray(db.clientes)?db.clientes:[];
}
function clientField(c,names){
  for(const n of names){if(c&&c[n]!=null&&String(c[n]).trim()!=="")return c[n]}
  return "";
}
function setupInspectionClients(){
  const el=document.getElementById("clientName"); if(!el)return;
  const clients=registeredClients();
  el.innerHTML='<option value="">Seleccione un cliente registrado</option>'+
    clients.map(c=>{
      const id=clientField(c,["id","uid","document","doc","nit"]);
      const name=clientField(c,["nombre","name","razonSocial","razon_social"]);
      const doc=clientField(c,["doc","document","nit"]);
      return `<option value="${esc(name)}" data-client-id="${esc(id)}">${esc(name)}${doc?" — "+esc(doc):""}</option>`;
    }).join("");
  el.disabled=false;
  el.addEventListener("change",()=>{
    const opt=el.selectedOptions[0];
    const c=clients.find(x=>String(clientField(x,["id","uid","document","doc","nit"]))===String(opt?.dataset.clientId));
    if(!c)return;
    const map={
      phone:["telefono","phone","tel"],documentNumber:["doc","document","nit"],
      email:["email","correo"],address:["direccion","address"],city:["ciudad","city"]
    };
    Object.entries(map).forEach(([id,keys])=>{const e=document.getElementById(id);if(e)e.value=clientField(c,keys)});
    el.dataset.clientId=opt.dataset.clientId||"";
  });
  if(!clients.length){
    el.insertAdjacentHTML("afterend",'<small class="muted">No hay clientes registrados. Primero registre el cliente en Clientes.</small>');
  }
}

function saveInspections(v){localStorage.setItem(STORAGE_KEY,JSON.stringify(v))}
async function syncInspectionsFromSupabase(){
  const me=await snicAuth.user(); if(!me)return;
  let q=snicSupabase.from('inspecciones').select('*').order('fecha',{ascending:false});
  const role=await snicAuth.role().catch(()=>null); if(role==='Técnico') q=q.eq('tecnico_id',me.id);
  const {data,error}=await q; if(error) throw error;
  const clients=registeredClients(); const mapped=(data||[]).map(x=>{const c=clients.find(c=>String(c.id)===String(x.cliente_id));return {...x,id:x.id,formatNumber:String(x.numero||'').replace(/^.*?(\d+)$/,'$1').padStart(4,'0'),issueDate:x.fecha||'',clientId:x.cliente_id,clientName:c?.nombre||'Cliente',documentNumber:c?.doc||'',technicianId:x.tecnico_id,technicianName:me.id===x.tecnico_id?me.user_metadata?.full_name||me.email:'',generalObservations:x.observaciones||''}}); saveInspections(mapped); return mapped;
}

function currentUser(){
  const unified=JSON.parse(sessionStorage.getItem("snic_user")||"null");
  if(unified) return {id:unified.id,fullName:unified.name,username:"",role:unified.roleId||"tecnico",document:unified.document||"",phone:"",email:unified.email||"",license:"",specialty:""};
  return null;
}
function requireLogin(){if(!currentUser())location.href="login.html"}
function isAdmin(){return currentUser()?.role==="admin"||currentUser()?.roleId==="admin"}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function slug(s){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"_").toLowerCase()}

document.addEventListener("DOMContentLoaded",async()=>{
  try{await snicAuth.require(); await snicAuth.syncClientsToLocal()}catch(e){console.warn(e.message)}
  seedUsers();

  const protectedPage=document.getElementById("inspectionTable")||document.getElementById("inspectionForm")||document.getElementById("usersTable");
  if(protectedPage) requireLogin();
  document.querySelectorAll("#logoutBtn").forEach(b=>b.addEventListener("click",()=>{sessionStorage.removeItem("snic_user");sessionStorage.removeItem(AUTH_KEY);location.href="login.html"}));

  const me=currentUser();
  document.querySelectorAll("#loggedUser").forEach(x=>{if(me)x.textContent=`${me.fullName} · ${me.role==="admin"?"Administrador":"Técnico"}`});
  if(isAdmin()){document.querySelectorAll("#adminLink").forEach(x=>x.classList.remove("hidden"));document.querySelectorAll("#reportsLink").forEach(x=>x.classList.remove("hidden"));}

  if(document.getElementById("inspectionTable"))initList();
  if(document.getElementById("usersTable"))initUsers();
  if(document.getElementById("inspectionForm"))initForm();
  if(document.getElementById("technicianReportBody"))initReports();
});

const checklist=[
 ["ACOMETIDA",["Estado del conductor","Calibre adecuado","Protección mecánica"]],
 ["TABLERO",["Estado general","Etiquetado","Barra neutro","Barra tierra"]],
 ["PROTECCIONES",["Breaker","Diferencial","Puesta a tierra","Varilla","Continuidad","Conexiones"]],
 ["CIRCUITOS",["Toma corrientes","Interruptores","Iluminación","Cableado","Canalización"]],
 ["RIESGOS",["Conductores expuestos","Sobrecargas","Humedad","Riesgo de incendio"]]
];

async function initList(){
 try{await snicAuth.syncClientsToLocal();await syncInspectionsFromSupabase()}catch(e){console.warn("Supabase inspecciones:",e.message)}
 renderList();document.getElementById("searchInspections")?.addEventListener("input",renderList);
}
function renderList(){
 const tb=document.getElementById("inspectionTable"),empty=document.getElementById("emptyState");if(!tb)return;
 const q=(document.getElementById("searchInspections")?.value||"").toLowerCase();
 const arr=inspections().filter(x=>(x.clientName+" "+x.documentNumber+" "+x.technicianName).toLowerCase().includes(q));
 tb.innerHTML="";empty.classList.toggle("hidden",arr.length>0);
 arr.sort((a,b)=>(b.issueDate||"").localeCompare(a.issueDate||"")).forEach(x=>{
  const tr=document.createElement("tr");
  tr.innerHTML=`<td>FIE-${esc(x.formatNumber||"0000")}</td><td>${esc(x.clientName||"Sin cliente")}</td><td>${esc(x.issueDate||"")}</td><td>${esc(x.technicianName||"")}</td>
  <td><div class="table-actions"><button class="btn btn-primary" onclick="editInspection('${x.id}')">Editar</button><button class="btn btn-secondary" onclick="printInspection('${x.id}')">Imprimir</button><button class="btn btn-danger" onclick="deleteInspection('${x.id}')">Eliminar</button></div></td>`;
  tb.appendChild(tr);
 });
}
function editInspection(id){location.href="formulario.html?id="+encodeURIComponent(id)}
function printInspection(id){location.href="formulario.html?id="+encodeURIComponent(id)+"&print=1"}
async function deleteInspection(id){if(!confirm("¿Eliminar esta inspección?"))return;try{const r=await snicSupabase.from('inspecciones').delete().eq('id',id);if(r.error)throw r.error;saveInspections(inspections().filter(x=>x.id!==id));renderList()}catch(e){alert('No se pudo eliminar: '+e.message)}}

function initUsers(){
 if(!isAdmin()){location.href="inspecciones.html";return}
 renderUsers();
 document.getElementById("userForm").addEventListener("submit",saveUser);
 document.getElementById("cancelUserEdit").addEventListener("click",resetUserForm);
}
function renderUsers(){
 const tb=document.getElementById("usersTable");tb.innerHTML="";
 users().forEach(u=>{
  const tr=document.createElement("tr");
  tr.innerHTML=`<td>${esc(u.fullName)}</td><td>${esc(u.username)}</td><td><span class="role-badge">${u.role==="admin"?"Administrador":"Técnico"}</span></td>
  <td><div class="tech-mini">CC: ${esc(u.document||"—")}<br>Tel: ${esc(u.phone||"—")}<br>${esc(u.email||"—")}<br>${esc(u.license||"—")} · ${esc(u.specialty||"—")}</div></td>
  <td><div class="table-actions"><button class="btn btn-primary" onclick="editUser('${u.id}')">Editar</button>${u.id!=="u-admin"?`<button class="btn btn-danger" onclick="deleteUser('${u.id}')">Eliminar</button>`:""}</div></td>`;
  tb.appendChild(tr);
 });
}
function saveUser(e){
 e.preventDefault();
 const id=document.getElementById("userId").value||crypto.randomUUID(),arr=users(),existing=arr.findIndex(x=>x.id===id);
 const data={id,fullName:v("fullName"),username:v("userName"),password:v("userPassword"),role:v("userRole"),document:v("techDocument"),phone:v("techPhone"),email:v("techEmail"),license:v("techLicense"),specialty:v("techSpecialty")};
 if(!data.fullName||!data.username||!data.password){showUserMsg("Completa nombre, usuario y contraseña.","error");return}
 if(arr.some(x=>x.username===data.username&&x.id!==id)){showUserMsg("Ese nombre de usuario ya existe.","error");return}
 if(existing>=0)arr[existing]=data;else arr.push(data);saveUsers(arr);showUserMsg("Usuario guardado correctamente.","success");resetUserForm();renderUsers();
}
function editUser(id){
 const u=users().find(x=>x.id===id);if(!u)return;
 document.getElementById("userId").value=u.id;setv("fullName",u.fullName);setv("userName",u.username);setv("userPassword",u.password);setv("userRole",u.role);setv("techDocument",u.document);setv("techPhone",u.phone);setv("techEmail",u.email);setv("techLicense",u.license);setv("techSpecialty",u.specialty);document.getElementById("userFormTitle").textContent="Editar usuario";window.scrollTo({top:0,behavior:"smooth"});
}
function deleteUser(id){if(!confirm("¿Eliminar este usuario/técnico?"))return;saveUsers(users().filter(x=>x.id!==id));renderUsers()}
function resetUserForm(){document.getElementById("userForm").reset();document.getElementById("userId").value="";document.getElementById("userFormTitle").textContent="Nuevo usuario"}
function showUserMsg(t,type){const b=document.getElementById("userMessage");b.textContent=t;b.className="alert "+type}
function v(id){return document.getElementById(id).value.trim()}function setv(id,val){document.getElementById(id).value=val||""}

function initForm(){
 setupInspectionClients();
 buildChecklist();buildPhotos();
 const p=new URLSearchParams(location.search),id=p.get("id"),me=currentUser();
 document.getElementById("issueDate").value=new Date().toISOString().slice(0,10);
 document.getElementById("formatNumber").value=nextNumber();
 fillTechnician(me);
 if(id){const item=inspections().find(x=>x.id===id);if(item){loadForm(item);document.getElementById("formTitle").textContent="Editar inspección"}}
 document.getElementById("inspectionForm").addEventListener("submit",saveForm);document.getElementById("printBtn").addEventListener("click",()=>window.print());
 if(p.get("print")==="1")setTimeout(()=>window.print(),600);
}
function fillTechnician(u){
 if(!u)return;
 setv("technicianName",u.fullName);setv("technicianDocument",u.document);setv("technicianPhone",u.phone);setv("technicianEmail",u.email);setv("technicianLicense",u.license);setv("technicianSpecialty",u.specialty);
}
function nextNumber(){const n=inspections().map(x=>parseInt(x.formatNumber,10)).filter(Number.isFinite);return String((n.length?Math.max(...n):0)+1).padStart(4,"0")}
function buildChecklist(){
 const b=document.getElementById("checklistBody");b.innerHTML="";
 checklist.forEach(([cat,items])=>{b.insertAdjacentHTML("beforeend",`<tr class="category"><td colspan="4">${cat}</td></tr>`);items.forEach(name=>{const k=slug(cat+"_"+name);b.insertAdjacentHTML("beforeend",`<tr><td>${name}</td><td class="check-cell"><input type="radio" name="${k}" value="cumple"></td><td class="check-cell"><input type="radio" name="${k}" value="no_cumple"></td><td><input type="text" data-observation="${k}"></td></tr>`)})});
}
function buildPhotos(){
 const g=document.getElementById("photosGrid");g.innerHTML="";
 for(let i=1;i<=6;i++){g.insertAdjacentHTML("beforeend",`<div class="photo-card" data-photo="${i}"><label for="photo${i}"><span>FOTO ${i}<br><small>📷 Tocar para cámara</small></span></label><input id="photo${i}" type="file" accept="image/*" capture="environment"><button type="button" class="photo-remove hidden">×</button></div>`);document.getElementById("photo"+i).addEventListener("change",e=>handlePhoto(i,e.target.files[0]))}
}
function handlePhoto(i,file){if(!file)return;const r=new FileReader();r.onload=()=>{const c=document.querySelector(`[data-photo="${i}"]`);c.dataset.image=r.result;c.querySelector("label").innerHTML=`<img src="${r.result}" alt="Foto ${i}">`;const b=c.querySelector(".photo-remove");b.classList.remove("hidden");b.onclick=()=>removePhoto(i)};r.readAsDataURL(file)}
function removePhoto(i){const c=document.querySelector(`[data-photo="${i}"]`);c.dataset.image="";c.querySelector("label").innerHTML=`<span>FOTO ${i}<br><small>📷 Tocar para cámara</small></span>`;c.querySelector("input").value="";c.querySelector(".photo-remove").classList.add("hidden")}
async function saveForm(e){
 e.preventDefault();
 const clientEl=document.getElementById("clientName"), clientId=clientEl?.dataset.clientId||"";
 const client=registeredClients().find(c=>String(clientField(c,["id","uid","document","doc","nit"]))===String(clientId));
 if(!client){alert("Debes seleccionar un cliente registrado en el módulo Clientes.");return}
 const d=collectForm(); d.clientId=clientId; d.clientName=clientField(client,["nombre","name","razonSocial","razon_social"]);
 const p=new URLSearchParams(location.search),id=p.get("id");
 const payload={cliente_id:clientId,tecnico_id:currentUser().id,fecha:d.issueDate||new Date().toISOString().slice(0,10),tipo_inspeccion:d.acometida||'Inspección eléctrica',observaciones:d.generalObservations||'' ,estado:'borrador'};
 try{
   let result;
   if(id){ result=await snicSupabase.from('inspecciones').update(payload).eq('id',id).select().single(); }
   else { result=await snicSupabase.from('inspecciones').insert(payload).select().single(); }
   if(result.error) throw result.error;
   d.id=result.data.id; d.technicianId=currentUser().id; d.technicianName=currentUser().fullName;
   const arr=inspections(),idx=arr.findIndex(x=>x.id===d.id); if(idx>=0)arr[idx]=d; else arr.push(d); saveInspections(arr);
   alert("Inspección guardada correctamente en Supabase."); location.href="inspecciones.html";
 }catch(err){alert("No se pudo guardar la inspección: "+err.message)}
}

function collectForm(){
 const ids=["formatNumber","issueDate","expiryDate","paymentMethod","paymentMeans","clientName","phone","documentNumber","email","address","clientType","city","acometida","installedCapacity","voltage","circuits","frequency","installationAge","technicianName","technicianDocument","technicianPhone","technicianEmail","technicianLicense","technicianSpecialty","generalObservations"];
 const d={};ids.forEach(id=>{const e=document.getElementById(id);if(e)d[id]=e.value});d.technicianId=currentUser().id;d.checklist={};
 document.querySelectorAll("[data-observation]").forEach(e=>d.checklist[e.dataset.observation]={observation:e.value});
 document.querySelectorAll(".check-table input[type=radio]:checked").forEach(e=>{d.checklist[e.name]=d.checklist[e.name]||{};d.checklist[e.name].status=e.value});
 d.parameters={};document.querySelectorAll(".parameter-table input").forEach(e=>d.parameters[e.name]=e.value);d.photos=[];for(let i=1;i<=6;i++)d.photos.push(document.querySelector(`[data-photo="${i}"]`)?.dataset.image||"");d.savedAt=new Date().toISOString();return d;
}
function loadForm(d){
 setupInspectionClients();
 const sel=document.getElementById("clientName");
 if(sel && d.clientId){
   sel.dataset.clientId=d.clientId;
   [...sel.options].forEach(o=>{if(String(o.dataset.clientId)===String(d.clientId))o.selected=true});
 }
 const ids=["formatNumber","issueDate","expiryDate","paymentMethod","paymentMeans","clientName","phone","documentNumber","email","address","clientType","city","acometida","installedCapacity","voltage","circuits","frequency","installationAge","technicianName","technicianDocument","technicianPhone","technicianEmail","technicianLicense","technicianSpecialty","generalObservations"];
 ids.forEach(id=>{const e=document.getElementById(id);if(e&&d[id]!=null)e.value=d[id]});
 Object.entries(d.checklist||{}).forEach(([k,val])=>{const o=document.querySelector(`[data-observation="${k}"]`);if(o)o.value=val.observation||"";if(val.status){const r=document.querySelector(`input[name="${k}"][value="${val.status}"]`);if(r)r.checked=true}});
 Object.entries(d.parameters||{}).forEach(([k,val])=>{const e=document.querySelector(`[name="${k}"]`);if(e)e.value=val});
 (d.photos||[]).forEach((img,i)=>{if(img){const c=document.querySelector(`[data-photo="${i+1}"]`);c.dataset.image=img;c.querySelector("label").innerHTML=`<img src="${img}" alt="Foto ${i+1}">`;const b=c.querySelector(".photo-remove");b.classList.remove("hidden");b.onclick=()=>removePhoto(i+1)}})
}

function initReports(){
 if(!isAdmin()){location.href="inspecciones.html";return}
 populateReportYears();populateReportTechnicians();
 ["reportPeriod","reportYear","reportMonth","reportQuarter","reportTechnician"].forEach(id=>document.getElementById(id)?.addEventListener("change",()=>{updateReportControls();renderReport()}));
 document.getElementById("printReportBtn").addEventListener("click",()=>window.print());
 const now=new Date();document.getElementById("reportYear").value=String(now.getFullYear());document.getElementById("reportMonth").value=String(now.getMonth()+1);document.getElementById("reportQuarter").value=String(Math.floor(now.getMonth()/3)+1);
 updateReportControls();renderReport();
}
function populateReportYears(){
 const y=document.getElementById("reportYear"),set=new Set([String(new Date().getFullYear())]);
 inspections().forEach(x=>{if(x.issueDate)set.add(x.issueDate.slice(0,4))});
 [...set].sort((a,b)=>b.localeCompare(a)).forEach(v=>y.insertAdjacentHTML("beforeend",`<option value="${v}">${v}</option>`));
}
function populateReportTechnicians(){
 const s=document.getElementById("reportTechnician");s.innerHTML='<option value="all">Todos los técnicos</option>';
 users().filter(u=>u.role==="tecnico").forEach(u=>s.insertAdjacentHTML("beforeend",`<option value="${esc(u.id)}">${esc(u.fullName)}</option>`));
}
function updateReportControls(){
 const p=document.getElementById("reportPeriod").value;
 document.getElementById("monthField").classList.toggle("hidden",p!=="monthly");
 document.getElementById("quarterField").classList.toggle("hidden",p!=="quarterly");
}
function getReportRange(){
 const p=document.getElementById("reportPeriod").value,y=Number(document.getElementById("reportYear").value);let start,end,title;
 if(p==="monthly"){const m=Number(document.getElementById("reportMonth").value);start=new Date(y,m-1,1);end=new Date(y,m,1);title=`Reporte mensual - ${start.toLocaleDateString("es-CO",{month:"long",year:"numeric"})}`}
 else if(p==="quarterly"){const q=Number(document.getElementById("reportQuarter").value),m=(q-1)*3;start=new Date(y,m,1);end=new Date(y,m+3,1);title=`Reporte trimestral - ${q}° trimestre de ${y}`}
 else{start=new Date(y,0,1);end=new Date(y+1,0,1);title=`Reporte anual - ${y}`}
 return {start,end,title};
}
function renderReport(){
 const r=getReportRange(),tf=document.getElementById("reportTechnician").value;
 const arr=inspections().filter(x=>{if(!x.issueDate)return false;const d=new Date(x.issueDate+"T00:00:00");return d>=r.start&&d<r.end&&(tf==="all"||x.technicianId===tf)}).sort((a,b)=>(b.issueDate||"").localeCompare(a.issueDate||""));
 const clients=new Set(arr.map(x=>(x.documentNumber||x.clientName||"").trim()).filter(Boolean)),techIds=new Set(arr.map(x=>x.technicianId).filter(Boolean));
 document.getElementById("reportTitle").textContent=r.title;document.getElementById("reportSubtitle").textContent=`Generado el ${new Date().toLocaleString("es-CO")} · Solo visible para administradores`;
 document.getElementById("totalInspections").textContent=arr.length;document.getElementById("totalClients").textContent=clients.size;document.getElementById("totalTechnicians").textContent=techIds.size;document.getElementById("averagePerTech").textContent=techIds.size?(arr.length/techIds.size).toFixed(1):"0";
 const map={};arr.forEach(x=>{const id=x.technicianId||("name:"+x.technicianName);if(!map[id])map[id]={name:x.technicianName||"Sin técnico",count:0,clients:new Set(),last:"",specialty:x.technicianSpecialty||""};map[id].count++;const c=(x.documentNumber||x.clientName||"").trim();if(c)map[id].clients.add(c);if(!map[id].last||x.issueDate>map[id].last)map[id].last=x.issueDate;const u=users().find(u=>u.id===x.technicianId);if(u)map[id].specialty=u.specialty||x.technicianSpecialty||""});
 const tb=document.getElementById("technicianReportBody");tb.innerHTML="";Object.values(map).sort((a,b)=>b.count-a.count).forEach(x=>tb.insertAdjacentHTML("beforeend",`<tr><td>${esc(x.name)}</td><td>${esc(x.specialty||"—")}</td><td><strong>${x.count}</strong></td><td>${x.clients.size}</td><td>${esc(x.last||"—")}</td></tr>`));
 document.getElementById("reportEmpty").classList.toggle("hidden",arr.length>0);
 const activity={};arr.forEach(x=>{const k=x.technicianName||"Sin técnico";activity[k]=(activity[k]||0)+1});const rows=Object.entries(activity).sort((a,b)=>b[1]-a[1]),max=rows[0]?.[1]||1;const bars=document.getElementById("activityBars");bars.innerHTML="";rows.forEach(([n,c])=>bars.insertAdjacentHTML("beforeend",`<div class="activity-row"><span>${esc(n)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2,c/max*100)}%"></div></div><span class="activity-value">${c}</span></div>`));
 const dt=document.getElementById("detailReportBody");dt.innerHTML="";arr.forEach(x=>dt.insertAdjacentHTML("beforeend",`<tr><td>${esc(x.issueDate||"")}</td><td>FIE-${esc(x.formatNumber||"0000")}</td><td>${esc(x.clientName||"Sin cliente")}</td><td>${esc(x.technicianName||"Sin técnico")}</td></tr>`));
}
