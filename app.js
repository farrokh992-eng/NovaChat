const C = window.NOVA_CONFIG || {};

const ready =
  C.SUPABASE_URL &&
  !C.SUPABASE_URL.includes("PASTE_") &&
  C.SUPABASE_PUBLISHABLE_KEY &&
  !C.SUPABASE_PUBLISHABLE_KEY.includes("PASTE_");

let sb = null;
let user = null;
let profile = null;
let active = null;
let filter = "all";
let channel = null;

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const esc = x =>
  String(x ?? "").replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m])
  );

const time = x =>
  new Date(x).toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit"
  });

function notice(t) {
  $("#authMessage").textContent = t;
}

function modal(title, body) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = body;
  $("#modal").classList.remove("hidden");
}

function closeModal() {
  $("#modal").classList.add("hidden");
}

function avatarHTML(p, size = "") {
  if (p?.avatar_url) {
    return `<img class="avatar-img ${size}" src="${esc(p.avatar_url)}">`;
  }

  const letter =
    (p?.display_name || p?.username || "N")[0];

  return `<span class="avatar ${size}">${esc(letter)}</span>`;
}


/* =========================
   BOOT
========================= */

async function boot() {

  if (!ready) {
    notice("config.js هنوز تنظیم نشده است.");
    return;
  }

  sb = supabase.createClient(
    C.SUPABASE_URL,
    C.SUPABASE_PUBLISHABLE_KEY
  );

  const {
    data: { user: u }
  } = await sb.auth.getUser();

  user = u;

  if (user) {
    await showApp();
  } else {
    showAuth();
  }

  sb.auth.onAuthStateChange(async (_, session) => {

    user = session?.user || null;

    if (user) {
      await showApp();
    } else {
      showAuth();
    }

  });
}


/* =========================
   AUTH
========================= */

function showAuth() {

  $("#auth").classList.remove("hidden");
  $("#app").classList.add("hidden");

}

async function login() {

  if (!ready) {
    notice("config.js هنوز تنظیم نشده است.");
    return;
  }

  const email = $("#email").value.trim();
  const password = $("#password").value;

  if (!email || !password) {
    notice("ایمیل و رمز عبور را وارد کنید.");
    return;
  }

  const { error } =
    await sb.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    notice(error.message);
  }

}

async function signup() {

  if (!ready) {
    notice("config.js هنوز تنظیم نشده است.");
    return;
  }

  const email = $("#email").value.trim();
  const password = $("#password").value;

  const name =
    $("#displayName").value.trim() ||
    email.split("@")[0];

  if (!email || !password) {
    notice("ایمیل و رمز عبور را وارد کنید.");
    return;
  }

  const {
    data,
    error
  } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: name
      }
    }
  });

  if (error) {
    notice(error.message);
    return;
  }

  if (data.session) {
    notice("حساب ساخته شد.");
  } else {
    notice("ایمیل تأیید را بررسی کنید.");
  }

}


/* =========================
   APP
========================= */

async function showApp() {

  $("#auth").classList.add("hidden");
  $("#app").classList.remove("hidden");

  await loadProfile();
  await loadChats();

}


/* =========================
   PROFILE
========================= */

async function loadProfile() {

  const {
    data,
    error
  } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error(error);
    return;
  }

  profile = data;

  updateHeaderProfile();

}


function updateHeaderProfile() {

  if (!profile) return;

  $("#name").textContent =
    profile.display_name ||
    profile.username ||
    user.email;

  $("#avatar").outerHTML = avatarHTML(profile);

  const verified =
    profile.is_verified
      ? " 🔵"
      : "";

  $("#status").textContent =
    `@${profile.username || "user"}${verified}`;

}


/* =========================
   PROFILE MODAL
========================= */

function openProfile() {

  if (!profile) return;

  modal(
    "پروفایل من",

    `
      <div class="profile-editor">

        <div class="profile-preview">
          ${avatarHTML(profile, "large")}
        </div>

        <label>
          نام نمایشی
          <input
            id="profileName"
            value="${esc(profile.display_name)}"
          >
        </label>

        <label>
          نام کاربری
          <input
            id="profileUsername"
            value="${esc(profile.username || "")}"
            placeholder="username"
          >
        </label>

        <small>
          نام کاربری بدون @ وارد شود.
        </small>

        <label>
          درباره من
          <textarea
            id="profileBio"
            placeholder="درباره خودتان بنویسید..."
          >${esc(profile.bio || "")}</textarea>
        </label>

        <label>
          عکس پروفایل
          <input
            id="avatarFile"
            type="file"
            accept="image/*"
          >
        </label>

        <button
          class="primary"
          onclick="saveProfile()"
        >
          ذخیره تغییرات
        </button>

        ${
          profile.is_owner
            ? `
              <div class="owner-badge">
                👑 مالک NovaChat
                <span>🔵 تأیید شده</span>
              </div>
            `
            : ""
        }

      </div>
    `
  );

}


async function saveProfile() {

  const displayName =
    $("#profileName").value.trim();

  const username =
    $("#profileUsername").value
      .trim()
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/[^a-z0-9_]/g, "");

  const bio =
    $("#profileBio").value.trim();

  if (!displayName) {
    alert("نام نمایشی را وارد کنید.");
    return;
  }

  if (!username) {
    alert("نام کاربری را وارد کنید.");
    return;
  }

  if (username.length < 3) {
    alert("نام کاربری حداقل ۳ حرف باشد.");
    return;
  }

  let avatarUrl = profile.avatar_url;

  const file =
    $("#avatarFile")?.files?.[0];

  if (file) {

    const ext =
      file.name.split(".").pop();

    const path =
      `${user.id}/${Date.now()}.${ext}`;

    const {
      error: uploadError
    } = await sb.storage
      .from("avatars")
      .upload(path, file, {
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      alert(uploadError.message);
      return;
    }

    const {
      data: publicData
    } = sb.storage
      .from("avatars")
      .getPublicUrl(path);

    avatarUrl =
      publicData.publicUrl;

  }

  const {
    data,
    error
  } = await sb
    .from("profiles")
    .update({
      display_name: displayName,
      username,
      bio,
      avatar_url: avatarUrl
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {

    if (
      error.message
        .toLowerCase()
        .includes("duplicate")
    ) {
      alert("این نام کاربری قبلاً گرفته شده است.");
    } else {
      alert(error.message);
    }

    return;
  }

  profile = data;

  closeModal();

  updateHeaderProfile();

  await loadChats();

}


/* =========================
   USER SEARCH
========================= */

async function searchUsers() {

  const q =
    $("#newUserSearch").value
      .trim()
      .toLowerCase();

  if (q.length < 2) {
    $("#userResults").innerHTML =
      "<small>حداقل ۲ حرف وارد کنید.</small>";
    return;
  }

  const {
    data,
    error
  } = await sb
    .from("profiles")
    .select(
      "id,email,display_name,username,bio,avatar_url,is_verified,is_owner"
    )
    .or(
      `username.ilike.%${q}%,display_name.ilike.%${q}%,email.ilike.%${q}%`
    )
    .neq("id", user.id)
    .limit(20);

  if (error) {
    $("#userResults").innerHTML =
      `<small>${esc(error.message)}</small>`;
    return;
  }

  if (!data?.length) {
    $("#userResults").innerHTML =
      "<small>کاربری پیدا نشد.</small>";
    return;
  }

  $("#userResults").innerHTML =
    data.map(p => `

      <button
        class="user-result"
        onclick="startChatWith('${p.id}')"
      >

        ${avatarHTML(p)}

        <span>

          <b>
            ${esc(p.display_name)}
            ${p.is_verified ? " 🔵" : ""}
          </b>

          <small>
            @${esc(p.username || "user")}
          </small>

        </span>

      </button>

    `).join("");

}


/* =========================
   NEW CHAT
========================= */

function openNewChat() {

  modal(
    "گفتگوی جدید",

    `
      <input
        id="newUserSearch"
        placeholder="جستجو با @username یا نام..."
        oninput="searchUsers()"
      >

      <div
        id="userResults"
        class="user-results"
      >
        <small>
          نام کاربری، نام یا ایمیل را وارد کنید.
        </small>
      </div>
    `
  );

}


async function startChatWith(otherUserId) {

  const {
    data,
    error
  } = await sb.rpc(
    "create_private_conversation",
    {
      other_user: otherUserId
    }
  );

  if (error) {
    alert(error.message);
    return;
  }

  closeModal();

  await loadChats();

  openChat(data);

}


/* =========================
   CHATS
========================= */

async function loadChats() {

  const {
    data,
    error
  } = await sb
    .from("conversations")
    .select(`
      id,
      title,
      is_group,
      created_at,
      conversation_members!inner(
        user_id
      ),
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
    .order(
      "created_at",
      {
        ascending: false
      }
    );

  if (error) {
    console.error(error);
    return;
  }

  window.chats = data || [];

  await enrichChats();

  renderChats();

}


async function enrichChats() {

  for (const c of window.chats) {

    const memberIds =
      (c.conversation_members || [])
        .map(x => x.user_id)
        .filter(id => id !== user.id);

    if (!memberIds.length) continue;

    const {
      data
    } = await sb
      .from("profiles")
      .select(
        "id,display_name,username,avatar_url,is_verified"
      )
      .in("id", memberIds);

    c.otherProfile =
      data?.[0] || null;

  }

}


function renderChats() {

  const q =
    $("#search").value
      .trim()
      .toLowerCase();

  let chats =
    (window.chats || [])
      .filter(c => {

        if (!q) return true;

        const p =
          c.otherProfile;

        return (
          (c.title || "")
            .toLowerCase()
            .includes(q)
          ||
          (p?.display_name || "")
            .toLowerCase()
            .includes(q)
          ||
          (p?.username || "")
            .toLowerCase()
            .includes(q)
        );

      });

  $("#chatList").innerHTML =
    chats.map(c => {

      const p =
        c.otherProfile;

      const title =
        p?.display_name ||
        c.title ||
        "گفتگو";

      const last =
        (c.messages || [])
          .sort(
            (a,b) =>
              new Date(a.created_at) -
              new Date(b.created_at)
          )
          .at(-1);

      return `

        <button
          class="chat ${
            active === c.id
              ? "selected"
              : ""
          }"
          onclick="openChat('${c.id}')"
        >

          ${avatarHTML(p)}

          <span>

            <b>
              ${esc(title)}
              ${
                p?.is_verified
                  ? " 🔵"
                  : ""
              }
            </b>

            <small>
              ${
                esc(
                  last?.body ||
                  "هنوز پیامی نیست"
                )
              }
            </small>

          </span>

          <time>
            ${
              last
                ? time(last.created_at)
                : ""
            }
          </time>

        </button>

      `;

    }).join("");

  $("#allCount").textContent =
    chats.length;

}


/* =========================
   OPEN CHAT
========================= */

async function openChat(id) {

  active = id;

  const c =
    window.chats.find(
      x => x.id === id
    );

  const p =
    c?.otherProfile;

  $("#name").textContent =
    p?.display_name ||
    c?.title ||
    "گفتگو";

  $("#status").textContent =
    p
      ? `@${p.username || "user"}${
          p.is_verified
            ? " 🔵"
            : ""
        }`
      : "گفتگوی خصوصی";

  const oldAvatar =
    $("#avatar");

  if (oldAvatar) {
    oldAvatar.outerHTML =
      avatarHTML(p);
  }

  renderChats();

  await loadMessages();

  if (innerWidth < 800) {

    $(".sidebar")
      .classList.add("hide");

    $(".main")
      .classList.add("show");

  }

}


/* =========================
   MESSAGES
========================= */

async function loadMessages() {

  const {
    data,
    error
  } = await sb
    .from("messages")
    .select(
      "id,body,sender_id,created_at"
    )
    .eq(
      "conversation_id",
      active
    )
    .order("created_at");

  if (error) {
    console.error(error);
    return;
  }

  $("#messages").innerHTML =
    (data || [])
      .map(messageHTML)
      .join("")
    ||
    `
      <div class="empty">
        هنوز پیامی نیست.
        اولین پیام را بفرستید.
      </div>
    `;

  $("#messages").scrollTop =
    $("#messages").scrollHeight;

  if (channel) {
    sb.removeChannel(channel);
  }

  channel =
    sb
      .channel(
        "conversation:" + active
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter:
            "conversation_id=eq." + active
        },
        payload => {

          if (
            payload.new.sender_id !==
            user.id
          ) {
            appendMessage(
              payload.new
            );
          }

        }
      )
      .subscribe();

}


function messageHTML(m) {

  return `
    <div
      class="bubble ${
        m.sender_id === user.id
          ? "me"
          : ""
      }"
    >
      ${esc(m.body)}
      <time>
        ${time(m.created_at)}
      </time>
    </div>
  `;

}


function appendMessage(m) {

  $("#messages")
    .insertAdjacentHTML(
      "beforeend",
      messageHTML(m)
    );

  $("#messages").scrollTop =
    $("#messages").scrollHeight;

}


/* =========================
   SEND MESSAGE
========================= */

$("#composer").onsubmit =
  async e => {

    e.preventDefault();

    if (!active) return;

    const body =
      $("#text").value.trim();

    if (!body) return;

    $("#text").value = "";

    const {
      data,
      error
    } = await sb
      .from("messages")
      .insert({
        conversation_id: active,
        sender_id: user.id,
        body
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    appendMessage(data);

    await loadChats();

  };


/* =========================
   EVENTS
========================= */

$("#loginBtn").onclick =
  login;

$("#signupBtn").onclick =
  signup;

$("#forgot").onclick =
  async () => {

    const email =
      $("#email").value.trim();

    if (!email) {
      notice("ایمیل را وارد کنید.");
      return;
    }

    const {
      error
    } =
      await sb.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            location.href
        }
      );

    notice(
      error
        ? error.message
        : "لینک بازیابی ارسال شد."
    );

  };


$("#logout").onclick =
  () => sb?.auth.signOut();


$("#search").oninput =
  renderChats;


$("#profileBtn").onclick =
  openProfile;


$("#newChat").onclick =
  openNewChat;


$("#fileBtn").onclick =
  () => $("#file").click();


$("#back").onclick =
  () => {

    $(".sidebar")
      .classList.remove("hide");

    $(".main")
      .classList.remove("show");

  };


$("#close").onclick =
  closeModal;


$("#modal").onclick =
  e => {

    if (e.target.id === "modal") {
      closeModal();
    }

  };


$$(".tab").forEach(
  x => {

    x.onclick = () => {

      $$(".tab")
        .forEach(y =>
          y.classList.remove(
            "active"
          )
        );

      x.classList.add("active");

      filter =
        x.dataset.filter;

      renderChats();

    };

  }
);


window.startChatWith =
  startChatWith;

window.searchUsers =
  searchUsers;

window.saveProfile =
  saveProfile;


/* START */

boot();
