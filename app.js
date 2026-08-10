document.addEventListener("DOMContentLoaded", () => {

  const C = window.NOVA_CONFIG || {};

  const $ = id => document.getElementById(id);

  let sb = null;
  let user = null;
  let profile = null;
  let chats = [];
  let activeChat = null;
  let realtimeChannel = null;
  let authMode = "login";

  const ready =
    typeof C.SUPABASE_URL === "string" &&
    C.SUPABASE_URL.startsWith("https://") &&
    typeof C.SUPABASE_PUBLISHABLE_KEY === "string" &&
    C.SUPABASE_PUBLISHABLE_KEY.length > 20;

  function toast(message) {
    const el = $("toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(window.__toastTimer);

    window.__toastTimer = setTimeout(() => {
      el.classList.remove("show");
    }, 3000);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function time(value) {
    try {
      return new Date(value).toLocaleTimeString(
        document.documentElement.lang === "en"
          ? "en-US"
          : "fa-IR",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );
    } catch {
      return "";
    }
  }

  function show(id) {
    $(id)?.classList.remove("hidden");
  }

  function hide(id) {
    $(id)?.classList.add("hidden");
  }

  function closePanels() {
    [
      "menuPanel",
      "profilePanel",
      "settingsPanel",
      "languagePanel",
      "aboutPanel",
      "newChatPanel",
      "contactPanel",
      "groupPanel",
      "channelPanel"
    ].forEach(hide);
  }


  /* =========================
     AUTH
  ========================= */

  function setAuthMode(mode) {

    authMode = mode;

    const signup = mode === "signup";

    $("signupNameBox")?.classList.toggle(
      "hidden",
      !signup
    );

    $("loginBtn").textContent =
      signup ? "ساخت حساب" : "ورود";

    $("signupBtn").classList.toggle(
      "hidden",
      signup
    );

    $("authTitle").textContent =
      signup
        ? "ساخت حساب BipolarChat"
        : "ورود به BipolarChat";

    $("authMessage").textContent =
      signup
        ? "اطلاعات حساب جدید را وارد کنید."
        : "برای ادامه وارد حساب خود شوید.";

    $("toggleAuth").textContent =
      signup
        ? "حساب دارید؟ ورود"
        : "حساب ندارید؟ ساخت حساب";
  }


  async function login() {

    if (!sb) {
      toast("اتصال Supabase آماده نیست.");
      return;
    }

    const email = $("email").value.trim();
    const password = $("password").value;

    if (!email || !password) {
      $("authMessage").textContent =
        "ایمیل و رمز عبور را وارد کنید.";
      return;
    }

    $("loginBtn").disabled = true;
    $("authMessage").textContent = "در حال ورود...";

    try {

      const { data, error } =
        await sb.auth.signInWithPassword({
          email,
          password
        });

      if (error) {
        console.error("LOGIN ERROR:", error);

        $("authMessage").textContent =
          error.message ||
          "ورود انجام نشد.";

        return;
      }

      if (!data.session) {
        $("authMessage").textContent =
          "ورود انجام شد ولی نشست ایجاد نشد.";
        return;
      }

      user = data.user;

      await enterApp();

    } catch (error) {

      console.error(error);

      $("authMessage").textContent =
        error?.message ||
        "خطای غیرمنتظره در ورود.";

    } finally {
      $("loginBtn").disabled = false;
    }
  }


  async function signup() {

    if (!sb) return;

    const email = $("email").value.trim();
    const password = $("password").value;
    const displayName =
      $("displayName").value.trim() ||
      email.split("@")[0];

    if (!email || !password) {
      $("authMessage").textContent =
        "ایمیل و رمز عبور را وارد کنید.";
      return;
    }

    if (password.length < 6) {
      $("authMessage").textContent =
        "رمز عبور باید حداقل ۶ کاراکتر باشد.";
      return;
    }

    $("loginBtn").disabled = true;
    $("authMessage").textContent =
      "در حال ساخت حساب...";

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
        console.error("SIGNUP ERROR:", error);

        $("authMessage").textContent =
          error.message;

        return;
      }

      if (data.session && data.user) {

        user = data.user;

        await enterApp();

      } else {

        $("authMessage").textContent =
          "حساب ساخته شد. ایمیل تأیید حساب را بررسی کنید.";

      }

    } catch (error) {

      console.error(error);

      $("authMessage").textContent =
        error?.message ||
        "ساخت حساب انجام نشد.";

    } finally {
      $("loginBtn").disabled = false;
    }
  }


  async function forgotPassword() {

    const email = $("email").value.trim();

    if (!email) {
      $("authMessage").textContent =
        "ابتدا ایمیل را وارد کنید.";
      return;
    }

    const { error } =
      await sb.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: window.location.origin
        }
      );

    $("authMessage").textContent =
      error
        ? error.message
        : "لینک بازیابی رمز عبور ارسال شد.";
  }


  async function logout() {

    try {
      await sb.auth.signOut();
    } finally {

      user = null;
      profile = null;
      chats = [];
      activeChat = null;

      if (realtimeChannel) {
        await sb.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }

      closePanels();

      hide("app");
      show("auth");

      setAuthMode("login");
    }
  }


  /* =========================
     APP
  ========================= */

  async function enterApp() {

    if (!user) return;

    hide("auth");
    show("app");

    await loadProfile();
    await loadChats();

    updateHeader();
  }


  async function loadProfile() {

    if (!user) return;

    const { data, error } =
      await sb
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
      console.error("PROFILE ERROR:", error);
    }

    profile = data || {
      id: user.id,
      email: user.email,
      display_name:
        user.user_metadata?.display_name ||
        user.email?.split("@")[0] ||
        "کاربر"
    };

    updateProfileUI();
  }


  function updateProfileUI() {

    if (!profile) return;

    const name =
      profile.display_name ||
      "کاربر";

    $("profileName").value =
      profile.display_name || "";

    $("profileUsername").value =
      profile.username || "";

    $("profileEmail").value =
      profile.email ||
      user?.email ||
      "";

    $("profileBio").value =
      profile.bio || "";

    renderAvatar(
      $("profileAvatar"),
      profile.avatar_url,
      name
    );
  }


  function renderAvatar(element, url, name) {

    if (!element) return;

    if (url) {

      element.innerHTML =
        `<img src="${escapeHTML(url)}" alt="">`;

    } else {

      element.textContent =
        (name || "B")
          .charAt(0)
          .toUpperCase();
    }
  }


  async function saveProfile() {

    if (!user) return;

    const displayName =
      $("profileName").value.trim();

    const username =
      $("profileUsername").value
        .trim()
        .replace(/^@/, "")
        .toLowerCase();

    const bio =
      $("profileBio").value.trim();

    if (!displayName) {
      toast("نام نمایشی را وارد کنید.");
      return;
    }

    if (
      username &&
      !/^[a-zA-Z0-9_]{3,32}$/.test(username)
    ) {
      toast(
        "نام کاربری باید ۳ تا ۳۲ کاراکتر باشد."
      );
      return;
    }

    const { data, error } =
      await sb
        .from("profiles")
        .update({
          display_name: displayName,
          username: username || null,
          bio
        })
        .eq("id", user.id)
        .select()
        .single();

    if (error) {

      console.error(error);

      toast(error.message);
      return;
    }

    profile = data;

    updateProfileUI();
    updateHeader();

    hide("profilePanel");

    toast("پروفایل ذخیره شد.");
  }


  /* =========================
     AVATAR
  ========================= */

  async function uploadAvatar(file) {

    if (!file || !user) return;

    toast(
      "برای تصویر پروفایل ابتدا باید Storage bucket پروژه آماده باشد."
    );
  }


  /* =========================
     HEADER
  ========================= */

  function updateHeader() {

    const name =
      activeChat?.title ||
      profile?.display_name ||
      "BipolarChat";

    $("chatName").textContent = name;

    $("chatStatus").textContent =
      activeChat
        ? activeChat.is_group
          ? "گروه"
          : "گفتگوی خصوصی"
        : "BipolarChat";

    $("chatAvatar").textContent =
      name.charAt(0).toUpperCase();
  }


  /* =========================
     CHATS
  ========================= */

  async function loadChats() {

    if (!user) return;

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

      console.error("CHATS ERROR:", error);

      $("chatList").innerHTML = `
        <div class="empty-list">
          خطا در دریافت گفتگوها.
        </div>
      `;

      return;
    }

    chats = data || [];

    renderChats();
  }


  function renderChats() {

    const list = $("chatList");

    if (!list) return;

    const query =
      $("search").value
        .trim()
        .toLowerCase();

    let filtered = chats;

    if (query) {
      filtered =
        chats.filter(chat =>
          String(chat.title || "")
            .toLowerCase()
            .includes(query)
        );
    }

    if (!filtered.length) {

      list.innerHTML = `
        <div class="empty-list">
          هنوز گفتگویی ندارید.
        </div>
      `;

      return;
    }

    list.innerHTML =
      filtered.map(chat => {

        const messages =
          [...(chat.messages || [])]
            .sort(
              (a,b) =>
                new Date(a.created_at) -
                new Date(b.created_at)
            );

        const last =
          messages[messages.length - 1];

        const title =
          chat.title ||
          "گفتگوی خصوصی";

        return `
          <button
            class="chat ${
              activeChat?.id === chat.id
                ? "selected"
                : ""
            }"
            data-id="${escapeHTML(chat.id)}">

            <span class="avatar">
              ${escapeHTML(
                title.charAt(0).toUpperCase()
              )}
            </span>

            <span class="chat-info">
              <b>${escapeHTML(title)}</b>
              <small>
                ${escapeHTML(
                  last?.body ||
                  "هنوز پیامی نیست"
                )}
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

    list
      .querySelectorAll(".chat")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => openChat(button.dataset.id)
        );

      });
  }


  async function openChat(id) {

    const chat =
      chats.find(x => x.id === id);

    if (!chat) return;

    activeChat = chat;

    updateHeader();
    renderChats();

    await loadMessages();

    if (window.innerWidth <= 700) {

      $("sidebar")
        .classList.add("hide");

      $("main")
        .classList.add("show");
    }
  }


  async function loadMessages() {

    if (!activeChat) return;

    const { data, error } =
      await sb
        .from("messages")
        .select(`
          id,
          body,
          sender_id,
          created_at
        `)
        .eq(
          "conversation_id",
          activeChat.id
        )
        .order(
          "created_at",
          { ascending: true }
        );

    if (error) {

      console.error(error);

      $("messages").innerHTML = `
        <div class="empty-list">
          خطا در دریافت پیام‌ها.
        </div>
      `;

      return;
    }

    renderMessages(data || []);
    subscribeMessages();
  }


  function renderMessages(messages) {

    if (!messages.length) {

      $("messages").innerHTML = `
        <div class="welcome">
          <img
            class="welcome-logo"
            src="https://s6.uupload.ir/files/file_000000002dd082469339a22756c5ad8b_ko8m.png"
            alt="">
          <h1>${escapeHTML(
            activeChat?.title ||
            "BipolarChat"
          )}</h1>
          <p>اولین پیام را بفرستید.</p>
        </div>
      `;

      return;
    }

    $("messages").innerHTML =
      messages.map(message => {

        const mine =
          message.sender_id === user.id;

        return `
          <div class="bubble ${mine ? "me" : ""}">
            ${escapeHTML(message.body)}
            <time>${time(message.created_at)}</time>
          </div>
        `;

      }).join("");

    scrollMessages();
  }


  function appendMessage(message) {

    const box = $("messages");

    if (
      box.querySelector(".welcome") ||
      box.querySelector(".empty-list")
    ) {
      box.innerHTML = "";
    }

    const mine =
      message.sender_id === user.id;

    box.insertAdjacentHTML(
      "beforeend",
      `
        <div class="bubble ${mine ? "me" : ""}">
          ${escapeHTML(message.body)}
          <time>${time(message.created_at)}</time>
        </div>
      `
    );

    scrollMessages();
  }


  function scrollMessages() {

    const box = $("messages");

    if (box) {
      box.scrollTop =
        box.scrollHeight;
    }
  }


  async function sendMessage() {

    if (!activeChat) {
      toast("ابتدا یک گفتگو انتخاب کنید.");
      return;
    }

    const input = $("text");
    const body = input.value.trim();

    if (!body) return;

    const old = body;

    input.value = "";

    const { data, error } =
      await sb
        .from("messages")
        .insert({
          conversation_id: activeChat.id,
          sender_id: user.id,
          body
        })
        .select()
        .single();

    if (error) {

      console.error(error);

      input.value = old;

      toast(
        "ارسال پیام انجام نشد: " +
        error.message
      );

      return;
    }

    appendMessage(data);
  }


  function subscribeMessages() {

    if (realtimeChannel) {
      sb.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    if (!activeChat) return;

    realtimeChannel =
      sb
        .channel(
          `messages-${activeChat.id}-${Date.now()}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter:
              `conversation_id=eq.${activeChat.id}`
          },
          payload => {

            if (
              payload.new.sender_id !== user.id
            ) {
              appendMessage(payload.new);
            }

          }
        )
        .subscribe();
  }


  /* =========================
     CONTACT
  ========================= */

  async function searchProfile() {

    let value =
      $("contactSearch")
        .value
        .trim()
        .replace(/^@/, "");

    if (!value) {
      toast("ایمیل یا نام کاربری را وارد کنید.");
      return;
    }

    let query;

    if (value.includes("@")) {

      query =
        sb
          .from("profiles")
          .select(
            "id,email,display_name,username"
          )
          .eq("email", value)
          .maybeSingle();

    } else {

      query =
        sb
          .from("profiles")
          .select(
            "id,email,display_name,username"
          )
          .eq("username", value)
          .maybeSingle();
    }

    const { data, error } =
      await query;

    if (error) {
      console.error(error);
      toast(error.message);
      return;
    }

    if (!data) {
      toast("کاربر پیدا نشد.");
      return;
    }

    if (data.id === user.id) {
      toast("این حساب خود شماست.");
      return;
    }

    const { data: conversationId, error: rpcError } =
      await sb.rpc(
        "create_private_conversation",
        {
          other_user: data.id
        }
      );

    if (rpcError) {

      console.error(rpcError);

      toast(rpcError.message);
      return;
    }

    hide("contactPanel");
    hide("newChatPanel");

    await loadChats();
    await openChat(conversationId);

    toast("گفتگو ایجاد شد.");
  }


  /* =========================
     GROUP
  ========================= */

  async function createGroup() {

    const title =
      $("groupTitle")
        .value
        .trim();

    if (!title) {
      toast("نام گروه را وارد کنید.");
      return;
    }

    const { data, error } =
      await sb
        .from("conversations")
        .insert({
          title,
          is_group: true
        })
        .select()
        .single();

    if (error) {

      console.error(error);
      toast(error.message);
      return;
    }

    const { error: memberError } =
      await sb
        .from("conversation_members")
        .insert({
          conversation_id: data.id,
          user_id: user.id
        });

    if (memberError) {

      console.error(memberError);
      toast(memberError.message);
      return;
    }

    hide("groupPanel");
    hide("newChatPanel");

    $("groupTitle").value = "";
    $("groupUsername").value = "";
    $("groupDescription").value = "";

    await loadChats();
    await openChat(data.id);

    toast("گروه ساخته شد.");
  }


  /* =========================
     CHANNEL
  ========================= */

  async function createChannel() {

    const title =
      $("channelTitle")
        .value
        .trim();

    if (!title) {
      toast("نام کانال را وارد کنید.");
      return;
    }

    const { data, error } =
      await sb
        .from("conversations")
        .insert({
          title,
          is_group: true
        })
        .select()
        .single();

    if (error) {

      console.error(error);
      toast(error.message);
      return;
    }

    const { error: memberError } =
      await sb
        .from("conversation_members")
        .insert({
          conversation_id: data.id,
          user_id: user.id
        });

    if (memberError) {

      console.error(memberError);
      toast(memberError.message);
      return;
    }

    hide("channelPanel");
    hide("newChatPanel");

    $("channelTitle").value = "";
    $("channelUsername").value = "";
    $("channelDescription").value = "";

    await loadChats();
    await openChat(data.id);

    toast("کانال ساخته شد.");
  }


  /* =========================
     LANGUAGE
  ========================= */

  const translations = {
    fa: {
      search: "جستجوی گفتگوها",
      message: "پیام بنویسید...",
      all: "همه",
      unread: "خوانده‌نشده"
    },
    en: {
      search: "Search chats",
      message: "Write a message...",
      all: "All",
      unread: "Unread"
    }
  };

  function setLanguage(lang) {

    const valid =
      lang === "en" ? "en" : "fa";

    localStorage.setItem(
      "bipolar_language",
      valid
    );

    document.documentElement.lang = valid;
    document.documentElement.dir =
      valid === "en" ? "ltr" : "rtl";

    $("search").placeholder =
      translations[valid].search;

    $("text").placeholder =
      translations[valid].message;

    document
      .querySelectorAll(".chat-tab")
      .forEach((button,index) => {
        button.textContent =
          index === 0
            ? translations[valid].all
            : translations[valid].unread;
      });

    $("currentLanguage").textContent =
      valid === "en"
        ? "English"
        : "فارسی";

    $("faCheck").textContent =
      valid === "fa" ? "✓" : "";

    $("enCheck").textContent =
      valid === "en" ? "✓" : "";
  }


  /* =========================
     SETTINGS
  ========================= */

  function openSettings(title, content) {

    $("settingsTitle").textContent = title;

    $("settingsContent").innerHTML = content;

    show("settingsPanel");
  }


  /* =========================
     EVENTS
  ========================= */

  $("loginBtn")
    .addEventListener(
      "click",
      () => {
        if (authMode === "signup") {
          signup();
        } else {
          login();
        }
      }
    );

  $("signupBtn")
    .addEventListener(
      "click",
      () => setAuthMode("signup")
    );

  $("toggleAuth")
    .addEventListener(
      "click",
      () =>
        setAuthMode(
          authMode === "login"
            ? "signup"
            : "login"
        )
    );

  $("forgot")
    .addEventListener(
      "click",
      forgotPassword
    );

  $("composer")
    .addEventListener(
      "submit",
      event => {
        event.preventDefault();
        sendMessage();
      }
    );

  $("text")
    .addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {
          event.preventDefault();
          sendMessage();
        }

      }
    );

  $("search")
    .addEventListener(
      "input",
      renderChats
    );


  $("menuBtn")
    .addEventListener(
      "click",
      () => show("menuPanel")
    );


  $("closeMenu")
    .addEventListener(
      "click",
      () => hide("menuPanel")
    );


  $("profileMenuBtn")
    .addEventListener(
      "click",
      () => {
        hide("menuPanel");
        updateProfileUI();
        show("profilePanel");
      }
    );


  $("chatSettingsBtn")
    .addEventListener(
      "click",
      () => {

        hide("menuPanel");

        openSettings(
          "تنظیمات گفتگو",
          `
            <div class="setting-card">
              <strong>نمایش پیام‌ها</strong>
              <p>
                تنظیمات ظاهری گفتگو در نسخه BipolarChat-v1.
              </p>
            </div>

            <div class="setting-card">
              <strong>حالت گفتگو</strong>
              <p>
                تنظیمات این بخش در ساختار فعلی آماده اتصال به دیتابیس است.
              </p>
            </div>
          `
        );

      }
    );


  $("privacyBtn")
    .addEventListener(
      "click",
      () => {

        hide("menuPanel");

        openSettings(
          "حریم خصوصی و امنیت",
          `
            <div class="setting-card">
              <strong>حساب</strong>
              <p>
                اطلاعات حساب شما توسط Supabase Auth مدیریت می‌شود.
              </p>
            </div>

            <div class="setting-card">
              <strong>دستگاه‌ها</strong>
              <p>
                مدیریت نشست‌های فعال در مرحله بعدی متصل می‌شود.
              </p>
            </div>
          `
        );

      }
    );


  $("storageBtn")
    .addEventListener(
      "click",
      () => {

        hide("menuPanel");

        openSettings(
          "ذخیره‌سازی داده",
          `
            <div class="setting-card">
              <strong>داده‌های محلی</strong>
              <p>
                تنظیمات زبان و اطلاعات رابط در مرورگر ذخیره می‌شوند.
              </p>
            </div>

            <div class="setting-card">
              <strong>داده‌های حساب</strong>
              <p>
                پیام‌ها و اطلاعات حساب در Supabase نگهداری می‌شوند.
              </p>
            </div>
          `
        );

      }
    );


  $("foldersBtn")
    .addEventListener(
      "click",
      () => {

        hide("menuPanel");

        openSettings(
          "پوشه‌ها",
          `
            <div class="setting-card">
              <strong>پوشه‌های گفتگو</strong>
              <p>
                ساختار پوشه‌بندی BipolarChat آماده توسعه است.
              </p>
            </div>
          `
        );

      }
    );


  $("powerBtn")
    .addEventListener(
      "click",
      () => {

        hide("menuPanel");

        openSettings(
          "صرفه‌جویی انرژی",
          `
            <div class="setting-card">
              <strong>Power Saving</strong>
              <p>
                در نسخه فعلی اعلان‌های Push فعال نیستند.
                حالت صرفه‌جویی برای نسخه بعدی آماده توسعه است.
              </p>
            </div>
          `
        );

      }
    );


  $("languageMenuBtn")
    .addEventListener(
      "click",
      () => {
        hide("menuPanel");
        show("languagePanel");
      }
    );


  $("aboutMenuBtn")
    .addEventListener(
      "click",
      () => {
        hide("menuPanel");
        show("aboutPanel");
      }
    );


  $("logoutBtn")
    .addEventListener(
      "click",
      logout
    );


  $("newChatBtn")
    .addEventListener(
      "click",
      () => show("newChatPanel")
    );


  $("addContactBtn")
    .addEventListener(
      "click",
      () => {
        hide("newChatPanel");
        show("contactPanel");
      }
    );


  $("saveContactBtn")
    .addEventListener(
      "click",
      searchProfile
    );


  $("createGroupBtn")
    .addEventListener(
      "click",
      () => {
        hide("newChatPanel");
        show("groupPanel");
      }
    );


  $("saveGroupBtn")
    .addEventListener(
      "click",
      createGroup
    );


  $("createChannelBtn")
    .addEventListener(
      "click",
      () => {
        hide("newChatPanel");
        show("channelPanel");
      }
    );


  $("saveChannelBtn")
    .addEventListener(
      "click",
      createChannel
    );


  $("saveProfileBtn")
    .addEventListener(
      "click",
      saveProfile
    );


  $("addAvatarBtn")
    .addEventListener(
      "click",
      () => $("avatarFile").click()
    );


  $("avatarFile")
    .addEventListener(
      "change",
      event => {
        uploadAvatar(
          event.target.files?.[0]
        );
      }
    );


  $("removeAvatarBtn")
    .addEventListener(
      "click",
      async () => {

        if (!user) return;

        const { data, error } =
          await sb
            .from("profiles")
            .update({
              avatar_url: null
            })
            .eq("id", user.id)
            .select()
            .single();

        if (error) {
          toast(error.message);
          return;
        }

        profile = data;
        updateProfileUI();

        toast("تصویر پروفایل حذف شد.");
      }
    );


  $("backBtn")
    .addEventListener(
      "click",
      () => {

        $("sidebar")
          .classList.remove("hide");

        $("main")
          .classList.remove("show");

        activeChat = null;

        updateHeader();
      }
    );


  $("chatSearchBtn")
    .addEventListener(
      "click",
      () => {
        $("search").focus();
      }
    );


  $("chatMoreBtn")
    .addEventListener(
      "click",
      () => {

        if (!activeChat) {
          toast("ابتدا یک گفتگو انتخاب کنید.");
          return;
        }

        openSettings(
          "تنظیمات گفتگو",
          `
            <div class="setting-card">
              <strong>${escapeHTML(
                activeChat.title ||
                "گفتگوی خصوصی"
              )}</strong>
              <p>
                تنظیمات این گفتگو در BipolarChat.
              </p>
            </div>
          `
        );
      }
    );


  $("headerProfileBtn")
    .addEventListener(
      "click",
      () => {

        if (
          !activeChat &&
          profile
        ) {
          updateProfileUI();
          show("profilePanel");
        }
      }
    );


  $("attachBtn")
    .addEventListener(
      "click",
      () => $("file").click()
    );


  document
    .querySelectorAll("[data-close]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          hide(
            button.dataset.close
          );
        }
      );

    });


  document
    .querySelectorAll(".language-option")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          setLanguage(
            button.dataset.lang
          );
        }
      );

    });


  document
    .querySelectorAll(".overlay")
    .forEach(overlay => {

      overlay.addEventListener(
        "click",
        event => {

          if (
            event.target === overlay
          ) {
            hide(overlay.id);
          }

        }
      );

    });


  /* =========================
     BOOT
  ========================= */

  async function boot() {

    if (!ready) {

      $("authMessage").textContent =
        "config.js صحیح تنظیم نشده است.";

      return;
    }

    if (!window.supabase) {

      $("authMessage").textContent =
        "کتابخانه Supabase بارگذاری نشد.";

      return;
    }

    try {

      sb =
        window.supabase.createClient(
          C.SUPABASE_URL,
          C.SUPABASE_PUBLISHABLE_KEY
        );

      const {
        data,
        error
      } =
        await sb.auth.getSession();

      if (error) {
        console.error(error);
      }

      if (data?.session?.user) {

        user =
          data.session.user;

        await enterApp();

      } else {

        show("auth");

      }

      sb.auth.onAuthStateChange(
        async (_event, session) => {

          if (session?.user) {

            user =
              session.user;

            await enterApp();

          } else {

            user = null;

            hide("app");
            show("auth");

          }

        }
      );

    } catch (error) {

      console.error(
        "SUPABASE BOOT ERROR:",
        error
      );

      $("authMessage").textContent =
        error?.message ||
        "اتصال به Supabase برقرار نشد.";
    }
  }


  const savedLanguage =
    localStorage.getItem(
      "bipolar_language"
    ) || "fa";

  setLanguage(savedLanguage);
  setAuthMode("login");

  boot();

});
