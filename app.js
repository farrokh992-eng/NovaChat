document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const C = window.NOVA_CONFIG || {};
  const $ = id => document.getElementById(id);

  let sb = null;
  let user = null;
  let profile = null;
  let activeChat = null;
  let chats = [];
  let realtimeChannel = null;

  const ready =
    typeof C.SUPABASE_URL === "string" &&
    C.SUPABASE_URL.startsWith("https://") &&
    typeof C.SUPABASE_PUBLISHABLE_KEY === "string" &&
    C.SUPABASE_PUBLISHABLE_KEY.startsWith("sb_");

  /* =========================
     HELPERS
  ========================= */

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(message) {
    const el = $("toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(window.__toastTimer);

    window.__toastTimer = setTimeout(() => {
      el.classList.remove("show");
    }, 2800);
  }

  function show(el) {
    el?.classList.remove("hidden");
  }

  function hide(el) {
    el?.classList.add("hidden");
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

  function closeAllPanels() {
    [
      "menuPanel",
      "profilePanel",
      "languagePanel",
      "aboutPanel",
      "newChatPanel",
      "contactPanel",
      "groupPanel",
      "channelPanel"
    ].forEach(id => hide($(id)));
  }

  function showAuthMessage(message) {
    const el = $("authMessage");
    if (el) el.textContent = message;
  }

  /* =========================
     LANGUAGE
  ========================= */

  const translations = {
    fa: {
      appName: "BipolarChat",
      login: "ورود",
      signup: "ساخت حساب",
      email: "ایمیل",
      password: "رمز عبور",
      forgot: "رمز عبور را فراموش کرده‌اید؟",
      online: "آنلاین",
      search: "جستجوی گفتگوها",
      all: "همه",
      unread: "خوانده‌نشده",
      newChat: "گفتگوی جدید",
      profile: "پروفایل من",
      language: "زبان",
      about: "درباره",
      logout: "خروج",
      privateChat: "گفتگوی خصوصی",
      send: "پیام بنویسید...",
      noChats: "هنوز گفتگویی ندارید.",
      noMessages: "هنوز پیامی نیست",
      firstMessage: "اولین پیام را بفرستید.",
      contact: "افزودن مخاطب",
      group: "ساخت گروه",
      channel: "ساخت کانال",
      save: "ذخیره تغییرات",
      saved: "ذخیره شد.",
      settings: "تنظیمات",
      account: "حساب",
      chatSettings: "تنظیمات گفتگو",
      privacy: "حریم خصوصی و امنیت",
      storage: "ذخیره‌سازی داده",
      folders: "پوشه‌ها",
      power: "صرفه‌جویی انرژی",
      aboutText: "پیام‌رسان آزمایشی BipolarChat",
      support: "پشتیبانی",
      supportTelegram: "تلگرام پشتیبانی"
    },

    en: {
      appName: "BipolarChat",
      login: "Log in",
      signup: "Create account",
      email: "Email",
      password: "Password",
      forgot: "Forgot password?",
      online: "Online",
      search: "Search chats",
      all: "All",
      unread: "Unread",
      newChat: "New chat",
      profile: "My profile",
      language: "Language",
      about: "About",
      logout: "Log out",
      privateChat: "Private chat",
      send: "Write a message...",
      noChats: "No chats yet.",
      noMessages: "No messages yet",
      firstMessage: "Send the first message.",
      contact: "Add contact",
      group: "Create group",
      channel: "Create channel",
      save: "Save changes",
      saved: "Saved.",
      settings: "Settings",
      account: "Account",
      chatSettings: "Chat settings",
      privacy: "Privacy & Security",
      storage: "Data & Storage",
      folders: "Chat folders",
      power: "Power saving",
      aboutText: "BipolarChat experimental messenger",
      support: "Support",
      supportTelegram: "Support Telegram"
    }
  };

  function t(key) {
    const lang =
      localStorage.getItem("bipolar_language") || "fa";

    return translations[lang]?.[key] || translations.fa[key] || key;
  }

  function setLanguage(lang) {
    if (!["fa", "en"].includes(lang)) lang = "fa";

    localStorage.setItem("bipolar_language", lang);

    document.documentElement.lang = lang;
    document.documentElement.dir =
      lang === "en" ? "ltr" : "rtl";

    if ($("currentLanguage")) {
      $("currentLanguage").textContent =
        lang === "en" ? "English" : "فارسی";
    }

    if ($("faCheck")) {
      $("faCheck").textContent =
        lang === "fa" ? "✓" : "";
    }

    if ($("enCheck")) {
      $("enCheck").textContent =
        lang === "en" ? "✓" : "";
    }

    updateStaticTexts();
  }

  function updateStaticTexts() {
    if ($("email")) {
      $("email").placeholder =
        t("email");
    }

    if ($("password")) {
      $("password").placeholder =
        t("password");
    }

    if ($("search")) {
      $("search").placeholder =
        t("search");
    }

    if ($("text")) {
      $("text").placeholder =
        t("send");
    }

    if ($("loginBtn")) {
      $("loginBtn").textContent =
        t("login");
    }

    if ($("signupBtn")) {
      $("signupBtn").textContent =
        t("signup");
    }

    if ($("forgot")) {
      $("forgot").textContent =
        t("forgot");
    }

    if ($("onlineStatus")) {
      $("onlineStatus").textContent =
        t("online");
    }
  }

  /* =========================
     FIRST LOGIN NOTICE
  ========================= */

  function showFirstLoginNotice() {
    if (!user) return;

    const key =
      "bipolar_first_login_" + user.id;

    if (localStorage.getItem(key)) return;

    localStorage.setItem(key, "1");

    setTimeout(() => {
      showAuthMessage(
        "درود بر کاربران گرامی؛\n\n" +
        "اپلیکیشن BipolarChat تحت شبکه وب صرفاً یک نسخه آزمایشی می‌باشد.\n\n" +
        "این اپلیکیشن جهت محافظت از اطلاعات شما بر روی Supabase و GitHub ذخیره شده است.\n\n" +
        "تابع قوانین جمهوری‌اسلامی‌ایران و قوهٔ قضائیه محترم🇮🇷"
      );

      toast(
        "درود بر کاربران گرامی؛ BipolarChat نسخه آزمایشی است."
      );
    }, 500);
  }

  /* =========================
     AUTH / BOOT
  ========================= */

  async function boot() {
    if (!ready) {
      showAuth();
      showAuthMessage(
        "config.js به‌درستی تنظیم نشده است."
      );
      return;
    }

    if (!window.supabase) {
      showAuth();
      showAuthMessage(
        "Supabase بارگذاری نشد. صفحه را دوباره باز کنید."
      );
      return;
    }

    try {
      sb = window.supabase.createClient(
        C.SUPABASE_URL,
        C.SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );

      const {
        data: { session }
      } = await sb.auth.getSession();

      if (session?.user) {
        user = session.user;
        await enterApp();
      } else {
        showAuth();
      }

      sb.auth.onAuthStateChange(
        async (_event, session) => {
          user = session?.user || null;

          if (user) {
            await enterApp();
          } else {
            showAuth();
          }
        }
      );

    } catch (error) {
      console.error(error);
      showAuth();
      showAuthMessage(
        "خطا در اتصال به Supabase."
      );
    }
  }

  function showAuth() {
    show($("auth"));
    hide($("app"));
  }

  async function enterApp() {
    hide($("auth"));
    show($("app"));

    await loadProfile();
    await loadChats();

    showFirstLoginNotice();
  }

  /* =========================
     PROFILE
  ========================= */

  async function loadProfile() {
    if (!user) return;

    const { data, error } =
      await sb
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
      console.error(error);

      profile = {
        id: user.id,
        email: user.email,
        display_name:
          user.user_metadata?.display_name ||
          user.email?.split("@")[0] ||
          "کاربر"
      };

      updateProfileUI();
      return;
    }

    profile =
      data || {
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
      user?.email?.split("@")[0] ||
      "کاربر";

    const title =
      activeChat?.title || name;

    if ($("chatName")) {
      $("chatName").textContent = title;
    }

    if ($("chatAvatar")) {
      $("chatAvatar").textContent =
        title.charAt(0).toUpperCase();
    }

    if ($("profileAvatar")) {
      $("profileAvatar").textContent =
        name.charAt(0).toUpperCase();
    }

    if ($("profileName")) {
      $("profileName").value =
        profile.display_name || "";
    }

    if ($("profileUsername")) {
      $("profileUsername").value =
        profile.username || "";
    }

    if ($("profileBio")) {
      $("profileBio").value =
        profile.bio || "";
    }

    if (
      profile.is_owner ||
      profile.is_verified
    ) {
      show($("verificationBadge"));
    } else {
      hide($("verificationBadge"));
    }
  }

  async function saveProfile() {
    if (!user) return;

    const displayName =
      $("profileName")?.value.trim();

    const username =
      $("profileUsername")?.value
        .trim()
        .replace(/^@/, "")
        .toLowerCase();

    const bio =
      $("profileBio")?.value.trim() || "";

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

      if (
        error.message?.toLowerCase()
          .includes("duplicate")
      ) {
        toast(
          "این نام کاربری قبلاً استفاده شده است."
        );
      } else {
        toast(error.message);
      }

      return;
    }

    profile = data;

    updateProfileUI();

    toast(t("saved"));

    hide($("profilePanel"));
    show($("menuPanel"));
  }

  /* =========================
     LOGIN
  ========================= */

  async function login() {
    if (!sb) return;

    const email =
      $("email")?.value.trim();

    const password =
      $("password")?.value || "";

    if (!email || !password) {
      showAuthMessage(
        "ایمیل و رمز عبور را وارد کنید."
      );
      return;
    }

    showAuthMessage("در حال ورود...");

    const { error } =
      await sb.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      console.error(error);
      showAuthMessage(
        "Invalid login credentials"
      );
    }
  }

  async function signup() {
    if (!sb) return;

    const email =
      $("email")?.value.trim();

    const password =
      $("password")?.value || "";

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
        "رمز عبور حداقل ۶ کاراکتر باشد."
      );
      return;
    }

    showAuthMessage(
      "در حال ساخت حساب..."
    );

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
      console.error(error);
      showAuthMessage(error.message);
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
  }

  async function forgotPassword() {
    if (!sb) return;

    const email =
      $("email")?.value.trim();

    if (!email) {
      showAuthMessage(
        "ایمیل را وارد کنید."
      );
      return;
    }

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
  }

  async function logout() {
    if (!sb) return;

    if (realtimeChannel) {
      await sb.removeChannel(
        realtimeChannel
      );
      realtimeChannel = null;
    }

    await sb.auth.signOut();

    activeChat = null;
    chats = [];
    profile = null;

    closeAllPanels();
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
            id,
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

      if ($("chatList")) {
        $("chatList").innerHTML = `
          <div class="empty-list">
            خطا در دریافت گفتگوها.
          </div>
        `;
      }

      return;
    }

    chats = data || [];

    renderChats();
  }

  function renderChats() {
    const list = $("chatList");

    if (!list) return;

    let filtered = [...chats];

    const query =
      $("search")?.value
        .trim()
        .toLowerCase();

    if (query) {
      filtered = filtered.filter(chat =>
        (chat.title || "")
          .toLowerCase()
          .includes(query)
      );
    }

    if (!filtered.length) {
      list.innerHTML = `
        <div class="empty-list">
          ${escapeHTML(t("noChats"))}
        </div>
      `;

      if ($("allCount")) {
        $("allCount").textContent = "0";
      }

      return;
    }

    list.innerHTML =
      filtered.map(chat => {

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
          t("privateChat");

        return `
          <button
            class="chat ${
              activeChat?.id === chat.id
                ? "selected"
                : ""
            }"
            data-id="${escapeHTML(chat.id)}"
            type="button"
          >
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
                  t("noMessages")
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
          () => openChat(
            button.dataset.id
          )
        );
      });

    if ($("allCount")) {
      $("allCount").textContent =
        String(filtered.length);
    }
  }

  async function openChat(id) {
    const chat =
      chats.find(x => x.id === id);

    if (!chat) return;

    activeChat = chat;

    if ($("chatName")) {
      $("chatName").textContent =
        chat.title ||
        t("privateChat");
    }

    if ($("chatAvatar")) {
      $("chatAvatar").textContent =
        (
          chat.title ||
          "B"
        ).charAt(0).toUpperCase();
    }

    if ($("chatStatus")) {
      $("chatStatus").textContent =
        chat.is_group
          ? "گروه"
          : t("privateChat");
    }

    renderChats();

    await loadMessages();

    if (window.innerWidth <= 700) {
      $("sidebar")
        ?.classList.add("hide");

      $("main")
        ?.classList.add("show");
    }
  }

  /* =========================
     MESSAGES
  ========================= */

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

      if ($("messages")) {
        $("messages").innerHTML = `
          <div class="empty-list">
            خطا در دریافت پیام‌ها.
          </div>
        `;
      }

      return;
    }

    renderMessages(data || []);

    subscribeMessages();
  }

  function renderMessages(messages) {
    if (!messages.length) {
      $("messages").innerHTML = `
        <div class="welcome">
          <div class="welcome-logo">B</div>

          <h1>
            ${escapeHTML(
              activeChat?.title ||
              "BipolarChat"
            )}
          </h1>

          <p>${escapeHTML(
            t("firstMessage")
          )}</p>
        </div>
      `;

      return;
    }

    $("messages").innerHTML =
      messages.map(message => {

        const mine =
          message.sender_id === user.id;

        return `
          <div class="bubble ${
            mine ? "me" : ""
          }">
            ${escapeHTML(
              message.body
            )}

            <time>
              ${time(
                message.created_at
              )}
            </time>
          </div>
        `;
      }).join("");

    scrollMessages();
  }

  function appendMessage(message) {
    const box = $("messages");

    if (!box) return;

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
        <div class="bubble ${
          mine ? "me" : ""
        }">
          ${escapeHTML(
            message.body
          )}

          <time>
            ${time(
              message.created_at
            )}
          </time>
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
      toast(
        "ابتدا یک گفتگو انتخاب کنید."
      );
      return;
    }

    const input = $("text");

    if (!input) return;

    const body =
      input.value.trim();

    if (!body) return;

    input.value = "";

    const { data, error } =
      await sb
        .from("messages")
        .insert({
          conversation_id:
            activeChat.id,
          sender_id:
            user.id,
          body
        })
        .select()
        .single();

    if (error) {
      console.error(error);

      input.value = body;

      toast(
        "ارسال پیام انجام نشد."
      );

      return;
    }

    appendMessage(data);
  }

  function subscribeMessages() {
    if (realtimeChannel) {
      sb.removeChannel(
        realtimeChannel
      );
      realtimeChannel = null;
    }

    if (!activeChat) return;

    realtimeChannel =
      sb
        .channel(
          "bipolar-chat-" +
          activeChat.id +
          "-" +
          Date.now()
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter:
              "conversation_id=eq." +
              activeChat.id
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

  /* =========================
     CONTACT
  ========================= */

  async function searchProfile() {
    let value =
      $("contactSearch")
        ?.value
        .trim();

    if (!value) {
      toast(
        "ایمیل یا نام کاربری را وارد کنید."
      );
      return;
    }

    value =
      value.replace(/^@/, "");

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
      toast(
        "جستجو انجام نشد."
      );
      return;
    }

    if (!data) {
      toast(
        "کاربر پیدا نشد."
      );
      return;
    }

    if (data.id === user.id) {
      toast(
        "نمی‌توانید با خودتان گفتگو بسازید."
      );
      return;
    }

    const {
      data: conversationId,
      error: createError
    } =
      await sb.rpc(
        "create_private_conversation",
        {
          other_user: data.id
        }
      );

    if (createError) {
      console.error(createError);
      toast(
        createError.message
      );
      return;
    }

    closeAllPanels();

    $("contactSearch").value = "";
    $("contactName").value = "";

    await loadChats();

    await openChat(
      conversationId
    );

    toast(
      "مخاطب اضافه شد."
    );
  }

  /* =========================
     GROUP
  ========================= */

  async function createGroup() {
    const title =
      $("groupTitle")
        ?.value
        .trim();

    if (!title) {
      toast(
        "نام گروه را وارد کنید."
      );
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

    const {
      error: memberError
    } =
      await sb
        .from("conversation_members")
        .insert({
          conversation_id:
            data.id,
          user_id:
            user.id
        });

    if (memberError) {
      console.error(memberError);
      toast(
        memberError.message
      );
      return;
    }

    closeAllPanels();

    $("groupTitle").value = "";
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
        ?.value
        .trim();

    if (!title) {
      toast(
        "نام کانال را وارد کنید."
      );
      return;
    }

    const username =
      $("channelUsername")
        ?.value
        .trim()
        .replace(/^@/, "")
        .toLowerCase();

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

    const {
      error: memberError
    } =
      await sb
        .from("conversation_members")
        .insert({
          conversation_id:
            data.id,
          user_id:
            user.id
        });

    if (memberError) {
      console.error(memberError);
      toast(
        memberError.message
      );
      return;
    }

    closeAllPanels();

    $("channelTitle").value = "";
    $("channelUsername").value = "";
    $("channelDescription").value = "";

    await loadChats();
    await openChat(data.id);

    toast(
      username
        ? `کانال @${username} ساخته شد.`
        : "کانال ساخته شد."
    );
  }

  /* =========================
     EVENTS
  ========================= */

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

  $("composer")
    ?.addEventListener(
      "submit",
      event => {
        event.preventDefault();
        sendMessage();
      }
    );

  $("text")
    ?.addEventListener(
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
    ?.addEventListener(
      "input",
      renderChats
    );

  $("menuBtn")
    ?.addEventListener(
      "click",
      () => {
        closeAllPanels();
        show($("menuPanel"));
      }
    );

  $("closeMenu")
    ?.addEventListener(
      "click",
      () => hide($("menuPanel"))
    );

  $("profileMenuBtn")
    ?.addEventListener(
      "click",
      () => {
        hide($("menuPanel"));
        updateProfileUI();
        show($("profilePanel"));
      }
    );

  $("profileBack")
    ?.addEventListener(
      "click",
      () => {
        hide($("profilePanel"));
        show($("menuPanel"));
      }
    );

  $("languageMenuBtn")
    ?.addEventListener(
      "click",
      () => {
        hide($("menuPanel"));
        show($("languagePanel"));
      }
    );

  $("languageBack")
    ?.addEventListener(
      "click",
      () => {
        hide($("languagePanel"));
        show($("menuPanel"));
      }
    );

  $("aboutMenuBtn")
    ?.addEventListener(
      "click",
      () => {
        hide($("menuPanel"));
        show($("aboutPanel"));
      }
    );

  $("aboutBack")
    ?.addEventListener(
      "click",
      () => {
        hide($("aboutPanel"));
        show($("menuPanel"));
      }
    );

  $("logoutBtn")
    ?.addEventListener(
      "click",
      logout
    );

  $("newChatBtn")
    ?.addEventListener(
      "click",
      () => show($("newChatPanel"))
    );

  $("newChatBack")
    ?.addEventListener(
      "click",
      () => hide($("newChatPanel"))
    );

  $("addContactBtn")
    ?.addEventListener(
      "click",
      () => {
        hide($("newChatPanel"));
        show($("contactPanel"));
      }
    );

  $("contactBack")
    ?.addEventListener(
      "click",
      () => {
        hide($("contactPanel"));
        show($("newChatPanel"));
      }
    );

  $("saveContactBtn")
    ?.addEventListener(
      "click",
      searchProfile
    );

  $("createGroupBtn")
    ?.addEventListener(
      "click",
      () => {
        hide($("newChatPanel"));
        show($("groupPanel"));
      }
    );

  $("groupBack")
    ?.addEventListener(
      "click",
      () => {
        hide($("groupPanel"));
        show($("newChatPanel"));
      }
    );

  $("saveGroupBtn")
    ?.addEventListener(
      "click",
      createGroup
    );

  $("createChannelBtn")
    ?.addEventListener(
      "click",
      () => {
        hide($("newChatPanel"));
        show($("channelPanel"));
      }
    );

  $("channelBack")
    ?.addEventListener(
      "click",
      () => {
        hide($("channelPanel"));
        show($("newChatPanel"));
      }
    );

  $("saveChannelBtn")
    ?.addEventListener(
      "click",
      createChannel
    );

  $("saveProfileBtn")
    ?.addEventListener(
      "click",
      saveProfile
    );

  $("backBtn")
    ?.addEventListener(
      "click",
      () => {
        $("sidebar")
          ?.classList.remove("hide");

        $("main")
          ?.classList.remove("show");

        activeChat = null;

        updateProfileUI();

        if ($("chatStatus")) {
          $("chatStatus").textContent =
            "یک گفتگو را انتخاب کنید";
        }
      }
    );

  $("attachBtn")
    ?.addEventListener(
      "click",
      () => {
        $("file")?.click();
      }
    );

  $("chatSearchBtn")
    ?.addEventListener(
      "click",
      () => {
        $("search")?.focus();

        if (window.innerWidth <= 700) {
          $("sidebar")
            ?.classList.remove("hide");

          $("main")
            ?.classList.remove("show");
        }
      }
    );

  $("chatMoreBtn")
    ?.addEventListener(
      "click",
      () => {
        if (activeChat) {
          toast(
            "تنظیمات گفتگو به‌زودی اضافه می‌شود."
          );
        } else {
          toast(
            "ابتدا یک گفتگو انتخاب کنید."
          );
        }
      }
    );

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
            hide(overlay);
          }
        }
      );
    });

  /* =========================
     START
  ========================= */

  setLanguage(
    localStorage.getItem(
      "bipolar_language"
    ) || "fa"
  );

  boot();
});
