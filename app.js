document.addEventListener("DOMContentLoaded", () => {
  const C = window.NOVA_CONFIG || {};
  const $ = id => document.getElementById(id);

  const ready =
    typeof C.SUPABASE_URL === "string" &&
    C.SUPABASE_URL.startsWith("https://") &&
    typeof C.SUPABASE_PUBLISHABLE_KEY === "string" &&
    C.SUPABASE_PUBLISHABLE_KEY.length > 20;

  let sb = null;
  let user = null;
  let profile = null;
  let activeChat = null;
  let chats = [];
  let realtimeChannel = null;

  function escapeHTML(v) {
    return String(v ?? "")
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

  function authMessage(text) {
    if ($("authMessage")) $("authMessage").textContent = text;
  }

  function formatTime(value) {
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

  function closePanels() {
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

  /* =========================
     AUTH
  ========================= */

  function showAuth() {
    show($("auth"));
    hide($("app"));
  }

  async function boot() {
    if (!ready) {
      authMessage("config.js به‌درستی تنظیم نشده است.");
      return;
    }

    if (!window.supabase) {
      authMessage("Supabase بارگذاری نشده است.");
      return;
    }

    try {
      sb = window.supabase.createClient(
        C.SUPABASE_URL,
        C.SUPABASE_PUBLISHABLE_KEY
      );

      const { data, error } =
        await sb.auth.getSession();

      if (error) {
        console.error(error);
        showAuth();
        authMessage("خطا در دریافت نشست کاربر.");
        return;
      }

      if (data?.session?.user) {
        user = data.session.user;
        await enterApp();
      } else {
        showAuth();
      }

      sb.auth.onAuthStateChange(async (_event, session) => {
        user = session?.user || null;

        if (user) {
          await enterApp();
        } else {
          showAuth();
        }
      });

    } catch (error) {
      console.error(error);
      showAuth();
      authMessage("اتصال به Supabase برقرار نشد.");
    }
  }

  async function login() {
    const email = $("email")?.value.trim();
    const password = $("password")?.value || "";

    if (!email || !password) {
      authMessage("ایمیل و رمز عبور را وارد کنید.");
      return;
    }

    authMessage("در حال ورود...");

    const { error } =
      await sb.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      console.error(error);
      authMessage(
        error.message === "Invalid login credentials"
          ? "ایمیل یا رمز عبور اشتباه است."
          : error.message
      );
    }
  }

  async function signup() {
    const email = $("email")?.value.trim();
    const password = $("password")?.value || "";
    const name =
      $("displayName")?.value.trim() ||
      email?.split("@")[0] ||
      "کاربر";

    if (!email || !password) {
      authMessage("ایمیل و رمز عبور را وارد کنید.");
      return;
    }

    if (password.length < 6) {
      authMessage("رمز عبور حداقل ۶ کاراکتر باشد.");
      return;
    }

    authMessage("در حال ساخت حساب...");

    const { data, error } =
      await sb.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name
          }
        }
      });

    if (error) {
      console.error(error);
      authMessage(error.message);
      return;
    }

    if (data.session) {
      authMessage("حساب با موفقیت ساخته شد.");
    } else {
      authMessage(
        "حساب ساخته شد. ایمیل تأیید را بررسی کنید."
      );
    }
  }

  async function forgotPassword() {
    const email = $("email")?.value.trim();

    if (!email) {
      authMessage("ابتدا ایمیل را وارد کنید.");
      return;
    }

    const { error } =
      await sb.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: window.location.origin
        }
      );

    authMessage(
      error
        ? error.message
        : "لینک بازیابی رمز عبور ارسال شد."
    );
  }

  async function logout() {
    try {
      if (realtimeChannel) {
        await sb.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }

      await sb.auth.signOut();

      user = null;
      profile = null;
      activeChat = null;
      chats = [];

      closePanels();
      showAuth();

    } catch (error) {
      console.error(error);
    }
  }

  /* =========================
     FIRST LOGIN NOTICE
  ========================= */

  function firstLoginNotice() {
    if (!user) return;

    const key = "bipolarchat_first_login_" + user.id;

    if (localStorage.getItem(key)) return;

    localStorage.setItem(key, "1");

    setTimeout(() => {
      toast(
        "درود بر کاربران گرامی؛ اپلیکیشن BipolarChat تحت شبکه وب صرفاً یک نسخه آزمایشی می‌باشد."
      );
    }, 700);
  }

  /* =========================
     ENTER APP
  ========================= */

  async function enterApp() {
    hide($("auth"));
    show($("app"));

    await loadProfile();
    await loadChats();

    firstLoginNotice();
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

    if ($("profileName"))
      $("profileName").value =
        profile.display_name || "";

    if ($("profileUsername"))
      $("profileUsername").value =
        profile.username || "";

    if ($("profileBio"))
      $("profileBio").value =
        profile.bio || "";

    if ($("profileAvatar"))
      $("profileAvatar").textContent =
        name.charAt(0).toUpperCase();

    if ($("chatName") && !activeChat)
      $("chatName").textContent = name;

    if ($("chatAvatar") && !activeChat)
      $("chatAvatar").textContent =
        name.charAt(0).toUpperCase();

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
      $("profileUsername")
        ?.value
        .trim()
        .replace(/^@/, "")
        .toLowerCase();

    const bio =
      $("profileBio")
        ?.value
        .trim();

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
          bio: bio || null
        })
        .eq("id", user.id)
        .select()
        .single();

    if (error) {
      console.error(error);
      toast(
        error.message ||
        "ذخیره پروفایل انجام نشد."
      );
      return;
    }

    profile = data;
    updateProfileUI();

    toast("پروفایل ذخیره شد.");

    hide($("profilePanel"));
    show($("menuPanel"));
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
          conversation_members!inner(user_id)
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
      toast("گفتگوها دریافت نشدند.");
      return;
    }

    chats = data || [];

    renderChats();
  }

  function renderChats() {
    const list = $("chatList");
    if (!list) return;

    const query =
      $("search")
        ?.value
        .trim()
        .toLowerCase() || "";

    let filtered = chats.filter(chat =>
      !query ||
      (chat.title || "")
        .toLowerCase()
        .includes(query)
    );

    $("allCount").textContent =
      String(filtered.length);

    if (!filtered.length) {
      list.innerHTML = `
        <div class="empty-list">
          هنوز گفتگویی ندارید.
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(chat => {
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
          data-id="${escapeHTML(chat.id)}"
        >
          <span class="avatar">
            ${escapeHTML(
              title.charAt(0).toUpperCase()
            )}
          </span>

          <span class="chat-info">
            <b>${escapeHTML(title)}</b>
            <small>
              ${
                chat.is_group
                  ? "گروه"
                  : "گفتگوی خصوصی"
              }
            </small>
          </span>
        </button>
      `;
    }).join("");

    list
      .querySelectorAll(".chat")
      .forEach(btn => {
        btn.addEventListener(
          "click",
          () => openChat(btn.dataset.id)
        );
      });
  }

  async function openChat(id) {
    const chat =
      chats.find(x => x.id === id);

    if (!chat) return;

    activeChat = chat;

    const title =
      chat.title ||
      "گفتگوی خصوصی";

    $("chatName").textContent = title;

    $("chatAvatar").textContent =
      title.charAt(0).toUpperCase();

    $("chatStatus").textContent =
      chat.is_group
        ? "گروه"
        : "گفتگوی خصوصی";

    renderChats();

    await loadMessages();

    if (window.innerWidth <= 700) {
      $("sidebar")
        ?.classList.add("hide");

      $("main")
        ?.classList.add("show");
    }
  }

  async function loadMessages() {
    if (!activeChat) return;

    const { data, error } =
      await sb
        .from("messages")
        .select(
          "id,body,sender_id,created_at"
        )
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
    const box = $("messages");
    if (!box) return;

    if (!messages.length) {
      box.innerHTML = `
        <div class="welcome">
          <div class="welcome-logo">B</div>
          <h1>
            ${escapeHTML(
              activeChat?.title ||
              "BipolarChat"
            )}
          </h1>
          <p>
            اولین پیام را بفرستید.
          </p>
        </div>
      `;
      return;
    }

    box.innerHTML =
      messages.map(message => {
        const mine =
          message.sender_id === user.id;

        return `
          <div class="bubble ${
            mine ? "me" : ""
          }">
            ${escapeHTML(message.body)}
            <time>
              ${formatTime(
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
          ${escapeHTML(message.body)}
          <time>
            ${formatTime(
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
    if (box)
      box.scrollTop = box.scrollHeight;
  }

  async function sendMessage() {
    if (!activeChat) {
      toast("ابتدا یک گفتگو انتخاب کنید.");
      return;
    }

    const input = $("text");
    const body =
      input?.value.trim();

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
      toast("ارسال پیام انجام نشد.");
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
          "messages-" +
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

  async function addContact() {
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
      toast("جستجوی کاربر انجام نشد.");
      return;
    }

    if (!data) {
      toast("کاربر پیدا نشد.");
      return;
    }

    if (data.id === user.id) {
      toast(
        "نمی‌توانید خودتان را اضافه کنید."
      );
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

    const savedName =
      $("contactName")
        ?.value
        .trim();

    closePanels();

    if (savedName) {
      toast(
        `${savedName} به گفتگوها اضافه شد.`
      );
    } else {
      toast("مخاطب اضافه شد.");
    }

    await loadChats();

    if (conversationId) {
      await openChat(
        conversationId
      );
    }
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
          conversation_id:
            data.id,
          user_id:
            user.id
        });

    if (memberError) {
      console.error(memberError);
      toast(memberError.message);
      return;
    }

    closePanels();

    $("groupTitle").value = "";

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
      toast("نام کانال را وارد کنید.");
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

    const { error: memberError } =
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
      toast(memberError.message);
      return;
    }

    closePanels();

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
     LANGUAGE
  ========================= */

  function setLanguage(lang) {
    localStorage.setItem(
      "bipolar_language",
      lang
    );

    if (lang === "en") {
      document.documentElement.lang =
        "en";
      document.documentElement.dir =
        "ltr";

      if ($("currentLanguage"))
        $("currentLanguage").textContent =
          "English";

      if ($("faCheck"))
        $("faCheck").textContent = "";

      if ($("enCheck"))
        $("enCheck").textContent = "✓";

    } else {
      document.documentElement.lang =
        "fa";
      document.documentElement.dir =
        "rtl";

      if ($("currentLanguage"))
        $("currentLanguage").textContent =
          "فارسی";

      if ($("faCheck"))
        $("faCheck").textContent = "✓";

      if ($("enCheck"))
        $("enCheck").textContent = "";
    }
  }

  /* =========================
     EVENTS
  ========================= */

  $("loginBtn")?.addEventListener(
    "click",
    login
  );

  $("signupBtn")?.addEventListener(
    "click",
    signup
  );

  $("forgot")?.addEventListener(
    "click",
    forgotPassword
  );

  $("composer")?.addEventListener(
    "submit",
    e => {
      e.preventDefault();
      sendMessage();
    }
  );

  $("text")?.addEventListener(
    "keydown",
    e => {
      if (
        e.key === "Enter" &&
        !e.shiftKey
      ) {
        e.preventDefault();
        sendMessage();
      }
    }
  );

  $("search")?.addEventListener(
    "input",
    renderChats
  );

  $("menuBtn")?.addEventListener(
    "click",
    () => show($("menuPanel"))
  );

  $("closeMenu")?.addEventListener(
    "click",
    () => hide($("menuPanel"))
  );

  $("profileMenuBtn")?.addEventListener(
    "click",
    () => {
      hide($("menuPanel"));
      updateProfileUI();
      show($("profilePanel"));
    }
  );

  $("profileBack")?.addEventListener(
    "click",
    () => {
      hide($("profilePanel"));
      show($("menuPanel"));
    }
  );

  $("languageMenuBtn")?.addEventListener(
    "click",
    () => {
      hide($("menuPanel"));
      show($("languagePanel"));
    }
  );

  $("languageBack")?.addEventListener(
    "click",
    () => {
      hide($("languagePanel"));
      show($("menuPanel"));
    }
  );

  $("aboutMenuBtn")?.addEventListener(
    "click",
    () => {
      hide($("menuPanel"));
      show($("aboutPanel"));
    }
  );

  $("aboutBack")?.addEventListener(
    "click",
    () => {
      hide($("aboutPanel"));
      show($("menuPanel"));
    }
  );

  $("logoutBtn")?.addEventListener(
    "click",
    logout
  );

  $("newChatBtn")?.addEventListener(
    "click",
    () => show($("newChatPanel"))
  );

  $("newChatBack")?.addEventListener(
    "click",
    () => hide($("newChatPanel"))
  );

  $("addContactBtn")?.addEventListener(
    "click",
    () => {
      hide($("newChatPanel"));
      show($("contactPanel"));
    }
  );

  $("contactBack")?.addEventListener(
    "click",
    () => {
      hide($("contactPanel"));
      show($("newChatPanel"));
    }
  );

  $("saveContactBtn")?.addEventListener(
    "click",
    addContact
  );

  $("createGroupBtn")?.addEventListener(
    "click",
    () => {
      hide($("newChatPanel"));
      show($("groupPanel"));
    }
  );

  $("groupBack")?.addEventListener(
    "click",
    () => {
      hide($("groupPanel"));
      show($("newChatPanel"));
    }
  );

  $("saveGroupBtn")?.addEventListener(
    "click",
    createGroup
  );

  $("createChannelBtn")?.addEventListener(
    "click",
    () => {
      hide($("newChatPanel"));
      show($("channelPanel"));
    }
  );

  $("channelBack")?.addEventListener(
    "click",
    () => {
      hide($("channelPanel"));
      show($("newChatPanel"));
    }
  );

  $("saveChannelBtn")?.addEventListener(
    "click",
    createChannel
  );

  $("saveProfileBtn")?.addEventListener(
    "click",
    saveProfile
  );

  $("backBtn")?.addEventListener(
    "click",
    () => {
      $("sidebar")
        ?.classList.remove("hide");

      $("main")
        ?.classList.remove("show");

      activeChat = null;

      updateProfileUI();

      if ($("chatStatus"))
        $("chatStatus").textContent =
          "یک گفتگو را انتخاب کنید";
    }
  );

  $("attachBtn")?.addEventListener(
    "click",
    () => $("file")?.click()
  );

  $("chatSearchBtn")?.addEventListener(
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

  $("chatMoreBtn")?.addEventListener(
    "click",
    () => {
      toast(
        activeChat
          ? "تنظیمات گفتگو به‌زودی اضافه می‌شود."
          : "ابتدا یک گفتگو انتخاب کنید."
      );
    }
  );

  document
    .querySelectorAll(".language-option")
    .forEach(button => {
      button.addEventListener(
        "click",
        () =>
          setLanguage(
            button.dataset.lang
          )
      );
    });

  document
    .querySelectorAll(".overlay")
    .forEach(overlay => {
      overlay.addEventListener(
        "click",
        e => {
          if (e.target === overlay)
            hide(overlay);
        }
      );
    });

  /* =========================
     START
  ========================= */

  const savedLanguage =
    localStorage.getItem(
      "bipolar_language"
    ) || "fa";

  setLanguage(savedLanguage);

  boot();
});
