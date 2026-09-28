/**
 * ============================================================
 * CHRONO-FRONT: GALACTIC WAR
 * Authentication System
 * File: ./public/js/auth.js
 * ============================================================
 *
 * Features:
 * - Login and registration
 * - Client-side validation
 * - Password strength indicator
 * - Session persistence
 * - Server-side session verification
 * - Error handling
 *
 * Backend endpoints:
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/verify
 */

"use strict";

(() => {
  // ==========================================================
  // CONFIGURATION
  // ==========================================================

  const TOKEN_KEY = "gw_session_token";
  const LEGACY_TOKEN_KEY = "gw_id_token";
  const USER_KEY = "gw_user";

  const REDIRECT_URL = "./index.html";

  // IMPORTANT:
  // Use your deployed Express backend's ROOT URL.
  // Do not include /api/auth here.
  const API_BASE = "https://galactic-warfare-backend.onrender.com/";

  const API_TIMEOUT = 20000;

  // ==========================================================
  // DOM ELEMENTS
  // ==========================================================

  const $ = (id) => document.getElementById(id);

  const elements = {
    tabLogin: $("tabLogin"),
    tabRegister: $("tabRegister"),

    sectionLogin: $("sectionLogin"),
    sectionRegister: $("sectionRegister"),

    formLogin: $("formLogin"),
    formRegister: $("formRegister"),

    loginEmail: $("loginEmail"),
    loginPassword: $("loginPassword"),
    loginStatus: $("loginStatus"),
    loginBtn: $("loginBtn"),

    regUsername: $("regUsername"),
    regEmail: $("regEmail"),
    regPassword: $("regPassword"),
    regConfirm: $("regConfirm"),
    regStrengthBar: $("regStrengthBar"),
    regStatus: $("regStatus"),
    regBtn: $("regBtn")
  };

  // ==========================================================
  // INITIALIZATION
  // ==========================================================

  document.addEventListener("DOMContentLoaded", initialize);

  async function initialize() {
    bindTabs();
    bindForms();
    bindPasswordStrength();

    switchTab("login");

    const token =
      localStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem(LEGACY_TOKEN_KEY);

    if (!token) return;

    const verified = await verifyToken(token);

    if (verified) {
      window.location.replace(REDIRECT_URL);
      return;
    }

    clearSession();
  }

  // ==========================================================
  // TAB SWITCHING
  // ==========================================================

  function bindTabs() {
    elements.tabLogin?.addEventListener("click", () => {
      switchTab("login");
    });

    elements.tabRegister?.addEventListener("click", () => {
      switchTab("register");
    });

    $("linkToRegister")?.addEventListener("click", (event) => {
      event.preventDefault();
      switchTab("register");
    });

    $("linkToLogin")?.addEventListener("click", (event) => {
      event.preventDefault();
      switchTab("login");
    });
  }

  function switchTab(tab) {
    const isLogin = tab === "login";

    elements.tabLogin?.classList.toggle("active", isLogin);
    elements.tabRegister?.classList.toggle("active", !isLogin);

    elements.tabLogin?.setAttribute(
      "aria-selected",
      String(isLogin)
    );

    elements.tabRegister?.setAttribute(
      "aria-selected",
      String(!isLogin)
    );

    elements.sectionLogin?.classList.toggle("active", isLogin);
    elements.sectionRegister?.classList.toggle("active", !isLogin);

    if (elements.sectionLogin) {
      elements.sectionLogin.hidden = !isLogin;
    }

    if (elements.sectionRegister) {
      elements.sectionRegister.hidden = isLogin;
    }

    clearStatus(elements.loginStatus);
    clearStatus(elements.regStatus);
  }

  // ==========================================================
  // FORM EVENTS
  // ==========================================================

  function bindForms() {
    elements.formLogin?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleLogin();
    });

    elements.formRegister?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleRegister();
    });
  }

  // ==========================================================
  // PASSWORD STRENGTH
  // ==========================================================

  function bindPasswordStrength() {
    elements.regPassword?.addEventListener("input", () => {
      updatePasswordStrength(elements.regPassword.value);
    });
  }

  function updatePasswordStrength(password) {
    const bar = elements.regStrengthBar;

    if (!bar) return;

    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const colors = [
      "#ef4444",
      "#f97316",
      "#eab308",
      "#22d3ee",
      "#4ade80"
    ];

    bar.style.width = `${(score / 5) * 100}%`;

    bar.style.background =
      score > 0 ? colors[score - 1] : "transparent";
  }

  // ==========================================================
  // API REQUEST
  // ==========================================================

  async function apiPost(endpoint, payload) {
    const base = API_BASE.trim().replace(/\/+$/, "");

    if (
      !base ||
      base.includes("YOUR-BACKEND") ||
      base.includes("YOUR_BACKEND")
    ) {
      return {
        ok: false,
        status: 0,
        data: {
          error: "Backend URL is not configured in auth.js."
        }
      };
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, API_TIMEOUT);

    try {
      const response = await fetch(`${base}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "omit",
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const text = await response.text();

      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {
          error: "The server returned an invalid response."
        };
      }

      return {
        ok: response.ok,
        status: response.status,
        data
      };

    } catch (error) {
      const message =
        error.name === "AbortError"
          ? "The server took too long to respond. Please try again."
          : "Cannot connect to the authentication server. Check your backend URL, CORS settings, and server status.";

      return {
        ok: false,
        status: 0,
        data: { error: message }
      };

    } finally {
      clearTimeout(timeout);
    }
  }

  // ==========================================================
  // LOGIN
  // ==========================================================

  async function handleLogin() {
    clearStatus(elements.loginStatus);

    const email =
      elements.loginEmail?.value.trim().toLowerCase() || "";

    const password =
      elements.loginPassword?.value || "";

    if (!isValidEmail(email)) {
      showStatus(
        elements.loginStatus,
        "Please enter a valid email address.",
        "error"
      );

      elements.loginEmail?.focus();
      return;
    }

    if (!password) {
      showStatus(
        elements.loginStatus,
        "Please enter your password.",
        "error"
      );

      elements.loginPassword?.focus();
      return;
    }

    setLoading(elements.loginBtn, true, "AUTHENTICATING...");

    try {
      const result = await apiPost("/api/auth/login", {
        email,
        password
      });

      if (!isSuccessful(result)) {
        showStatus(
          elements.loginStatus,
          getErrorMessage(result, "Login failed."),
          "error"
        );
        return;
      }

      const data = result.data;

      if (!data.token) {
        showStatus(
          elements.loginStatus,
          "The server did not return a session token. Please try again.",
          "error"
        );
        return;
      }

      const commanderName =
        data.commanderName ||
        data.username ||
        email.split("@")[0];

      persistSession(data.token, {
        email: data.email || email,
        commanderName,
        progress: data.progress || {}
      });

      showStatus(
        elements.loginStatus,
        `Welcome back, ${commanderName}! Establishing uplink...`,
        "success"
      );

      setTimeout(() => {
        window.location.replace(REDIRECT_URL);
      }, 900);

    } catch (error) {
      console.error("[Auth] Login error:", error);

      showStatus(
        elements.loginStatus,
        "An unexpected error occurred during login.",
        "error"
      );

    } finally {
      setLoading(elements.loginBtn, false);
    }
  }

  // ==========================================================
  // REGISTRATION
  // ==========================================================

  async function handleRegister() {
    clearStatus(elements.regStatus);

    const commanderName =
      elements.regUsername?.value.trim() || "";

    const email =
      elements.regEmail?.value.trim().toLowerCase() || "";

    const password =
      elements.regPassword?.value || "";

    const confirmPassword =
      elements.regConfirm?.value || "";

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (
      commanderName.length < 3 ||
      commanderName.length > 24
    ) {
      showStatus(
        elements.regStatus,
        "Commander name must be between 3 and 24 characters.",
        "error"
      );

      elements.regUsername?.focus();
      return;
    }

    if (!/^[a-zA-Z0-9_-]+(?: [a-zA-Z0-9_-]+)*$/.test(commanderName)) {
      showStatus(
        elements.regStatus,
        "Commander name can contain letters, numbers, spaces, underscores, and hyphens.",
        "error"
      );

      elements.regUsername?.focus();
      return;
    }

    if (!isValidEmail(email)) {
      showStatus(
        elements.regStatus,
        "Please enter a valid email address.",
        "error"
      );

      elements.regEmail?.focus();
      return;
    }

    if (password.length < 8) {
      showStatus(
        elements.regStatus,
        "Password must contain at least 8 characters.",
        "error"
      );

      elements.regPassword?.focus();
      return;
    }

    if (password.length > 128) {
      showStatus(
        elements.regStatus,
        "Password cannot exceed 128 characters.",
        "error"
      );

      elements.regPassword?.focus();
      return;
    }

    if (password !== confirmPassword) {
      showStatus(
        elements.regStatus,
        "Passwords do not match.",
        "error"
      );

      elements.regConfirm?.focus();
      return;
    }

    // --------------------------------------------------------
    // SEND REGISTRATION REQUEST
    // --------------------------------------------------------

    setLoading(
      elements.regBtn,
      true,
      "CREATING ACCOUNT..."
    );

    try {
      const result = await apiPost("/api/auth/register", {
        email,
        password,
        commanderName
      });

      if (!isSuccessful(result)) {
        showStatus(
          elements.regStatus,
          getErrorMessage(result, "Registration failed."),
          "error"
        );

        console.error("[Auth] Registration failed:", {
          status: result.status,
          response: result.data
        });

        return;
      }

      // ------------------------------------------------------
      // STORE SESSION ONLY AFTER CONFIRMED SUCCESS
      // ------------------------------------------------------

      const data = result.data;

      if (!data.token) {
        showStatus(
          elements.regStatus,
          "The account may have been created, but the server did not return a session token. Please try logging in.",
          "error"
        );

        return;
      }

      const resolvedName =
        data.commanderName || commanderName;

      persistSession(data.token, {
        email: data.email || email,
        commanderName: resolvedName,
        progress: data.progress || {}
      });

      showStatus(
        elements.regStatus,
        `Account created successfully, ${resolvedName}! Deploying...`,
        "success"
      );

      setTimeout(() => {
        window.location.replace(REDIRECT_URL);
      }, 1000);

    } catch (error) {
      console.error("[Auth] Registration error:", error);

      showStatus(
        elements.regStatus,
        "An unexpected error occurred during registration.",
        "error"
      );

    } finally {
      setLoading(elements.regBtn, false);
    }
  }

  // ==========================================================
  // RESPONSE VALIDATION
  // ==========================================================

  function isSuccessful(result) {
    if (!result || !result.ok) {
      return false;
    }

    const data = result.data || {};

    return data.ok === true || data.success === true;
  }

  function getErrorMessage(result, fallback) {
    const data = result?.data || {};

    if (data.error) return data.error;
    if (data.message) return data.message;

    if (result?.status === 409) {
      return "An account with this email already exists.";
    }

    if (result?.status === 429) {
      return "Too many attempts. Please wait before trying again.";
    }

    if (result?.status === 503) {
      return "The database is temporarily unavailable. Please try again.";
    }

    if (result?.status === 0) {
      return "Cannot reach the authentication server. Check your backend URL and server status.";
    }

    if (result?.status) {
      return `${fallback} HTTP ${result.status}.`;
    }

    return fallback;
  }

  // ==========================================================
  // SESSION MANAGEMENT
  // ==========================================================

  function persistSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(LEGACY_TOKEN_KEY, token);

    localStorage.setItem(
      USER_KEY,
      JSON.stringify(user)
    );
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function verifyToken(token) {
    const result = await apiPost(
      "/api/auth/verify",
      { token }
    );

    if (!isSuccessful(result)) {
      return false;
    }

    const data = result.data;

    try {
      const user = JSON.parse(
        localStorage.getItem(USER_KEY) || "{}"
      );

      if (data.commanderName) {
        user.commanderName = data.commanderName;
      }

      if (data.email) {
        user.email = data.email;
      }

      localStorage.setItem(
        USER_KEY,
        JSON.stringify(user)
      );

    } catch (error) {
      console.error("[Auth] Could not refresh session user:", error);
    }

    return true;
  }

  // ==========================================================
  // UI HELPERS
  // ==========================================================

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function setLoading(button, loading, label) {
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.textContent.trim();
    }

    button.disabled = loading;
    button.classList.toggle("loading", loading);

    if (loading && label) {
      button.textContent = label;
    } else if (!loading && button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
  }

  function showStatus(element, message, type = "error") {
    if (!element) return;

    element.textContent = message;
    element.className = `auth-status visible ${type}`;
  }

  function clearStatus(element) {
    if (!element) return;

    element.textContent = "";
    element.className = "auth-status";
  }

})();
