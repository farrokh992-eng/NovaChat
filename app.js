(() => {
  "use strict";

  const C = window.NOVA_CONFIG || {};

  const ready =
    typeof C.SUPABASE_URL === "string" &&
    C.SUPABASE_URL.startsWith("https://") &&
    typeof C.SUPABASE_PUBLISHABLE_KEY === "string" &&
    C.SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");

  let sb = null;
  let user = null;
  let profile = null;
  let active = null;
  let channel = null;
  let filter = "all";

  const $ = (selector) =>
    document.querySelector(selector);

  const $$ = (selector) =>
    document.querySelectorAll(selector);

  function esc(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char])
    );
  }

  function time(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function notice(text) {
    const el = $("#authMessage");

    if (el) {
      el.textContent = text;
    }
  }

  function showAuth() {
    $("#auth")?.classList.remove("hidden");
    $("#app")?.classList.add("hidden");
  }

  function showAppUI() {
    $("#auth")?.classList.add("hidden");
    $("#app")?.classList.remove("hidden");
  }

  function modal(title, html) {
    const modalEl = $("#modal");
    const titleEl = $("#modalTitle");
    const bodyEl = $("#modalBody");

    if (!modalEl || !titleEl || !bodyEl) {
      return;
    }

    titleEl.textContent = title;
    bodyEl.innerHTML = html;
    modalEl.classList.remove("hidden");
  }

  function closeModal() {
    $("#modal")?.classList.add("hidden");
  }

  function initials(name) {
    const value =
      String(name || "B").trim();

    return value
      ? value.charAt(0).toUpperCase()
      : "B";
  }

  function avatarHTML(data, extraClass = "") {
    if (data?.avatar_url) {
      return `
        <img
          class="avatar-img ${extraClass}"
          src="${esc(data.avatar_url)}"
          alt=""
          loading="lazy"
        >
      `;
    }

    return `
      <span class="avatar ${extraClass}">
        ${esc(initials(
          data?.display_name ||
          data?.username ||
          "B"
        ))}
      </span>
    `;
  }


  /* =========================
     ERROR HANDLER
  ========================= */

  window.addEventListener(
    "error",
    (event) => {
      console.error(
        "BipolarChat error:",
        event.error || event.message
      );
    }
  );


  /* =========================
     BOOT
  ========================= */

  async function boot() {
    try {
      if (!ready) {
        showAuth();
        notice(
          "config.js هنوز تنظیم نشده است."
        );
        return;
      }

      if (!window.supabase) {
        showAuth();
        notice(
          "Supabase بارگذاری نشده است. اینترنت را بررسی کنید."
        );
        return;
      }

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
        data,
        error
      } = await sb.auth.getUser();

      if (error) {
        console.warn(
          "getUser:",
          error.message
        );
      }

      user = data?.user || null;

      if (user) {
        await showApp();
      } else {
        showAuth();
      }

      sb.auth.onAuthStateChange(
        async (_event, session) => {

          user =
            session?.user || null;

          if (user) {
            await showApp();
          } else {
            showAuth();
          }
        }
      );

    } catch (error) {
      console.error(
        "BOOT ERROR:",
        error
      );

      showAuth();

      notice(
        "برنامه نتوانست اجرا شود. صفحه را دوباره باز کنید."
      );
    }
  }


  /* =========================
     AUTH
  ========================= */

  async function login() {
    if (!ready || !sb) {
      notice(
        "Supabase هنوز آماده نیست."
      );
      return;
    }

    const email =
      $("#email")?.value.trim();

    const password =
      $("#password")?.value || "";

    if (!email) {
      notice("ایمیل را وارد کنید.");
      return;
    }

    if (!password) {
      notice("رمز عبور را وارد کنید.");
      return;
    }

    notice("در حال ورود...");

    const {
      error
    } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      notice(error.message);
      return;
    }

    notice("ورود موفق بود.");
  }


  async function signup() {
    if (!ready || !sb) {
      notice(
        "Supabase هنوز آماده نیست."
      );
      return;
    }

    const email =
      $("#email")?.value.trim();

    const password =
      $("#password")?.value || "";

    const displayName =
      $("#displayName")?.value.trim() ||
      email?.split("@")[0] ||
      "کاربر";

    if (!email) {
      notice("ایمیل را وارد کنید.");
      return;
    }

    if (password.length < 6) {
      notice(
        "رمز عبور باید حداقل ۶ کاراکتر باشد."
      );
      return;
    }

    notice("در حال ساخت حساب...");

    const {
      data,
      error
    } = await sb.auth.signUp({
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
      notice("حساب با موفقیت ساخته شد.");
    } else {
      notice(
        "حساب ساخته شد. ایمیل تأیید را بررسی کنید."
      );
    }
  }


  async function logout() {
    if (!sb) return;

    await sb.auth.signOut();

    user = null;
    profile = null;
    active = null;

    if (channel) {
      await sb.removeChannel(channel);
      channel = null;
    }

    showAuth();
  }


  async function forgotPassword() {
    if (!sb) return;

    const email =
      $("#email")?.value.trim();

    if (!email) {
      notice("ایمیل را وارد کنید.");
      return;
    }

    const {
      error
    } = await sb.auth.resetPasswordForEmail(
      email,
      {
        redirectTo:
          window.location.href
      }
    );

    notice(
      error
        ? error.message
        : "لینک بازیابی ارسال شد."
    );
  }


  /* =========================
     APP
  ========================= */

  async function showApp() {
    showAppUI();

    await loadProfile();
    await loadChats();

    updateMenu();
  }


  /* =========================
     PROFILE
  ========================= */

  async function loadProfile() {
    if (!user || !sb) return;

    const {
      data,
      error
    } = await sb
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error(
        "PROFILE ERROR:",
        error
      );

      profile = {
        id: user.id,
        email: user.email,
        display_name:
          user.user_metadata
            ?.display_name ||
          user.email
      };

      updateHeaderProfile();
      return;
    }

    profile = data;
    updateHeaderProfile();
  }


  function updateHeaderProfile() {
    if (!profile) return;

    const name =
      profile.display_name ||
      user?.email ||
      "BipolarChat";

    const nameEl = $("#name");

    if (nameEl) {
      nameEl.textContent = name;
    }

    const avatarEl = $("#avatar");

    if (avatarEl) {
      avatarEl.outerHTML =
        avatarHTML(profile);
    }

    const statusEl = $("#status");

    if (statusEl) {
      statusEl.textContent =
        profile.username
          ? "@" + profile.username
          : "آنلاین";
    }
  }


  function openProfile() {
    if (!user) return;

    const name =
      profile?.display_name ||
      user.email ||
      "";

    const username =
      profile?.username || "";

    const bio =
      profile?.bio || "";

    modal(
      "پروفایل من",
      `
        <div class="profile-editor">

          <div class="profile-preview">
            ${avatarHTML(
              profile,
              "large"
            )}
          </div>

          <label>
            نام نمایشی
            <input
              id="profileName"
              value="${esc(name)}"
            >
          </label>

          <label>
            نام کاربری
            <input
              id="profileUsername"
              value="${esc(username)}"
              placeholder="username"
            >
          </label>

          <label>
            درباره من
            <textarea
              id="profileBio"
              placeholder="درباره من..."
            >${esc(bio)}</textarea>
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
            id="saveProfileBtn"
          >
            ذخیره تغییرات
          </button>

          <button
            class="secondary"
            id="logoutProfileBtn"
          >
            خروج از حساب
          </button>

        </div>
      `
    );

    $("#saveProfileBtn")
      ?.addEventListener(
        "click",
        saveProfile
      );

    $("#logoutProfileBtn")
      ?.addEventListener(
        "click",
        async () => {
          closeModal();
          await logout();
        }
      );
  }


  async function saveProfile() {
    if (!user || !sb) return;

    const displayName =
      $("#profileName")
        ?.value.trim();

    const username =
      $("#profileUsername")
        ?.value.trim()
        .toLowerCase()
        .replace(/^@/, "")
        .replace(
          /[^a-z0-9_]/g,
          ""
        );

    const bio =
      $("#profileBio")
        ?.value.trim();

    if (!displayName) {
      alert(
        "نام نمایشی را وارد کنید."
      );
      return;
    }

    /*
      نسخه فعلی دیتابیس فقط
      display_name و avatar_url دارد.
      بنابراین اگر username/bio هنوز
      به دیتابیس اضافه نشده باشد،
      برنامه را خراب نمی‌کنیم.
    */

    const updates = {
      display_name:
        displayName
    };

    /*
      فقط اگر ستون‌های جدید
      در دیتابیس وجود داشته باشند
      آنها را امتحان می‌کنیم.
    */

    const avatarFile =
      $("#avatarFile")
        ?.files?.[0];

    if (avatarFile) {

      const extension =
        avatarFile.name
          .split(".")
          .pop() || "jpg";

      const path =
        `${user.id}/${Date.now()}.${extension}`;

      const {
        error: uploadError
      } = await sb.storage
        .from("avatars")
        .upload(
          path,
          avatarFile,
          {
            upsert: true,
            contentType:
              avatarFile.type
          }
        );

      if (!uploadError) {

        const {
          data
        } = sb.storage
          .from("avatars")
          .getPublicUrl(path);

        updates.avatar_url =
          data.publicUrl;
      }
    }

    let result =
      await sb
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single();

    if (result.error) {
      alert(
        result.error.message
      );
      return;
    }

    profile = result.data;

    /*
      اگر username/bio در دیتابیس
      وجود داشته باشند، آنها را هم
      ذخیره می‌کنیم.
    */

    if (
      username &&
      username.length >= 3
    ) {

      const extended =
        await sb
          .from("profiles")
          .update({
            username,
            bio: bio || ""
          })
          .eq("id", user.id)
          .select()
          .single();

      if (!extended.error) {
        profile =
          extended.data;
      }
    }

    closeModal();
    updateHeaderProfile();
  }


  /* =========================
     USER SEARCH
  ========================= */

  function openNewChat() {
    modal(
      "گفتگوی جدید",
      `
        <input
          id="newUserSearch"
          placeholder="ایمیل کاربر را وارد کنید..."
        >

        <button
          class="primary"
          id="searchUserBtn"
        >
          جستجو
        </button>

        <div
          id="userResults"
          class="user-results"
        ></div>
      `
    );

    $("#searchUserBtn")
      ?.addEventListener(
        "click",
        searchUsers
      );

    $("#newUserSearch")
      ?.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key === "Enter"
          ) {
            event.preventDefault();
            searchUsers();
          }
        }
      );
  }


  async function searchUsers() {
    const input =
      $("#newUserSearch");

    const results =
      $("#userResults");

    if (!input || !results) {
      return;
    }

    const q =
      input.value
        .trim()
        .toLowerCase();

    if (q.length < 2) {
      results.innerHTML =
        "<small>حداقل ۲ حرف وارد کنید.</small>";
      return;
    }

    const {
      data,
      error
    } = await sb
      .from("profiles")
      .select("*")
      .or(
        `email.ilike.%${q}%,display_name.ilike.%${q}%`
      )
      .neq(
        "id",
        user.id
      )
      .limit(20);

    if (error) {
      results.innerHTML =
        `<small>${esc(
          error.message
        )}</small>`;
      return;
    }

    if (!data?.length) {
      results.innerHTML =
        "<small>کاربری پیدا نشد.</small>";
      return;
    }

    results.innerHTML =
      data.map(
        (p) => `
          <button
            class="user-result"
            data-user-id="${esc(p.id)}"
          >
            ${avatarHTML(p)}

            <span>
              <b>
                ${esc(
                  p.display_name ||
                  p.email
                )}
              </b>

              <small>
                ${esc(
                  p.email || ""
                )}
              </small>
            </span>
          </button>
        `
      ).join("");

    results
      .querySelectorAll(
        ".user-result"
      )
      .forEach((button) => {

        button.addEventListener(
          "click",
          () => {
            startChatWith(
              button.dataset.userId
            );
          }
        );

      });
  }


  async function startChatWith(
    otherUserId
  ) {
    if (!otherUserId) return;

    const {
      data,
      error
    } = await sb.rpc(
      "create_private_conversation",
      {
        other_user:
          otherUserId
      }
    );

    if (error) {
      alert(
        error.message
      );
      return;
    }

    closeModal();

    await loadChats();

    await openChat(data);
  }


  /* =========================
     CHATS
  ========================= */

  async function loadChats() {
    if (!user || !sb) return;

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
      console.error(
        "CHAT ERROR:",
        error
      );

      window.chats = [];
      renderChats();

      return;
    }

    window.chats =
      data || [];

    await enrichChats();

    renderChats();
  }


  async function enrichChats() {

    if (!window.chats?.length) {
      return;
    }

    for (
      const chat
      of window.chats
    ) {

      const ids =
        (
          chat.conversation_members ||
          []
        )
          .map(
            (member) =>
              member.user_id
          )
          .filter(
            (id) =>
              id !== user.id
          );

      if (!ids.length) {
        continue;
      }

      const {
        data
      } = await sb
        .from("profiles")
        .select("*")
        .in(
          "id",
          ids
        );

      chat.otherProfile =
        data?.[0] || null;
    }
  }


  function getLastMessage(chat) {

    const messages =
      chat.messages || [];

    if (!messages.length) {
      return null;
    }

    return messages
      .slice()
      .sort(
        (a, b) =>
          new Date(
            a.created_at
          ) -
          new Date(
            b.created_at
          )
      )
      .pop();
  }


  function renderChats() {
    const list =
      $("#chatList");

    if (!list) return;

    const query =
      $("#search")
        ?.value
        .trim()
        .toLowerCase() ||
      "";

    let chats =
      window.chats || [];

    if (query) {
      chats =
        chats.filter(
          (chat) => {

            const p =
              chat.otherProfile;

            return (
              String(
                chat.title || ""
              )
                .toLowerCase()
                .includes(query) ||

              String(
                p?.display_name || ""
              )
                .toLowerCase()
                .includes(query) ||

              String(
                p?.email || ""
              )
                .toLowerCase()
                .includes(query)
            );
          }
        );
    }

    if (
      filter ===
      "unread"
    ) {
      /*
        فعلاً سیستم unread کامل
        در دیتابیس وجود ندارد.
      */
      chats = [];
    }

    list.innerHTML =
      chats
        .map(
          (chat) => {

            const p =
              chat.otherProfile;

            const title =
              p?.display_name ||
              chat.title ||
              "گفتگو";

            const last =
              getLastMessage(
                chat
              );

            return `
              <button
                class="chat ${
                  active === chat.id
                    ? "selected"
                    : ""
                }"
                data-chat-id="${esc(
                  chat.id
                )}"
              >

                ${avatarHTML(p)}

                <span>
                  <b>
                    ${esc(title)}
                  </b>

                  <small>
                    ${esc(
                      last?.body ||
                      "هنوز پیامی نیست"
                    )}
                  </small>
                </span>

                <time>
                  ${
                    last
                      ? time(
                          last.created_at
                        )
                      : ""
                  }
                </time>

              </button>
            `;
          }
        )
        .join("");

    list
      .querySelectorAll(
        ".chat"
      )
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            () => {

              openChat(
                button.dataset.chatId
              );

            }
          );

        }
      );

    if ($("#allCount")) {
      $("#allCount")
        .textContent =
        chats.length;
    }
  }


  /* =========================
     OPEN CHAT
  ========================= */

  async function openChat(id) {

    if (!id) return;

    const chat =
      (window.chats || [])
        .find(
          (item) =>
            item.id === id
        );

    if (!chat) return;

    active = id;

    const p =
      chat.otherProfile;

    const title =
      p?.display_name ||
      chat.title ||
      "گفتگو";

    const nameEl =
      $("#name");

    if (nameEl) {
      nameEl.textContent =
        title;
    }

    const statusEl =
      $("#status");

    if (statusEl) {
      statusEl.textContent =
        p?.email ||
        (
          chat.is_group
            ? "گروه"
            : "گفتگوی خصوصی"
        );
    }

    const avatar =
      $("#avatar");

    if (avatar) {
      avatar.outerHTML =
        avatarHTML(p);
    }

    renderChats();

    await loadMessages();

    if (
      window.innerWidth <
      800
    ) {

      $(".sidebar")
        ?.classList.add(
          "hide"
        );

      $(".main")
        ?.classList.add(
          "show"
        );
    }
  }


  /* =========================
     MESSAGES
  ========================= */

  async function loadMessages() {

    if (!active) return;

    const {
      data,
      error
    } = await sb
      .from("messages")
      .select(`
        id,
        body,
        sender_id,
        created_at
      `)
      .eq(
        "conversation_id",
        active
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );

    if (error) {
      console.error(
        "MESSAGE ERROR:",
        error
      );

      alert(
        error.message
      );

      return;
    }

    const box =
      $("#messages");

    if (!box) return;

    if (!data?.length) {

      box.innerHTML = `
        <div class="empty">
          هنوز پیامی نیست.
          اولین پیام را بفرستید.
        </div>
      `;

    } else {

      box.innerHTML =
        data
          .map(
            messageHTML
          )
          .join("");
    }

    box.scrollTop =
      box.scrollHeight;

    if (channel) {
      await sb.removeChannel(
        channel
      );
      channel = null;
    }

    channel =
      sb
        .channel(
          "bipolarchat-" +
          active
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter:
              "conversation_id=eq." +
              active
          },
          (payload) => {

            if (
              payload.new
                .sender_id !==
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


  function messageHTML(message) {

    const mine =
      message.sender_id ===
      user?.id;

    return `
      <div
        class="bubble ${
          mine ? "me" : ""
        }"
      >

        <span>
          ${esc(
            message.body
          )}
        </span>

        <time>
          ${time(
            message.created_at
          )}
        </time>

      </div>
    `;
  }


  function appendMessage(
    message
  ) {

    const box =
      $("#messages");

    if (!box) return;

    const empty =
      box.querySelector(
        ".empty"
      );

    if (empty) {
      empty.remove();
    }

    box.insertAdjacentHTML(
      "beforeend",
      messageHTML(
        message
      )
    );

    box.scrollTop =
      box.scrollHeight;
  }


  async function sendMessage() {

    if (!active) {
      notice(
        "ابتدا یک گفتگو انتخاب کنید."
      );
      return;
    }

    const input =
      $("#text");

    if (!input) return;

    const body =
      input.value.trim();

    if (!body) return;

    if (!user) {
      notice(
        "ابتدا وارد حساب شوید."
      );
      return;
    }

    input.value = "";

    const {
      data,
      error
    } = await sb
      .from("messages")
      .insert({
        conversation_id:
          active,
        sender_id:
          user.id,
        body
      })
      .select()
      .single();

    if (error) {
      console.error(
        "SEND ERROR:",
        error
      );

      alert(
        error.message
      );

      input.value =
        body;

      return;
    }

    /*
      پیام خودمان را اینجا
      دستی اضافه می‌کنیم.
      Realtime برای فرستنده
      دوباره اضافه نمی‌کند.
    */

    if (data) {
      appendMessage(data);
    }

    await loadChats();
  }


  /* =========================
     SETTINGS / MENU
  ========================= */

  function updateMenu() {

    const menu =
      $("#menuBtn");

    if (!menu) return;

    menu.onclick =
      () => {

        modal(
          "BipolarChat",
          `
            <div class="settings-menu">

              <button
                class="secondary menu-item"
                id="menuProfile"
              >
                👤 پروفایل من
              </button>

              <button
                class="secondary menu-item"
                id="menuLanguage"
              >
                🌐 زبان
              </button>

              <button
                class="secondary menu-item"
                id="menuAbout"
              >
                ℹ️ درباره BipolarChat
              </button>

              <button
                class="secondary menu-item"
                id="menuLogout"
              >
                🚪 خروج
              </button>

            </div>
          `
        );

        $("#menuProfile")
          ?.addEventListener(
            "click",
            () => {
              closeModal();
              openProfile();
            }
          );

        $("#menuLanguage")
          ?.addEventListener(
            "click",
            () => {

              modal(
                "زبان",
                `
                  <button class="secondary menu-item">
                    🇮🇷 فارسی
                  </button>

                  <button class="secondary menu-item">
                    🇬🇧 English
                  </button>

                  <button class="secondary menu-item">
                    🇩🇪 Deutsch
                  </button>

                  <button class="secondary menu-item">
                    🇹🇷 Türkçe
                  </button>
                `
              );

            }
          );

        $("#menuAbout")
          ?.addEventListener(
            "click",
            () => {

              modal(
                "درباره BipolarChat",
                `
                  <p>
                    BipolarChat
                  </p>

                  <p>
                    پیام‌رسان وب خصوصی
                  </p>
                `
              );

            }
          );

        $("#menuLogout")
          ?.addEventListener(
            "click",
            async () => {
              closeModal();
              await logout();
            }
          );
      };
  }


  /* =========================
     EVENTS
  ========================= */

  function bindEvents() {

    $("#loginBtn")
      ?.addEventListener(
        "click",
        login
      );

    $("#signupBtn")
      ?.addEventListener(
        "click",
        signup
      );

    $("#forgot")
      ?.addEventListener(
        "click",
        forgotPassword
      );

    $("#profileBtn")
      ?.addEventListener(
        "click",
        openProfile
      );

    $("#newChat")
      ?.addEventListener(
        "click",
        openNewChat
      );

    $("#fileBtn")
      ?.addEventListener(
        "click",
        () => {
          $("#file")?.click();
        }
      );

    $("#composer")
      ?.addEventListener(
        "submit",
        (event) => {
          event.preventDefault();
          sendMessage();
        }
      );

    $("#text")
      ?.addEventListener(
        "keydown",
        (event) => {

          if (
            event.key === "Enter" &&
            !event.shiftKey
          ) {

            event.preventDefault();

            sendMessage();
          }
        }
      );

    $("#search")
      ?.addEventListener(
        "input",
        renderChats
      );

    $("#back")
      ?.addEventListener(
        "click",
        () => {

          $(".sidebar")
            ?.classList.remove(
              "hide"
            );

          $(".main")
            ?.classList.remove(
              "show"
            );
        }
      );

    $("#close")
      ?.addEventListener(
        "click",
        closeModal
      );

    $("#modal")
      ?.addEventListener(
        "click",
        (event) => {

          if (
            event.target.id ===
            "modal"
          ) {
            closeModal();
          }

        }
      );

    $$(".tab")
      .forEach(
        (tab) => {

          tab.addEventListener(
            "click",
            () => {

              $$(".tab")
                .forEach(
                  (item) =>
                    item.classList.remove(
                      "active"
                    )
                );

              tab.classList.add(
                "active"
              );

              filter =
                tab.dataset.filter ||
                "all";

              renderChats();
            }
          );

        }
      );

    /*
      دکمه‌های Header فعلاً
      بدون ID بودند.
      اینجا جلوی خطا را می‌گیریم.
    */

    $$(".header-btn")
      .forEach(
        (button, index) => {

          button.addEventListener(
            "click",
            () => {

              if (index === 0) {

                $("#search")
                  ?.focus();

              } else {

                updateMenu();
                $("#menuBtn")
                  ?.click();

              }

            }
          );

        }
      );
  }


  /* =========================
     START
  ========================= */

  function start() {
    bindEvents();
    updateMenu();
    boot();
  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      start
    );

  } else {

    start();

  }

})();
