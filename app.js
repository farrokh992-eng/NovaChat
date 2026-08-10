document.addEventListener("DOMContentLoaded", () => {

  "use strict";

  /* =========================================================
     BipolarChat-v1
     ========================================================= */

  const C = window.NOVA_CONFIG || {};

  const LOGO =
    "https://s6.uupload.ir/files/file_000000002dd082469339a22756c5ad8b_ko8m.png";

  const VERIFIED =
    "https://s6.uupload.ir/files/picsart_26-08-10_04-18-21-233_qlx.png";

  const OWNER_USERNAME = "bipolar";

  const SYSTEM_CHANNEL_USERNAME = "Bipolar_ir";

  const ready =
    typeof C.SUPABASE_URL === "string" &&
    C.SUPABASE_URL.startsWith("https://") &&
    typeof C.SUPABASE_PUBLISHABLE_KEY === "string" &&
    C.SUPABASE_PUBLISHABLE_KEY.length > 20;


  let sb = null;
  let user = null;
  let profile = null;

  let chats = [];
  let activeChat = null;
  let realtimeChannel = null;

  let currentLanguage =
    localStorage.getItem("bipolar_language") || "fa";


  const $ = id =>
    document.getElementById(id);


  /* =========================================================
     HELPERS
     ========================================================= */

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

    clearTimeout(window.__bipolarToast);

    window.__bipolarToast =
      setTimeout(() => {
        el.classList.remove("show");
      }, 2800);

  }


  function show(el) {
    el?.classList.remove("hidden");
  }


  function hide(el) {
    el?.classList.add("hidden");
  }


  function text(id, value) {

    const el = $(id);

    if (el) {
      el.textContent = value ?? "";
    }

  }


  function formatTime(value) {

    try {

      return new Date(value)
        .toLocaleTimeString(
          currentLanguage === "fa"
            ? "fa-IR"
            : "en-US",
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
      "channelPanel",
      "settingsPagePanel"
    ].forEach(id => hide($(id)));

  }


  function isMobile() {

    return window.innerWidth <= 700;

  }


  /* =========================================================
     AUTH
     ========================================================= */

  function showAuth() {

    show($("auth"));
    hide($("app"));

  }


  function showApp() {

    hide($("auth"));
    show($("app"));

  }


  async function boot() {

    if (!ready) {

      $("authMessage").textContent =
        "config.js به‌درستی تنظیم نشده است.";

      return;

    }


    if (!window.supabase) {

      $("authMessage").textContent =
        "کتابخانه Supabase بارگذاری نشده است.";

      return;

    }


    try {

      sb =
        window.supabase.createClient(
          C.SUPABASE_URL,
          C.SUPABASE_PUBLISHABLE_KEY
        );


      const {
        data: {
          session
        }
      } =
        await sb.auth.getSession();


      if (session?.user) {

        user = session.user;

        await enterApp();

      } else {

        showAuth();

      }


      sb.auth.onAuthStateChange(
        async (_event, session) => {

          user =
            session?.user || null;


          if (user) {

            await enterApp();

          } else {

            showAuth();

          }

        }
      );


    } catch (error) {

      console.error(
        "Supabase boot error:",
        error
      );

      $("authMessage").textContent =
        "اتصال به Supabase برقرار نشد.";

    }

  }


  async function login() {

    const email =
      $("email").value.trim();

    const password =
      $("password").value;


    if (!email || !password) {

      $("authMessage").textContent =
        "ایمیل و رمز عبور را وارد کنید.";

      return;

    }


    $("authMessage").textContent =
      "در حال ورود...";


    const {
      error
    } =
      await sb.auth.signInWithPassword({
        email,
        password
      });


    if (error) {

      console.error(error);

      $("authMessage").textContent =
        error.message;

    }

  }


  async function signup() {

    const email =
      $("email").value.trim();

    const password =
      $("password").value;

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
        "رمز عبور حداقل ۶ کاراکتر باشد.";

      return;

    }


    $("authMessage").textContent =
      "در حال ساخت حساب...";


    const {
      data,
      error
    } =
      await sb.auth.signUp({

        email,

        password,

        options: {

          data: {
            display_name:
              displayName
          }

        }

      });


    if (error) {

      $("authMessage").textContent =
        error.message;

      return;

    }


    if (data.session) {

      $("authMessage").textContent =
        "حساب ساخته شد.";

    } else {

      $("authMessage").textContent =
        "حساب ساخته شد. ایمیل تأیید را بررسی کنید.";

    }

  }


  async function forgotPassword() {

    const email =
      $("email").value.trim();


    if (!email) {

      $("authMessage").textContent =
        "ایمیل را وارد کنید.";

      return;

    }


    const {
      error
    } =
      await sb.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            window.location.origin +
            window.location.pathname
        }
      );


    $("authMessage").textContent =
      error
        ? error.message
        : "لینک بازیابی رمز ارسال شد.";

  }


  async function logout() {

    try {

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

    } catch (error) {

      console.error(error);

    }

  }


  /* =========================================================
     PROFILE
     ========================================================= */

  async function loadProfile() {

    if (!user) return;


    const {
      data,
      error
    } =
      await sb
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();


    if (error) {

      console.error(
        "Profile load:",
        error
      );

    }


    profile =
      data || {

        id: user.id,

        email: user.email,

        display_name:
          user.user_metadata?.display_name ||
          user.email?.split("@")[0] ||
          "کاربر",

        username:
          null,

        bio:
          "",

        avatar_url:
          null,

        is_owner:
          false,

        is_verified:
          false

      };


    updateProfileUI();

  }


  function updateProfileUI() {

    if (!profile) return;


    const name =
      profile.display_name ||
      user?.email?.split("@")[0] ||
      "کاربر";


    const username =
      profile.username
        ? "@" + profile.username
        : "";


    const avatarLetter =
      name
        .trim()
        .charAt(0)
        .toUpperCase() ||
      "B";


    text(
      "headerName",
      "BipolarChat"
    );


    text(
      "headerUsername",
      username || "@bipolar"
    );


    text(
      "settingsName",
      name
    );


    text(
      "settingsUsername",
      username || "نام کاربری ثبت نشده"
    );


    text(
      "profileName",
      name
    );


    $("profileName").value =
      profile.display_name || "";


    $("profileUsername").value =
      profile.username || "";


    $("profileBio").value =
      profile.bio || "";


    setAvatar(
      $("headerAvatar"),
      profile.avatar_url,
      avatarLetter
    );


    setAvatar(
      $("settingsAvatar"),
      profile.avatar_url,
      avatarLetter
    );


    setAvatar(
      $("profileAvatar"),
      profile.avatar_url,
      avatarLetter
    );


    const verified =
      profile.is_verified === true ||
      profile.is_owner === true ||
      String(profile.username || "")
        .toLowerCase() === OWNER_USERNAME;


    if (verified) {

      show($("verificationBadge"));

    } else {

      hide($("verificationBadge"));

    }

  }


  function setAvatar(
    element,
    url,
    fallback
  ) {

    if (!element) return;


    if (url) {

      element.innerHTML =
        `<img src="${escapeHTML(url)}" alt="">`;

    } else {

      element.textContent =
        fallback;

    }

  }


  async function saveProfile() {

    if (!user) return;


    const displayName =
      $("profileName").value.trim();

    const username =
      $("profileUsername")
        .value
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


    const {
      data,
      error
    } =
      await sb
        .from("profiles")
        .update({

          display_name:
            displayName,

          username:
            username || null,

          bio

        })
        .eq(
          "id",
          user.id
        )
        .select()
        .maybeSingle();


    if (error) {

      console.error(error);

      toast(
        error.message ||
        "ذخیره پروفایل انجام نشد."
      );

      return;

    }


    profile =
      data || {

        ...profile,

        display_name:
          displayName,

        username:
          username || null,

        bio

      };


    updateProfileUI();

    toast(
      "پروفایل ذخیره شد."
    );

  }


  /* =========================================================
     AVATAR
     ========================================================= */

  async function uploadAvatar(file) {

    if (!file || !user) return;


    if (!file.type.startsWith("image/")) {

      toast(
        "فقط فایل تصویری مجاز است."
      );

      return;

    }


    if (file.size > 5 * 1024 * 1024) {

      toast(
        "حداکثر حجم تصویر ۵ مگابایت است."
      );

      return;

    }


    toast(
      "در حال بارگذاری تصویر..."
    );


    try {

      const extension =
        file.name
          .split(".")
          .pop()
          .toLowerCase();


      const path =
        `${user.id}/avatar.${extension}`;


      const {
        error: uploadError
      } =
        await sb.storage
          .from("avatars")
          .upload(
            path,
            file,
            {
              upsert: true,
              contentType:
                file.type
            }
          );


      if (uploadError) {

        console.error(
          uploadError
        );

        toast(
          "فضای ذخیره‌سازی avatars در Supabase هنوز ساخته نشده است."
        );

        return;

      }


      const {
        data
      } =
        sb.storage
          .from("avatars")
          .getPublicUrl(path);


      const url =
        data?.publicUrl;


      if (!url) {

        toast(
          "آدرس تصویر دریافت نشد."
        );

        return;

      }


      const {
        error: updateError
      } =
        await sb
          .from("profiles")
          .update({
            avatar_url: url
          })
          .eq(
            "id",
            user.id
          );


      if (updateError) {

        console.error(
          updateError
        );

        toast(
          updateError.message
        );

        return;

      }


      profile.avatar_url =
        url;


      updateProfileUI();

      toast(
        "تصویر پروفایل تغییر کرد."
      );


    } catch (error) {

      console.error(error);

      toast(
        "بارگذاری تصویر انجام نشد."
      );

    }

  }


  async function removeAvatar() {

    if (!user || !profile) return;


    const {
      error
    } =
      await sb
        .from("profiles")
        .update({
          avatar_url: null
        })
        .eq(
          "id",
          user.id
        );


    if (error) {

      console.error(error);

      toast(
        error.message
      );

      return;

    }


    profile.avatar_url =
      null;

    updateProfileUI();

    toast(
      "تصویر پروفایل حذف شد."
    );

  }


  /* =========================================================
     CHATS
     ========================================================= */

  async function loadChats() {

    if (!user || !sb) return;


    const {
      data,
      error
    } =
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
          {
            ascending: false
          }
        );


    if (error) {

      console.error(
        "Chats:",
        error
      );

      chats = [];

      renderChats();

      return;

    }


    chats =
      data || [];


    renderChats();

  }


  function renderChats() {

    const list =
      $("chatList");


    if (!list) return;


    const query =
      $("search")
        ?.value
        .trim()
        .toLowerCase() ||
      "";


    let filtered =
      chats.filter(chat => {

        if (!query)
          return true;


        return (
          chat.title ||
          ""
        )
          .toLowerCase()
          .includes(query);

      });


    if (!filtered.length) {

      list.innerHTML = `
        <div class="empty-list">
          هنوز گفتگویی ندارید.
        </div>
      `;


      text(
        "allCount",
        "0"
      );


      return;

    }


    list.innerHTML =
      filtered
        .map(chat => {

          const messages =
            [
              ...(chat.messages || [])
            ]
              .sort(
                (a, b) =>
                  new Date(a.created_at) -
                  new Date(b.created_at)
              );


          const last =
            messages[
              messages.length - 1
            ];


          const title =
            chat.title ||
            "گفتگو";


          return `

            <button
              class="chat ${
                activeChat?.id === chat.id
                  ? "selected"
                  : ""
              }"
              data-chat-id="${escapeHTML(chat.id)}"
            >

              <span class="avatar">
                ${escapeHTML(
                  title.charAt(0)
                )}
              </span>

              <span class="chat-info">

                <b>
                  ${escapeHTML(title)}
                </b>

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
                    ? formatTime(
                        last.created_at
                      )
                    : ""
                }
              </time>

            </button>

          `;

        })
        .join("");


    list
      .querySelectorAll(
        "[data-chat-id]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () =>
            openChat(
              button.dataset.chatId
            )
        );

      });


    text(
      "allCount",
      String(filtered.length)
    );

  }


  async function openChat(id) {

    const chat =
      chats.find(
        item => item.id === id
      );


    if (!chat) return;


    activeChat =
      chat;


    text(
      "chatName",
      chat.title ||
      "گفتگو"
    );


    text(
      "chatStatus",
      chat.is_group
        ? "گروه / کانال"
        : "گفتگوی خصوصی"
    );


    text(
      "chatAvatar",
      (
        chat.title ||
        "B"
      ).charAt(0)
    );


    renderChats();

    await loadMessages();


    if (isMobile()) {

      $("sidebar")
        ?.classList.add("hide");

      $("main")
        ?.classList.add("show");

    }

  }


  async function loadMessages() {

    if (!activeChat || !user) return;


    const {
      data,
      error
    } =
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
          {
            ascending: true
          }
        );


    if (error) {

      console.error(
        "Messages:",
        error
      );


      $("messages").innerHTML = `
        <div class="empty-list">
          خطا در دریافت پیام‌ها.
        </div>
      `;


      return;

    }


    renderMessages(
      data || []
    );


    subscribeMessages();

  }


  function renderMessages(
    messages
  ) {

    const box =
      $("messages");


    if (!box) return;


    if (!messages.length) {

      box.innerHTML = `

        <div class="welcome">

          <img
            src="${LOGO}"
            class="welcome-logo"
            alt="">

          <h2>
            ${escapeHTML(
              activeChat?.title ||
              "BipolarChat"
            )}
          </h2>

          <p>
            اولین پیام را بفرستید.
          </p>

        </div>

      `;


      return;

    }


    box.innerHTML =
      messages
        .map(
          message => {

            const mine =
              message.sender_id ===
              user.id;


            return `

              <div class="bubble ${
                mine ? "me" : ""
              }">

                ${escapeHTML(
                  message.body
                )}

                <time>
                  ${formatTime(
                    message.created_at
                  )}
                </time>

              </div>

            `;

          }
        )
        .join("");


    scrollMessages();

  }


  function appendMessage(
    message
  ) {

    const box =
      $("messages");


    if (!box) return;


    if (
      box.querySelector(
        ".welcome"
      )
    ) {

      box.innerHTML = "";

    }


    const mine =
      message.sender_id ===
      user.id;


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

    const box =
      $("messages");


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


    const input =
      $("text");


    const body =
      input.value.trim();


    if (!body) return;


    input.value = "";


    const {
      data,
 
