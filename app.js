/* =========================================================
   BipolarChat-v1
   app.js
   ========================================================= */

"use strict";

/* =========================================================
   SUPABASE
   ========================================================= */

const CONFIG = window.NOVA_CONFIG || window.BIPOLAR_CONFIG || {};

const SUPABASE_URL =
  CONFIG.SUPABASE_URL || "";

const SUPABASE_KEY =
  CONFIG.SUPABASE_PUBLISHABLE_KEY ||
  CONFIG.SUPABASE_ANON_KEY ||
  "";

if (!window.supabase) {
  console.error("Supabase SDK is not loaded.");
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Supabase configuration is missing. Check config.js."
  );
}

const supabaseClient =
  window.supabase && SUPABASE_URL && SUPABASE_KEY
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
   DOM HELPERS
   ========================================================= */

const $ = (id) => document.getElementById(id);

const auth = $("auth");
const app = $("app");
const toast = $("toast");

const emailInput = $("email");
const passwordInput = $("password");
const passwordConfirmInput = $("passwordConfirm");

const loginBtn = $("loginBtn");
const signupBtn = $("signupBtn");
const forgotBtn = $("forgot");
const toggleAuthBtn = $("toggleAuth");
const googleLoginBtn = $("googleLoginBtn");

const passwordToggle = $("passwordToggle");

const authTitle = $("authTitle");
const authMessage = $("authMessage");
const signupNameBox = $("signupNameBox");
const signupPasswordConfirmBox =
  $("signupPasswordConfirmBox");

const displayNameInput = $("displayName");

const menuPanel = $("menuPanel");
const profilePanel = $("profilePanel");
const settingsPanel = $("settingsPanel");
const languagePanel = $("languagePanel");
const aboutPanel = $("aboutPanel");
const newChatPanel = $("newChatPanel");
const contactPanel = $("contactPanel");
const groupPanel = $("groupPanel");
const channelPanel = $("channelPanel");

const sidebar = $("sidebar");
const main = $("main");

const chatList = $("chatList");
const messages = $("messages");

const profileName = $("profileName");
const profileUsername = $("profileUsername");
const profileEmail = $("profileEmail");
const profileBio = $("profileBio");

const profileAvatar = $("profileAvatar");
const avatarFile = $("avatarFile");

const settingsTitle = $("settingsTitle");
const settingsContent = $("settingsContent");

let authMode = "login";
let currentUser = null;
let currentSession = null;
let toastTimer = null;


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message, duration = 3000) {
  if (!toast) return;

  clearTimeout(toastTimer);

  toast.textContent = message;
  toast.classList.add("show");

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}


/* =========================================================
   AUTH UI
   ========================================================= */

function setAuthMode(mode) {
  authMode = mode;

  const signup = mode === "signup";

  if (authTitle) {
    authTitle.textContent = signup
      ? "ساخت حساب BipolarChat"
      : "ورود به BipolarChat";
  }

  if (authMessage) {
    authMessage.textContent = signup
      ? "برای ساخت حساب اطلاعات زیر را وارد کنید."
      : "برای ادامه وارد حساب خود شوید.";
  }

  if (signupNameBox) {
    signupNameBox.classList.add("hidden");
  }

  if (signupPasswordConfirmBox) {
    signupPasswordConfirmBox.classList.toggle(
      "hidden",
      !signup
    );
  }

  if (loginBtn) {
    loginBtn.classList.toggle("hidden", signup);
  }

  if (signupBtn) {
    signupBtn.classList.toggle("hidden", !signup);
  }

  if (toggleAuthBtn) {
    toggleAuthBtn.textContent = signup
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
   PASSWORD VISIBILITY
   ========================================================= */

function togglePasswordVisibility() {
  if (!passwordInput) return;

  const isPassword =
    passwordInput.type === "password";

  passwordInput.type =
    isPassword ? "text" : "password";

  if (passwordToggle) {
    passwordToggle.textContent =
      isPassword ? "◉" : "◌";

    passwordToggle.setAttribute(
      "aria-label",
      isPassword
        ? "پنهان کردن رمز عبور"
        : "نمایش رمز عبور"
    );
  }
}


/* =========================================================
   LOADING STATE
   ========================================================= */

function setButtonLoading(button, loading, text) {
  if (!button) return;

  if (loading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText =
        button.textContent;
    }

    button.disabled = true;
    button.textContent = text || "در حال انجام...";
  } else {
    button.disabled = false;

    if (button.dataset.originalText) {
      button.textContent =
        button.dataset.originalText;
    }
  }
}


/* =========================================================
   AUTH ERROR
   ========================================================= */

function getAuthErrorMessage(error) {
  if (!error) {
    return "خطای نامشخص.";
  }

  const message =
    String(error.message || "").toLowerCase();

  if (
    message.includes("invalid login") ||
    message.includes("invalid credentials")
  ) {
    return "ایمیل یا رمز عبور اشتباه است.";
  }

  if (
    message.includes("email not confirmed")
  ) {
    return "ایمیل حساب هنوز تأیید نشده است.";
  }

  if (
    message.includes("user already registered")
  ) {
    return "این ایمیل قبلاً ثبت شده است.";
  }

  if (
    message.includes("password should be")
  ) {
    return "رمز عبور شرایط لازم را ندارد.";
  }

  if (
    message.includes("rate limit")
  ) {
    return "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.";
  }

  if (
    message.includes("network")
  ) {
    return "اتصال به اینترنت یا سرور برقرار نیست.";
  }

  return error.message || "عملیات انجام نشد.";
}


/* =========================================================
   LOGIN
   ========================================================= */

async function login() {
  if (!supabaseClient) {
    showToast("اتصال Supabase برقرار نیست.");
    return;
  }

  const email =
    emailInput?.value.trim() || "";

  const password =
    passwordInput?.value || "";

  if (!email) {
    showToast("ایمیل را وارد کنید.");
    emailInput?.focus();
    return;
  }

  if (!password) {
    showToast("رمز عبور را وارد کنید.");
    passwordInput?.focus();
    return;
  }

  setButtonLoading(
    loginBtn,
    true,
    "در حال ورود..."
  );

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw error;
    }

    currentSession = data.session;
    currentUser = data.user;

    if (!currentUser) {
      throw new Error(
        "حساب کاربری دریافت نشد."
      );
    }

    await enterApplication(currentUser);

    showToast("ورود با موفقیت انجام شد.");

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    showToast(getAuthErrorMessage(error));
  } finally {
    setButtonLoading(
      loginBtn,
      false
    );
  }
}


/* =========================================================
   SIGN UP
   ========================================================= */

async function signup() {
  if (!supabaseClient) {
    showToast("اتصال Supabase برقرار نیست.");
    return;
  }

  const email =
    emailInput?.value.trim() || "";

  const password =
    passwordInput?.value || "";

  const confirm =
    passwordConfirmInput?.value || "";

  if (!email) {
    showToast("ایمیل را وارد کنید.");
    emailInput?.focus();
    return;
  }

  if (!password) {
    showToast("رمز عبور را وارد کنید.");
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
    const { data, error } =
      await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: "Unknown",
            username: "",
            bio: ""
          }
        }
      });

    if (error) {
      throw error;
    }

    if (data.session && data.user) {
      currentSession = data.session;
      currentUser = data.user;

      await enterApplication(currentUser);

      showToast(
        "حساب با موفقیت ساخته شد."
      );
    } else {
      showToast(
        "حساب ساخته شد. ایمیل خود را برای تأیید بررسی کنید.",
        5000
      );

      setAuthMode("login");
    }

  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    showToast(getAuthErrorMessage(error));
  } finally {
    setButtonLoading(
      signupBtn,
      false
    );
  }
}


/* =========================================================
   GOOGLE LOGIN
   ========================================================= */

async function loginWithGoogle() {
  if (!supabaseClient) {
    showToast("اتصال Supabase برقرار نیست.");
    return;
  }

  setButtonLoading(
    googleLoginBtn,
    true,
    "در حال اتصال..."
  );

  try {
    const redirectTo =
      window.location.origin +
      window.location.pathname;

    const { error } =
      await supabaseClient.auth.signInWithOAuth({
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
      getAuthErrorMessage(error),
      5000
    );

    setButtonLoading(
      googleLoginBtn,
      false
    );
  }
}


/* =========================================================
   FORGOT PASSWORD
   ========================================================= */

async function forgotPassword() {
  if (!supabaseClient) {
    showToast("اتصال Supabase برقرار نیست.");
    return;
  }

  const email =
    emailInput?.value.trim() || "";

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

    const { error } =
      await supabaseClient.auth.resetPasswordForEmail(
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
      getAuthErrorMessage(error),
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
   ENTER APPLICATION
   ========================================================= */

async function enterApplication(user) {
  if (!user) return;

  currentUser = user;

  if (auth) {
    auth.classList.add("hidden");
  }

  if (app) {
    app.classList.remove("hidden");
  }

  loadProfile(user);

  resetPanels();

  if (sidebar) {
    sidebar.classList.remove("hide");
  }

  if (main) {
    main.classList.remove("show");
  }

  renderWelcome();

  await loadChats();
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {
  if (!supabaseClient) return;

  try {
    const { error } =
      await supabaseClient.auth.signOut();

    if (error) {
      throw error;
    }

    currentUser = null;
    currentSession = null;

    closeAllPanels();

    if (app) {
      app.classList.add("hidden");
    }

    if (auth) {
      auth.classList.remove("hidden");
    }

    setAuthMode("login");

    if (emailInput) {
      emailInput.value = "";
    }

    if (passwordInput) {
      passwordInput.value = "";
    }

    showToast("از حساب خارج شدید.");

  } catch (error) {
    console.error("LOGOUT ERROR:", error);
    showToast(
      getAuthErrorMessage(error)
    );
  }
}


/* =========================================================
   SESSION CHECK
   ========================================================= */

async function initializeAuth() {
  if (!supabaseClient) {
    if (auth) {
      auth.classList.remove("hidden");
    }

    if (app) {
      app.classList.add("hidden");
    }

    return;
  }

  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    currentSession = data.session;
    currentUser =
      data.session?.user || null;

    if (currentUser) {
      await enterApplication(currentUser);
    } else {
      if (auth) {
        auth.classList.remove("hidden");
      }

      if (app) {
        app.classList.add("hidden");
      }

      setAuthMode("login");
    }

  } catch (error) {
    console.error(
      "SESSION ERROR:",
      error
    );

    if (auth) {
      auth.classList.remove("hidden");
    }

    if (app) {
      app.classList.add("hidden");
    }

    showToast(
      "بررسی ورود انجام نشد."
    );
  }

  supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

      currentSession = session;
      currentUser =
        session?.user || null;

      if (
        event === "SIGNED_IN" &&
        currentUser
      ) {
        await enterApplication(
          currentUser
        );
      }

      if (
        event === "SIGNED_OUT"
      ) {
        currentUser = null;
        currentSession = null;

        if (app) {
          app.classList.add("hidden");
        }

        if (auth) {
          auth.classList.remove("hidden");
        }

        setAuthMode("login");
      }
    }
  );
}


/* =========================================================
   PROFILE
   ========================================================= */

function getProfileStorageKey(user) {
  return user
    ? `bipolarchat_profile_${user.id}`
    : "";
}


function getStoredProfile(user) {
  if (!user) return {};

  try {
    const raw =
      localStorage.getItem(
        getProfileStorageKey(user)
      );

    return raw
      ? JSON.parse(raw)
      : {};
  } catch {
    return {};
  }
}


function saveStoredProfile(profile) {
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


function loadProfile(user) {
  if (!user) return;

  const stored =
    getStoredProfile(user);

  const metadata =
    user.user_metadata || {};

  const name =
    stored.name ||
    metadata.display_name ||
    "Unknown";

  const username =
    stored.username ||
    metadata.username ||
    "";

  const bio =
    stored.bio ||
    metadata.bio ||
    "";

  if (profileName) {
    profileName.value = name;
  }

  if (profileUsername) {
    profileUsername.value =
      username.replace(/^@/, "");
  }

  if (profileBio) {
    profileBio.value = bio;
  }

  if (profileEmail) {
    profileEmail.value =
      user.email || "";
  }

  renderAvatar(
    stored.avatar ||
    metadata.avatar_url ||
    "",
    name
  );
}


function renderAvatar(source, name) {
  if (!profileAvatar) return;

  if (source) {
    profileAvatar.innerHTML =
      `<img src="${escapeHtmlAttribute(source)}" alt="">`;
  } else {
    profileAvatar.textContent =
      getInitial(name);
  }
}


function getInitial(name) {
  const value =
    String(name || "U").trim();

  return value
    ? value.charAt(0).toUpperCase()
    : "U";
}


function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


async function saveProfile() {
  if (!currentUser) {
    showToast("ابتدا وارد حساب شوید.");
    return;
  }

  const name =
    profileName?.value.trim() ||
    "Unknown";

  const username =
    profileUsername?.value
      .trim()
      .replace(/^@/, "") ||
    "";

  const bio =
    profileBio?.value.trim() ||
    "";

  const stored =
    getStoredProfile(currentUser);

  const profile = {
    ...stored,
    name,
    username,
    bio
  };

  saveStoredProfile(profile);

  try {
    if (supabaseClient) {
      const { error } =
        await supabaseClient.auth.updateUser({
          data: {
            display_name: name,
            username,
            bio
          }
        });

      if (error) {
        throw error;
      }
    }

    loadProfile(currentUser);

    showToast(
      "پروفایل ذخیره شد."
    );

  } catch (error) {
    console.error(
      "PROFILE UPDATE ERROR:",
      error
    );

    showToast(
      getAuthErrorMessage(error)
    );
  }
}


/* =========================================================
   AVATAR
   ========================================================= */

function selectAvatar() {
  avatarFile?.click();
}


function handleAvatarFile(event) {
  const file =
    event.target.files?.[0];

  if (!file || !currentUser) return;

  if (!file.type.startsWith("image/")) {
    showToast(
      "فایل انتخاب‌شده تصویر نیست."
    );
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast(
      "حجم تصویر نباید بیشتر از ۵ مگابایت باشد."
    );
    return;
  }

  const reader =
    new FileReader();

  reader.onload = () => {
    const stored =
      getStoredProfile(currentUser);

    stored.avatar =
      reader.result;

    saveStoredProfile(stored);

    renderAvatar(
      reader.result,
      profileName?.value ||
      "Unknown"
    );

    showToast(
      "تصویر پروفایل تغییر کرد."
    );
  };

  reader.readAsDataURL(file);

  event.target.value = "";
}


function removeAvatar() {
  if (!currentUser) return;

  const stored =
    getStoredProfile(currentUser);

  delete stored.avatar;

  saveStoredProfile(stored);

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

  panel.classList.remove("hidden");
  document.body.classList.add(
    "panel-open"
  );
}


function closePanel(panel) {
  if (!panel) return;

  panel.classList.add("hidden");

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
    .querySelectorAll(".overlay")
    .forEach((panel) => {
      panel.classList.add("hidden");
    });

  document.body.classList.remove(
    "panel-open"
  );
}


function resetPanels() {
  closeAllPanels();
}


function closeByDataAttribute(event) {
  const button =
    event.target.closest(
      "[data-close]"
    );

  if (!button) return;

  const id =
    button.dataset.close;

  closePanel($(id));
}


/* =========================================================
   MENU
   ========================================================= */

function openMenu() {
  openPanel(menuPanel);
}


function openProfile() {
  if (currentUser) {
    loadProfile(currentUser);
  }

  openPanel(profilePanel);
}


function openNewChat() {
  openPanel(newChatPanel);
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

  openPanel(settingsPanel);
}


function openChatSettings() {
  openGenericSettings(
    "تنظیمات گفتگو",
    `
      <div class="setting-card">
        <strong>اندازه متن پیام</strong>
        <p>از ۱۲ تا ۳۰ پیکسل — مقدار پیش‌فرض ۱۶.</p>

        <input
          id="messageFontSize"
          type="range"
          min="12"
          max="30"
          value="${getSetting(
            "messageFontSize",
            "16"
          )}"
          style="width:100%;margin-top:12px">

        <strong
          id="messageFontSizeValue"
          style="display:block;margin-top:8px">
          ${getSetting(
            "messageFontSize",
            "16"
          )}px
        </strong>
      </div>

      <div class="setting-card">
        <strong>پوسته</strong>
        <p>فقط روشن یا تاریک.</p>

        <button
          type="button"
          class="small-action"
          data-theme="light">
          روشن
        </button>

        <button
          type="button"
          class="small-action"
          data-theme="dark">
          تاریک
        </button>
      </div>

      <div class="setting-card">
        <strong>گوشه پیام</strong>
        <p>از ۱ تا ۱۷.</p>

        <input
          id="messageRadius"
          type="range"
          min="1"
          max="17"
          value="${getSetting(
            "messageRadius",
            "16"
          )}"
          style="width:100%;margin-top:12px">

        <strong
          id="messageRadiusValue"
          style="display:block;margin-top:8px">
          ${getSetting(
            "messageRadius",
            "16"
          )}px
        </strong>
      </div>

      <div class="setting-card">
        <strong>پس‌زمینه گفتگو</strong>
        <p>
          تنظیمات پس‌زمینه گفتگو در این بخش قرار می‌گیرد.
        </p>

        <input
          id="chatBackgroundColor"
          type="color"
          value="${getSetting(
            "chatBackgroundColor",
            "#f7f9fb"
          )}"
          style="margin-top:10px;width:60px;height:40px">
      </div>

      <div class="setting-card">
        <strong>ری‌اکشن سریع</strong>
        <p>
          با دو ضربه روی پیام، ری‌اکشن 👍🏻 ثبت می‌شود.
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

  if (font) {
    font.addEventListener(
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

        document.documentElement.style
          .setProperty(
            "--message-font-size",
            `${value}px`
          );
      }
    );
  }

  const radius =
    $("messageRadius");

  const radiusValue =
    $("messageRadiusValue");

  if (radius) {
    radius.addEventListener(
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

        document.documentElement.style
          .setProperty(
            "--message-radius",
            `${value}px`
          );
      }
    );
  }

  const background =
    $("chatBackgroundColor");

  if (background) {
    background.addEventListener(
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
  }

  document
    .querySelectorAll(
      "[data-theme]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          setTheme(
            button.dataset.theme
          );
        }
      );
    });
}


function openPrivacySettings() {
  openGenericSettings(
    "حریم خصوصی و امنیت",
    `
      <div class="setting-card">
        <strong>تأیید دو مرحله‌ای</strong>
        <p>
          گذرواژه دومرحله‌ای و ایمیل بازیابی.
        </p>
      </div>

      <div class="setting-card">
        <strong>ایمیل ورود</strong>
        <p>
          ایمیل فعلی حساب:
          ${escapeHtml(
            currentUser?.email || "-"
          )}
        </p>
      </div>

      <div class="setting-card">
        <strong>شماره تلفن</strong>
        <p>
          امکان افزودن شماره و تعیین
          سطح نمایش.
        </p>
      </div>

      <div class="setting-card">
        <strong>آخرین بازدید</strong>
        <p>
          همه، مخاطبین، هیچکس و استثناها.
        </p>
      </div>

      <div class="setting-card">
        <strong>عکس پروفایل</strong>
        <p>
          همه، مخاطبین، هیچکس و استثناها.
        </p>
      </div>

      <div class="setting-card">
        <strong>پیام فوروارد</strong>
      </div>

      <div class="setting-card">
        <strong>تماس‌ها</strong>
      </div>

      <div class="setting-card">
        <strong>بیوگرافی</strong>
      </div>

      <div class="setting-card">
        <strong>دعوت‌ها</strong>
      </div>

      <div class="setting-card">
        <strong>حذف خودکار اکانت</strong>
        <p>
          ۳ ماه، ۶ ماه، ۱۲ ماه یا ۱۸ ماه.
        </p>
      </div>

      <div class="setting-card">
        <strong>کاربران مسدود</strong>
      </div>

      <div class="setting-card">
        <strong>دستگاه‌های فعال</strong>
      </div>
    `
  );
}


function openStorageSettings() {
  openGenericSettings(
    "ذخیره‌سازی داده",
    `
      <div class="setting-card">
        <strong>میزان استفاده از حافظه</strong>
        <p id="storageUsage">
          در حال محاسبه...
        </p>
      </div>

      <div class="setting-card">
        <strong>میزان استفاده از داده</strong>
        <p>
          اطلاعات مصرف داده در این بخش نمایش داده می‌شود.
        </p>
      </div>
    `
  );

  calculateStorage();
}


function openFoldersSettings() {
  openGenericSettings(
    "پوشه‌ها",
    `
      <div class="setting-card">
        <strong>پوشه‌های گفتگو</strong>
        <p>
          مدیریت دسته‌بندی گفتگوها.
        </p>
      </div>
    `
  );
}


function openPowerSettings() {
  openGenericSettings(
    "صرفه‌جویی انرژی",
    `
      <div class="setting-card">
        <strong>صرفه‌جویی انرژی</strong>
        <p>
          تنظیمات کاهش مصرف منابع برنامه.
        </p>
      </div>
    `
  );
}


/* =========================================================
   LANGUAGE
   ========================================================= */

function openLanguage() {
  updateLanguageChecks();
  openPanel(languagePanel);
}


function updateLanguageChecks() {
  const lang =
    localStorage.getItem(
      "bipolarchat_language"
    ) || "fa";

  const faCheck =
    $("faCheck");

  const enCheck =
    $("enCheck");

  if (faCheck) {
    faCheck.textContent =
      lang === "fa" ? "✓" : "";
  }

  if (enCheck) {
    enCheck.textContent =
      lang === "en" ? "✓" : "";
  }

  const current =
    $("currentLanguage");

  if (current) {
    current.textContent =
      lang === "fa"
        ? "فارسی"
        : "English";
  }
}


function changeLanguage(lang) {
  if (
    lang !== "fa" &&
    lang !== "en"
  ) {
    return;
  }

  localStorage.setItem(
    "bipolarchat_language",
    lang
  );

  if (lang === "fa") {
    document.documentElement.lang =
      "fa";

    document.documentElement.dir =
      "rtl";
  } else {
    document.documentElement.lang =
      "en";

    document.documentElement.dir =
      "ltr";
  }

  updateLanguageChecks();

  showToast(
    lang === "fa"
      ? "زبان فارسی انتخاب شد."
      : "English selected."
  );

  /*
    ترجمه کامل UI در مرحله اختصاصی
    Localization انجام می‌شود.
  */
}


/* =========================================================
   ABOUT
   ========================================================= */

function openAbout() {
  openPanel(aboutPanel);
}


/* =========================================================
   NEW CHAT / GROUP / CHANNEL
   ========================================================= */

function openContact() {
  openPanel(contactPanel);
}


function openGroup() {
  openPanel(groupPanel);
}


function openChannel() {
  openPanel(channelPanel);
}


function saveContact() {
  const search =
    $("contactSearch")
      ?.value.trim();

  const name =
    $("contactName")
      ?.value.trim();

  if (!search) {
    showToast(
      "ایمیل یا نام کاربری را وارد کنید."
    );
    return;
  }

  /*
    ساخت مخاطب واقعی به جدول دیتابیس
    وابسته است و بدون schema ساخته نمی‌شود.
  */

  showToast(
    "مخاطب آماده اضافه شدن است."
  );
}


function saveGroup() {
  const title =
    $("groupTitle")
      ?.value.trim();

  if (!title) {
    showToast(
      "نام گروه را وارد کنید."
    );
    return;
  }

  showToast(
    "ساخت گروه نیازمند اتصال جدول گروه‌ها در Supabase است."
  );
}


function saveChannel() {
  const title =
    $("channelTitle")
      ?.value.trim();

  if (!title) {
    showToast(
      "نام کانال را وارد کنید."
    );
    return;
  }

  showToast(
    "ساخت کانال نیازمند اتصال جدول کانال‌ها در Supabase است."
  );
}


/* =========================================================
   CHAT
   ========================================================= */

function renderWelcome() {
  if (!messages) return;

  messages.innerHTML = `
    <div class="welcome">
      <img
        class="welcome-logo"
        src="https://s6.uupload.ir/files/file_000000002dd082469339a22756c5ad8b_ko8m.png"
        alt="BipolarChat">

      <h1>BipolarChat</h1>

      <p>
        یک گفتگو را انتخاب کنید.
      </p>
    </div>
  `;
}


async function loadChats() {
  if (!chatList) return;

  chatList.innerHTML = `
    <div class="empty-list">
      هنوز گفتگویی وجود ندارد.
    </div>
  `;
}


/* =========================================================
   MOBILE NAVIGATION
   ========================================================= */

function showChatOnMobile() {
  if (sidebar) {
    sidebar.classList.add("hide");
  }

  if (main) {
    main.classList.add("show");
  }
}


function showSidebarOnMobile() {
  if (sidebar) {
    sidebar.classList.remove("hide");
  }

  if (main) {
    main.classList.remove("show");
  }
}


/* =========================================================
   SETTINGS STORAGE
   ========================================================= */

function getSetting(
  key,
  fallback
) {
  const value =
    localStorage.getItem(
      `bipolarchat_${key}`
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
    `bipolarchat_${key}`,
    String(value)
  );
}


function setTheme(theme) {
  if (
    theme !== "light" &&
    theme !== "dark"
  ) {
    return;
  }

  localStorage.setItem(
    "bipolarchat_theme",
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


function loadTheme() {
  const theme =
    localStorage.getItem(
      "bipolarchat_theme"
    ) || "light";

  setThemeSilently(theme);
}


function setThemeSilently(theme) {
  document.documentElement
    .setAttribute(
      "data-theme",
      theme
    );
}


/* =========================================================
   STORAGE
   ========================================================= */

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
        localStorage.getItem(key) || "";

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


/* =========================================================
   SECURITY / HTML
   ========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   EVENT BINDINGS
   ========================================================= */

function bindEvents() {

  /* AUTH */

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


  /* ENTER KEY */

  emailInput?.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter"
      ) {
        event.preventDefault();

        if (authMode === "login") {
          login();
        } else {
          passwordInput?.focus();
        }
      }
    }
  );

  passwordInput?.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter"
      ) {
        event.preventDefault();

        if (authMode === "login") {
          login();
        } else {
          passwordConfirmInput?.focus();
        }
      }
    }
  );

  passwordConfirmInput?.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter"
      ) {
        event.preventDefault();

        if (authMode === "signup") {
          signup();
        }
      }
    }
  );


  /* MENU */

  $("menuBtn")?.addEventListener(
    "click",
    openMenu
  );

  $("closeMenu")?.addEventListener(
    "click",
    () => closePanel(menuPanel)
  );

  $("profileMenuBtn")?.addEventListener(
    "click",
    openProfile
  );

  $("chatSettingsBtn")?.addEventListener(
    "click",
    openChatSettings
  );

  $("privacyBtn")?.addEventListener(
    "click",
    openPrivacySettings
  );

  $("storageBtn")?.addEventListener(
    "click",
    openStorageSettings
  );

  $("foldersBtn")?.addEventListener(
    "click",
    openFoldersSettings
  );

  $("powerBtn")?.addEventListener(
    "click",
    openPowerSettings
  );

  $("languageMenuBtn")?.addEventListener(
    "click",
    openLanguage
  );

  $("aboutMenuBtn")?.addEventListener(
    "click",
    openAbout
  );

  $("logoutBtn")?.addEventListener(
    "click",
    logout
  );


  /* PROFILE */

  $("saveProfileBtn")?.addEventListener(
    "click",
    saveProfile
  );

  $("addAvatarBtn")?.addEventListener(
    "click",
    selectAvatar
  );

  $("removeAvatarBtn")?.addEventListener(
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
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          changeLanguage(
            button.dataset.lang
          );
        }
      );
    });


  /* NEW CHAT */

  $("newChatBtn")?.addEventListener(
    "click",
    openNewChat
  );

  $("addContactBtn")?.addEventListener(
    "click",
    openContact
  );

  $("createGroupBtn")?.addEventListener(
    "click",
    openGroup
  );

  $("createChannelBtn")?.addEventListener(
    "click",
    openChannel
  );

  $("saveContactBtn")?.addEventListener(
    "click",
    saveContact
  );

  $("saveGroupBtn")?.addEventListener(
    "click",
    saveGroup
  );

  $("saveChannelBtn")?.addEventListener(
    "click",
    saveChannel
  );


  /* MOBILE BACK */

  $("backBtn")?.addEventListener(
    "click",
    showSidebarOnMobile
  );


  /* CLOSE BUTTONS */

  document.addEventListener(
    "click",
    closeByDataAttribute
  );


  /* ESC */

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closeAllPanels();
      }
    }
  );


  /* OVERLAY */

  document
    .querySelectorAll(".overlay")
    .forEach((overlay) => {

      overlay.addEventListener(
        "click",
        (event) => {

          if (
            event.target === overlay
          ) {
            closePanel(overlay);
          }

        }
      );

    });


  /* CHAT SEARCH */

  $("search")?.addEventListener(
    "input",
    (event) => {
      const query =
        event.target.value
          .trim()
          .toLowerCase();

      document
        .querySelectorAll(".chat")
        .forEach((chat) => {

          const text =
            chat.textContent
              .toLowerCase();

          chat.style.display =
            !query ||
            text.includes(query)
              ? ""
              : "none";
        });
    }
  );


  /* TABS */

  document
    .querySelectorAll(
      ".chat-tab"
    )
    .forEach((tab) => {

      tab.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              ".chat-tab"
            )
            .forEach((item) =>
              item.classList.remove(
                "active"
              )
            );

          tab.classList.add(
            "active"
          );

        }
      );

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


  /* ATTACH */

  $("attachBtn")
    ?.addEventListener(
      "click",
      () => {
        $("file")?.click();
      }
    );


  /* COMPOSER */

  $("composer")
    ?.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const input =
          $("text");

        const text =
          input?.value.trim();

        if (!text) return;

        showToast(
          "برای ارسال پیام، یک گفتگو انتخاب کنید."
        );

        if (input) {
          input.value = "";
        }
      }
    );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initializeLocalSettings() {
  loadTheme();

  const fontSize =
    getSetting(
      "messageFontSize",
      "16"
    );

  const radius =
    getSetting(
      "messageRadius",
      "16"
    );

  document.documentElement.style
    .setProperty(
      "--message-font-size",
      `${fontSize}px`
    );

  document.documentElement.style
    .setProperty(
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
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    initializeLocalSettings();

    bindEvents();

    setAuthMode("login");

    await initializeAuth();

  }
);
