(()=>{const KEY="volcanProjectaV3";const DEF={projectType:"Vivienda",area:90,location:"Santiago, Región Metropolitana",priority:"Aislación térmica",material:"Volcanita ST 10",insulation:"AislanGlass R100",wall:{length:3.4,thickness:.15,height:2.6}};const $=(s,p=document)=>p.querySelector(s),$$=(s,p=document)=>[...p.querySelectorAll(s)];let state=load(),zoom=1,selected=null;
function load(){try{return {...DEF,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return {...DEF}}}
function save(msg="Proyecto guardado"){localStorage.setItem(KEY,JSON.stringify(state));toast(msg)}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");clearTimeout(toast.x);toast.x=setTimeout(()=>e.classList.remove("show"),2400)}
function go(v){$$(".view").forEach(x=>x.classList.toggle("active",x.dataset.view===v));$$(".app-subnav nav button").forEach(x=>x.classList.toggle("active",x.dataset.go===v||(v==="editor"&&x.dataset.go==="config")));window.scrollTo({top:0,behavior:"smooth"});sync();if(v==="solutions"||v==="export")renderMaterials();if(v==="editor"&&state.editorObjects?.walls?.length&&$("#detectedWallsLayer"))renderEditorObjects($("#detectedWallsLayer"),state.editorObjects);else if(v==="editor"&&state.detectedWalls?.length&&$("#detectedWallsLayer"))renderDetectedWalls($("#detectedWallsLayer"),state.detectedWalls,false)}
function shortLoc(){return state.location.split(",")[0]}
function sync(){const map={areaValue:state.area,areaCurrent:`${state.area} m²`,summaryType:state.projectType,summaryArea:`${state.area} m²`,summaryLocation:shortLoc(),summaryPriority:state.priority};Object.entries(map).forEach(([k,v])=>{const e=$("#"+k);if(e)e.textContent=v});if($("#areaRange"))$("#areaRange").value=state.area;if($("#locationSelect"))$("#locationSelect").value=state.location;const t=$(`input[name="projectType"][value="${CSS.escape(state.projectType)}"]`);if(t)t.checked=true;const p=$(`input[name="priority"][value="${CSS.escape(state.priority)}"]`);if(p)p.checked=true;renderSolutions()}
function renderSolutions(){const c=$("#solutionCards");if(!c)return;c.innerHTML=PROJECTA_DATA.solutions.map(x=>`<article class="solution-card"><small>${x.category}</small><div class="solution-visual">${x.visual}</div><h3>${x.title}</h3><p>${x.description}</p><button class="small-link" data-toast="Detalle técnico disponible en la siguiente fase">Ver detalle →</button></article>`).join("");const z=state.location.includes("Antofagasta")?"Norte":state.location.includes("Puerto Montt")?"Sur":"Centro";if($("#recommendationCopy"))$("#recommendationCopy").textContent=`Propuesta conceptual para ${state.projectType.toLowerCase()} de ${state.area} m², prioridad ${state.priority.toLowerCase()} y zona ${z}.`}
function mats(){const f=state.priority==="Aislación térmica"?1.08:1;return PROJECTA_DATA.materials.map(x=>({...x,qty:Math.ceil(state.area*x.factor*f),total:Math.ceil(state.area*x.factor*f)*x.price}))}
function renderMaterials(){const m=mats(),html=m.map(x=>`<div class="material-row"><span>${x.name}</span><b>${x.qty} ${x.unit}</b></div>`).join("");if($("#materialsList"))$("#materialsList").innerHTML=html;if($("#exportMaterials"))$("#exportMaterials").innerHTML=html;const s=m.reduce((a,b)=>a+b.total,0),iva=Math.round(s*.19),tot=s+iva,fmt=n=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);if($("#subtotalValue"))$("#subtotalValue").textContent=fmt(s);if($("#taxValue"))$("#taxValue").textContent=fmt(iva);if($("#totalValue"))$("#totalValue").textContent=fmt(tot)}
function download(name,content,type="text/plain;charset=utf-8"){const b=new Blob([content],{type}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500)}
document.addEventListener("click",e=>{const g=e.target.closest("[data-go]");if(g)go(g.dataset.go);const d=e.target.closest("[data-demo]");if(d)toast(`${d.dataset.demo}: sección simulada`);const t=e.target.closest("[data-toast]");if(t)toast(t.dataset.toast);const c=e.target.closest("[data-commercial]");if(c)openDialog(c.dataset.commercial)});
$("#searchButton")?.addEventListener("click",()=>toast($("#globalSearch").value?`Búsqueda simulada: ${$("#globalSearch").value}`:"Escribe un término de búsqueda"));
$("#areaRange")?.addEventListener("input",e=>{state.area=+e.target.value;sync()});$("#projectForm")?.addEventListener("change",e=>{if(e.target.name==="projectType")state.projectType=e.target.value;if(e.target.name==="priority")state.priority=e.target.value;if(e.target.id==="locationSelect")state.location=e.target.value;sync()});$("#projectForm")?.addEventListener("submit",e=>{e.preventDefault();save("Configuración guardada");go("editor")});

const file=$("#sketchInput"),openFile=()=>file.click();
$("#uploadSketchBtn")?.addEventListener("click",openFile);
$("#uploadSketchLink")?.addEventListener("click",openFile);

let interpretedWalls=[];

function groupPeaks(values, threshold){
  const groups=[]; let start=null;
  values.forEach((v,i)=>{
    if(v>=threshold && start===null) start=i;
    const end=(v<threshold || i===values.length-1);
    if(end && start!==null){
      const stop=v<threshold?i-1:i;
      if(stop-start>=0) groups.push([start,stop]);
      start=null;
    }
  });
  return groups;
}

function analyzeSketchImage(img){
  const canvas=document.createElement("canvas");
  const maxW=600,maxH=420,scale=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight,1);
  canvas.width=Math.max(120,Math.round(img.naturalWidth*scale));
  canvas.height=Math.max(120,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(img,0,0,canvas.width,canvas.height);

  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const rows=new Array(canvas.height).fill(0),cols=new Array(canvas.width).fill(0);
  let dark=0;
  for(let y=0;y<canvas.height;y++){
    for(let x=0;x<canvas.width;x++){
      const i=(y*canvas.width+x)*4;
      const lum=.299*data[i]+.587*data[i+1]+.114*data[i+2];
      if(lum<125 && data[i+3]>40){rows[y]++;cols[x]++;dark++;}
    }
  }

  const rowThreshold=Math.max(18,canvas.width*.16);
  const colThreshold=Math.max(18,canvas.height*.16);
  let hGroups=groupPeaks(rows,rowThreshold);
  let vGroups=groupPeaks(cols,colThreshold);

  hGroups=hGroups
    .map(g=>({g,score:rows.slice(g[0],g[1]+1).reduce((a,b)=>a+b,0)}))
    .sort((a,b)=>b.score-a.score).slice(0,8).map(x=>x.g).sort((a,b)=>a[0]-b[0]);
  vGroups=vGroups
    .map(g=>({g,score:cols.slice(g[0],g[1]+1).reduce((a,b)=>a+b,0)}))
    .sort((a,b)=>b.score-a.score).slice(0,8).map(x=>x.g).sort((a,b)=>a[0]-b[0]);

  const walls=[];
  hGroups.forEach(g=>{
    const y=((g[0]+g[1])/2)/canvas.height*100;
    walls.push({orientation:"h",x:7,y:Math.max(5,Math.min(95,y)),length:86,thickness:Math.max(1.2,(g[1]-g[0]+1)/canvas.height*100)});
  });
  vGroups.forEach(g=>{
    const x=((g[0]+g[1])/2)/canvas.width*100;
    walls.push({orientation:"v",x:Math.max(5,Math.min(95,x)),y:7,length:86,thickness:Math.max(1.2,(g[1]-g[0]+1)/canvas.width*100)});
  });

  if(walls.length<4){
    walls.splice(0,walls.length,
      {orientation:"h",x:8,y:10,length:84,thickness:1.5},
      {orientation:"h",x:8,y:88,length:84,thickness:1.5},
      {orientation:"v",x:8,y:10,length:78,thickness:1.5},
      {orientation:"v",x:92,y:10,length:78,thickness:1.5},
      {orientation:"v",x:43,y:10,length:42,thickness:1.2},
      {orientation:"h",x:8,y:52,length:35,thickness:1.2}
    );
  }
  const density=dark/(canvas.width*canvas.height);
  const confidence=Math.max(58,Math.min(94,Math.round(66+walls.length*2-density*25)));
  return {walls,confidence};
}

function renderDetectedWalls(target,walls,preview=false){
  if(!target)return;
  target.innerHTML="";
  walls.forEach((w,idx)=>{
    const el=document.createElement("i");
    el.className=preview?"detected-preview-wall":"detected-editor-wall";
    el.dataset.detectedWall=idx;
    if(w.start&&w.end){
      const horizontal=Math.abs(w.end.x-w.start.x)>=Math.abs(w.end.y-w.start.y);
      el.dataset.type="wall";
      el.style.left=`${Math.min(w.start.x,w.end.x)*100}%`;
      el.style.top=`${Math.min(w.start.y,w.end.y)*100}%`;
      el.style.width=`${horizontal?Math.max(Math.abs(w.end.x-w.start.x)*100,2):1.4}%`;
      el.style.height=`${horizontal?1.4:Math.max(Math.abs(w.end.y-w.start.y)*100,2)}%`;
      target.appendChild(el);
      return;
    }
    if(w.orientation==="h"){
      el.style.left=`${w.x}%`; el.style.top=`${w.y}%`;
      el.style.width=`${w.length}%`; el.style.height=`${w.thickness}%`;
    }else{
      el.style.left=`${w.x}%`; el.style.top=`${w.y}%`;
      el.style.width=`${w.thickness}%`; el.style.height=`${w.length}%`;
    }
    target.appendChild(el);
  });
}

function renderEditorObjects(target,model){
  if(!target||!model)return;
  renderDetectedWalls(target,model.walls||[],false);
  const walls=new Map((model.walls||[]).map(w=>[w.id,w]));
  [...(model.doors||[]),...(model.windows||[])].forEach(item=>{
    const wall=walls.get(item.wallId);if(!wall)return;
    const horizontal=Math.abs(wall.end.x-wall.start.x)>=Math.abs(wall.end.y-wall.start.y);
    const x=wall.start.x+(wall.end.x-wall.start.x)*(item.position||.5),y=wall.start.y+(wall.end.y-wall.start.y)*(item.position||.5);
    const el=document.createElement("i");el.className=`detected-editor-opening ${item.type}`;el.dataset.type=item.type;el.dataset.detectedId=item.id;el.title=item.type==="door"?"Puerta interpretada":"Ventana interpretada";
    el.style.left=`${x*100}%`;el.style.top=`${y*100}%`;el.style.width=horizontal?"4%":"1.5%";el.style.height=horizontal?"1.5%":"4%";target.appendChild(el);
  });
  (model.rooms||[]).forEach(room=>{
    if(!room.polygon?.length)return;
    const center=room.polygon.reduce((sum,point)=>({x:sum.x+point.x,y:sum.y+point.y}),{x:0,y:0});
    center.x/=room.polygon.length;center.y/=room.polygon.length;
    const label=document.createElement("button");label.type="button";label.className="detected-editor-room";label.dataset.type="room";label.dataset.roomId=room.id;label.textContent=room.name||"Recinto";label.style.left=`${center.x*100}%`;label.style.top=`${center.y*100}%`;label.title="Editar nombre del recinto";target.appendChild(label);
  });
}

function applyInterpretedWalls(){
  state.detectedWalls=interpretedWalls;
  save("Boceto interpretado y guardado como base editable");
  const layer=$("#detectedWallsLayer");
  if(layer) renderDetectedWalls(layer,interpretedWalls,false);
  $("#sketchDialog")?.close();
  go("editor");
}

const sketchUploadController = window.VOLCAN_SKETCH && window.VOLCAN_SKETCH.createSketchUploadController ?
  window.VOLCAN_SKETCH.createSketchUploadController({
    fileInput: file,
    dialog: $("#sketchDialog"),
    processingStage: $("#sketchProcessing"),
    result: $("#sketchResult"),
    preview: $("#sketchPreviewImage"),
    previewPlan: $("#detectedPlanPreview"),
    wallCount: $("#detectedWallCount"),
    confidence: $("#detectedConfidence"),
    statusText: $("#sketchStatus"),
    errorBox: $("#sketchError"),
    analyzeButton: $("#analyzeSketchBtn"),
    useButton: $("#useSketchBtn"),
    methodText: $("#detectedMethod"),
    openingsText: $("#detectedOpenings"),
    roomsText: $("#detectedRooms"),
    warningsBox: $("#sketchWarnings"),
    editButton: $("#editSketchInterpretationBtn"),
    correctionPanel: $("#sketchCorrectionPanel"),
    context: { projectType: state.projectType, area: state.area }
  }) : null;

$("#sketchDialogClose")?.addEventListener("click",()=>$("#sketchDialog").close());
$("#retrySketchBtn")?.addEventListener("click",()=>{ $("#sketchDialog").close(); file.value=""; openFile(); });
$("#useSketchBtn")?.addEventListener("click",()=>{
  const plan = sketchUploadController && sketchUploadController.getCurrentPlan ? sketchUploadController.getCurrentPlan() : null;
  if (plan) {
    const editorObjects = window.VOLCAN_SKETCH.convertPlanToEditorObjects(plan);
    state.editorObjects = editorObjects;
    state.detectedWalls = editorObjects.walls || [];
    state.sketchPlan = plan;
    const layer = $("#detectedWallsLayer");
    if (layer) renderEditorObjects(layer, editorObjects);
    save("Plano interpretado listo para editar");
    $("#sketchDialog")?.close();
    go("editor");
    return;
  }
  applyInterpretedWalls();
});

file?.addEventListener("change", (event) => {
  if (sketchUploadController) return;
  const f=file.files[0]; if(!f)return;
  const img=new Image();
  const url=URL.createObjectURL(f);
  $("#sketchDialog")?.showModal();
  $("#sketchProcessing").hidden=false;
  $("#sketchResult").hidden=true;
  img.onload=()=>{
    $("#sketchPreviewImage").src=url;
    setTimeout(()=>{
      const result=analyzeSketchImage(img);
      interpretedWalls=result.walls;
      renderDetectedWalls($("#detectedPlanPreview"),interpretedWalls,true);
      $("#detectedWallCount").textContent=interpretedWalls.length;
      $("#detectedConfidence").textContent=`${result.confidence}%`;
      $("#sketchProcessing").hidden=true;
      $("#sketchResult").hidden=false;
    },700);
  };
  img.onerror=()=>{
    $("#sketchDialog")?.close();
    toast("No fue posible leer ese archivo. Prueba con JPG o PNG.");
  };
  img.src=url;
});

const canvas=$("#planCanvas");if(canvas){function choose(el){$$("[data-plan-object]",canvas).forEach(x=>x.classList.remove("selected"));el.classList.add("selected");selected=el;$("#selectedObjectName").textContent=`${(el.dataset.type||"Elemento").replace(/^./,m=>m.toUpperCase())} seleccionado`}canvas.addEventListener("pointerdown",e=>{const o=e.target.closest(".draggable");if(!o){const dw=e.target.closest(".detected-editor-wall");if(dw){$$(".detected-editor-wall",canvas).forEach(x=>x.classList.remove("selected"));dw.classList.add("selected");selected=dw;$("#selectedObjectName").textContent="Muro interpretado seleccionado";return}const w=e.target.closest(".wall");if(w)choose(w);return}choose(o);o.setPointerCapture(e.pointerId);const cr=canvas.getBoundingClientRect(),or=o.getBoundingClientRect(),ox=e.clientX-or.left,oy=e.clientY-or.top;const mv=ev=>{const x=Math.max(0,Math.min(cr.width-o.offsetWidth,ev.clientX-cr.left-ox)),y=Math.max(0,Math.min(cr.height-o.offsetHeight,ev.clientY-cr.top-oy));o.style.left=`${x/cr.width*100}%`;o.style.top=`${y/cr.height*100}%`};const up=()=>{o.removeEventListener("pointermove",mv);o.removeEventListener("pointerup",up)};o.addEventListener("pointermove",mv);o.addEventListener("pointerup",up)});$$("[data-add]").forEach(b=>b.addEventListener("click",()=>{const type=b.dataset.add;if(["wall","door","window"].includes(type)){toast(`${type} agregado conceptualmente`);return}const o=document.createElement("button");o.className=`furniture ${type} draggable`;o.dataset.planObject="";o.dataset.type=type;o.style.left=`${35+Math.random()*25}%`;o.style.top=`${35+Math.random()*25}%`;canvas.appendChild(o)}));$("#dimensionsToggle")?.addEventListener("change",e=>$$("[data-dimension]").forEach(x=>x.hidden=!e.target.checked));$("#toggleDimensionsBtn")?.addEventListener("click",()=>$("#dimensionsToggle").click());$("#zoomIn")?.addEventListener("click",()=>{zoom=Math.min(1.3,zoom+.1);updZoom()});$("#zoomOut")?.addEventListener("click",()=>{zoom=Math.max(.7,zoom-.1);updZoom()})}
if(canvas){canvas.addEventListener("click",e=>{const opening=e.target.closest(".detected-editor-opening");if(opening){$("#selectedObjectName").textContent=`${opening.dataset.type} interpretada seleccionada`;return}const roomLabel=e.target.closest(".detected-editor-room");if(roomLabel){const room=state.editorObjects?.rooms?.find(item=>item.id===roomLabel.dataset.roomId);if(!room)return;const name=window.prompt("Nombre del recinto",room.name||"Recinto");if(name?.trim()){room.name=name.trim();const sourceRoom=state.sketchPlan?.rooms?.find(item=>item.id===room.id);if(sourceRoom)sourceRoom.name=room.name;roomLabel.textContent=room.name;save("Nombre de recinto actualizado")}}})}
function updZoom(){$("#planCanvas").style.setProperty("--canvas-scale",zoom);$("#zoomLabel").textContent=`${Math.round(zoom*100)}%`}
$("#saveProjectBtn")?.addEventListener("click",()=>save());$("#generateSolutionBtn")?.addEventListener("click",()=>{save("");go("solutions")});
function openDialog(type){const d=$("#contactDialog"),txt={quote:["Solicitar cotización","Completa tus datos para simular la cotización."],advice:["Solicitar asesoría","Un especialista podría revisar tu proyecto."],buy:["Continuar compra","Flujo de compra simulado."]}[type]||["Contacto","Completa tus datos."];$("#dialogTitle").textContent=txt[0];$("#dialogText").textContent=txt[1];d.showModal()}$("#dialogClose")?.addEventListener("click",()=>$("#contactDialog").close());$("#contactForm")?.addEventListener("submit",e=>{e.preventDefault();$("#contactDialog").close();toast("Solicitud simulada enviada")});
$("#printBtn")?.addEventListener("click",()=>window.print());$("#csvBtn")?.addEventListener("click",()=>download("materiales.csv","\ufeffProducto;Cantidad;Unidad\n"+mats().map(x=>`${x.name};${x.qty};${x.unit}`).join("\n"),"text/csv;charset=utf-8"));$("#txtBtn")?.addEventListener("click",()=>download("soluciones.txt",PROJECTA_DATA.solutions.map(x=>`${x.category}: ${x.title}`).join("\n")));$("#jsonBtn")?.addEventListener("click",()=>download("proyecto.json",JSON.stringify({project:state,materials:mats()},null,2),"application/json"));$("#htmlBtn")?.addEventListener("click",()=>download("resumen.html",`<h1>Volcán Proyecta</h1><p>${state.projectType} · ${state.area} m² · ${state.location}</p>`,"text/html"));$("#shareBtn")?.addEventListener("click",async()=>{const txt=`Volcán Proyecta: ${state.projectType}, ${state.area} m²`;if(navigator.share)try{await navigator.share({title:"Volcán Proyecta",text:txt})}catch{}else{await navigator.clipboard.writeText(txt);toast("Resumen copiado")}});
sync();go("dashboard")})();