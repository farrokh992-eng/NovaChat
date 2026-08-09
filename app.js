const C=window.NOVA_CONFIG||{}; const ready=C.SUPABASE_URL&&!C.SUPABASE_URL.includes("PASTE_")&&C.SUPABASE_PUBLISHABLE_KEY&&!C.SUPABASE_PUBLISHABLE_KEY.includes("PASTE_");
let sb=null,user=null,active=null,filter="all",channel=null;
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const esc=x=>String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const time=x=>new Date(x).toLocaleTimeString("fa-IR",{hour:"2-digit",minute:"2-digit"});
function notice(t){$("#authMessage").textContent=t}
function modal(t,b){$("#modalTitle").textContent=t;$("#modalBody").innerHTML=b;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}
async function boot(){
 if(!ready){notice("اول Supabase را وصل کنید؛ فایل config.js را طبق راهنما تنظیم کنید.");return}
 sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_PUBLISHABLE_KEY);
 const {data:{user:u}}=await sb.auth.getUser(); user=u;
 if(user) await showApp(); else showAuth();
 sb.auth.onAuthStateChange(async(_,s)=>{user=s?.user||null;if(user) await showApp();else showAuth()});
}
function showAuth(){$("#auth").classList.remove("hidden");$("#app").classList.add("hidden")}
async function showApp(){ $("#auth").classList.add("hidden");$("#app").classList.remove("hidden"); await loadProfile(); await loadChats() }
async function loadProfile(){const {data}=await sb.from("profiles").select("*").eq("id",user.id).single(); if(data){$("#name").textContent=data.display_name||user.email;$("#avatar").textContent=(data.display_name||"N")[0]}}
async function loadChats(){
 let q=sb.from("conversations").select("id,title,is_group,created_at,conversation_members!inner(user_id),messages(body,created_at,sender_id)").eq("conversation_members.user_id",user.id).order("created_at",{ascending:false});
 const {data,error}=await q; if(error){console.error(error);return}
 window.chats=data||[]; renderChats();
}
function renderChats(){
 let q=$("#search").value.trim().toLowerCase();let a=(window.chats||[]).filter(c=>(!q||(c.title||"").toLowerCase().includes(q))&&(filter==="all"||filter==="favorites"));
 $("#chatList").innerHTML=a.map(c=>{let m=(c.messages||[]).sort((x,y)=>new Date(x.created_at)-new Date(y.created_at)).at(-1);return `<button class="chat ${active===c.id?"selected":""}" onclick="openChat('${c.id}')"><span class="avatar">${esc((c.title||"N")[0])}</span><span><b>${esc(c.title||"گفتگو")}</b><small>${esc(m?.body||"هنوز پیامی نیست")}</small></span><time>${m?time(m.created_at):""}</time></button>`}).join("");
 $("#allCount").textContent=a.length;$("#unreadCount").textContent="";
}
async function openChat(id){
 active=id;let c=window.chats.find(x=>x.id===id);$("#name").textContent=c.title||"گفتگو";$("#status").textContent=c.is_group?"گروه":"گفتگوی خصوصی";$("#avatar").textContent=(c.title||"N")[0];renderChats();await loadMessages(); if(innerWidth<800){$(".sidebar").classList.add("hide");$(".main").classList.add("show")}
}
async function loadMessages(){
 const {data}=await sb.from("messages").select("id,body,sender_id,created_at").eq("conversation_id",active).order("created_at");
 $("#messages").innerHTML=(data||[]).map(m=>`<div class="bubble ${m.sender_id===user.id?"me":""}">${esc(m.body)}<time>${time(m.created_at)}</time></div>`).join("")||`<div class="empty">هنوز پیامی نیست. اولین پیام را بفرستید.</div>`;
 $("#messages").scrollTop=$("#messages").scrollHeight;
 if(channel)sb.removeChannel(channel);
 channel=sb.channel("conversation:"+active).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"conversation_id=eq."+active},payload=>{if(payload.new.sender_id!==user.id){appendMessage(payload.new)}}).subscribe();
}
function appendMessage(m){$("#messages").insertAdjacentHTML("beforeend",`<div class="bubble">${esc(m.body)}<time>${time(m.created_at)}</time></div>`);$("#messages").scrollTop=$("#messages").scrollHeight}
$("#composer").onsubmit=async e=>{e.preventDefault();if(!active)return;let body=$("#text").value.trim();if(!body)return;$("#text").value="";let {data,error}=await sb.from("messages").insert({conversation_id:active,sender_id:user.id,body}).select().single();if(error)alert(error.message);else appendMessage(data)}
$("#loginBtn").onclick=async()=>{if(!ready)return notice("config.js هنوز تنظیم نشده است.");let {error}=await sb.auth.signInWithPassword({email:$("#email").value,password:$("#password").value});if(error)notice(error.message)}
$("#signupBtn").onclick=async()=>{if(!ready)return notice("config.js هنوز تنظیم نشده است.");let email=$("#email").value,p=$("#password").value,n=$("#displayName").value.trim()||email.split("@")[0];let {data,error}=await sb.auth.signUp({email,password:p,options:{data:{display_name:n}}});if(error)notice(error.message);else notice(data.session?"حساب ساخته شد.":"ایمیل تأیید را بررسی کنید.")}
$("#forgot").onclick=async()=>{if(!ready)return;let email=$("#email").value.trim();if(!email)return notice("ایمیل را وارد کنید.");let {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.href});notice(error?error.message:"لینک بازیابی ارسال شد.")}
$("#logout").onclick=()=>sb?.auth.signOut();
$("#search").oninput=renderChats;
$$(".tab").forEach(x=>x.onclick=()=>{$$(".tab").forEach(y=>y.classList.remove("active"));x.classList.add("active");filter=x.dataset.filter;renderChats()});
$("#back").onclick=()=>{$(".sidebar").classList.remove("hide");$(".main").classList.remove("show")};
$("#close").onclick=closeModal;$("#modal").onclick=e=>e.target.id==="modal"&&closeModal();
$("#profileBtn").onclick=()=>modal("حساب من",`<p>${esc(user?.email)}</p><button class="secondary" onclick="sb.auth.signOut()">خروج از حساب</button>`);
$("#newChat").onclick=()=>modal("گفتگوی جدید",`<input id="newEmail" placeholder="ایمیل کاربر"><button class="primary" onclick="startChat()">ایجاد گفتگو</button>`);
window.startChat=async()=>{let email=$("#newEmail").value.trim();let {data:p}=await sb.from("profiles").select("id,display_name").eq("email",email).single();if(!p)return alert("کاربر پیدا نشد.");let {data:c,error}=await sb.rpc("create_private_conversation",{other_user:p.id});if(error)return alert(error.message);closeModal();await loadChats();openChat(c)};
$("#fileBtn").onclick=()=>$("#file").click();
boot();