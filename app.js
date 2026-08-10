const C = window.NOVA_CONFIG || {};

const ready =
  C.SUPABASE_URL &&
  !C.SUPABASE_URL.includes("PASTE_") &&
  C.SUPABASE_PUBLISHABLE_KEY &&
  !C.SUPABASE_PUBLISHABLE_KEY.includes("PASTE_");

let sb = null;
let user = null;
let active = null;
let filter = "all";
let channel = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m])
  );

const time = (x) =>
  new Date(x).toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit"
  });

function notice(text) {
  const el = $("#authMessage");
  if (el) el.textContent = text;
}

function modal(title, body) {
  const titleEl = $("#modalTitle");
  const bodyEl = $("#modalBody");
  const modalEl = $("#modal");

  if (!titleEl || !bodyEl || !modalEl) return;

  titleEl.textContent = title;
  bodyEl.innerHTML = body;
  modalEl.classList.remove("hidden");
}

function closeModal() {
  const modalEl = $("#modal");
  if (modalEl) modalEl.classList.add("hidden");
}

function showAuth() {
  $("#auth")?.classList.remove("hidden");
  $("#app")?.classList.add("hidden");
}

async function showApp() {
  $("#auth")?.classList.add("hidden");
  $("#app")?.classList.remove("hidden");

  await loadProfile();
  await loadChats();
}

async function boot() {
  try {
    if (!ready) {
      notice("config.js هنوز تنظیم نشده است.");
      return;
    }

    sb = window.supabase.createClient(
      C.SUPABASE_URL,
      C.SUPABASE_PUBLISHABLE_KEY
    );

    const {
      data: { user: currentUser },
      error
    } = await sb.auth.getUser();

    if (error) {
      console.error("Auth error:", error);
      showAuth();
      return;
    }

    user = currentUser || null;

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
  } catch (error) {
    console.error("BOOT ERROR:", error);
    showAuth();
    notice("خطایی در اجرای برنامه رخ داد. صفحه را Refresh کنید.");
  }
}


async function loadProfile() {
  if (!user || !sb) return;

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Profile error:", error);
    return;
  }

  if (data) {
    const displayName = data.display_name || user.email || "کاربر";

    if ($("#name")) {
      $("#name").textContent = displayName;
    }

    if ($("#avatar")) {
      $("#avatar").textContent = displayName[0] || "B";
    }
  }
}


async function loadChats() {
  if (!user || !sb) return;

  const query = sb
    .from("conversations")
    .select(
      "id,title,is_group,created_at,conversation_members!inner(user_id),messages(body,created_at,sender_id)"
    )
    .eq("conversation_members.user_id", user.id)
    .order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("Chats error:", error);
    window.chats = [];
    renderChats();
    return;
  }

  window.chats = data || [];
  renderChats();
}


function renderChats() {
  const list = $("#chatList");
  const search = $("#search");

  if (!list) return;

  const q = search
    ? search.value.trim().toLowerCase()
    : "";

  let chats = window.chats || [];

  if (filter === "unread") {
    chats = [];
  }

  if (q) {
    chats = chats.filter((c) =>
      (c.title || "گفتگو").toLowerCase().includes(q)
    );
  }

  list.innerHTML = chats
    .map((c) => {
      const messages = c.messages || [];

      const lastMessage = messages
        .slice()
        .sort(
          (a, b) =>
            new Date(a.created_at) -
            new Date(b.created_at)
        )
        .at(-1);

      const title = c.title || "گفتگو";

      return `
        <button
          class="chat ${active === c.id ? "selected" : ""}"
          onclick="openChat('${c.id}')"
        >
          <span class="avatar">
            ${esc(title[0] || "N")}
          </span>

          <span>
            <b>${esc(title)}</b>
            <small>
              ${esc(
                lastMessage?.body ||
                "هنوز پیامی نیست"
              )}
            </small>
          </span>

          <time>
            ${
              lastMessage
                ? time(lastMessage.created_at)
                : ""
            }
          </time>
        </button>
      `;
    })
    .join("");

  if ($("#allCount")) {
    $("#allCount").textContent = chats.length;
  }
}


async function openChat(id) {
  active = id;

  const conversation = (window.chats || []).find(
    (x) => x.id === id
  );

  if (!conversation) return;

  const title = conversation.title || "گفتگو";

  if ($("#name")) {
    $("#name").textContent = title;
  }

  if ($("#status")) {
    $("#status").textContent =
      conversation.is_group
        ? "گروه"
        : "گفتگوی خصوصی";
  }

  if ($("#avatar")) {
    $("#avatar").textContent = title[0] || "N";
  }

  renderChats();

  await loadMessages();

  if (window.innerWidth < 800) {
    $(".sidebar")?.classList.add("hide");
    $(".main")?.classList.add("show");
  }
}


async function loadMessages() {
  if (!active || !sb || !user) return;

  const { data, error } = await sb
    .from("messages")
    .select(
      "id,body,sender_id,created_at"
    )
    .eq("conversation_id", active)
    .order("created_at");

  if (error) {
    console.error("Messages error:", error);
    return;
  }

  const messages = $("#messages");

  if (!messages) return;

  messages.innerHTML =
    (data || [])
      .map(
        (m) => `
          <div class="bubble ${
            m.sender_id === user.id
              ? "me"
              : ""
          }">
            ${esc(m.body)}
            <time>${time(m.created_at)}</time>
          </div>
        `
      )
      .join("") ||
    `
      <div class="empty">
        هنوز پیامی نیست. اولین پیام را بفرستید.
      </div>
    `;

  messages.scrollTop = messages.scrollHeight;

  if (channel) {
    await sb.removeChannel(channel);
  }

  channel = sb
    .channel("conversation:" + active)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter:
          "conversation_id=eq." + active
      },
      (payload) => {
        if (
          payload.new.sender_id !==
          user.id
        ) {
          appendMessage(payload.new);
        }
      }
    )
    .subscribe();
}


function appendMessage(message) {
  const messages = $("#messages");

  if (!messages) return;

  messages.insertAdjacentHTML(
    "beforeend",
    `
      <div class="bubble">
        ${esc(message.body)}
        <time>${time(message.created_at)}</time>
      </div>
    `
  );

  messages.scrollTop = messages.scrollHeight;
}


/* SEND MESSAGE */

$("#composer")?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (!active || !user || !sb) return;

    const input = $("#text");

    if (!input) return;

    const body = input.value.trim();

    if (!body) return;

    input.value = "";

    const { data, error } = await sb
      .from("messages")
      .insert({
        conversation_id: active,
        sender_id: user.id,
        body
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    if (data) {
      appendMessage(data);
    }
  }
);


/* LOGIN */

$("#loginBtn")?.addEventListener(
  "click",
  async () => {
    if (!ready) {
      notice("config.js هنوز تنظیم نشده است.");
      return;
    }

    const email =
      $("#email")?.value.trim();

    const password =
      $("#password")?.value;

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
);


/* SIGN UP */

$("#signupBtn")?.addEventListener(
  "click",
  async () => {
    if (!ready) {
      notice("config.js هنوز تنظیم نشده است.");
      return;
    }

    const email =
      $("#email")?.value.trim();

    const password =
      $("#password")?.value;

    const displayName =
      $("#displayName")?.value.trim() ||
      email?.split("@")[0] ||
      "کاربر";

    if (!email || !password) {
      notice(
        "ایمیل و رمز عبور را وارد کنید."
      );
      return;
    }

    if (password.length < 6) {
      notice(
        "رمز عبور باید حداقل ۶ کاراکتر باشد."
      );
      return;
    }

    const { data, error } =
      await sb.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName
          }
        }
      });

    if (error) {
      notice(error.message);
      return;
    }

    if (data?.session) {
      notice("حساب ساخته شد.");
    } else {
      notice(
        "حساب ساخته شد. ایمیل تأیید را بررسی کنید."
      );
    }
  }
);


/* PASSWORD RESET */

$("#forgot")?.addEventListener(
  "click",
  async () => {
    if (!ready) return;

    const email =
      $("#email")?.value.trim();

    if (!email) {
      notice("ایمیل را وارد کنید.");
      return;
    }

    const { error } =
      await sb.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: location.href
        }
      );

    notice(
      error
        ? error.message
        : "لینک بازیابی ارسال شد."
    );
  }
);


/* LOGOUT
   نسخه جدید دیگر به #logout وابسته نیست.
*/

window.logoutUser = async () => {
  if (sb) {
    await sb.auth.signOut();
  }
};


/* SEARCH */

$("#search")?.addEventListener(
  "input",
  renderChats
);


/* TABS */

$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((x) =>
      x.classList.remove("active")
    );

    tab.classList.add("active");

    filter =
      tab.dataset.filter || "all";

    renderChats();
  });
});


/* MOBILE BACK */

$("#back")?.addEventListener(
  "click",
  () => {
    $(".sidebar")?.classList.remove("hide");
    $(".main")?.classList.remove("show");
  }
);


/* MODAL */

$("#close")?.addEventListener(
  "click",
  closeModal
);

$("#modal")?.addEventListener(
  "click",
  (event) => {
    if (event.target.id === "modal") {
      closeModal();
    }
  }
);


/* PROFILE */

$("#profileBtn")?.addEventListener(
  "click",
  () => {
    modal(
      "حساب من",
      `
        <p>${esc(user?.email || "")}</p>

        <button
          class="secondary"
          onclick="logoutUser()"
        >
          خروج از حساب
        </button>
      `
    );
  }
);


/* NEW CHAT */

$("#newChat")?.addEventListener(
  "click",
  () => {
    modal(
      "گفتگوی جدید",
      `
        <input
          id="newEmail"
          placeholder="ایمیل کاربر"
        >

        <button
          class="primary"
          onclick="startChat()"
        >
          ایجاد گفتگو
        </button>
      `
    );
  }
);


window.startChat = async () => {
  const input = $("#newEmail");

  if (!input || !sb) return;

  const email = input.value.trim();

  if (!email) {
    alert("ایمیل کاربر را وارد کنید.");
    return;
  }

  const { data: profile, error } =
    await sb
      .from("profiles")
      .select("id,display_name")
      .eq("email", email)
      .single();

  if (error || !profile) {
    alert("کاربر پیدا نشد.");
    return;
  }

  const {
    data: conversationId,
    error: conversationError
  } = await sb.rpc(
    "create_private_conversation",
    {
      other_user: profile.id
    }
  );

  if (conversationError) {
    alert(conversationError.message);
    return;
  }

  closeModal();

  await loadChats();

  openChat(conversationId);
};


/* FILE BUTTON */

$("#fileBtn")?.addEventListener(
  "click",
  () => {
    $("#file")?.click();
  }
);


/* START */

boot();
