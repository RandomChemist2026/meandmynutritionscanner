
const $ = (id) => document.getElementById(id);
const PRODUCT_KEY = "nutrition-scanner-products-v1";
const LOG_KEY = "nutrition-scanner-log-v1";

let deferredInstallPrompt = null;
let scannerControls = null;
let scanReader = null;
let lastScanned = "";

const nutrientIds = ["kcal100","protein100","carbs100","fat100","fiber100","sugar100","satfat100","salt100"];

function todayKey(){
  const d = new Date();
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function loadProducts(){
  try{return JSON.parse(localStorage.getItem(PRODUCT_KEY) || "{}")}catch{return {}}
}
function saveProducts(v){ localStorage.setItem(PRODUCT_KEY, JSON.stringify(v)); }
function loadLog(){
  try{return JSON.parse(localStorage.getItem(LOG_KEY) || "{}")}catch{return {}}
}
function saveLog(v){ localStorage.setItem(LOG_KEY, JSON.stringify(v)); }
function n(id){ const v=Number($(id).value); return Number.isFinite(v) && v>=0 ? v : 0; }
function fmt(x, digits=1){
  if(!Number.isFinite(x)) return "0";
  const p = 10**digits;
  const v = Math.round(x*p)/p;
  return Number.isInteger(v) ? String(v) : v.toFixed(digits).replace(/0+$/,"").replace(/\.$/,"");
}
function status(msg, bad=false){
  $("status").textContent=msg;
  $("status").style.color = bad ? "var(--danger)" : "var(--muted)";
}
function currentFood(){
  return {
    barcode:$("barcodeInput").value.trim(),
    name:$("foodName").value.trim(),
    brand:$("brandLine").textContent.trim(),
    image:$("productImage").src && !$("productImage").classList.contains("hidden") ? $("productImage").src : "",
    kcal:n("kcal100"), protein:n("protein100"), carbs:n("carbs100"), fat:n("fat100"),
    fiber:n("fiber100"), sugar:n("sugar100"), satfat:n("satfat100"), salt:n("salt100")
  };
}
function setField(id, value){ $(id).value = Number.isFinite(Number(value)) ? Number(value) : ""; }
function applyFood(food){
  $("foodName").value=food.name || "";
  $("brandLine").textContent=food.brand || "";
  setField("kcal100",food.kcal); setField("protein100",food.protein); setField("carbs100",food.carbs);
  setField("fat100",food.fat); setField("fiber100",food.fiber); setField("sugar100",food.sugar);
  setField("satfat100",food.satfat); setField("salt100",food.salt);
  if(food.image){
    $("productImage").src=food.image; $("productImage").alt=food.name ? `Photo of ${food.name}` : "Product photo";
    $("productImage").classList.remove("hidden");
  }else{
    $("productImage").removeAttribute("src"); $("productImage").classList.add("hidden");
  }
  updatePortion();
}
function clearFood(){
  $("foodName").value=""; $("brandLine").textContent="";
  nutrientIds.forEach(id=>$(id).value="");
  $("productImage").classList.add("hidden");
  updatePortion();
}
function updatePortion(){
  const f = Math.max(0,n("weightInput"))/100;
  const values = {
    kcal:n("kcal100")*f, protein:n("protein100")*f, carbs:n("carbs100")*f, fat:n("fat100")*f,
    fiber:n("fiber100")*f, sugar:n("sugar100")*f, satfat:n("satfat100")*f, salt:n("salt100")*f
  };
  $("portionKcal").textContent=`${fmt(values.kcal)} kcal`;
  $("portionProtein").textContent=`${fmt(values.protein)} g`;
  $("portionCarbs").textContent=`${fmt(values.carbs)} g`;
  $("portionFat").textContent=`${fmt(values.fat)} g`;
  $("portionFiber").textContent=`${fmt(values.fiber)} g`;
  $("portionSugar").textContent=`${fmt(values.sugar)} g`;
  $("portionSatfat").textContent=`${fmt(values.satfat)} g`;
  $("portionSalt").textContent=`${fmt(values.salt,2)} g`;
  return values;
}
function normalizeOFFProduct(code,p){
  const nu=p.nutriments || {};
  let kcal = Number(nu["energy-kcal_100g"]);
  if(!Number.isFinite(kcal)){
    const kj = Number(nu.energy_100g);
    kcal = Number.isFinite(kj) ? kj/4.184 : 0;
  }
  return {
    barcode:code,
    name:p.product_name || p.product_name_en || "Unnamed product",
    brand:p.brands || "",
    image:p.image_front_small_url || p.image_front_url || "",
    kcal:kcal || 0,
    protein:Number(nu.proteins_100g)||0,
    carbs:Number(nu.carbohydrates_100g)||0,
    fat:Number(nu.fat_100g)||0,
    fiber:Number(nu.fiber_100g)||0,
    sugar:Number(nu.sugars_100g)||0,
    satfat:Number(nu["saturated-fat_100g"])||0,
    salt:Number(nu.salt_100g)||0
  };
}
async function lookupBarcode(code){
  code=(code||"").replace(/\D/g,"");
  $("barcodeInput").value=code;
  if(code.length<6){status("Enter a valid barcode.",true);return;}
  const saved=loadProducts()[code];
  if(saved){applyFood(saved);status("Loaded your saved version of this product.");return;}

  if(!navigator.onLine){
    clearFood(); status("Offline and this barcode is not saved. Enter the label values manually.",true); return;
  }
  status("Looking up product...");
  try{
    const fields="code,product_name,product_name_en,brands,image_front_small_url,image_front_url,nutriments";
    const url=`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${encodeURIComponent(fields)}`;
    const res=await fetch(url,{headers:{"Accept":"application/json"}});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    if(data.status!==1 || !data.product){
      clearFood(); status("Barcode not found. Enter the food name and label values once, then save it.",true); return;
    }
    const food=normalizeOFFProduct(code,data.product);
    applyFood(food);
    status("Product found. Check the label values before adding.");
  }catch(err){
    console.error(err);
    status("Could not reach Open Food Facts. You can still enter the values manually.",true);
  }
}
function saveCurrentFood(){
  const food=currentFood();
  if(!food.name){status("Enter a food name first.",true);return;}
  if(!food.barcode){status("Enter a barcode if you want this food remembered by scan. You can still add it to today.",true);return;}
  const products=loadProducts(); products[food.barcode]=food; saveProducts(products);
  status("Saved on this device.");
  renderSavedFoods();
}
function addToToday(){
  const food=currentFood();
  const weight=n("weightInput");
  if(!food.name){status("Enter or look up a food first.",true);return;}
  if(weight<=0){status("Weight must be greater than 0 g.",true);return;}
  const p=updatePortion();
  const all=loadLog(), key=todayKey(), arr=all[key] || [];
  arr.push({
    id:(crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random()),
    time:new Date().toISOString(),
    meal:$("mealSelect").value,
    name:food.name, barcode:food.barcode, weight,
    kcal:p.kcal,protein:p.protein,carbs:p.carbs,fat:p.fat,fiber:p.fiber,sugar:p.sugar,satfat:p.satfat,salt:p.salt
  });
  all[key]=arr; saveLog(all);
  renderToday();
  status(`Added ${fmt(weight)} g of ${food.name}.`);
}
function renderToday(){
  const all=loadLog(), arr=all[todayKey()] || [];
  const totals=arr.reduce((a,x)=>{for(const k of ["kcal","protein","carbs","fat"])a[k]+=Number(x[k])||0;return a},{kcal:0,protein:0,carbs:0,fat:0});
  $("totalKcal").textContent=fmt(totals.kcal);
  $("totalProtein").textContent=fmt(totals.protein);
  $("totalCarbs").textContent=fmt(totals.carbs);
  $("totalFat").textContent=fmt(totals.fat);
  const wrap=$("mealLog"); wrap.innerHTML="";
  if(!arr.length){wrap.innerHTML='<div class="empty">No foods added today.</div>';return;}
  arr.slice().reverse().forEach(x=>{
    const row=document.createElement("div"); row.className="log-item";
    const left=document.createElement("div");
    const title=document.createElement("div"); title.className="log-title"; title.textContent=x.name;
    const meta=document.createElement("div"); meta.className="log-meta"; meta.textContent=`${x.meal} · ${fmt(x.weight)} g · ${fmt(x.kcal)} kcal · P ${fmt(x.protein)} g`;
    left.append(title,meta);
    const actions=document.createElement("div"); actions.className="log-actions";
    const del=document.createElement("button"); del.type="button"; del.className="ghost"; del.textContent="Remove";
    del.addEventListener("click",()=>{
      const data=loadLog(), list=data[todayKey()]||[];
      data[todayKey()]=list.filter(i=>i.id!==x.id); saveLog(data); renderToday();
    });
    actions.append(del); row.append(left,actions); wrap.append(row);
  });
}
function renderSavedFoods(){
  const products=loadProducts(), entries=Object.entries(products);
  const wrap=$("savedFoodsList"); wrap.innerHTML="";
  if(!entries.length){wrap.innerHTML='<div class="empty">No saved foods yet.</div>';return;}
  entries.sort((a,b)=>(a[1].name||"").localeCompare(b[1].name||"")).forEach(([code,food])=>{
    const row=document.createElement("div"); row.className="saved-item";
    const left=document.createElement("div");
    const title=document.createElement("div"); title.className="log-title"; title.textContent=food.name||code;
    const meta=document.createElement("div"); meta.className="log-meta"; meta.textContent=`${code} · ${fmt(food.kcal)} kcal/100 g · P ${fmt(food.protein)} g`;
    left.append(title,meta);
    const actions=document.createElement("div"); actions.className="log-actions";
    const use=document.createElement("button"); use.type="button"; use.className="secondary"; use.textContent="Use";
    use.addEventListener("click",()=>{$("barcodeInput").value=code;applyFood(food);$("savedPanel").classList.add("hidden");window.scrollTo({top:0,behavior:"smooth"});});
    const del=document.createElement("button"); del.type="button"; del.className="ghost"; del.textContent="Delete";
    del.addEventListener("click",()=>{const p=loadProducts();delete p[code];saveProducts(p);renderSavedFoods();});
    actions.append(use,del);row.append(left,actions);wrap.append(row);
  });
}
async function startScanner(){
  if(!window.isSecureContext){
    status("Camera scanning needs HTTPS. Manual barcode entry still works.",true); return;
  }
  if(!navigator.mediaDevices?.getUserMedia){
    status("Camera access is not supported in this browser.",true); return;
  }
  $("scannerPanel").classList.remove("hidden");
  $("scanBtn").disabled=true;
  lastScanned="";
  try{
    const ZXing = await import("https://cdn.jsdelivr.net/npm/@zxing/browser@0.2.1/+esm");
    scanReader = new ZXing.BrowserMultiFormatReader();
    const constraints={audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}};
    scannerControls = await scanReader.decodeFromConstraints(constraints,$("video"),(result,error,controls)=>{
      if(result){
        const code=result.getText().replace(/\D/g,"");
        if(code && code!==lastScanned){
          lastScanned=code;
          $("barcodeInput").value=code;
          stopScanner();
          lookupBarcode(code);
          if(navigator.vibrate) navigator.vibrate(80);
        }
      }
    });
    status("Point the camera at an EAN/UPC barcode.");
  }catch(err){
    console.error(err);
    stopScanner();
    status("Camera scanner could not start. Check camera permission or enter the barcode manually.",true);
  }
}
function stopScanner(){
  try{scannerControls?.stop();}catch{}
  scannerControls=null;
  try{scanReader?.reset?.();}catch{}
  scanReader=null;
  const v=$("video");
  if(v.srcObject){for(const t of v.srcObject.getTracks())t.stop();v.srcObject=null;}
  $("scannerPanel").classList.add("hidden"); $("scanBtn").disabled=false;
}
function exportCSV(){
  const arr=(loadLog()[todayKey()]||[]);
  if(!arr.length){status("Nothing to export today.",true);return;}
  const rows=[["Time","Meal","Food","Barcode","Weight_g","Calories_kcal","Protein_g","Carbs_g","Fat_g","Fiber_g","Sugar_g","SaturatedFat_g","Salt_g"]];
  arr.forEach(x=>rows.push([x.time,x.meal,x.name,x.barcode,x.weight,x.kcal,x.protein,x.carbs,x.fat,x.fiber,x.sugar,x.satfat,x.salt]));
  const esc=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const blob=new Blob([rows.map(r=>r.map(esc).join(",")).join("\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob), a=document.createElement("a");a.href=url;a.download=`nutrition-${todayKey()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function updateNetwork(){
  $("networkBadge").textContent=navigator.onLine?"Online":"Offline";
}
function setTodayLabel(){
  $("todayDate").textContent=new Intl.DateTimeFormat(undefined,{weekday:"long",day:"numeric",month:"short"}).format(new Date());
}
function registerPWA(){
  if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(console.error);}
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;$("installBtn").classList.remove("hidden");});
  $("installBtn").addEventListener("click",async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$("installBtn").classList.add("hidden");});
}
$("lookupBtn").addEventListener("click",()=>lookupBarcode($("barcodeInput").value));
$("barcodeInput").addEventListener("keydown",e=>{if(e.key==="Enter")lookupBarcode($("barcodeInput").value);});
$("scanBtn").addEventListener("click",startScanner);
$("stopScanBtn").addEventListener("click",stopScanner);
$("saveFoodBtn").addEventListener("click",saveCurrentFood);
$("addMealBtn").addEventListener("click",addToToday);
$("clearTodayBtn").addEventListener("click",()=>{const all=loadLog();delete all[todayKey()];saveLog(all);renderToday();status("Today's log cleared.");});
$("exportBtn").addEventListener("click",exportCSV);
$("savedFoodsBtn").addEventListener("click",()=>{$("savedPanel").classList.remove("hidden");renderSavedFoods();$("savedPanel").scrollIntoView({behavior:"smooth"});});
$("closeSavedBtn").addEventListener("click",()=>$("savedPanel").classList.add("hidden"));
["weightInput",...nutrientIds].forEach(id=>$(id).addEventListener("input",updatePortion));
window.addEventListener("online",updateNetwork);window.addEventListener("offline",updateNetwork);
window.addEventListener("pagehide",stopScanner);
setTodayLabel(); updateNetwork(); updatePortion(); renderToday(); renderSavedFoods(); registerPWA();
