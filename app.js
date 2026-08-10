document.addEventListener("DOMContentLoaded", () => {

const C = window.NOVA_CONFIG || {};

const ready =
typeof C.SUPABASE_URL === "string" &&
C.SUPABASE_URL.startsWith("https://") &&
typeof C.SUPABASE_PUBLISHABLE_KEY === "string" &&
C.SUPABASE_PUBLISHABLE_KEY.length > 20;

let sb=null;
let user=null;
let profile=null;
let activeChat=null;
let chats=[];
let realtimeChannel=null;

const $=id=>document.getElementById(id);

const LOGO =
"https://s6.uupload.ir/files/file_000000002dd082469339a22756c5ad8b_ko8m.png";

const VERIFY =
"https://s6.uupload.ir/files/picsart_26-08-10_04-18-21-233_qlx.png";


/* =========================
HELPERS
========================= */

function escapeHTML(v){
return String(v??"")
.replaceAll("&","&amp;")
.replaceAll("<","&lt;")
.replaceAll(">","&gt;")
.replaceAll('"',"&quot;")
.replaceAll("'","&#039;");
}

function toast(text){
const el=$("toast");
if(!el)return;
el.textContent=text;
el.classList.add("show");
clearTimeout(window.toastTimer);
window.toastTimer=setTimeout(()=>el.classList.remove("show"),2800);
}

function show(el){
el?.classList.remove("hidden");
}

function hide(el){
el?.classList.add("hidden");
}

function time(v){
try{
return new Date(v).toLocaleTimeString(
document.documentElement.lang==="en"?"en-US":"fa-IR",
{hour:"2-digit",minute:"2-digit"}
);
}catch{return ""}
}

function closeAllPanels(){
document.querySelectorAll(".overlay")
.forEach(x=>hide(x));
}


/* =========================
AUTH
========================= */

function authMessage(text){
if($("authMessage"))
$("authMessage").textContent=text;
}

async function boot(){

if(!ready){
authMessage("config.js صحیح تنظیم نشده است.");
return;
}

if(!window.supabase){
authMessage("Supabase بارگذاری نشد.");
return;
}

try{

sb=window.supabase.createClient(
C.SUPABASE_URL,
C.SUPABASE_PUBLISHABLE_KEY,
{
auth:{
persistSession:true,
autoRefreshToken:true,
detectSessionInUrl:true
}
}
);

const {data}=await sb.auth.getSession();

if(data?.session?.user){
user=data.session.user;
await enterApp();
}else{
showAuth();
}

sb.auth.onAuthStateChange(
async(_event,session)=>{
user=session?.user||null;

if(user){
await enterApp();
}else{
showAuth();
}
}
);

}catch(error){

console.error(error);
authMessage("اتصال به Supabase انجام نشد.");

}

}

function showAuth(){
show($("auth"));
hide($("app"));
}

async function enterApp(){

hide($("auth"));
show($("app"));

await loadProfile();
await ensureSettings();
await ensureOfficialChannel();
await loadChats();

await firstLoginNotice();

}


/* =========================
PROFILE
========================= */

async function loadProfile(){

if(!user)return;

const {data,error}=await sb
.from("profiles")
.select("*")
.eq("id",user.id)
.maybeSingle();

if(error){
console.error(error);
return;
}

profile=data||{
id:user.id,
email:user.email,
display_name:user.user_metadata?.display_name||
user.email?.split("@")[0]||
"کاربر"
};

updateProfileUI();

}

function updateProfileUI(){

if(!profile)return;

const name=
profile.display_name||
"کاربر";

$("profileName").value=
profile.display_name||"";

$("profileUsername").value=
profile.username||"";

$("profileBio").value=
profile.bio||"";

$("profileAvatar").textContent=
name.charAt(0).toUpperCase();

if(profile.avatar_url){

$("profilePhoto").src=
profile.avatar_url;

show($("profilePhoto"));
hide($("profileAvatar"));
show($("removeAvatarBtn"));

}else{

hide($("profilePhoto"));
show($("profileAvatar"));
hide($("removeAvatarBtn"));

}

if(profile.is_owner||profile.is_verified){

show($("verificationBadge"));

}else{

hide($("verificationBadge"));

}

}


async function saveProfile(){

if(!user)return;

const displayName=
$("profileName").value.trim();

let username=
$("profileUsername").value
.trim()
.replace(/^@/,"")
.toLowerCase();

const bio=
$("profileBio").value.trim();

if(!displayName){
toast("نام نمایشی را وارد کنید.");
return;
}

if(username &&
!/^[a-zA-Z0-9_]{3,32}$/.test(username)){
toast("نام کاربری معتبر نیست.");
return;
}

const {data,error}=await sb
.from("profiles")
.update({
display_name:displayName,
username:username||null,
bio
})
.eq("id",user.id)
.select()
.single();

if(error){

console.error(error);

if(
error.message?.toLowerCase()
.includes("duplicate")
){
toast("این نام کاربری قبلاً استفاده شده.");
}else{
toast(error.message);
}

return;
}

profile=data;

updateProfileUI();

toast("پروفایل ذخیره شد.");

}


async function uploadAvatar(file){

if(!file||!user)return;

if(file.size>2*1024*1024){
toast("حجم تصویر حداکثر ۲ مگابایت باشد.");
return;
}

/*
برای اینکه فعلاً بدون Storage هم کار کند،
تصویر به data URL تبدیل می‌شود.
برای نسخه نهایی بهتر است Storage اختصاصی بسازیم.
*/

const reader=new FileReader();

reader.onload=async()=>{

const url=reader.result;

const {data,error}=await sb
.from("profiles")
.update({
avatar_url:url
})
.eq("id",user.id)
.select()
.single();

if(error){
console.error(error);
toast("ذخیره تصویر انجام نشد.");
return;
}

profile=data;
updateProfileUI();
toast("تصویر پروفایل ذخیره شد.");

};

reader.readAsDataURL(file);

}


async function removeAvatar(){

const {data,error}=await sb
.from("profiles")
.update({avatar_url:null})
.eq("id",user.id)
.select()
.single();

if(error){
toast("حذف تصویر انجام نشد.");
return;
}

profile=data;
updateProfileUI();

toast("تصویر حذف شد.");

}


/* =========================
SETTINGS
========================= */

async function ensureSettings(){

if(!user)return;

const {data}=await sb
.from("user_settings")
.select("*")
.eq("user_id",user.id)
.maybeSingle();

if(!data){

await sb
.from("user_settings")
.insert({
user_id:user.id,
language:"fa"
});

}

}

async function saveSetting(field,value){

if(!user)return;

await sb
.from("user_settings")
.upsert({
user_id:user.id,
[field]:value,
updated_at:new Date().toISOString()
});

}


/* =========================
LANGUAGE
========================= */

function setLanguage(lang){

localStorage.setItem(
"bipolar_language",
lang
);

document.documentElement.lang=lang;
document.documentElement.dir=
lang==="en"?"ltr":"rtl";

if($("currentLanguage"))
$("currentLanguage").textContent=
lang==="en"?"English":"فارسی";

if($("faCheck"))
$("faCheck").textContent=
lang==="fa"?"✓":"";

if($("enCheck"))
$("enCheck").textContent=
lang==="en"?"✓":"";

if(lang==="en"){

$("search").placeholder="Search";
$("text").placeholder="Write a message...";
$("authMessage").textContent=
"Sign in to continue.";

}else{

$("search").placeholder="جستجو";
$("text").placeholder="پیام بنویسید...";
}

}


async function changeLanguage(lang){

setLanguage(lang);

await saveSetting("language",lang);

toast(
lang==="en"
?"Language changed"
:"زبان تغییر کرد"
);

}


/* =========================
OFFICIAL CHANNEL
========================= */

async function ensureOfficialChannel(){

if(!user)return;

let {data:channel,error}=await sb
.from("conversations")
.select("*")
.eq("username","Bipolar_ir")
.maybeSingle();

if(error){
console.error(error);
return;
}

if(!channel){

/*
اگر کاربر اجازه ساخت conversation را داشته باشد
اولین ورود کانال رسمی ساخته می‌شود.
*/

const result=await sb
.from("conversations")
.insert({
title:"BipolarChat",
username:"Bipolar_ir",
description:"کانال رسمی BipolarChat",
is_group:true,
conversation_type:"channel",
is_public:true,
is_verified:true
})
.select()
.single();

if(!result.error)
channel=result.data;

}

if(!channel)return;


/* عضویت خودکار */

await sb
.from("channel_members")
.upsert({
channel_id:channel.id,
user_id:user.id
},{
onConflict:"channel_id,user_id"
});

}


/* =========================
FIRST LOGIN
========================= */

async function firstLoginNotice(){

if(!user)return;

const key=
"bipolar_first_notice_"+user.id;

if(localStorage.getItem(key))
return;

localStorage.setItem(key,"1");

toast(
"درود بر کاربران گرامی؛ اپلیکیشن BipolarChat تحت شبکه وب صرفاً یک نسخه آزمایشی می‌باشد."
);

setTimeout(()=>{

alert(
`درود بر کاربران گرامی؛

اپلیکیشن BipolarChat تحت شبکه وب صرفاً یک نسخه آزمایشی می‌باشد.

این اپلیکیشن جهت محافظت از اطلاعات شما بر روی Supabase و GitHub ذخیره شده است.

تابع قوانین جمهوری‌اسلامی‌ایران و قوهٔ قضائیه محترم🇮🇷`
);

},400);

}


/* =========================
CHATS
========================= */

async function loadChats(){

if(!user)return;

const {data,error}=await sb
.from("conversations")
.select(`
id,
title,
username,
description,
is_group,
conversation_type,
is_verified,
created_at,
conversation_members!inner(user_id),
messages(
body,
created_at,
sender_id
)
`)
.eq(
"conversation_members.user_id",
user.id
)
.order("created_at",{ascending:false});

if(error){

console.error(error);
return;

}

chats=data||[];

renderChats();

}

function renderChats(){

const list=$("chatList");
if(!list)return;

let filtered=[...chats];

const query=
$("search").value
.trim()
.toLowerCase();

if(query){

filtered=filtered.filter(chat=>
(chat.title||"")
.toLowerCase()
.includes(query)||
(chat.username||"")
.toLowerCase()
.includes(query)
);

}

if(!filtered.length){

list.innerHTML=
`<div class="empty-list">
هنوز گفتگویی ندارید.
</div>`;

$("allCount").textContent="0";
return;

}

list.innerHTML=
filtered.map(chat=>{

const messages=
[...(chat.messages||[])]
.sort(
(a,b)=>
new Date(a.created_at)-
new Date(b.created_at)
);

const last=
messages[messages.length-1];

const title=
chat.title||
"گفتگوی خصوصی";

return `
<button
class="chat ${activeChat?.id===chat.id?"selected":""}"
data-id="${escapeHTML(chat.id)}">

<span class="avatar">
${escapeHTML(title.charAt(0))}
</span>

<span class="chat-info">

<b>
${escapeHTML(title)}

${chat.is_verified?
`<img
src="${VERIFY}"
style="width:15px;height:15px;vertical-align:middle;object-fit:contain">`
:""}

</b>

<small>
${escapeHTML(
last?.body||
(chat.username?
"@"+chat.username:
"هنوز پیامی نیست")
)}
</small>

</span>

<time>
${last?time(last.created_at):""}
</time>

</button>
`;

}).join("");

list
.querySelectorAll(".chat")
.forEach(btn=>{
btn.onclick=
()=>openChat(btn.dataset.id);
});

$("allCount").textContent=
String(filtered.length);

}


/* =========================
OPEN CHAT
========================= */

async function openChat(id){

const chat=
chats.find(x=>x.id===id);

if(!chat)return;

activeChat=chat;

$("chatName").textContent=
chat.title||"گفتگوی خصوصی";

$("chatStatus").textContent=
chat.username?
"@"+chat.username:
chat.conversation_type==="channel"?
"کانال":
chat.is_group?
"گروه":
"گفتگوی خصوصی";

$("chatAvatar").textContent=
(chat.title||"B").charAt(0);

renderChats();

await loadMessages();

if(window.innerWidth<=700){

$("sidebar").classList.add("hide");
$("main").classList.add("show");

}

}


async function loadMessages(){

if(!activeChat)return;

const {data,error}=await sb
.from("messages")
.select("id,body,sender_id,created_at")
.eq("conversation_id",activeChat.id)
.order("created_at",{ascending:true});

if(error){

console.error(error);

$("messages").innerHTML=
`<div class="empty-list">
خطا در دریافت پیام‌ها.
</div>`;

return;

}

renderMessages(data||[]);
subscribeMessages();

}


function renderMessages(messages){

if(!messages.length){

$("messages").innerHTML=
`<div class="welcome">

<img
src="${LOGO}"
class="welcome-logo">

<h1>
${escapeHTML(activeChat?.title||"BipolarChat")}
</h1>

<p>اولین پیام را بفرستید.</p>

</div>`;

return;

}

$("messages").innerHTML=
messages.map(message=>{

const mine=
message.sender_id===user.id;

return `
<div class="bubble ${mine?"me":""}">
${escapeHTML(message.body)}
<time>${time(message.created_at)}</time>
</div>
`;

}).join("");

scrollMessages();

}


function appendMessage(message){

const box=$("messages");

if(
box.querySelector(".welcome")||
box.querySelector(".empty-list")
){
box.innerHTML="";
}

const mine=
message.sender_id===user.id;

box.insertAdjacentHTML(
"beforeend",
`
<div class="bubble ${mine?"me":""}">
${escapeHTML(message.body)}
<time>${time(message.created_at)}</time>
</div>
`
);

scrollMessages();

}


function scrollMessages(){

const box=$("messages");

if(box)
box.scrollTop=box.scrollHeight;

}


async function sendMessage(){

if(!activeChat){
toast("ابتدا یک گفتگو انتخاب کنید.");
return;
}

const input=$("text");

const body=input.value.trim();

if(!body)return;

input.value="";

const {data,error}=await sb
.from("messages")
.insert({
conversation_id:activeChat.id,
sender_id:user.id,
body
})
.select()
.single();

if(error){

console.error(error);

input.value=body;

toast("ارسال پیام انجام نشد.");

return;

}

appendMessage(data);

}


function subscribeMessages(){

if(realtimeChannel)
sb.removeChannel(realtimeChannel);

if(!activeChat)return;

realtimeChannel=
sb.channel(
"messages-"+activeChat.id+"-"+Date.now()
)
.on(
"postgres_changes",
{
event:"INSERT",
schema:"public",
table:"messages",
filter:
"conversation_id=eq."+activeChat.id
},
payload=>{

if(payload.new.sender_id!==user.id)
appendMessage(payload.new);

}
)
.subscribe();

}


/* =========================
CONTACT
========================= */

async function searchProfile(){

let value=
$("contactSearch")
.value
.trim();

if(!value){
toast("ایمیل یا نام کاربری را وارد کنید.");
return;
}

value=value.replace(/^@/,"");

let query;

if(value.includes("@")){

query=sb
.from("profiles")
.select("id,email,display_name,username,avatar_url,is_verified")
.eq("email",value)
.maybeSingle();

}else{

query=sb
.from("profiles")
.select("id,email,display_name,username,avatar_url,is_verified")
.ilike("username",value)
.maybeSingle();

}

const {data,error}=await query;

if(error){
console.error(error);
toast("جستجو انجام نشد.");
return;
}

if(!data){
toast("کاربر پیدا نشد.");
return;
}

if(data.id===user.id){

/*
مهم:
@bipolar دیگر کاربر را به Telegram نمی‌فرستد.
خود پروفایل BipolarChat باز می‌شود.
*/

showOwnProfile();
return;

}

const {data:conversationId,error:createError}=
await sb.rpc(
"create_private_conversation",
{
other_user:data.id
}
);

if(createError){

console.error(createError);
toast(createError.message);
return;

}

closeAllPanels();

await loadChats();
await openChat(conversationId);

toast("مخاطب اضافه شد.");

}


function showOwnProfile(){

closeAllPanels();
updateProfileUI();
show($("profilePanel"));

}


/* =========================
GROUP
========================= */

async function createGroup(){

const title=
$("groupTitle").value.trim();

const description=
$("groupDescription").value.trim();

if(!title){
toast("نام گروه را وارد کنید.");
return;
}

const {data,error}=await sb
.from("conversations")
.insert({
title,
description,
is_group:true,
conversation_type:"group",
is_public:false
})
.select()
.single();

if(error){
console.error(error);
toast(error.message);
return;
}

const memberError=
await sb
.from("conversation_members")
.insert({
conversation_id:data.id,
user_id:user.id
});

if(memberError.error){
toast(memberError.error.message);
return;
}

closeAllPanels();

$("groupTitle").value="";
$("groupDescription").value="";

await loadChats();
await openChat(data.id);

toast("گروه ساخته شد.");

}


/* =========================
CHANNEL
========================= */

async function createChannel(){

const title=
$("channelTitle").value.trim();

let username=
$("channelUsername").value
.trim()
.replace(/^@/,"")
.toLowerCase();

const description=
$("channelDescription").value.trim();

const isPublic=
$("channelPublic").checked;

if(!title){
toast("نام کانال را وارد کنید.");
return;
}

if(isPublic &&
username &&
!/^[a-zA-Z0-9_]{3,32}$/.test(username)){
toast("آیدی کانال معتبر نیست.");
return;
}

const {data,error}=await sb
.from("conversations")
.insert({
title,
username:username||null,
description,
is_group:true,
conversation_type:"channel",
is_public:isPublic
})
.select()
.single();

if(error){
console.error(error);
toast(error.message);
return;
}

const member=
await sb
.from("conversation_members")
.insert({
conversation_id:data.id,
user_id:user.id
});

if(member.error){
toast(member.error.message);
return;
}

closeAllPanels();

await loadChats();
await openChat(data.id);

toast("کانال ساخته شد.");

}


/* =========================
LOGOUT
========================= */

async function logout(){

if(realtimeChannel)
sb.removeChannel(realtimeChannel);

await sb.auth.signOut();

activeChat=null;
chats=[];
profile=null;

showAuth();

}


/* =========================
EVENTS
========================= */

$("loginBtn").onclick=async()=>{

const email=$("email").value.trim();
const password=$("password").value;

if(!email||!password){
authMessage("ایمیل و رمز عبور را وارد کنید.");
return;
}

authMessage("در حال ورود...");

const {error}=
await sb.auth.signInWithPassword({
email,password
});

if(error)
authMessage(error.message);

};


$("signupBtn").onclick=async()=>{

const email=$("email").value.trim();
const password=$("password").value;

const displayName=
$("displayName")?.value.trim()||
email.split("@")[0];

if(!email||!password){
authMessage("اطلاعات را کامل کنید.");
return;
}

const {data,error}=
await sb.auth.signUp({
email,
password,
options:{
data:{display_name:displayName}
}
});

if(error){
authMessage(error.message);
return;
}

authMessage(
data.session?
"حساب ساخته شد."
:"ایمیل تأیید را بررسی کنید."
);

};


$("forgot").onclick=async()=>{

const email=$("email").value.trim();

if(!email){
authMessage("ایمیل را وارد کنید.");
return;
}

const {error}=
await sb.auth.resetPasswordForEmail(
email,
{redirectTo:window.location.origin}
);

authMessage(
error?
error.message:
"لینک بازیابی رمز ارسال شد."
);

};


$("composer").onsubmit=e=>{
e.preventDefault();
sendMessage();
};


$("text").onkeydown=e=>{

if(e.key==="Enter"&&!e.shiftKey){

e.preventDefault();
sendMessage();

}

};


$("search").oninput=renderChats;


$("menuBtn").onclick=()=>{
show($("menuPanel"));
};


$("closeMenu").onclick=()=>{
hide($("menuPanel"));
};


$("profileMenuBtn").onclick=()=>{
hide($("menuPanel"));
updateProfileUI();
show($("profilePanel"));
};


$("profileBack").onclick=()=>{
hide($("profilePanel"));
show($("menuPanel"));
};


$("languageMenuBtn").onclick=()=>{
hide($("menuPanel"));
show($("languagePanel"));
};


$("languageBack").onclick=()=>{
hide($("languagePanel"));
show($("menuPanel"));
};


$("aboutMenuBtn").onclick=()=>{
hide($("menuPanel"));
show($("aboutPanel"));
};


$("aboutBack").onclick=()=>{
hide($("aboutPanel"));
show($("menuPanel"));
};


$("chatSettingsBtn").onclick=()=>{
hide($("menuPanel"));
show($("chatSettingsPanel"));
};


$("privacyBtn").onclick=()=>{
hide($("menuPanel"));
show($("privacyPanel"));
};


$("dataBtn").onclick=()=>{
hide($("menuPanel"));
show($("dataPanel"));
};


$("powerBtn").onclick=async()=>{

const status=$("powerStatus");

const enabled=
status.textContent==="خاموش";

status.textContent=
enabled?"روشن":"خاموش";

await saveSetting(
"power_saving",
enabled
);

};


document
.querySelectorAll("[data-back]")
.forEach(btn=>{

btn.onclick=()=>{

hide($(btn.dataset.back));
show($("menuPanel"));

};

});


$("logoutBtn").onclick=logout;


$("newChatBtn").onclick=()=>{
show($("newChatPanel"));
};


$("newChatBack").onclick=()=>{
hide($("newChatPanel"));
};


$("addContactBtn").onclick=()=>{
hide($("newChatPanel"));
show($("contactPanel"));
};


$("contactBack").onclick=()=>{
hide($("contactPanel"));
show($("newChatPanel"));
};


$("saveContactBtn").onclick=
searchProfile;


$("createGroupBtn").onclick=()=>{
hide($("newChatPanel"));
show($("groupPanel"));
};


$("groupBack").onclick=()=>{
hide($("groupPanel"));
show($("newChatPanel"));
};


$("saveGroupBtn").onclick=
createGroup;


$("createChannelBtn").onclick=()=>{
hide($("newChatPanel"));
show($("channelPanel"));
};


$("channelBack").onclick=()=>{
hide($("channelPanel"));
show($("newChatPanel"));
};


$("saveChannelBtn").onclick=
createChannel;


$("saveProfileBtn").onclick=
saveProfile;


$("avatarInput").onchange=e=>{

const file=e.target.files?.[0];

if(file)
uploadAvatar(file);

};


$("removeAvatarBtn").onclick=
removeAvatar;


document
.querySelectorAll(".language-option")
.forEach(btn=>{

btn.onclick=()=>{
changeLanguage(btn.dataset.lang);
};

});


$("clearLocalBtn").onclick=()=>{

localStorage.removeItem("bipolar_language");

toast("تنظیمات محلی پاک شد.");

};


$("backBtn").onclick=()=>{

$("sidebar").classList.remove("hide");
$("main").classList.remove("show");

activeChat=null;

$("chatName").textContent=
profile?.display_name||
"BipolarChat";

$("chatStatus").textContent=
"یک گفتگو را انتخاب کنید";

};


$("chatSearchBtn").onclick=()=>{

$("search").focus();

if(window.innerWidth<=700){

$("sidebar").classList.remove("hide");
$("main").classList.remove("show");

}

};


$("chatMoreBtn").onclick=()=>{

if(activeChat){

toast("تنظیمات این گفتگو در حال توسعه است.");

}else{

toast("ابتدا یک گفتگو انتخاب کنید.");

}

};


$("attachBtn").onclick=()=>{
$("file").click();
};


document
.querySelectorAll(".overlay")
.forEach(overlay=>{

overlay.onclick=e=>{

if(e.target===overlay)
hide(overlay);

};

});


/* =========================
START
========================= */

const savedLanguage=
localStorage.getItem("bipolar_language")||"fa";

setLanguage(savedLanguage);

boot();

});
