/* =========================================================
   BipolarChat-v2
   app.js — repaired
   ========================================================= */

"use strict";

/* =========================================================
   SUPABASE
   ========================================================= */

const CONFIG =
  window.NOVA_CONFIG ||
  window.NOVA_CONFIG ||
  {};

const SUPABASE_URL =
  CONFIG.SUPABASE_URL || "";

const SUPABASE_KEY =
  CONFIG.SUPABASE_PUBLISHABLE_KEY ||
  CONFIG.SUPABASE_ANON_KEY ||
  "";

const supabaseClient =
  window.supabase &&
  SUPABASE_URL &&
  SUPABASE_KEY
    ? window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      )
    : null;

/* =========================================================
   DOM
   ========================================================= */

const $ = id =>
  document.getElementById(id);

const auth = $("auth");
const app = $("app");
const toast = $("toast");

const emailInput = $("email");
const passwordInput = $("password");
const passwordConfirmInput =
  $("passwordConfirm");

const loginBtn = $("loginBtn");
const signupBtn = $("signupBtn");
const forgotBtn = $("forgot");
const toggleAuthBtn = $("toggleAuth");
const googleLoginBtn =
  $("googleLoginBtn");

const passwordToggle =
  $("passwordToggle");

const authTitle =
  $("authTitle");

const authMessage =
  $("authMessage");

const signupNameBox =
  $("signupNameBox");

const signupPasswordConfirmBox =
  $("signupPasswordConfirmBox");

const displayNameInput =
  $("displayName");

const menuPanel =
  $("menuPanel");

const profilePanel =
  $("profilePanel");

const settingsPanel =
  $("settingsPanel");

const languagePanel =
  $("languagePanel");

const aboutPanel =
  $("aboutPanel");

const newChatPanel =
  $("newChatPanel");

const contactPanel =
  $("contactPanel");

const groupPanel =
  $("groupPanel");

const channelPanel =
  $("channelPanel");

const sidebar =
  $("sidebar");

const main =
  $("main");

const chatList =
  $("chatList");

const messages =
  $("messages");

const profileName =
  $("profileName");

const profileUsername =
  $("profileUsername");

const profileEmail =
  $("profileEmail");

const profileBio =
  $("profileBio");

const profileAvatar =
  $("profileAvatar");

const avatarFile =
  $("avatarFile");

const settingsTitle =
  $("settingsTitle");

const settingsContent =
  $("settingsContent");

/* =========================================================
   STATE
   ========================================================= */

let authMode = "login";
let currentUser = null;
let currentSession = null;
let toastTimer = null;

let activeConversationId = null;
let realtimeChannel = null;
let conversationCache = [];
let pendingMfaFactorId = null;

/* =========================================================
   STORAGE KEYS
   ========================================================= */

function userKey(name) {
  return currentUser
    ? `bipolarchat_${currentUser.id}_${name}`
    : `bipolarchat_${name}`;
}

function globalKey(name) {
  return `bipolarchat_${name}`;
}

/* =========================================================
   TOAST
   ========================================================= */

function showToast(
  message,
  duration = 3000
) {
  if (!toast) return;

  clearTimeout(toastTimer);

  toast.textContent =
    String(message);

  toast.classList.add("show");

  toastTimer = setTimeout(
    () => {
      toast.classList.remove(
        "show"
      );
    },
    duration
  );
}

/* =========================================================
   AUTH UI
   ========================================================= */

function setAuthMode(mode) {
  authMode = mode;

  const signup =
    mode === "signup";

  if (authTitle) {
    authTitle.textContent =
      signup
        ? "ساخت حساب BipolarChat"
        : "ورود به BipolarChat";
  }

  if (authMessage) {
    authMessage.textContent =
      signup
        ? "برای ساخت حساب اطلاعات زیر را وارد کنید."
        : "برای ادامه وارد حساب خود شوید.";
  }

  if (signupNameBox) {
    signupNameBox.classList.add(
      "hidden"
    );
  }

  if (signupPasswordConfirmBox) {
    signupPasswordConfirmBox.classList.toggle(
      "hidden",
      !signup
    );
  }

  if (loginBtn) {
    loginBtn.classList.toggle(
      "hidden",
      signup
    );
  }

  if (signupBtn) {
    signupBtn.classList.toggle(
      "hidden",
      !signup
    );
  }

  if (toggleAuthBtn) {
    toggleAuthBtn.textContent =
      signup
        ? "حساب دارید؟ ورود"
        : "حساب ندارید؟ ساخت حساب";
  }

  if (passwordInput) {
    passwordInput.value = "";
  }

  if (passwordConfirmInput) {
    passwordConfirmInput.value = "";
  }
}

/* =========================================================
   PASSWORD
   ========================================================= */

function togglePasswordVisibility() {
  if (!passwordInput) return;

  const hidden =
    passwordInput.type ===
    "password";

  passwordInput.type =
    hidden
      ? "text"
      : "password";

  if (passwordToggle) {
    passwordToggle.textContent =
      hidden
        ? "◉"
        : "◌";
  }
}

/* =========================================================
   BUTTON LOADING
   ========================================================= */

function setButtonLoading(
  button,
  loading,
  text
) {
  if (!button) return;

  if (loading) {
    if (
      !button.dataset.originalText
    ) {
      button.dataset.originalText =
        button.textContent;
    }

    button.disabled = true;

    button.textContent =
      text ||
      "در حال انجام...";
  } else {
    button.disabled = false;

    if (
      button.dataset.originalText
    ) {
      button.textContent =
        button.dataset.originalText;
    }
  }
}

/* =========================================================
   AUTH ERROR
   ========================================================= */

function getAuthErrorMessage(
  error
) {
  if (!error) {
    return "خطای نامشخص.";
  }

  const message =
    String(
      error.message || ""
    ).toLowerCase();

  if (
    message.includes(
      "invalid login"
    ) ||
    message.includes(
      "invalid credentials"
    )
  ) {
    return "ایمیل یا رمز عبور اشتباه است.";
  }

  if (
    message.includes(
      "email not confirmed"
    )
  ) {
    return "ایمیل حساب هنوز تأیید نشده است.";
  }

  if (
    message.includes(
      "user already registered"
    )
  ) {
    return "این ایمیل قبلاً ثبت شده است.";
  }

  if (
    message.includes(
      "password should be"
    )
  ) {
    return "رمز عبور شرایط لازم را ندارد.";
  }

  if (
    message.includes(
      "rate limit"
    )
  ) {
    return "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.";
  }

  if (
    message.includes(
      "network"
    )
  ) {
    return "اتصال به اینترنت یا سرور برقرار نیست.";
  }

  return (
    error.message ||
    "عملیات انجام نشد."
  );
}

/* =========================================================
   LOGIN
   ========================================================= */

async function login() {
  if (!supabaseClient) {
    showToast(
      "اتصال Supabase برقرار نیست."
    );
    return;
  }

  const email =
    emailInput?.value.trim() ||
    "";

  const password =
    passwordInput?.value ||
    "";

  if (!email) {
    showToast(
      "ایمیل را وارد کنید."
    );
    emailInput?.focus();
    return;
  }

  if (!password) {
    showToast(
      "رمز عبور را وارد کنید."
    );
    passwordInput?.focus();
    return;
  }

  setButtonLoading(
    loginBtn,
    true,
    "در حال ورود..."
  );

  try {
    const {
      data,
      error
    } =
      await supabaseClient.auth
        .signInWithPassword({
          email,
          password
        });

    if (error) {
      throw error;
    }

    currentSession =
      data.session;

    currentUser =
      data.user;

    if (!currentUser) {
      throw new Error(
        "حساب کاربری دریافت نشد."
      );
    }

    await enterApplication(
      currentUser
    );

    showToast(
      "ورود با موفقیت انجام شد."
    );
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    showToast(
      getAuthErrorMessage(
        error
      )
    );
  } finally {
    setButtonLoading(
      loginBtn,
      false
    );
  }
}

/* =========================================================
   SIGNUP
   ========================================================= */

async function signup() {
  if (!supabaseClient) {
    showToast(
      "اتصال Supabase برقرار نیست."
    );
    return;
  }

  const email =
    emailInput?.value.trim() ||
    "";

  const password =
    passwordInput?.value ||
    "";

  const confirm =
    passwordConfirmInput?.value ||
    "";

  if (!email) {
    showToast(
      "ایمیل را وارد کنید."
    );
    emailInput?.focus();
    return;
  }

  if (!password) {
    showToast(
      "رمز عبور را وارد کنید."
    );
    passwordInput?.focus();
    return;
  }

  if (password.length < 6) {
    showToast(
      "رمز عبور باید حداقل ۶ کاراکتر باشد."
    );
    return;
  }

  if (!confirm) {
    showToast(
      "تکرار رمز عبور را وارد کنید."
    );
    passwordConfirmInput?.focus();
    return;
  }

  if (password !== confirm) {
    showToast(
      "رمز عبور و تکرار آن یکسان نیستند."
    );
    return;
  }

  setButtonLoading(
    signupBtn,
    true,
    "در حال ساخت حساب..."
  );

  try {
    const {
      data,
      error
    } =
      await supabaseClient.auth
        .signUp({
          email,
          password,
          options: {
            data: {
              display_name:
                "Unknown",
              username: "",
              bio: ""
            }
          }
        });

    if (error) {
      throw error;
    }

    if (
      data.session &&
      data.user
    ) {
      currentSession =
        data.session;

      currentUser =
        data.user;

      await enterApplication(
        currentUser
      );

      showToast(
        "حساب با موفقیت ساخته شد."
      );
    } else {
      showToast(
        "حساب ساخته شد. ایمیل خود را برای تأیید بررسی کنید.",
        5000
      );

      setAuthMode(
        "login"
      );
    }
  } catch (error) {
    console.error(
      "SIGNUP ERROR:",
      error
    );

    showToast(
      getAuthErrorMessage(
        error
      )
    );
  } finally {
    setButtonLoading(
      signupBtn,
      false
    );
  }
}

/* =========================================================
   GOOGLE
   ========================================================= */

async function loginWithGoogle() {
  if (!supabaseClient) {
    showToast(
      "اتصال Supabase برقرار نیست."
    );
    return;
  }

  setButtonLoading(
    googleLoginBtn,
    true,
    "در حال اتصال..."
  );

  try {
    const redirectTo =
      "https://farrokh992-eng.github.io/NovaChat/";

    const {
      error
    } =
      await supabaseClient.auth
        .signInWithOAuth({
          provider: "google",
          options: {
            redirectTo
          }
        });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error(
      "GOOGLE LOGIN ERROR:",
      error
    );

    showToast(
      getAuthErrorMessage(
        error
      ),
      5000
    );

    setButtonLoading(
      googleLoginBtn,
      false
    );
  }
}

/* =========================================================
   PASSWORD RESET
   ========================================================= */

async function forgotPassword() {
  if (!supabaseClient) {
    showToast(
      "اتصال Supabase برقرار نیست."
    );
    return;
  }

  const email =
    emailInput?.value.trim() ||
    "";

  if (!email) {
    showToast(
      "ابتدا ایمیل حساب خود را وارد کنید."
    );
    emailInput?.focus();
    return;
  }

  setButtonLoading(
    forgotBtn,
    true,
    "در حال ارسال..."
  );

  try {
    const redirectTo =
      window.location.origin +
      window.location.pathname;

    const {
      error
    } =
      await supabaseClient.auth
        .resetPasswordForEmail(
          email,
          {
            redirectTo
          }
        );

    if (error) {
      throw error;
    }

    showToast(
      "لینک تغییر رمز به ایمیل شما ارسال شد.",
      5000
    );
  } catch (error) {
    console.error(
      "PASSWORD RESET ERROR:",
      error
    );

    showToast(
      getAuthErrorMessage(
        error
      ),
      5000
    );
  } finally {
    setButtonLoading(
      forgotBtn,
      false
    );
  }
}

/* =========================================================
   ENTER APP
   ========================================================= */

async function enterApplication(
  user
) {
  if (!user) return;

  currentUser = user;

  if (auth) {
    auth.classList.add(
      "hidden"
    );
  }

  if (app) {
    app.classList.remove(
      "hidden"
    );
  }

  await loadProfile(user);
  loadTheme();
  loadLanguage();
  loadVisualSettings();
  resetPanels();

  sidebar?.classList.remove(
    "hide"
  );

  main?.classList.remove(
    "show"
  );

  renderWelcome();

  await loadChats();
}

/* =========================================================
   WELCOME
   ========================================================= */

function renderWelcome() {
  if (!messages) return;

  const title =
    currentLanguage() === "en"
      ? "BipolarChat"
      : "BipolarChat";

  const text =
    currentLanguage() === "en"
      ? "Select a conversation."
      : "یک گفتگو را انتخاب کنید.";

  messages.innerHTML = `
    <div class="welcome">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}

/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {
  if (!supabaseClient) return;

  try {
    const {
      error
    } =
      await supabaseClient.auth
        .signOut();

    if (error) {
      throw error;
    }

    currentUser = null;
    currentSession = null;

    closeAllPanels();

    if (realtimeChannel) {
      supabaseClient.removeChannel(
        realtimeChannel
      );
      realtimeChannel = null;
    }

    activeConversationId =
      null;

    app?.classList.add(
      "hidden"
    );

    auth?.classList.remove(
      "hidden"
    );

    setAuthMode(
      "login"
    );

    if (emailInput) {
      emailInput.value = "";
    }

    if (passwordInput) {
      passwordInput.value = "";
    }

    showToast(
      "از حساب خارج شدید."
    );
  } catch (error) {
    console.error(
      "LOGOUT ERROR:",
      error
    );

    showToast(
      getAuthErrorMessage(
        error
      )
    );
  }
}

/* =========================================================
   AUTH INITIALIZATION
   ========================================================= */

async function initializeAuth() {
  if (!supabaseClient) {
    auth?.classList.remove(
      "hidden"
    );

    app?.classList.add(
      "hidden"
    );

    return;
  }

  try {
    const {
      data,
      error
    } =
      await supabaseClient.auth
        .getSession();

    if (error) {
      throw error;
    }

    currentSession =
      data.session;

    currentUser =
      data.session?.user ||
      null;

    if (currentUser) {
      await enterApplication(
        currentUser
      );
    } else {
      auth?.classList.remove(
        "hidden"
      );

      app?.classList.add(
        "hidden"
      );

      setAuthMode(
        "login"
      );
    }
  } catch (error) {
    console.error(
      "SESSION ERROR:",
      error
    );

    auth?.classList.remove(
      "hidden"
    );

    app?.classList.add(
      "hidden"
    );
  }

  supabaseClient.auth
    .onAuthStateChange(
      async (
        event,
        session
      ) => {
        currentSession =
          session;

        currentUser =
          session?.user ||
          null;

        if (
          event ===
            "SIGNED_IN" &&
          currentUser
        ) {
          await enterApplication(
            currentUser
          );
        }

        if (
          event ===
          "SIGNED_OUT"
        ) {
          currentUser = null;
          currentSession = null;

          app?.classList.add(
            "hidden"
          );

          auth?.classList.remove(
            "hidden"
          );

          setAuthMode(
            "login"
          );
        }
      }
    );
}

/* =========================================================
   PROFILE
   ========================================================= */

function getProfileStorageKey(
  user
) {
  return user
    ? `bipolarchat_profile_${user.id}`
    : "";
}

function getStoredProfile(
  user
) {
  if (!user) return {};

  try {
    const raw =
      localStorage.getItem(
        getProfileStorageKey(
          user
        )
      );

    return raw
      ? JSON.parse(raw)
      : {};
  } catch {
    return {};
  }
}

function saveStoredProfile(
  profile
) {
  if (!currentUser) return;

  try {
    localStorage.setItem(
      getProfileStorageKey(
        currentUser
      ),
      JSON.stringify(profile)
    );
  } catch (error) {
    console.warn(
      "PROFILE STORAGE ERROR:",
      error
    );
  }
}

async function loadProfile(user) {
  if (!user) return;

  const stored = getStoredProfile(user);
  const metadata = user.user_metadata || {};
  let dbProfile = null;

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("id,email,display_name,username,bio,avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (!error) dbProfile = data || null;
    } catch (error) {
      console.warn("PROFILE LOAD WARNING:", error);
    }
  }

  const name =
    dbProfile?.display_name ||
    stored.name ||
    metadata.display_name ||
    "کاربر";

  const username =
    dbProfile?.username ||
    stored.username ||
    metadata.username ||
    "";

  const bio =
    dbProfile?.bio ||
    stored.bio ||
    metadata.bio ||
    "";

  const avatar =
    dbProfile?.avatar_url ||
    stored.avatar ||
    metadata.avatar_url ||
    "";

  saveStoredProfile({
    ...stored,
    name,
    username,
    bio,
    avatar
  });

  if (profileName) profileName.value = name;
  if (profileUsername) profileUsername.value = username.replace(/^@/, "");
  if (profileBio) profileBio.value = bio;
  if (profileEmail) profileEmail.value = dbProfile?.email || user.email || "";

  renderAvatar(avatar, name);
}

/* =========================================================
   AVATAR
   ========================================================= */

function renderAvatar(
  source,
  name
) {
  if (!profileAvatar) return;

  profileAvatar.innerHTML =
    "";

  if (source) {
    const img =
      document.createElement(
        "img"
      );

    img.src = source;
    img.alt = "";
    img.loading = "eager";

    profileAvatar.appendChild(
      img
    );
  } else {
    profileAvatar.textContent =
      getInitial(name);
  }
}

function getInitial(name) {
  const value =
    String(
      name || "U"
    ).trim();

  return value
    ? value
        .charAt(0)
        .toUpperCase()
    : "U";
}

async function saveProfile() {
  if (!currentUser) {
    showToast("ابتدا وارد حساب شوید.");
    return;
  }

  const name = profileName?.value.trim() || "کاربر";
  const username =
    profileUsername?.value.trim().replace(/^@/, "").toLowerCase() || "";
  const bio = profileBio?.value.trim() || "";

  if (username && !/^[a-z0-9_]{3,32}$/.test(username)) {
    showToast("نام کاربری باید ۳ تا ۳۲ کاراکتر و فقط شامل حروف انگلیسی، عدد و _ باشد.");
    return;
  }

  const stored = getStoredProfile(currentUser);
  saveStoredProfile({ ...stored, name, username, bio });

  try {
    if (!supabaseClient) throw new Error("اتصال Supabase برقرار نیست.");

    const { error: authError } = await supabaseClient.auth.updateUser({
      data: { display_name: name, username, bio }
    });

    if (authError) throw authError;

    const { error: profileError } = await supabaseClient
      .from("profiles")
      .upsert({
        id: currentUser.id,
        email: currentUser.email || "",
        display_name: name,
        username: username || null,
        bio,
        avatar_url: stored.avatar || null
      }, { onConflict: "id" });

    if (profileError) throw profileError;

    await loadProfile(currentUser);
    showToast("پروفایل با موفقیت ذخیره شد.");
  } catch (error) {
    console.error("PROFILE UPDATE ERROR:", error);
    showToast(error?.message || "ذخیره پروفایل انجام نشد.");
  }
}

function selectAvatar() {
  avatarFile?.click();
}

function handleAvatarFile(
  event
) {
  const file =
    event.target.files?.[0];

  if (
    !file ||
    !currentUser
  ) {
    return;
  }

  if (
    !file.type.startsWith(
      "image/"
    )
  ) {
    showToast(
      "فایل انتخاب‌شده تصویر نیست."
    );
    return;
  }

  if (
    file.size >
    5 * 1024 * 1024
  ) {
    showToast(
      "حجم تصویر نباید بیشتر از ۵ مگابایت باشد."
    );
    return;
  }

  const reader =
    new FileReader();

  reader.onload = () => {
    const stored =
      getStoredProfile(
        currentUser
      );

    stored.avatar =
      reader.result;

    saveStoredProfile(
      stored
    );

    renderAvatar(
      reader.result,
      profileName?.value ||
        "Unknown"
    );

    showToast(
      "تصویر پروفایل ذخیره شد."
    );
  };

  reader.onerror = () => {
    showToast(
      "خواندن تصویر انجام نشد."
    );
  };

  reader.readAsDataURL(
    file
  );

  event.target.value = "";
}

function removeAvatar() {
  if (!currentUser) return;

  const stored =
    getStoredProfile(
      currentUser
    );

  delete stored.avatar;

  saveStoredProfile(
    stored
  );

  renderAvatar(
    "",
    profileName?.value ||
      "Unknown"
  );

  showToast(
    "تصویر پروفایل حذف شد."
  );
}

/* =========================================================
   PANELS
   ========================================================= */

function openPanel(panel) {
  if (!panel) return;

  panel.classList.remove(
    "hidden"
  );

  document.body.classList.add(
    "panel-open"
  );
}

function closePanel(panel) {
  if (!panel) return;

  panel.classList.add(
    "hidden"
  );

  if (
    !document.querySelector(
      ".overlay:not(.hidden)"
    )
  ) {
    document.body.classList.remove(
      "panel-open"
    );
  }
}

function closeAllPanels() {
  document
    .querySelectorAll(
      ".overlay"
    )
    .forEach(
      panel => {
        panel.classList.add(
          "hidden"
        );
      }
    );

  document.body.classList.remove(
    "panel-open"
  );
}

function resetPanels() {
  closeAllPanels();
}

/* =========================================================
   MENU
   ========================================================= */

function openMenu() {
  openPanel(menuPanel);
}

function openProfile() {
  if (currentUser) {
    loadProfile(
      currentUser
    );
  }

  openPanel(
    profilePanel
  );
}

function openNewChat() {
  openPanel(
    newChatPanel
  );
}

/* =========================================================
   SETTINGS
   ========================================================= */

function openGenericSettings(
  title,
  content
) {
  if (settingsTitle) {
    settingsTitle.textContent =
      title;
  }

  if (settingsContent) {
    settingsContent.innerHTML =
      content;
  }

  openPanel(
    settingsPanel
  );
}

/* =========================================================
   CHAT SETTINGS
   ========================================================= */

function openChatSettings() {
  openGenericSettings(
    t(
      "chatSettings",
      "تنظیمات گفتگو"
    ),
    `
      <div class="setting-card">
        <strong>
          ${t(
            "messageSize",
            "اندازه متن پیام"
          )}
        </strong>

        <p>
          ${t(
            "messageSizeDesc",
            "اندازه متن پیام را تغییر دهید."
          )}
        </p>

        <input
          id="messageFontSize"
          type="range"
          min="12"
          max="30"
          value="${escapeHtml(
            getSetting(
              "messageFontSize",
              "16"
            )
          )}"
          style="width:100%;margin-top:12px"
        >

        <strong
          id="messageFontSizeValue"
          style="display:block;margin-top:8px"
        >
          ${escapeHtml(
            getSetting(
              "messageFontSize",
              "16"
            )
          )}px
        </strong>
      </div>

      <div class="setting-card">
        <strong>
          ${t(
            "theme",
            "پوسته"
          )}
        </strong>

        <p>
          ${t(
            "themeDesc",
            "پوسته برنامه را انتخاب کنید."
          )}
        </p>

        <button
          type="button"
          class="small-action"
          data-theme="light"
        >
          ${t(
            "light",
            "روشن"
          )}
        </button>

        <button
          type="button"
          class="small-action"
          data-theme="dark"
        >
          ${t(
            "dark",
            "تاریک"
          )}
        </button>
      </div>

      <div class="setting-card">
        <strong>
          ${t(
            "messageRadius",
            "گوشه پیام"
          )}
        </strong>

        <input
          id="messageRadius"
          type="range"
          min="1"
          max="24"
          value="${escapeHtml(
            getSetting(
              "messageRadius",
              "16"
            )
          )}"
          style="width:100%;margin-top:12px"
        >

        <strong
          id="messageRadiusValue"
          style="display:block;margin-top:8px"
        >
          ${escapeHtml(
            getSetting(
              "messageRadius",
              "16"
            )
          )}px
        </strong>
      </div>

      <div class="setting-card">
        <strong>
          ${t(
            "chatBackground",
            "پس‌زمینه گفتگو"
          )}
        </strong>

        <input
          id="chatBackgroundColor"
          type="color"
          value="${escapeHtml(
            getSetting(
              "chatBackgroundColor",
              "#f7f9fb"
            )
          )}"
          style="margin-top:10px;width:60px;height:40px"
        >
      </div>

      <div class="setting-card">
        <strong>
          ${t(
            "quickReaction",
            "ری‌اکشن سریع"
          )}
        </strong>

        <p>
          ${t(
            "quickReactionDesc",
            "با دو ضربه روی پیام ری‌اکشن ثبت می‌شود."
          )}
        </p>
      </div>
    `
  );

  bindChatSettings();
}

function bindChatSettings() {
  const font =
    $("messageFontSize");

  const fontValue =
    $("messageFontSizeValue");

  font?.addEventListener(
    "input",
    () => {
      const value =
        Number(font.value);

      if (fontValue) {
        fontValue.textContent =
          `${value}px`;
      }

      saveSetting(
        "messageFontSize",
        value
      );

      document.documentElement.style.setProperty(
        "--message-font-size",
        `${value}px`
      );
    }
  );

  const radius =
    $("messageRadius");

  const radiusValue =
    $("messageRadiusValue");

  radius?.addEventListener(
    "input",
    () => {
      const value =
        Number(radius.value);

      if (radiusValue) {
        radiusValue.textContent =
          `${value}px`;
      }

      saveSetting(
        "messageRadius",
        value
      );

      document.documentElement.style.setProperty(
        "--message-radius",
        `${value}px`
      );
    }
  );

  const background =
    $("chatBackgroundColor");

  background?.addEventListener(
    "input",
    () => {
      saveSetting(
        "chatBackgroundColor",
        background.value
      );

      if (messages) {
        messages.style.background =
          background.value;
      }
    }
  );

  document
    .querySelectorAll(
      "[data-theme]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            setTheme(
              button.dataset.theme
            );
          }
        );
      }
    );
}

/* =========================================================
   PRIVACY / SECURITY
   ========================================================= */

function openPrivacySettings() {
  openGenericSettings(
    t(
      "privacy",
      "حریم خصوصی و امنیت"
    ),
    `
      <div class="setting-card">
        <strong>
          ${t(
            "twoFactor",
            "تأیید دو مرحله‌ای"
          )}
        </strong>

        <p>
          ${t(
            "twoFactorDesc",
            "فعال‌سازی تأیید دو مرحله‌ای حساب."
          )}
        </p>

        <button
          type="button"
          class="small-action"
          id="twoFactorBtn"
        >
          ${t(
            "manage",
            "مدیریت"
          )}
        </button>
      </div>

      <div class="setting-card">
        <strong>
          ${t(
            "loginEmail",
            "ایمیل ورود"
          )}
        </strong>

        <p>
          ${escapeHtml(
            currentUser?.email ||
              "-"
          )}
        </p>

        <button
          type="button"
          class="small-action"
          id="changeEmailBtn"
        >
          ${t(
            "change",
            "تغییر"
          )}
        </button>
      </div>

      ${privacyOption(
        "lastSeen",
        "آخرین بازدید"
      )}

      ${privacyOption(
        "profilePhoto",
        "عکس پروفایل"
      )}

      ${privacyOption(
        "bio",
        "بیوگرافی"
      )}

      ${privacyOption(
        "calls",
        "تماس‌ها"
      )}

      ${privacyOption(
        "forwards",
        "پیام فوروارد"
      )}

      ${privacyOption(
        "invites",
        "دعوت‌ها"
      )}

      <div class="setting-card">
        <strong>
          ${t(
            "deleteAccount",
            "حذف خودکار اکانت"
          )}
        </strong>

        <select
          id="deleteAccountPeriod"
          style="width:100%;margin-top:10px"
        >
          <option value="3">۳ ماه</option>
          <option value="6">۶ ماه</option>
          <option value="12">۱۲ ماه</option>
          <option value="18">۱۸ ماه</option>
        </select>
      </div>

      <div class="setting-card">
        <strong>
          ${t(
            "blockedUsers",
            "کاربران مسدود"
          )}
        </strong>

        <p>
          ${t(
            "noBlocked",
            "هنوز کاربری مسدود نشده است."
          )}
        </p>
      </div>

      <div class="setting-card">
        <strong>
          ${t(
            "activeDevices",
            "دستگاه‌های فعال"
          )}
        </strong>

        <p>
          ${t(
            "currentDevice",
            "این دستگاه"
          )}
        </p>
      </div>
    `
  );

  $("twoFactorBtn")
    ?.addEventListener(
      "click",
      openTwoFactor
    );

  $("changeEmailBtn")
    ?.addEventListener(
      "click",
      changeEmail
    );

  bindPrivacyOptions();
}

function privacyOption(
  key,
  title
) {
  const value =
    getPrivacy(
      key,
      "everyone"
    );

  return `
    <div class="setting-card">
      <strong>
        ${t(
          key,
          title
        )}
      </strong>

      <div
        style="
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-top:10px
        "
      >
        ${privacyButton(
          key,
          "everyone",
          "همه",
          value
        )}

        ${privacyButton(
          key,
          "contacts",
          "مخاطبین",
          value
        )}

        ${privacyButton(
          key,
          "nobody",
          "هیچکس",
          value
        )}
      </div>
    </div>
  `;
}

function privacyButton(
  key,
  value,
  label,
  current
) {
  return `
    <button
      type="button"
      class="small-action"
      data-privacy-key="${escapeHtml(
        key
      )}"
      data-privacy-value="${escapeHtml(
        value
      )}"
    >
      <span
        style="
          display:inline-block;
          font-size:20px;
          font-weight:900;
          margin-inline-end:5px
        "
      >
        ${
          current === value
            ? "●"
            : "○"
        }
      </span>

      ${escapeHtml(label)}
    </button>
  `;
}

function getPrivacy(
  key,
  fallback
) {
  return (
    localStorage.getItem(
      userKey(
        `privacy_${key}`
      )
    ) ||
    fallback
  );
}

function setPrivacy(
  key,
  value
) {
  localStorage.setItem(
    userKey(
      `privacy_${key}`
    ),
    value
  );
}

function bindPrivacyOptions() {
  document
    .querySelectorAll(
      "[data-privacy-key]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            setPrivacy(
              button.dataset
                .privacyKey,
              button.dataset
                .privacyValue
            );

            openPrivacySettings();

            showToast(
              "تنظیم حریم خصوصی ذخیره شد."
            );
          }
        );
      }
    );
}

/* =========================================================
   TWO FACTOR
   ========================================================= */

async function openTwoFactor() {
  if (!supabaseClient || !currentUser) {
    showToast("ابتدا وارد حساب شوید.");
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.mfa.listFactors();
    if (error) throw error;

    const verified = (data?.totp || []).find(
      factor => factor.status === "verified"
    );

    if (verified) {
      openGenericSettings(
        t("twoFactor", "تأیید دو مرحله‌ای"),
        `
          <div class="setting-card">
            <strong>تأیید دو مرحله‌ای فعال است</strong>
            <p style="margin-top:8px">حساب شما با برنامه‌های TOTP محافظت می‌شود.</p>
            <button type="button" class="small-action" id="disableTwoFactorBtn" style="margin-top:10px">
              غیرفعال کردن
            </button>
          </div>
        `
      );

      $("disableTwoFactorBtn")?.addEventListener("click", async () => {
        try {
          const { error: unenrollError } =
            await supabaseClient.auth.mfa.unenroll({ factorId: verified.id });

          if (unenrollError) throw unenrollError;

          showToast("تأیید دو مرحله‌ای غیرفعال شد.");
          openTwoFactor();
        } catch (error) {
          console.error("MFA UNENROLL ERROR:", error);
          showToast(error?.message || "غیرفعال‌سازی انجام نشد.");
        }
      });

      return;
    }

    pendingMfaFactorId = null;

    openGenericSettings(
      t("twoFactor", "تأیید دو مرحله‌ای"),
      `
        <div class="setting-card">
          <strong>فعال‌سازی تأیید دو مرحله‌ای</strong>
          <p style="margin-top:8px">
            برای فعال‌سازی، QR را با Google Authenticator، Microsoft Authenticator یا یک برنامه TOTP اسکن کنید.
          </p>

          <button type="button" class="small-action" id="startTwoFactorBtn" style="margin-top:10px">
            ایجاد کد امنیتی
          </button>

          <div id="mfaSetupBox" style="margin-top:14px"></div>
        </div>
      `
    );

    $("startTwoFactorBtn")?.addEventListener("click", async () => {
      const button = $("startTwoFactorBtn");
      setButtonLoading(button, true, "در حال ایجاد...");

      try {
        const { data: enrollData, error: enrollError } =
          await supabaseClient.auth.mfa.enroll({
            factorType: "totp",
            friendlyName: "BipolarChat"
          });

        if (enrollError) throw enrollError;

        pendingMfaFactorId = enrollData?.id || null;

        if (!pendingMfaFactorId || !enrollData?.totp?.qr_code) {
          throw new Error("اطلاعات MFA از Supabase دریافت نشد.");
        }

        const setup = $("mfaSetupBox");
        if (setup) {
          setup.innerHTML = `
            <div style="text-align:center">
              <img
                src="${escapeHtml(enrollData.totp.qr_code)}"
                alt="MFA QR"
                style="width:220px;height:220px;max-width:100%;border-radius:14px;background:#fff;padding:8px"
              >
              <p style="margin-top:10px;word-break:break-all;font-size:12px;opacity:.75">
                کلید دستی: ${escapeHtml(enrollData.totp.secret || "")}
              </p>
              <input
                id="twoFactorCode"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                placeholder="کد ۶ رقمی برنامه Authenticator"
                style="width:100%;margin-top:10px"
              >
              <button
                type="button"
                class="primary-btn"
                id="verifyTwoFactorBtn"
                style="margin-top:10px"
              >
                تأیید و فعال‌سازی
              </button>
            </div>
          `;

          $("verifyTwoFactorBtn")?.addEventListener("click", verifyTwoFactor);
        }
      } catch (error) {
        console.error("MFA ENROLL ERROR:", error);
        showToast(error?.message || "فعال‌سازی MFA انجام نشد.");
      } finally {
        setButtonLoading(button, false);
      }
    });
  } catch (error) {
    console.error("MFA LIST ERROR:", error);
    showToast(error?.message || "وضعیت تأیید دو مرحله‌ای دریافت نشد.");
  }
}

async function saveTwoFactor() {
  return verifyTwoFactor();
}

async function verifyTwoFactor() {
  if (!supabaseClient || !pendingMfaFactorId) {
    showToast("ابتدا کد امنیتی را ایجاد کنید.");
    return;
  }

  const code = $("twoFactorCode")?.value.trim();

  if (!/^\d{6}$/.test(code || "")) {
    showToast("کد باید ۶ رقمی باشد.");
    return;
  }

  const button = $("verifyTwoFactorBtn");
  setButtonLoading(button, true, "در حال تأیید...");

  try {
    const { data: challenge, error: challengeError } =
      await supabaseClient.auth.mfa.challenge({
        factorId: pendingMfaFactorId
      });

    if (challengeError) throw challengeError;

    const { error: verifyError } =
      await supabaseClient.auth.mfa.verify({
        factorId: pendingMfaFactorId,
        challengeId: challenge.id,
        code
      });

    if (verifyError) throw verifyError;

    pendingMfaFactorId = null;
    showToast("تأیید دو مرحله‌ای با موفقیت فعال شد.");
    openTwoFactor();
  } catch (error) {
    console.error("MFA VERIFY ERROR:", error);
    showToast(error?.message || "کد امنیتی صحیح نیست.");
  } finally {
    setButtonLoading(button, false);
  }
}

/* =========================================================
   EMAIL
   ========================================================= */

async function changeEmail() {
  if (
    !currentUser ||
    !supabaseClient
  ) {
    return;
  }

  const email =
    prompt(
      "ایمیل جدید را وارد کنید:"
    );

  if (!email) return;

  try {
    const {
      error
    } =
      await supabaseClient.auth
        .updateUser({
          email: email.trim()
        });

    if (error) {
      throw error;
    }

    showToast(
      "لینک تأیید به ایمیل جدید ارسال شد.",
      5000
    );
  } catch (error) {
    console.error(
      "EMAIL CHANGE ERROR:",
      error
    );

    showToast(
      getAuthErrorMessage(
        error
      )
    );
  }
}

/* =========================================================
   STORAGE
   ========================================================= */

function openStorageSettings() {
  openGenericSettings(
    t(
      "storage",
      "ذخیره‌سازی داده"
    ),
    `
      <div class="setting-card">
        <strong>
          میزان استفاده از حافظه
        </strong>

        <p id="storageUsage">
          در حال محاسبه...
        </p>
      </div>

      <div class="setting-card">
        <strong>
          فایل‌های ذخیره‌شده
        </strong>

        <div id="storedFiles">
          در حال بررسی...
        </div>
      </div>

      <div class="setting-card">
        <strong>
          پاک‌سازی
        </strong>

        <button
          type="button"
          class="small-action"
          id="clearAppCacheBtn"
        >
          پاک کردن داده‌های محلی
        </button>
      </div>
    `
  );

  calculateStorage();
  renderStoredFiles();

  $("clearAppCacheBtn")
    ?.addEventListener(
      "click",
      clearLocalData
    );
}

function calculateStorage() {
  const output =
    $("storageUsage");

  if (!output) return;

  let total = 0;

  try {
    for (
      let i = 0;
      i < localStorage.length;
      i++
    ) {
      const key =
        localStorage.key(i);

      const value =
        localStorage.getItem(
          key
        ) || "";

      total +=
        key.length +
        value.length;
    }
  } catch {
    total = 0;
  }

  const kb =
    (total * 2) / 1024;

  output.textContent =
    `${kb.toFixed(2)} KB`;
}

function renderStoredFiles() {
  const container =
    $("storedFiles");

  if (!container) return;

  const files =
    getLocalFiles();

  if (!files.length) {
    container.innerHTML = `
      <p>
        فایلی ذخیره نشده است.
      </p>
    `;

    return;
  }

  container.innerHTML =
    files
      .map(
        file => `
          <div
            style="
              display:flex;
              align-items:center;
              justify-content:space-between;
              gap:10px;
              margin-bottom:8px;
            "
          >
            <span>
              ${escapeHtml(
                file.name
              )}
            </span>

            <button
              type="button"
              class="small-action"
              data-delete-file="${escapeHtml(
                file.id
              )}"
            >
              حذف
            </button>
          </div>
        `
      )
      .join("");

  container
    .querySelectorAll(
      "[data-delete-file]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            deleteLocalFile(
              button.dataset
                .deleteFile
            );

            renderStoredFiles();
            calculateStorage();
          }
        );
      }
    );
}

function getLocalFiles() {
  try {
    return JSON.parse(
      localStorage.getItem(
        userKey("files")
      ) ||
        "[]"
    );
  } catch {
    return [];
  }
}

function deleteLocalFile(
  id
) {
  const files =
    getLocalFiles().filter(
      file =>
        file.id !== id
    );

  localStorage.setItem(
    userKey("files"),
    JSON.stringify(files)
  );

  showToast(
    "فایل حذف شد."
  );
}

function clearLocalData() {
  if (
    !confirm(
      "داده‌های محلی این حساب پاک شود؟"
    )
  ) {
    return;
  }

  const prefix =
    currentUser
      ? `bipolarchat_${currentUser.id}_`
      : "";

  const remove = [];

  for (
    let i = 0;
    i < localStorage.length;
    i++
  ) {
    const key =
      localStorage.key(i);

    if (
      prefix &&
      key.startsWith(prefix)
    ) {
      remove.push(key);
    }
  }

  remove.forEach(
    key =>
      localStorage.removeItem(
        key
      )
  );

  showToast(
    "داده‌های محلی پاک شد."
  );

  calculateStorage();
  renderStoredFiles();
}

/* =========================================================
   FOLDERS
   ========================================================= */

function openFoldersSettings() {
  const folders =
    getFolders();

  openGenericSettings(
    t(
      "folders",
      "پوشه‌ها"
    ),
    `
      <div class="setting-card">
        <strong>
          پوشه‌های گفتگو
        </strong>

        <p>
          گفتگوها را دسته‌بندی کنید.
        </p>

        <input
          id="folderName"
          type="text"
          placeholder="نام پوشه"
          style="width:100%;margin-top:10px"
        >

        <button
          type="button"
          class="small-action"
          id="createFolderBtn"
          style="margin-top:10px"
        >
          ایجاد پوشه
        </button>
      </div>

      <div
        id="folderList"
        class="setting-card"
      >
        ${renderFolderList(
          folders
        )}
      </div>
    `
  );

  $("createFolderBtn")
    ?.addEventListener(
      "click",
      createFolder
    );

  bindFolderActions();
}

function getFolders() {
  try {
    return JSON.parse(
      localStorage.getItem(
        userKey("folders")
      ) ||
        "[]"
    );
  } catch {
    return [];
  }
}

function saveFolders(
  folders
) {
  localStorage.setItem(
    userKey("folders"),
    JSON.stringify(folders)
  );
}

function createFolder() {
  const input =
    $("folderName");

  const name =
    input?.value.trim();

  if (!name) {
    showToast(
      "نام پوشه را وارد کنید."
    );
    return;
  }

  const folders =
    getFolders();

  folders.push({
    id: crypto.randomUUID(),
    name,
    chats: []
  });

  saveFolders(
    folders
  );

  openFoldersSettings();

  showToast(
    "پوشه ایجاد شد."
  );
}

function folderIconSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
}

function renderFolderList(folders) {
  if (!folders.length) {
    return `<p>هنوز پوشه‌ای ساخته نشده است.</p>`;
  }

  return folders.map(folder => `
    <div
      style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;"
    >
      <strong style="display:flex;align-items:center;gap:8px;">
        <span class="folder-icon">${folderIconSvg()}</span>
        ${escapeHtml(folder.name)}
      </strong>

      <button
        type="button"
        class="small-action"
        data-delete-folder="${escapeHtml(folder.id)}"
      >
        حذف
      </button>
    </div>
  `).join("");
}

function bindFolderActions() {
  document
    .querySelectorAll(
      "[data-delete-folder]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const folders =
              getFolders().filter(
                folder =>
                  folder.id !==
                  button.dataset
                    .deleteFolder
              );

            saveFolders(
              folders
            );

            openFoldersSettings();

            showToast(
              "پوشه حذف شد."
            );
          }
        );
      }
    );
}

/* =========================================================
   ENERGY
   ========================================================= */

function openPowerSettings() {
  const enabled =
    getSetting(
      "energySaving",
      "false"
    ) === "true";

  openGenericSettings(
    t(
      "energy",
      "صرفه‌جویی انرژی"
    ),
    `
      <div class="setting-card">
        <strong>
          صرفه‌جویی انرژی
        </strong>

        <p>
          انیمیشن‌ها و فعالیت‌های غیرضروری
          کاهش داده می‌شوند.
        </p>

        <button
          type="button"
          class="small-action"
          id="energyToggle"
        >
          ${
            enabled
              ? "● فعال"
              : "○ غیرفعال"
          }
        </button>
      </div>
    `
  );

  $("energyToggle")
    ?.addEventListener(
      "click",
      toggleEnergySaving
    );
}

function toggleEnergySaving() {
  const current =
    getSetting(
      "energySaving",
      "false"
    ) === "true";

  const next =
    !current;

  saveSetting(
    "energySaving",
    next
  );

  document.documentElement
    .classList.toggle(
      "energy-saving",
      next
    );

  openPowerSettings();

  showToast(
    next
      ? "صرفه‌جویی انرژی فعال شد."
      : "صرفه‌جویی انرژی غیرفعال شد."
  );
}

/* =========================================================
   LANGUAGE
   ========================================================= */

const translations = {
  fa: {
    chatSettings:
      "تنظیمات گفتگو",
    messageSize:
      "اندازه متن پیام",
    messageSizeDesc:
      "اندازه متن پیام را تغییر دهید.",
    theme:
      "پوسته",
    themeDesc:
      "پوسته برنامه را انتخاب کنید.",
    light:
      "روشن",
    dark:
      "تاریک",
    messageRadius:
      "گوشه پیام",
    chatBackground:
      "پس‌زمینه گفتگو",
    quickReaction:
      "ری‌اکشن سریع",
    quickReactionDesc:
      "با دو ضربه روی پیام ری‌اکشن ثبت می‌شود.",
    privacy:
      "حریم خصوصی و امنیت",
    twoFactor:
      "تأیید دو مرحله‌ای",
    twoFactorDesc:
      "فعال‌سازی تأیید دو مرحله‌ای حساب.",
    loginEmail:
      "ایمیل ورود",
    change:
      "تغییر",
    manage:
      "مدیریت",
    lastSeen:
      "آخرین بازدید",
    profilePhoto:
      "عکس پروفایل",
    bio:
      "بیوگرافی",
    calls:
      "تماس‌ها",
    forwards:
      "پیام فوروارد",
    invites:
      "دعوت‌ها",
    deleteAccount:
      "حذف خودکار اکانت",
    blockedUsers:
      "کاربران مسدود",
    activeDevices:
      "دستگاه‌های فعال",
    currentDevice:
      "این دستگاه",
    noBlocked:
      "هنوز کاربری مسدود نشده است.",
    storage:
      "ذخیره‌سازی داده",
    folders:
      "پوشه‌ها",
    energy:
      "صرفه‌جویی انرژی"
  },

  en: {
    chatSettings:
      "Chat Settings",
    messageSize:
      "Message Text Size",
    messageSizeDesc:
      "Change the message text size.",
    theme:
      "Theme",
    themeDesc:
      "Choose the application theme.",
    light:
      "Light",
    dark:
      "Dark",
    messageRadius:
      "Message Corner",
    chatBackground:
      "Chat Background",
    quickReaction:
      "Quick Reaction",
    quickReactionDesc:
      "Double tap a message to react.",
    privacy:
      "Privacy and Security",
    twoFactor:
      "Two-Step Verification",
    twoFactorDesc:
      "Manage two-step verification.",
    loginEmail:
      "Login Email",
    change:
      "Change",
    manage:
      "Manage",
    lastSeen:
      "Last Seen",
    profilePhoto:
      "Profile Photo",
    bio:
      "Bio",
    calls:
      "Calls",
    forwards:
      "Forwarded Messages",
    invites:
      "Invitations",
    deleteAccount:
      "Delete Account Automatically",
    blockedUsers:
      "Blocked Users",
    activeDevices:
      "Active Sessions",
    currentDevice:
      "This Device",
    noBlocked:
      "No blocked users.",
    storage:
      "Data and Storage",
    folders:
      "Chat Folders",
    energy:
      "Power Saving"
  }
};

function currentLanguage() {
  return (
    localStorage.getItem(
      globalKey("language")
    ) || "fa"
  );
}

function t(
  key,
  fallback
) {
  const lang =
    currentLanguage();

  return (
    translations[lang]?.[key] ||
    fallback ||
    key
  );
}

function openLanguage() {
  updateLanguageChecks();

  openPanel(
    languagePanel
  );
}

function updateLanguageChecks() {
  const lang =
    currentLanguage();

  if ($("faCheck")) {
    $("faCheck").textContent =
      lang === "fa"
        ? "✓"
        : "";
  }

  if ($("enCheck")) {
    $("enCheck").textContent =
      lang === "en"
        ? "✓"
        : "";
  }

  if ($("currentLanguage")) {
    $("currentLanguage")
      .textContent =
      lang === "fa"
        ? "فارسی"
        : "English";
  }
}

function changeLanguage(
  lang
) {
  if (
    lang !== "fa" &&
    lang !== "en"
  ) {
    return;
  }

  localStorage.setItem(
    globalKey("language"),
    lang
  );

  applyLanguage(
    lang
  );

  updateLanguageChecks();

  closePanel(
    languagePanel
  );

  showToast(
    lang === "fa"
      ? "زبان فارسی انتخاب شد."
      : "English selected."
  );
}

function applyLanguage(
  lang
) {
  document.documentElement.lang =
    lang;

  document.documentElement.dir =
    lang === "fa"
      ? "rtl"
      : "ltr";

  translateStaticUI();
}

function translateStaticUI() {
  const lang =
    currentLanguage();

  const dict =
    translations[lang];

  if (!dict) return;

  const map = {
    chatSettingsBtn:
      "chatSettings",
    privacyBtn:
      "privacy",
    storageBtn:
      "storage",
    foldersBtn:
      "folders",
    powerBtn:
      "energy"
  };

  Object.entries(
    map
  ).forEach(
    ([
      id,
      key
    ]) => {
      const el = $(id);

      if (
        el &&
        dict[key]
      ) {
        const target =
          el.querySelector(
            ".label, span, strong"
          );

        if (target) {
          target.textContent =
            dict[key];
        } else {
          el.textContent =
            dict[key];
        }
      }
    }
  );
}

function loadLanguage() {
  applyLanguage(
    currentLanguage()
  );
}

/* =========================================================
   THEME
   ========================================================= */

function setTheme(
  theme
) {
  if (
    theme !== "light" &&
    theme !== "dark"
  ) {
    return;
  }

  localStorage.setItem(
    globalKey("theme"),
    theme
  );

  document.documentElement
    .setAttribute(
      "data-theme",
      theme
    );

  showToast(
    theme === "dark"
      ? "پوسته تاریک فعال شد."
      : "پوسته روشن فعال شد."
  );
}

function setThemeSilently(
  theme
) {
  document.documentElement
    .setAttribute(
      "data-theme",
      theme
    );
}

function loadTheme() {
  const theme =
    localStorage.getItem(
      globalKey("theme")
    ) || "light";

  setThemeSilently(
    theme
  );
}

/* =========================================================
   GENERIC SETTINGS
   ========================================================= */

function getSetting(
  key,
  fallback
) {
  const value =
    localStorage.getItem(
      userKey(key)
    );

  return value !== null
    ? value
    : fallback;
}

function saveSetting(
  key,
  value
) {
  localStorage.setItem(
    userKey(key),
    String(value)
  );
}

function loadVisualSettings() {
  const font =
    getSetting(
      "messageFontSize",
      "16"
    );

  const radius =
    getSetting(
      "messageRadius",
      "16"
    );

  document.documentElement
    .style.setProperty(
      "--message-font-size",
      `${font}px`
    );

  document.documentElement
    .style.setProperty(
      "--message-radius",
      `${radius}px`
    );

  const background =
    getSetting(
      "chatBackgroundColor",
      ""
    );

  if (
    background &&
    messages
  ) {
    messages.style.background =
      background;
  }

  const energy =
    getSetting(
      "energySaving",
      "false"
    ) === "true";

  document.documentElement
    .classList.toggle(
      "energy-saving",
      energy
    );
}

/* =========================================================
   ABOUT
   ========================================================= */

function openAbout() {
  openPanel(
    aboutPanel
  );
}

/* =========================================================
   NEW CHAT
   ========================================================= */

function openContact() {
  openPanel(
    contactPanel
  );
}

function openGroup() {
  openPanel(
    groupPanel
  );
}

function openChannel() {
  openPanel(
    channelPanel
  );
}

/* =========================================================
   PROFILE HELPERS
   ========================================================= */

async function getProfileBySearch(
  search
) {
  if (
    !supabaseClient ||
    !currentUser
  ) {
    return null;
  }

  const value =
    String(
      search || ""
    )
      .trim()
      .replace(
        /^@/,
        ""
      );

  if (!value) {
    return null;
  }

  const normalized =
    value.toLowerCase();

  const result =
    await supabaseClient
      .from("profiles")
      .select(
        "id,email,display_name,username,bio,avatar_url"
      )
      .or(
        `email.ilike.${normalized},username.ilike.${normalized}`
      )
      .neq(
        "id",
        currentUser.id
      )
      .limit(1)
      .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data ||
    null;
}

/* =========================================================
   LOAD CONVERSATIONS
   ========================================================= */

async function loadChats() {
  if (
    !chatList ||
    !supabaseClient ||
    !currentUser
  ) {
    return;
  }

  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "conversation_members"
        )
        .select(`
          conversation_id,
          conversations (
            id,
            title,
            is_group,
            created_at,
            conversation_members (
              user_id,
              profiles (
                id,
                display_name,
                username,
                avatar_url
              )
            )
          )
        `)
        .eq(
          "user_id",
          currentUser.id
        );

    if (error) {
      throw error;
    }

    conversationCache =
      (data || [])
        .map(
          row =>
            row.conversations
        )
        .filter(Boolean);

    renderChatList(
      conversationCache
    );
  } catch (error) {
    console.error(
      "LOAD CHATS ERROR:",
      error
    );

    showToast(
      "گفتگوها بارگذاری نشدند."
    );
  }
}

/* =========================================================
   CHAT LIST UI
   ========================================================= */

function getConversationPartner(
  conversation
) {
  const members =
    conversation
      ?.conversation_members ||
    [];

  const member =
    members.find(
      item =>
        item.user_id !==
        currentUser?.id
    );

  return (
    member?.profiles ||
    null
  );
}

function getConversationTitle(
  conversation
) {
  if (conversation?.is_group) {
    return (
      conversation.title ||
      (conversation.kind === "channel" ? "کانال" : "گروه")
    );
  }

  const partner =
    getConversationPartner(
      conversation
    );

  return (
    partner?.display_name ||
    partner?.username ||
    partner?.email ||
    "کاربر"
  );
}

function renderChatList(
  conversations
) {
  if (!chatList) return;

  if (!conversations.length) {
    chatList.innerHTML = `
      <div class="empty-list">
        ${
          currentLanguage() ===
          "en"
            ? "No conversations yet."
            : "هنوز گفتگویی وجود ندارد."
        }
      </div>
    `;

    return;
  }

  chatList.innerHTML =
    conversations
      .map(
        conversation => {
          const partner =
            getConversationPartner(
              conversation
            );

          const title =
            getConversationTitle(
              conversation
            );

          const avatar =
            partner?.avatar_url ||
            "";

          return `
            <button
              type="button"
              class="chat"
              data-chat-id="${escapeHtml(
                conversation.id
              )}"
            >
              <div
                class="chat-avatar"
                style="
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  overflow:hidden;
                "
              >
                ${
                  avatar
                    ? `
                      <img
                        src="${escapeHtml(
                          avatar
                        )}"
                        alt=""
                        style="
                          width:100%;
                          height:100%;
                          object-fit:cover;
                        "
                      >
                    `
                    : escapeHtml(
                        getInitial(
                          title
                        )
                      )
                }
              </div>

              <div
                style="
                  min-width:0;
                  flex:1;
                "
              >
                <strong>
                  ${escapeHtml(
                    title
                  )}
                </strong>

                <small
                  class="chat-last-message"
                >
                  ${
                    currentLanguage() ===
                    "en"
                      ? "Open conversation"
                      : "باز کردن گفتگو"
                  }
                </small>
              </div>
            </button>
          `;
        }
      )
      .join("");

  chatList
    .querySelectorAll(
      "[data-chat-id]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            openConversation(
              button.dataset
                .chatId
            );
          }
        );
      }
    );
}

/* =========================================================
   OPEN CONVERSATION
   ========================================================= */

async function openConversation(
  conversationId
) {
  if (
    !conversationId ||
    !supabaseClient ||
    !currentUser
  ) {
    return;
  }

  const conversation =
    conversationCache.find(
      item =>
        item.id ===
        conversationId
    );

  activeConversationId =
    conversationId;

  showChatOnMobile();

  renderConversationHeader(
    conversation
  );

  await loadMessages(
    conversationId
  );

  subscribeToMessages(
    conversationId
  );
}

/* =========================================================
   CHAT HEADER
   ========================================================= */

function renderConversationHeader(conversation) {
  if (!conversation) return;

  const title = getConversationTitle(conversation);
  const partner = getConversationPartner(conversation);
  const avatar = conversation.is_group
    ? ""
    : (partner?.avatar_url || "");

  const nameEl = $("chatName");
  const statusEl = $("chatStatus");
  const avatarEl = $("chatAvatar");

  if (nameEl) nameEl.textContent = title;
  if (statusEl) {
    statusEl.textContent = conversation.is_group
      ? `${conversation.kind === "channel" ? "کانال" : "گروه"} • ${conversation.conversation_members?.length || 1} عضو`
      : (partner?.username ? `@${partner.username}` : "گفتگوی خصوصی");
  }

  if (avatarEl) {
    avatarEl.innerHTML = avatar
      ? `<img src="${escapeHtml(avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;">`
      : escapeHtml(getInitial(title));
  }

  const headerProfile = $("headerProfileBtn");
  if (headerProfile) headerProfile.title = title;
}

/* =========================================================
   LOAD MESSAGES
   ========================================================= */

async function loadMessages(
  conversationId
) {
  if (
    !messages ||
    !supabaseClient
  ) {
    return;
  }

  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from("messages")
        .select(`
          id,
          conversation_id,
          sender_id,
          body,
          created_at,
          profiles (
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .eq(
          "conversation_id",
          conversationId
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        );

    if (error) {
      throw error;
    }

    renderMessages(
      data || []
    );
  } catch (error) {
    console.error(
      "LOAD MESSAGES ERROR:",
      error
    );

    showToast(
      "پیام‌ها بارگذاری نشدند."
    );
  }
}

/* =========================================================
   RENDER MESSAGES
   ========================================================= */

function renderMessages(
  rows
) {
  if (!messages) return;

  if (!rows.length) {
    messages.innerHTML = `
      <div class="welcome">
        <h2>
          ${
            currentLanguage() ===
            "en"
              ? "No messages yet"
              : "هنوز پیامی وجود ندارد"
          }
        </h2>

        <p>
          ${
            currentLanguage() ===
            "en"
              ? "Send the first message."
              : "اولین پیام را ارسال کنید."
          }
        </p>
      </div>
    `;

    return;
  }

  messages.innerHTML =
    rows
      .map(
        message =>
          renderMessage(
            message
          )
      )
      .join("");

  scrollMessagesToBottom();
}

function renderMessage(
  message
) {
  const mine =
    message.sender_id ===
    currentUser?.id;

  const sender =
    message.profiles ||
    {};

  const time =
    new Date(
      message.created_at
    ).toLocaleTimeString(
      currentLanguage() ===
        "en"
        ? "en-US"
        : "fa-IR",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );

  return `
    <div
      class="message-row ${
        mine
          ? "mine"
          : "theirs"
      }"
      data-message-id="${escapeHtml(
        message.id
      )}"
    >
      <div class="message-bubble">
        ${
          !mine
            ? `
              <small
                style="
                  display:block;
                  margin-bottom:4px;
                  opacity:.65;
                "
              >
                ${escapeHtml(
                  sender.display_name ||
                  sender.username ||
                  "کاربر"
                )}
              </small>
            `
            : ""
        }

        <div class="message-body">
          ${escapeHtml(
            message.body
          )}
        </div>

        <small
          style="
            display:block;
            margin-top:4px;
            opacity:.55;
            font-size:11px;
          "
        >
          ${escapeHtml(
            time
          )}
        </small>
      </div>
    </div>
  `;
}

/* =========================================================
   REALTIME
   ========================================================= */

function subscribeToMessages(
  conversationId
) {
  if (
    !supabaseClient
  ) {
    return;
  }

  if (
    realtimeChannel
  ) {
    supabaseClient.removeChannel(
      realtimeChannel
    );

    realtimeChannel =
      null;
  }

  realtimeChannel =
    supabaseClient
      .channel(
        `messages-${conversationId}`
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter:
            `conversation_id=eq.${conversationId}`
        },
        async payload => {
          if (
            payload.new
              .conversation_id !==
            activeConversationId
          ) {
            return;
          }

          const {
            data,
            error
          } =
            await supabaseClient
              .from("messages")
              .select(`
                id,
                conversation_id,
                sender_id,
                body,
                created_at,
                profiles (
                  id,
                  display_name,
                  username,
                  avatar_url
                )
              `)
              .eq(
                "id",
                payload.new.id
              )
              .single();

          if (
            error ||
            !data
          ) {
            return;
          }

          appendRealtimeMessage(
            data
          );
        }
      )
      .subscribe(
        status => {
          if (
            status ===
            "CHANNEL_ERROR"
          ) {
            console.error(
              "Realtime channel error"
            );
          }
        }
      );
}

function appendRealtimeMessage(
  message
) {
  if (!messages) return;

  if (
    messages.querySelector(
      `[data-message-id="${CSS.escape(
        message.id
      )}"]`
    )
  ) {
    return;
  }

  const welcome =
    messages.querySelector(
      ".welcome"
    );

  if (welcome) {
    messages.innerHTML =
      "";
  }

  messages.insertAdjacentHTML(
    "beforeend",
    renderMessage(
      message
    )
  );

  scrollMessagesToBottom();
}

function scrollMessagesToBottom() {
  if (!messages) return;

  requestAnimationFrame(
    () => {
      messages.scrollTop =
        messages.scrollHeight;
    }
  );
}

/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage(
  text
) {
  if (
    !supabaseClient ||
    !currentUser
  ) {
    showToast(
      "ابتدا وارد حساب شوید."
    );
    return false;
  }

  if (
    !activeConversationId
  ) {
    showToast(
      currentLanguage() ===
        "en"
        ? "Select a conversation first."
        : "ابتدا یک گفتگو را انتخاب کنید."
    );
    return false;
  }

  const body =
    String(
      text || ""
    ).trim();

  if (!body) {
    return false;
  }

  if (
    body.length >
    10000
  ) {
    showToast(
      "پیام نمی‌تواند بیشتر از ۱۰۰۰۰ کاراکتر باشد."
    );
    return false;
  }

  const {
    error
  } =
    await supabaseClient
      .from("messages")
      .insert({
        conversation_id:
          activeConversationId,
        sender_id:
          currentUser.id,
        body
      });

  if (error) {
    console.error(
      "SEND MESSAGE ERROR:",
      error
    );

    showToast(
      "ارسال پیام انجام نشد."
    );

    return false;
  }

  return true;
}

/* =========================================================
   CREATE PRIVATE CHAT
   ========================================================= */

async function saveContact() {
  if (
    !supabaseClient ||
    !currentUser
  ) {
    showToast(
      "ابتدا وارد حساب شوید."
    );
    return;
  }

  const search =
    $("contactSearch")
      ?.value.trim();

  if (!search) {
    showToast(
      "ایمیل یا نام کاربری را وارد کنید."
    );
    return;
  }

  try {
    const profile =
      await getProfileBySearch(
        search
      );

    if (!profile) {
      showToast(
        "کاربری با این مشخصات پیدا نشد."
      );
      return;
    }

    const {
      data:
        conversationId,
      error
    } =
      await supabaseClient
        .rpc(
          "create_private_conversation",
          {
            other_user:
              profile.id
          }
        );

    if (error) {
      throw error;
    }

    closePanel(
      contactPanel
    );

    closePanel(
      newChatPanel
    );

    const input =
      $("contactSearch");

    if (input) {
      input.value = "";
    }

    await loadChats();

    await openConversation(
      conversationId
    );

    showToast(
      "گفتگو آماده شد."
    );
  } catch (error) {
    console.error(
      "CREATE CHAT ERROR:",
      error
    );

    showToast(
      getAuthErrorMessage(
        error
      )
    );
  }
}

/* =========================================================
   GROUP / CHANNEL
   ========================================================= */

async function saveGroup() {
  if (!supabaseClient || !currentUser) {
    showToast("ابتدا وارد حساب شوید.");
    return;
  }

  const title = $("groupTitle")?.value.trim();
  const username = $("groupUsername")?.value.trim().replace(/^@/, "").toLowerCase();
  const description = $("groupDescription")?.value.trim();

  if (!title) {
    showToast("نام گروه را وارد کنید.");
    return;
  }

  if (username && !/^[a-z0-9_]{3,32}$/.test(username)) {
    showToast("نام کاربری گروه نامعتبر است.");
    return;
  }

  try {
    const { data, error } = await supabaseClient.rpc("create_group_or_channel", {
      p_title: title,
      p_username: username || null,
      p_description: description || null,
      p_is_channel: false
    });

    if (error) throw error;

    closePanel(groupPanel);
    closePanel(newChatPanel);
    await loadChats();
    await openConversation(data);
    showToast("گروه با موفقیت ساخته شد.");
  } catch (error) {
    console.error("CREATE GROUP ERROR:", error);
    showToast(error?.message || "ساخت گروه انجام نشد.");
  }
}

async function saveChannel() {
  if (!supabaseClient || !currentUser) {
    showToast("ابتدا وارد حساب شوید.");
    return;
  }

  const title = $("channelTitle")?.value.trim();
  const username = $("channelUsername")?.value.trim().replace(/^@/, "").toLowerCase();
  const description = $("channelDescription")?.value.trim();

  if (!title) {
    showToast("نام کانال را وارد کنید.");
    return;
  }

  if (username && !/^[a-z0-9_]{3,32}$/.test(username)) {
    showToast("نام کاربری کانال نامعتبر است.");
    return;
  }

  try {
    const { data, error } = await supabaseClient.rpc("create_group_or_channel", {
      p_title: title,
      p_username: username || null,
      p_description: description || null,
      p_is_channel: true
    });

    if (error) throw error;

    closePanel(channelPanel);
    closePanel(newChatPanel);
    await loadChats();
    await openConversation(data);
    showToast("کانال با موفقیت ساخته شد.");
  } catch (error) {
    console.error("CREATE CHANNEL ERROR:", error);
    showToast(error?.message || "ساخت کانال انجام نشد.");
  }
}

/* =========================================================
   MOBILE
   ========================================================= */

function showChatOnMobile() {
  sidebar?.classList.add(
    "hide"
  );

  main?.classList.add(
    "show"
  );
}

function showSidebarOnMobile() {
  sidebar?.classList.remove(
    "hide"
  );

  main?.classList.remove(
    "show"
  );
}

/* =========================================================
   HTML SECURITY
   ========================================================= */

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

/* =========================================================
   EVENTS
   ========================================================= */

function bindEvents() {
  loginBtn?.addEventListener(
    "click",
    login
  );

  signupBtn?.addEventListener(
    "click",
    signup
  );

  forgotBtn?.addEventListener(
    "click",
    forgotPassword
  );

  googleLoginBtn?.addEventListener(
    "click",
    loginWithGoogle
  );

  toggleAuthBtn?.addEventListener(
    "click",
    () => {
      setAuthMode(
        authMode === "login"
          ? "signup"
          : "login"
      );
    }
  );

  passwordToggle?.addEventListener(
    "click",
    togglePasswordVisibility
  );

  emailInput?.addEventListener(
    "keydown",
    event => {
      if (
        event.key ===
        "Enter"
      ) {
        event.preventDefault();

        if (
          authMode ===
          "login"
        ) {
          login();
        } else {
          passwordInput?.focus();
        }
      }
    }
  );

  passwordInput?.addEventListener(
    "keydown",
    event => {
      if (
        event.key ===
        "Enter"
      ) {
        event.preventDefault();

        if (
          authMode ===
          "login"
        ) {
          login();
        } else {
          passwordConfirmInput?.focus();
        }
      }
    }
  );

  passwordConfirmInput?.addEventListener(
    "keydown",
    event => {
      if (
        event.key ===
        "Enter"
      ) {
        event.preventDefault();

        if (
          authMode ===
          "signup"
        ) {
          signup();
        }
      }
    }
  );

  /* MENU */

  $("menuBtn")
    ?.addEventListener(
      "click",
      openMenu
    );

  $("closeMenu")
    ?.addEventListener(
      "click",
      () =>
        closePanel(
          menuPanel
        )
    );

  $("profileMenuBtn")
    ?.addEventListener(
      "click",
      openProfile
    );

  $("chatSettingsBtn")
    ?.addEventListener(
      "click",
      openChatSettings
    );

  $("privacyBtn")
    ?.addEventListener(
      "click",
      openPrivacySettings
    );

  $("storageBtn")
    ?.addEventListener(
      "click",
      openStorageSettings
    );

  $("foldersBtn")
    ?.addEventListener(
      "click",
      openFoldersSettings
    );

  $("powerBtn")
    ?.addEventListener(
      "click",
      openPowerSettings
    );

  $("languageMenuBtn")
    ?.addEventListener(
      "click",
      openLanguage
    );

  $("aboutMenuBtn")
    ?.addEventListener(
      "click",
      openAbout
    );

  $("logoutBtn")
    ?.addEventListener(
      "click",
      logout
    );

  /* PROFILE */

  $("saveProfileBtn")
    ?.addEventListener(
      "click",
      saveProfile
    );

  $("addAvatarBtn")
    ?.addEventListener(
      "click",
      selectAvatar
    );

  $("removeAvatarBtn")
    ?.addEventListener(
      "click",
      removeAvatar
    );

  avatarFile?.addEventListener(
    "change",
    handleAvatarFile
  );

  /* LANGUAGE */

  document
    .querySelectorAll(
      ".language-option"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            changeLanguage(
              button.dataset
                .lang
            );
          }
        );
      }
    );

  /* NEW CHAT */

  $("newChatBtn")
    ?.addEventListener(
      "click",
      openNewChat
    );

  $("addContactBtn")
    ?.addEventListener(
      "click",
      openContact
    );

  $("createGroupBtn")
    ?.addEventListener(
      "click",
      openGroup
    );

  $("createChannelBtn")
    ?.addEventListener(
      "click",
      openChannel
    );

  $("saveContactBtn")
    ?.addEventListener(
      "click",
      saveContact
    );

  $("saveGroupBtn")
    ?.addEventListener(
      "click",
      saveGroup
    );

  $("saveChannelBtn")
    ?.addEventListener(
      "click",
      saveChannel
    );

  /* MOBILE */

  $("backBtn")
    ?.addEventListener(
      "click",
      () => {
        activeConversationId =
          null;

        if (
          realtimeChannel &&
          supabaseClient
        ) {
          supabaseClient.removeChannel(
            realtimeChannel
          );

          realtimeChannel =
            null;
        }

        showSidebarOnMobile();
      }
    );

  /* CLOSE */

  document.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-close]"
        );

      if (!button) return;

      closePanel(
        $(
          button.dataset.close
        )
      );
    }
  );

  /* ESC */

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key ===
        "Escape"
      ) {
        closeAllPanels();
      }
    }
  );

  /* OVERLAY */

  document
    .querySelectorAll(
      ".overlay"
    )
    .forEach(
      overlay => {
        overlay.addEventListener(
          "click",
          event => {
            if (
              event.target ===
              overlay
            ) {
              closePanel(
                overlay
              );
            }
          }
        );
      }
    );

  /* SEARCH */

  $("search")
    ?.addEventListener(
      "input",
      event => {
        const query =
          event.target.value
            .trim()
            .toLowerCase();

        document
          .querySelectorAll(
            ".chat"
          )
          .forEach(
            chat => {
              const text =
                chat.textContent
                  .toLowerCase();

              chat.style.display =
                !query ||
                text.includes(
                  query
                )
                  ? ""
                  : "none";
            }
          );
      }
    );

  /* TABS */
  document.querySelectorAll(".chat-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".chat-tab").forEach(item => item.classList.remove("active"));
      tab.classList.add("active");

      const filter = tab.dataset.filter || "all";
      document.querySelectorAll(".chat").forEach(chat => {
        if (filter === "all") {
          chat.style.display = "";
        } else {
          chat.style.display = chat.dataset.unread === "true" ? "" : "none";
        }
      });
    });
  });

  /* HEADER */

  $("headerProfileBtn")
    ?.addEventListener(
      "click",
      () => {
        if (currentUser) {
          openProfile();
        }
      }
    );

  $("chatSearchBtn")?.addEventListener("click", () => {
    $("search")?.focus();
    showToast("جستجو در گفتگوها");
  });

  $("chatMoreBtn")?.addEventListener("click", () => {
    if (!activeConversationId) {
      showToast("ابتدا یک گفتگو را انتخاب کنید.");
      return;
    }
    openChatSettings();
  });

  /* ATTACH */

  $("attachBtn")
    ?.addEventListener(
      "click",
      () => {
        $("file")?.click();
      }
    );

  /* FILE */

  $("file")
    ?.addEventListener(
      "change",
      handleSelectedFile
    );

  /* COMPOSER */

  $("composer")
    ?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const input =
          $("text");

        const text =
          input?.value.trim();

        if (!text) return;

        const sent =
          await sendMessage(
            text
          );

        if (
          sent &&
          input
        ) {
          input.value = "";
        }
      }
    );
}

/* =========================================================
   LOCAL FILES
   ========================================================= */

function handleSelectedFile(
  event
) {
  const file =
    event.target.files?.[0];

  if (!file) return;

  if (
    file.size >
    20 * 1024 * 1024
  ) {
    showToast(
      "حجم فایل نباید بیشتر از ۲۰ مگابایت باشد."
    );

    event.target.value =
      "";

    return;
  }

  const files =
    getLocalFiles();

  files.push({
    id:
      crypto.randomUUID(),
    name:
      file.name,
    type:
      file.type,
    size:
      file.size,
    createdAt:
      Date.now()
  });

  try {
    localStorage.setItem(
      userKey("files"),
      JSON.stringify(
        files
      )
    );

    showToast(
      "اطلاعات فایل ذخیره شد."
    );
  } catch {
    showToast(
      "فضای ذخیره‌سازی مرورگر کافی نیست."
    );
  }

  event.target.value =
    "";
}

/* =========================================================
   LOCAL MESSAGE DRAFT
   ========================================================= */

function saveMessageLocally(
  text
) {
  try {
    const drafts =
      JSON.parse(
        localStorage.getItem(
          userKey(
            "message_drafts"
          )
        ) ||
          "[]"
      );

    drafts.push({
      id:
        crypto.randomUUID(),
      text,
      createdAt:
        Date.now()
    });

    localStorage.setItem(
      userKey(
        "message_drafts"
      ),
      JSON.stringify(
        drafts.slice(-100)
      )
    );
  } catch {
    /* intentionally ignored */
  }
}

/* =========================================================
   APP VISIBILITY
   ========================================================= */

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState ===
      "visible"
    ) {
      loadTheme();

      if (currentUser) {
        loadProfile(
          currentUser
        );
      }

      loadVisualSettings();
    }
  }
);

window.addEventListener(
  "pageshow",
  () => {
    loadTheme();

    if (currentUser) {
      loadProfile(
        currentUser
      );
    }

    loadVisualSettings();
  }
);

/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    loadTheme();
    loadLanguage();

    bindEvents();

    setAuthMode(
      "login"
    );

    await initializeAuth();
  }
);
