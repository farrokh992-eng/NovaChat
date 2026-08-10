document.addEventListener("DOMContentLoaded", () => {

  const C = window.NOVA_CONFIG || {};

  const ready =
    typeof C.SUPABASE_URL === "string" &&
    C.SUPABASE_URL.startsWith("https://") &&
    typeof C.SUPABASE_PUBLISHABLE_KEY === "string" &&
    C.SUPABASE_PUBLISHABLE_KEY.startsWith("sb_");

  let sb = null;
  let user = null;
  let active = null;
  let chats = [];
  let currentLanguage = localStorage.getItem("bipolar_language") || "fa";

  const $ = (id) => document.getElementById(id);

  function text(el, value) {
    if (el) el.textContent = value;
  }

  function showAuthMessage(message) {
    text($("authMessage"), message);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatTime(value) {
    try {
      return new Date(value).toLocaleTimeString(
        currentLanguage === "fa" ? "fa-IR" : "en-US",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );
    } catch {
      return "";
    }
  }

  function showAuth() {
    $("auth")?.classList.remove("hidden");
    $("app")?.classList.add("hidden");
  }

  function showApp() {
    $("auth")?.classList.add("hidden");
    $("app")?.classList.remove("hidden");
  }

  async function boot() {

    if (!ready) {
      showAuthMessage(
        "تنظیمات Supabase در config.js کامل نیست."
      );
      return;
    }

    if (typeof window.supabase === "undefined") {
      showAuthMessage(
        "اتصال Supabase برقرار نشد. صفحه را دوباره باز کنید."
      );
      return;
    }

    try {

      sb = window.supabase.createClient(
        C.SUPABASE_URL,
        C.SUPABASE_PUBLISHABLE_KEY
      );

      const {
        data: { session }
      } = await sb.auth.getSession();

      user = session?.user || null;

      if (user) {
        await loadUser();
      } else {
        showAuth();
      }

      sb.auth.onAuthStateChange((_event, session) => {

        user = session?.user || null;

        if (user) {
          loadUser();
        } else {
          showAuth();
        }

      });

    } catch (error) {

      console.error(error);

      showAuthMessage(
        "اتصال به سرور انجام نشد. اتصال اینترنت را بررسی کنید."
      );
    }
  }


  async function loadUser() {

    showApp();

    try {

      const { data, error } =
        await sb
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

      if (error) {
        console.error(error);
        return;
      }

      window.BIPOLAR_PROFILE = data || {
        email: user.email,
        display_name: user.email?.split("@")[0] || "کاربر"
      };

      updateProfileUI();
      await loadChats();

    } catch (error) {

      console.error(error);

    }
  }


  function updateProfileUI() {

    const profile = window.BIPOLAR_PROFILE || {};

    const name =
      profile.display_name ||
      user?.email?.split("@")[0] ||
      "کاربر";

    const username =
      profile.username
        ? "@" + profile.username
        : "";

    text($("name"), name);

    text(
      $("status"),
      username ||
      (profile.is_verified ? "حساب تأییدشده" : "آنلاین")
    );

    text(
      $("avatar"),
      name.charAt(0).toUpperCase()
    );
  }


  async function loadChats() {

    if (!sb || !user) return;

    try {

      const { data, error } =
        await sb
          .from("conversations")
          .select(`
            id,
            title,
            is_group,
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
          .order(
            "created_at",
            { ascending: false }
          );

      if (error) {
        console.error(error);
        chats = [];
        renderChats();
        return;
      }

      chats = data || [];

      renderChats();

    } catch (error) {

      console.error(error);
    }
  }


  function renderChats() {

    const list = $("chatList");

    if (!list) return;

    if (!chats.length) {

      list.innerHTML = `
        <div class="empty">
          هنوز گفتگویی ندارید.
        </div>
      `;

      text($("allCount"), "0");
      return;
    }

    list.innerHTML = chats.map(chat => {

      const messages =
        [...(chat.messages || [])]
          .sort(
            (a, b) =>
              new Date(a.created_at) -
              new Date(b.created_at)
          );

      const last =
        messages[messages.length - 1];

      const title =
        chat.title ||
        "گفتگو";

      return `
        <button
          class="chat ${active === chat.id ? "selected" : ""}"
          data-chat-id="${escapeHTML(chat.id)}"
        >

          <span class="avatar">
            ${escapeHTML(title.charAt(0))}
          </span>

          <span class="chat-info">
            <b>${escapeHTML(title)}</b>
            <small>
              ${escapeHTML(
                last?.body || "هنوز پیامی نیست"
              )}
            </small>
          </span>

          <time>
            ${last ? formatTime(last.created_at) : ""}
          </time>

        </button>
      `;

    }).join("");

    list
      .querySelectorAll("[data-chat-id]")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => openChat(button.dataset.chatId)
        );

      });

    text($("allCount"), String(chats.length));
  }


  async function openChat(id) {

    active = id;

    const chat =
      chats.find(x => x.id === id);

    if (!chat) return;

    text(
      $("name"),
      chat.title || "گفتگو"
    );

    text(
      $("status"),
      chat.is_group
        ? "گروه"
        : "گفتگوی خصوصی"
    );

    text(
      $("avatar"),
      (chat.title || "N").charAt(0)
    );

    renderChats();

    await loadMessages();

    if (window.innerWidth < 800) {

      document
        .querySelector(".sidebar")
        ?.classList.add("hide");

      document
        .querySelector(".main")
        ?.classList.add("show");
    }
  }


  async function loadMessages() {

    if (!active || !sb || !user) return;

    try {

      const { data, error } =
        await sb
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

        $("messages").innerHTML = `
          <div class="empty">
            خطا در دریافت پیام‌ها
          </div>
        `;

        return;
      }

      const messages = data || [];

      $("messages").innerHTML =
        messages.map(message => `
          <div class="bubble ${
            message.sender_id === user.id
              ? "me"
              : ""
          }">

            ${escapeHTML(message.body)}

            <time>
              ${formatTime(message.created_at)}
            </time>

          </div>
        `).join("") ||

        `
          <div class="empty">
            هنوز پیامی نیست.
            اولین پیام را بفرستید.
          </div>
        `;

      const box = $("messages");

      if (box) {
        box.scrollTop = box.scrollHeight;
      }

    } catch (error) {

      console.error(error);

    }
  }


  async function sendMessage() {

    if (!active) return;

    const input = $("text");

    const body =
      input?.value.trim();

    if (!body) return;

    input.value = "";

    try {

      const { data, error } =
        await sb
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

        alert(
          "پیام ارسال نشد: " +
          error.message
        );

        input.value = body;

        return;
      }

      appendMessage(data);

      await loadChats();

    } catch (error) {

      console.error(error);

      alert("خطا در ارسال پیام.");

      input.value = body;
    }
  }


  function appendMessage(message) {

    const box = $("messages");

    if (!box) return;

    if (
      box.querySelector(".empty")
    ) {
      box.innerHTML = "";
    }

    box.insertAdjacentHTML(
      "beforeend",
      `
        <div class="bubble ${
          message.sender_id === user.id
            ? "me"
            : ""
        }">

          ${escapeHTML(message.body)}

          <time>
            ${formatTime(message.created_at)}
          </time>

        </div>
      `
    );

    box.scrollTop =
      box.scrollHeight;
  }


  async function login() {

    if (!sb) return;

    const email =
      $("email")?.value.trim();

    const password =
      $("password")?.value;

    if (!email || !password) {

      showAuthMessage(
        "ایمیل و رمز عبور را وارد کنید."
      );

      return;
    }

    showAuthMessage(
      "در حال ورود..."
    );

    const { error } =
      await sb.auth.signInWithPassword({
        email,
        password
      });

    if (error) {

      showAuthMessage(
        error.message
      );

    }

  }


  async function signup() {

    if (!sb) return;

    const email =
      $("email")?.value.trim();

    const password =
      $("password")?.value;

    const displayName =
      $("displayName")?.value.trim() ||
      email?.split("@")[0] ||
      "کاربر";

    if (!email || !password) {

      showAuthMessage(
        "ایمیل و رمز عبور را وارد کنید."
      );

      return;
    }

    if (password.length < 6) {

      showAuthMessage(
        "رمز عبور باید حداقل ۶ کاراکتر باشد."
      );

      return;
    }

    showAuthMessage(
      "در حال ساخت حساب..."
    );

    try {

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

        showAuthMessage(
          error.message
        );

        return;
      }

      if (data.session) {

        showAuthMessage(
          "حساب ساخته شد."
        );

      } else {

        showAuthMessage(
          "حساب ساخته شد. ایمیل تأیید را بررسی کنید."
        );

      }

    } catch (error) {

      console.error(error);

      showAuthMessage(
        "ساخت حساب انجام نشد."
      );
    }
  }


  async function forgotPassword() {

    const email =
      $("email")?.value.trim();

    if (!email) {

      showAuthMessage(
        "ابتدا ایمیل را وارد کنید."
      );

      return;
    }

    try {

      const { error } =
        await sb.auth.resetPasswordForEmail(
          email,
          {
            redirectTo:
              window.location.origin
          }
        );

      showAuthMessage(
        error
          ? error.message
          : "لینک بازیابی رمز ارسال شد."
      );

    } catch (error) {

      console.error(error);

      showAuthMessage(
        "ارسال لینک بازیابی انجام نشد."
      );
    }
  }


  async function logout() {

    try {

      await sb?.auth.signOut();

    } catch (error) {

      console.error(error);

    }
  }


  function setupEvents() {

    $("loginBtn")
      ?.addEventListener(
        "click",
        login
      );

    $("signupBtn")
      ?.addEventListener(
        "click",
        signup
      );

    $("forgot")
      ?.addEventListener(
        "click",
        forgotPassword
      );

    $("logout")
      ?.addEventListener(
        "click",
        logout
      );

    $("composer")
      ?.addEventListener(
        "submit",
        event => {
          event.preventDefault();
          sendMessage();
        }
      );

    $("search")
      ?.addEventListener(
        "input",
        renderChats
      );

    $("back")
      ?.addEventListener(
        "click",
        () => {

          document
            .querySelector(".sidebar")
            ?.classList.remove("hide");

          document
            .querySelector(".main")
            ?.classList.remove("show");

        }
      );

  }


  setupEvents();
  boot();

});
