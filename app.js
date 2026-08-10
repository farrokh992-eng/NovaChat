document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const CONFIG = window.NOVA_CONFIG || {};

  const $ = (id) => document.getElementById(id);

  let supabaseClient = null;
  let currentUser = null;
  let currentProfile = null;
  let activeChatId = null;
  let chats = [];
  let realtimeChannel = null;

  const state = {
    loadingMessages: false,
    sendingMessage: false
  };


  /* =========================================================
     HELPERS
     ========================================================= */

  function setText(id, value) {
    const element = $(id);
    if (element) {
      element.textContent = value ?? "";
    }
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
    if (!value) return "";

    try {
      return new Date(value).toLocaleTimeString("fa-IR", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "";
    }
  }


  function showAuthMessage(message, error = true) {
    const element = $("auth-message");

    if (!element) return;

    element.textContent = message || "";
    element.style.color = error
      ? "var(--danger)"
      : "var(--primary)";
  }


  function showToast(message) {
    const toast = $("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }


  function showAuthScreen() {
    $("auth-screen")?.classList.remove("hidden");
    $("main-screen")?.classList.add("hidden");
    $("mobile-nav")?.classList.add("hidden");
  }


  function showMainScreen() {
    $("auth-screen")?.classList.add("hidden");
    $("main-screen")?.classList.remove("hidden");
    $("mobile-nav")?.classList.remove("hidden");
  }


  function getInitial(name) {
    const value = String(name || "B").trim();
    return value.charAt(0).toUpperCase() || "B";
  }


  /* =========================================================
     SUPABASE
     ========================================================= */

  function validateConfig() {
    return (
      typeof CONFIG.SUPABASE_URL === "string" &&
      CONFIG.SUPABASE_URL.startsWith("https://") &&
      typeof CONFIG.SUPABASE_PUBLISHABLE_KEY === "string" &&
      CONFIG.SUPABASE_PUBLISHABLE_KEY.startsWith("sb_")
    );
  }


  async function initializeSupabase() {
    if (!validateConfig()) {
      showAuthMessage(
        "تنظیمات Supabase در config.js کامل نیست."
      );
      return false;
    }

    if (
      typeof window.supabase === "undefined" ||
      typeof window.supabase.createClient !== "function"
    ) {
      showAuthMessage(
        "کتابخانه Supabase بارگذاری نشد. صفحه را دوباره باز کنید."
      );
      return false;
    }

    try {
      supabaseClient = window.supabase.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_PUBLISHABLE_KEY
      );

      return true;
    } catch (error) {
      console.error("Supabase initialization error:", error);

      showAuthMessage(
        "اتصال به Supabase برقرار نشد."
      );

      return false;
    }
  }


  /* =========================================================
     AUTH
     ========================================================= */

  async function login(event) {
    event?.preventDefault();

    if (!supabaseClient) return;

    const email = $("email")?.value.trim();
    const password = $("password")?.value;

    if (!email || !password) {
      showAuthMessage(
        "ایمیل و رمز عبور را وارد کنید."
      );
      return;
    }

    const button = $("login-button");

    if (button) {
      button.disabled = true;
      button.textContent = "در حال ورود...";
    }

    showAuthMessage(
      "در حال ورود...",
      false
    );

    try {
      const { error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) {
        showAuthMessage(error.message);
        return;
      }

      showAuthMessage(
        "ورود موفق بود.",
        false
      );

    } catch (error) {
      console.error("Login error:", error);

      showAuthMessage(
        "ورود انجام نشد. دوباره تلاش کنید."
      );

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "ورود";
      }
    }
  }


  async function logout() {
    if (!supabaseClient) return;

    try {
      await supabaseClient.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  }


  /* =========================================================
     PROFILE
     ========================================================= */

  async function loadProfile() {
    if (!currentUser || !supabaseClient) return;

    try {
      const { data, error } =
        await supabaseClient
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .maybeSingle();

      if (error) {
        console.error("Profile error:", error);
        return;
      }

      currentProfile = data || {
        id: currentUser.id,
        email: currentUser.email,
        display_name:
          currentUser.email?.split("@")[0] || "کاربر"
      };

      window.BIPOLAR_PROFILE = currentProfile;

    } catch (error) {
      console.error("Profile load error:", error);
    }
  }


  /* =========================================================
     CHATS
     ========================================================= */

  async function loadChats() {
    if (!currentUser || !supabaseClient) return;

    try {
      const { data, error } =
        await supabaseClient
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
              id,
              body,
              sender_id,
              created_at
            )
          `)
          .eq(
            "conversation_members.user_id",
            currentUser.id
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          );

      if (error) {
        console.error("Chats error:", error);

        chats = [];
        renderChats();

        return;
      }

      chats = Array.isArray(data)
        ? data
        : [];

      renderChats();

    } catch (error) {
      console.error("Chat loading error:", error);
    }
  }


  function getLastMessage(chat) {
    const messages = Array.isArray(chat?.messages)
      ? [...chat.messages]
      : [];

    messages.sort(
      (a, b) =>
        new Date(a.created_at) -
        new Date(b.created_at)
    );

    return messages[messages.length - 1] || null;
  }


  function getChatTitle(chat) {
    return (
      chat?.title ||
      (chat?.is_group ? "گروه" : "گفتگوی خصوصی")
    );
  }


  function renderChats() {
    const list = $("chat-list");

    if (!list) return;

    if (!chats.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <strong>هنوز گفتگویی ندارید</strong>
          <span>
            برای شروع یک گفتگو ایجاد کنید.
          </span>
        </div>
      `;

      return;
    }

    list.innerHTML = chats.map((chat) => {
      const title = getChatTitle(chat);
      const last = getLastMessage(chat);

      return `
        <button
          type="button"
          class="chat-item"
          data-chat-id="${escapeHTML(chat.id)}"
          style="
            width:100%;
            display:flex;
            align-items:center;
            gap:12px;
            padding:10px 14px;
            border:0;
            border-bottom:1px solid var(--border);
            background:${activeChatId === chat.id
              ? "var(--primary-soft)"
              : "transparent"};
            color:var(--text);
            text-align:right;
          "
        >

          <span
            style="
              width:48px;
              height:48px;
              min-width:48px;
              display:flex;
              align-items:center;
              justify-content:center;
              border-radius:50%;
              background:var(--primary);
              color:#fff;
              font-weight:700;
            "
          >
            ${escapeHTML(getInitial(title))}
          </span>

          <span
            style="
              min-width:0;
              flex:1;
              display:flex;
              flex-direction:column;
              gap:4px;
            "
          >
            <strong
              style="
                overflow:hidden;
                text-overflow:ellipsis;
                white-space:nowrap;
              "
            >
              ${escapeHTML(title)}
            </strong>

            <small
              style="
                overflow:hidden;
                text-overflow:ellipsis;
                white-space:nowrap;
                color:var(--text-secondary);
              "
            >
              ${escapeHTML(
                last?.body || "هنوز پیامی نیست"
              )}
            </small>
          </span>

          <time
            style="
              align-self:flex-start;
              color:var(--text-secondary);
              font-size:11px;
              white-space:nowrap;
            "
          >
            ${last ? formatTime(last.created_at) : ""}
          </time>

        </button>
      `;
    }).join("");


    list
      .querySelectorAll("[data-chat-id]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => openChat(button.dataset.chatId)
        );
      });
  }


  /* =========================================================
     OPEN CHAT
     ========================================================= */

  async function openChat(chatId) {
    const chat = chats.find(
      (item) => item.id === chatId
    );

    if (!chat) return;

    activeChatId = chatId;

    const title = getChatTitle(chat);

    setText("chat-name", title);

    setText(
      "chat-status",
      chat.is_group
        ? "گروه"
        : "گفتگوی خصوصی"
    );

    setText(
      "chat-avatar",
      getInitial(title)
    );

    $("message-input")?.removeAttribute("disabled");
    $("attachment-button")?.removeAttribute("disabled");

    renderChats();

    await loadMessages();

    subscribeToMessages();

    if (window.innerWidth <= 700) {
      $("sidebar")?.classList.add("mobile-hidden");
      $("chat-area")?.classList.add("mobile-active");
    }
  }


  /* =========================================================
     MESSAGES
     ========================================================= */

  async function loadMessages() {
    if (
      !activeChatId ||
      !currentUser ||
      !supabaseClient
    ) {
      return;
    }

    if (state.loadingMessages) return;

    state.loadingMessages = true;

    const box = $("messages");

    if (!box) {
      state.loadingMessages = false;
      return;
    }

    try {
      const { data, error } =
        await supabaseClient
          .from("messages")
          .select(
            "id, body, sender_id, created_at"
          )
          .eq(
            "conversation_id",
            activeChatId
          )
          .order(
            "created_at",
            {
              ascending: true
            }
          );

      if (error) {
        console.error(
          "Messages error:",
          error
        );

        box.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <strong>
              دریافت پیام‌ها ناموفق بود
            </strong>
            <span>
              ${escapeHTML(error.message)}
            </span>
          </div>
        `;

        return;
      }

      renderMessages(data || []);

    } catch (error) {
      console.error(
        "Message loading error:",
        error
      );

    } finally {
      state.loadingMessages = false;
    }
  }


  function renderMessages(messages) {
    const box = $("messages");

    if (!box) return;

    if (!messages.length) {
      box.innerHTML = `
        <div class="welcome-state">
          <div class="welcome-logo">
            ${escapeHTML(
              getInitial(
                getChatTitle(
                  chats.find(
                    (chat) =>
                      chat.id === activeChatId
                  )
                )
              )
            )}
          </div>

          <h2>
            هنوز پیامی نیست
          </h2>

          <p>
            اولین پیام این گفتگو را ارسال کنید.
          </p>
        </div>
      `;

      return;
    }

    box.innerHTML = messages
      .map(renderMessage)
      .join("");

    scrollMessagesToBottom();
  }


  function renderMessage(message) {
    const own =
      message.sender_id === currentUser?.id;

    return `
      <div
        data-message-id="${escapeHTML(message.id)}"
        style="
          width:100%;
          display:flex;
          justify-content:${own ? "flex-start" : "flex-end"};
          margin:4px 0;
        "
      >

        <div
          style="
            max-width:min(75%, 620px);
            padding:8px 12px 6px;
            border-radius:${own
              ? "12px 12px 4px 12px"
              : "12px 12px 12px 4px"};
            background:${own
              ? "var(--primary)"
              : "var(--surface)"};
            color:${own
              ? "#ffffff"
              : "var(--text)"};
            box-shadow:0 1px 2px rgba(0,0,0,.08);
            overflow-wrap:anywhere;
          "
        >

          <div
            style="
              font-size:14px;
              line-height:1.7;
              white-space:pre-wrap;
            "
          >
            ${escapeHTML(message.body)}
          </div>

          <time
            style="
              display:block;
              margin-top:2px;
              text-align:left;
              font-size:10px;
              opacity:.72;
            "
          >
            ${formatTime(message.created_at)}
          </time>

        </div>

      </div>
    `;
  }


  function appendMessage(message) {
    const box = $("messages");

    if (!box) return;

    const welcome =
      box.querySelector(".welcome-state");

    if (welcome) {
      box.innerHTML = "";
    }

    if (
      box.querySelector(
        `[data-message-id="${CSS.escape(message.id)}"]`
      )
    ) {
      return;
    }

    box.insertAdjacentHTML(
      "beforeend",
      renderMessage(message)
    );

    scrollMessagesToBottom();
  }


  function scrollMessagesToBottom() {
    const box = $("messages");

    if (!box) return;

    requestAnimationFrame(() => {
      box.scrollTop = box.scrollHeight;
    });
  }


  /* =========================================================
     SEND MESSAGE
     ========================================================= */

  async function sendMessage(event) {
    event?.preventDefault();

    if (
      !activeChatId ||
      !currentUser ||
      !supabaseClient ||
      state.sendingMessage
    ) {
      return;
    }

    const input = $("message-input");

    if (!input) return;

    const body = input.value.trim();

    if (!body) return;

    state.sendingMessage = true;

    const sendButton = $("send-button");

    if (sendButton) {
      sendButton.disabled = true;
    }

    try {
      const { data, error } =
        await supabaseClient
          .from("messages")
          .insert({
            conversation_id: activeChatId,
            sender_id: currentUser.id,
            body
          })
          .select(
            "id,body,sender_id,created_at"
          )
          .single();

      if (error) {
        console.error(
          "Send message error:",
          error
        );

        showToast(
          "پیام ارسال نشد: " +
          error.message
        );

        return;
      }

      input.value = "";

      appendMessage(data);

      await loadChats();

    } catch (error) {
      console.error(
        "Send message exception:",
        error
      );

      showToast(
        "خطا در ارسال پیام."
      );

    } finally {
      state.sendingMessage = false;

      updateSendButton();
    }
  }


  function updateSendButton() {
    const input = $("message-input");
    const button = $("send-button");

    if (!input || !button) return;

    button.disabled =
      !activeChatId ||
      state.sendingMessage ||
      !input.value.trim();
  }


  /* =========================================================
     REALTIME
     ========================================================= */

  function unsubscribeFromMessages() {
    if (!supabaseClient || !realtimeChannel) {
      return;
    }

    supabaseClient
      .removeChannel(realtimeChannel);

    realtimeChannel = null;
  }


  function subscribeToMessages() {
    if (
      !supabaseClient ||
      !activeChatId
    ) {
      return;
    }

    unsubscribeFromMessages();

    realtimeChannel =
      supabaseClient
        .channel(
          `bipolarchat-messages-${activeChatId}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter:
              `conversation_id=eq.${activeChatId}`
          },
          (payload) => {
            if (payload?.new) {
              appendMessage(payload.new);
              loadChats();
            }
          }
        )
        .subscribe((status) => {
          console.log(
            "Realtime status:",
            status
          );
        });
  }


  /* =========================================================
     MOBILE
     ========================================================= */

  function goBackToChats() {
    $("sidebar")?.classList.remove(
      "mobile-hidden"
    );

    $("chat-area")?.classList.remove(
      "mobile-active"
    );

    activeChatId = null;

    $("message-input")?.setAttribute(
      "disabled",
      "disabled"
    );

    $("attachment-button")?.setAttribute(
      "disabled",
      "disabled"
    );

    $("send-button")?.setAttribute(
      "disabled",
      "disabled"
    );

    unsubscribeFromMessages();
  }


  /* =========================================================
     MODAL
     ========================================================= */

  function closeModal() {
    const modal = $("modal");

    if (!modal) return;

    modal.classList.add("hidden");
    modal.setAttribute(
      "aria-hidden",
      "true"
    );
  }


  /* =========================================================
     EVENTS
     ========================================================= */

  function setupEvents() {
    $("login-form")
      ?.addEventListener(
        "submit",
        login
      );


    $("message-form")
      ?.addEventListener(
        "submit",
        sendMessage
      );


    $("message-input")
      ?.addEventListener(
        "input",
        updateSendButton
      );


    $("back-button")
      ?.addEventListener(
        "click",
        goBackToChats
      );


    $("modal-close")
      ?.addEventListener(
        "click",
        closeModal
      );


    document
      .querySelector(
        "[data-modal-close]"
      )
      ?.addEventListener(
        "click",
        closeModal
      );


    $("chat-search")
      ?.addEventListener(
        "input",
        (event) => {
          const query =
            event.target.value
              .trim()
              .toLocaleLowerCase("fa");

          document
            .querySelectorAll(
              "[data-chat-id]"
            )
            .forEach((item) => {
              const title =
                item.textContent
                  .toLocaleLowerCase("fa");

              item.style.display =
                !query ||
                title.includes(query)
                  ? "flex"
                  : "none";
            });
        }
      );


    $("menu-button")
      ?.addEventListener(
        "click",
        () => {
          showToast(
            "منوی BipolarChat در مرحله بعد فعال می‌شود."
          );
        }
      );


    $("new-chat-button")
      ?.addEventListener(
        "click",
        () => {
          showToast(
            "جستجوی کاربران در مرحله بعد فعال می‌شود."
          );
        }
      );


    $("chat-search-button")
      ?.addEventListener(
        "click",
        () => {
          showToast(
            "جستجوی پیام‌ها در مرحله بعد فعال می‌شود."
          );
        }
      );


    $("chat-menu-button")
      ?.addEventListener(
        "click",
        () => {
          showToast(
            "گزینه‌های گفتگو در مرحله بعد فعال می‌شوند."
          );
        }
      );


    $("close-details")
      ?.addEventListener(
        "click",
        () => {
          $("details-panel")
            ?.classList.add("hidden");
        }
      );


    document
      .querySelectorAll(".mobile-nav-item")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            document
              .querySelectorAll(
                ".mobile-nav-item"
              )
              .forEach((item) => {
                item.classList.remove(
                  "active"
                );
              });

            button.classList.add("active");

            showToast(
              "این بخش در حال توسعه است."
            );
          }
        );
      });
  }


  /* =========================================================
     AUTH STATE
     ========================================================= */

  async function handleSession(session) {
    currentUser =
      session?.user || null;

    if (!currentUser) {
      currentProfile = null;
      activeChatId = null;
      chats = [];

      unsubscribeFromMessages();
      showAuthScreen();

      return;
    }

    showMainScreen();

    await loadProfile();
    await loadChats();

    setText(
      "chat-name",
      currentProfile?.display_name ||
      currentUser.email?.split("@")[0] ||
      "BipolarChat"
    );

    setText(
      "chat-status",
      currentProfile?.username
        ? `@${currentProfile.username}`
        : "آنلاین"
    );

    setText(
      "chat-avatar",
      getInitial(
        currentProfile?.display_name ||
        currentUser.email
      )
    );
  }


  /* =========================================================
     BOOT
     ========================================================= */

  async function boot() {
    const initialized =
      await initializeSupabase();

    if (!initialized) {
      return;
    }

    try {
      const {
        data: {
          session
        }
      } =
        await supabaseClient.auth.getSession();

      await handleSession(session);


      supabaseClient.auth.onAuthStateChange(
        async (_event, session) => {
          await handleSession(session);
        }
      );

    } catch (error) {
      console.error(
        "Boot error:",
        error
      );

      showAuthMessage(
        "راه‌اندازی BipolarChat انجام نشد."
      );
    }
  }


  setupEvents();
  boot();
});
