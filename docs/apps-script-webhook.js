/**
 * Chrono-Front: Galactic War — Google Apps Script Webhook
 *
 * SPREADSHEET:  CHRONO-FRONT STORAGE
 * SHEET TAB:    GalacticWarfare
 *
 * COLUMN LAYOUT (matches the actual spreadsheet):
 *   A  Email
 *   B  Password        — salted SHA-256 hash: "<uuid>:<base64hash>"
 *   C  Command_N       — commander / player display name
 *   D  Modes Unlock    — unlocked game modes string
 *   E  Level           — integer, starts at 1
 *   F  Coins Collected — integer, starts at 0
 *
 * ─── ACTIONS ───────────────────────────────────────────────
 *   register      { action, email, password, commanderName }
 *   login         { action, email, password }
 *   saveProgress  { action, email, password, commanderName,
 *                   modesUnlock, level, coinsCollected }
 *   loadProgress  { action, email, password }
 *
 * ─── RESPONSES ─────────────────────────────────────────────
 *   { success: true,  ... }
 *   { success: false, message: "...", duplicate?: true }
 *
 * ─── HOW TO DEPLOY / UPDATE ────────────────────────────────
 *   1. Open the Google Sheet → Extensions → Apps Script.
 *   2. Replace ALL existing code with this file → Save (Ctrl+S).
 *   3. First time:
 *        Deploy → New deployment
 *        Type: Web App | Execute as: Me | Who has access: Anyone
 *        Copy the URL → paste into .env as GOOGLE_APPS_SCRIPT_URL
 *   4. After any code change:
 *        Deploy → Manage deployments → pencil icon
 *        Version: New version → Deploy
 *      The URL never changes — only the code behind it updates.
 */

// ─── Sheet configuration ──────────────────────────────────────────────────────

const CONFIG = {
  SHEET_NAME: "GalacticWarfare",
  HEADERS: [
    "Email",
    "Password",
    "Commander_N",
    "Modes Unlock",
    "Level",
    "Coins Collected"
  ]
};


/* =========================================================
   INITIALIZE SPREADSHEET
========================================================= */

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CONFIG.HEADERS);
  }

  return sheet;
}


/* =========================================================
   JSON RESPONSE
========================================================= */

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


/* =========================================================
   PASSWORD HASHING
========================================================= */

function hashPassword(password, salt) {
  const value = salt + password;

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8
  );

  return Utilities.base64Encode(digest);
}


/* =========================================================
   FIND PLAYER
========================================================= */

function findPlayer(email) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const emails = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getDisplayValues();

  const normalizedEmail = email.trim().toLowerCase();

  for (let i = 0; i < emails.length; i++) {
    if (
      emails[i][0].trim().toLowerCase() === normalizedEmail
    ) {
      return {
        row: i + 2,
        email: emails[i][0]
      };
    }
  }

  return null;
}


/* =========================================================
   GET PLAYER PROGRESS
========================================================= */

function getPlayerProgress(row) {
  const sheet = getSheet();

  const data = sheet
    .getRange(row, 3, 1, 4)
    .getValues()[0];

  return {
    commanderName: data[0] || "Commander",
    modesUnlock: data[1] || "Adventure",
    level: Number(data[2]) || 1,
    coinsCollected: Number(data[3]) || 0
  };
}


/* =========================================================
   REGISTER
========================================================= */

function registerPlayer(data) {
  const email = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "");
  const commanderName = String(data.commanderName || "").trim();

  if (!email || !password || !commanderName) {
    return {
      success: false,
      message: "Please complete all required fields."
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      success: false,
      message: "Please enter a valid email address."
    };
  }

  if (password.length < 12) {
    return {
      success: false,
      message: "Password must contain at least 12 characters."
    };
  }

  if (commanderName.length > 5) {
    return {
      success: false,
      message: "Commander name must be 5 characters or Higher."
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    if (findPlayer(email)) {
      return {
        success: false,
        message: "An account with this email already exists."
      };
    }

    const sheet = getSheet();

    const salt = Utilities.getUuid();
    const passwordHash = hashPassword(password, salt);

    // Store the salt and hash together in the Password column.
    const storedPassword = salt + ":" + passwordHash;

    sheet.appendRow([
      email,
      storedPassword,
      commanderName,
      "Adventure",
      1,
      0
    ]);

    return {
      success: true,
      message: "Account registered successfully.",
      progress: {
        commanderName: commanderName,
        modesUnlock: "Adventure",
        level: 1,
        coinsCollected: 0
      }
    };

  } finally {
    lock.releaseLock();
  }
}


/* =========================================================
   LOGIN
========================================================= */

function loginPlayer(data) {
  const email = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "");

  if (!email || !password) {
    return {
      success: false,
      message: "Email and password are required."
    };
  }

  const player = findPlayer(email);

  if (!player) {
    return {
      success: false,
      message: "Invalid email or password."
    };
  }

  const sheet = getSheet();

  const storedPassword = String(
    sheet.getRange(player.row, 2).getValue()
  );

  const parts = storedPassword.split(":");

  if (parts.length !== 2) {
    return {
      success: false,
      message: "Account password data is invalid."
    };
  }

  const salt = parts[0];
  const savedHash = parts[1];

  const inputHash = hashPassword(password, salt);

  if (inputHash !== savedHash) {
    return {
      success: false,
      message: "Invalid email or password."
    };
  }

  return {
    success: true,
    message: "Login successful.",
    email: player.email,
    progress: getPlayerProgress(player.row)
  };
}


/* =========================================================
   SAVE PLAYER PROGRESS
========================================================= */

function saveProgress(data) {
  const email = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "");

  const player = findPlayer(email);

  if (!player) {
    return {
      success: false,
      message: "Player account not found."
    };
  }

  const sheet = getSheet();

  const storedPassword = String(
    sheet.getRange(player.row, 2).getValue()
  );

  const parts = storedPassword.split(":");

  if (parts.length !== 2) {
    return {
      success: false,
      message: "Account password data is invalid."
    };
  }

  if (hashPassword(password, parts[0]) !== parts[1]) {
    return {
      success: false,
      message: "Authentication failed."
    };
  }

  const level = Number(data.level);
  const coins = Number(data.coinsCollected);

  if (
    !Number.isInteger(level) ||
    level < 1 ||
    !Number.isInteger(coins) ||
    coins < 0
  ) {
    return {
      success: false,
      message: "Invalid progress data."
    };
  }

  const commanderName = String(
    data.commanderName || ""
  ).trim();

  const modesUnlock = String(
    data.modesUnlock || "Adventure"
  ).trim();

  if (commanderName.length > 40 || modesUnlock.length > 200) {
    return {
      success: false,
      message: "Invalid commander name or mode data."
    };
  }

  sheet.getRange(player.row, 3, 1, 4).setValues([[
    commanderName,
    modesUnlock,
    level,
    coins
  ]]);

  return {
    success: true,
    message: "Progress saved successfully."
  };
}


/* =========================================================
   LOAD PLAYER PROGRESS
========================================================= */

function loadProgress(data) {
  const email = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "");

  const player = findPlayer(email);

  if (!player) {
    return {
      success: false,
      message: "Player account not found."
    };
  }

  const sheet = getSheet();

  const storedPassword = String(
    sheet.getRange(player.row, 2).getValue()
  );

  const parts = storedPassword.split(":");

  if (
    parts.length !== 2 ||
    hashPassword(password, parts[0]) !== parts[1]
  ) {
    return {
      success: false,
      message: "Authentication failed."
    };
  }

  return {
    success: true,
    message: "Progress loaded successfully.",
    progress: getPlayerProgress(player.row)
  };
}


/* =========================================================
   API ROUTER
========================================================= */

function doGet() {
  return jsonResponse({
    success: true,
    message: "Chrono-Front API is running."
  });
}


function doPost(e) {
  try {
    const data = JSON.parse(
      e.postData.contents
    );

    switch (data.action) {

      case "register":
        return jsonResponse(registerPlayer(data));

      case "login":
        return jsonResponse(loginPlayer(data));

      case "saveProgress":
        return jsonResponse(saveProgress(data));

      case "loadProgress":
        return jsonResponse(loadProgress(data));

      default:
        return jsonResponse({
          success: false,
          message: "Unknown action."
        });
    }

  } catch (error) {
    return jsonResponse({
      success: false,
      message: "Request failed.",
      error: String(error.message)
    });
  }
}
    Logger.log("doPost error: " + err.message);
    return jsonResponse({ success: false, message: "Request failed: " + err.message });
  }
}
