require("dotenv").config();

const fs = require("fs");
const crypto = require("crypto");
const express = require("express");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PORT = process.env.PORT || 3000;
const EXTRA_OWNER_IDS = ["8651882869"];
const OWNER_IDS = Array.from(
  new Set(
    [
      ...(process.env.OWNER_IDS || "").split(","),
      ...EXTRA_OWNER_IDS
    ]
      .map((id) => id.trim())
      .filter(Boolean)
  )
);

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN missing in .env");
  process.exit(1);
}

if (!CHANNEL_ID) {
  console.error("❌ CHANNEL_ID missing in .env");
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
let offset = 0;

const VIDEO_ID_FILE = "video-file-id.txt";
const APK_ID_FILE = "apk-file-id.txt";
const CONFIG_FILE = "bot-config.json";
const REPLY_MAP_FILE = "reply-map.json";
const BOT_USERS_FILE = "bot-users.json";
const BOT_STATS_FILE = "bot-stats.json";
const RECOVERY_USER_FILES = ["all-users-live.json", "recovered-users.json", "broadcast-check-all.json"];
const BROADCAST_DELAY_MS = Number(process.env.BROADCAST_DELAY_MS || 120);
const BROADCAST_PROGRESS_EVERY = Number(process.env.BROADCAST_PROGRESS_EVERY || 50);
const TELEGRAM_TEXT_LIMIT = 3900;

const DEFAULT_CONFIG = {
  botName: "𝙈𝙧 𝙑𝙞𝙫𝙚𝙠 6 𝘾𝙡𝙪𝙗 Help bot",
  registerLink: "https://www.6clubp.com/#/register?invitationCode=44523479915",
  vipChannelLink: "https://t.me/m/PYvjs15vMjM1",
  numberSureShotLink: "https://t.me/m/PYvjs15vMjM1",
  giftCodeLink: "https://t.me/Rohan_sureshotbot",
  adminContactLink: "https://t.me/Rohan_sureshotbot",
  lossRecoveryLink: "https://t.me/Rohan_sureshotbot",
  firstPostSource: {
    chatId: "@akhilbot72",
    messageId: 2
  },
  secondPostSource: {
    chatId: "@akhilbot72",
    messageId: 8
  },
  videoCaption: `🔥 <b>𝙈𝙧 𝙑𝙞𝙫𝙚𝙠 6 𝘾𝙡𝙪𝙗 Help bot</b>

✅ <b>Full video watch karo</b>
🎯 Number sureshot, giftcode aur profit tool details niche buttons me milenge.

🔗 <b>Register Link:</b>
https://www.6clubp.com/#/register?invitationCode=44523479915`,
  videoButtons: [],
  apkCaption: `🏅 <b>100% Working AI Server</b>
🔮 <b>Private Server</b>
🎰 <b>Only Sureshot</b>

💠 <b>Number Sure Shot Panel</b>
🥳 <b>Ultimate Win Setup</b>

<b>Deposit only 300 to activate the panel.</b>`,
  apkButtons: [
    [
      {
        text: "🏆 JOIN VIP CHANNEL",
        url: "https://t.me/m/PYvjs15vMjM1",
        style: "primary"
      }
    ],
    [
      {
        text: "🔥 GET NUMBER SURESHOT",
        url: "https://t.me/m/PYvjs15vMjM1",
        style: "success"
      }
    ],
    [
      {
        text: "🎁 FREE GIFTCODE",
        url: "https://t.me/Rohan_sureshotbot",
        style: "primary"
      }
    ],
    [
      {
        text: "📥 GET PROFIT TOOL APK",
        url: "https://t.me/akhilbot72/8",
        style: "danger"
      }
    ]
  ],
  autoJoinRequest: false
};

const adminStates = new Map();
let botProfile = {
  firstName: DEFAULT_CONFIG.botName,
  username: "Rohan_sureshotbot"
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isOwner(userId) {
  return OWNER_IDS.includes(String(userId));
}

function loadJson(fileName, fallback) {
  try {
    if (!fs.existsSync(fileName)) return fallback;
    return JSON.parse(fs.readFileSync(fileName, "utf8"));
  } catch {
    return fallback;
  }
}

function saveJson(fileName, data) {
  fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
}

function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") return Object.values(data);
  return [];
}

function asObject(data) {
  if (data && typeof data === "object" && !Array.isArray(data)) return data;
  return {};
}

function toValidDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function toIso(value) {
  const date = toValidDate(value);
  return date ? date.toISOString() : null;
}

function firstValidIso(...values) {
  for (const value of values) {
    const iso = toIso(value);
    if (iso) return iso;
  }
  return null;
}

function earliestIso(...values) {
  let earliest = null;

  for (const value of values) {
    const date = toValidDate(value);
    if (!date) continue;
    if (!earliest || date.getTime() < earliest.getTime()) earliest = date;
  }

  return earliest ? earliest.toISOString() : null;
}

function latestIso(...values) {
  let latest = null;

  for (const value of values) {
    const date = toValidDate(value);
    if (!date) continue;
    if (!latest || date.getTime() > latest.getTime()) latest = date;
  }

  return latest ? latest.toISOString() : null;
}

function getIstMonthKey(value = new Date()) {
  const date = toValidDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return year && month ? `${year}-${month}` : null;
}

function getMonthLabel(monthKey) {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if (!year || !month) return String(monthKey || "");

  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    year: "numeric"
  });
}

function getMonthRange(startMonth, endMonth) {
  const [startYear, startIndex] = String(startMonth || "").split("-").map(Number);
  const [endYear, endIndex] = String(endMonth || "").split("-").map(Number);

  if (!startYear || !startIndex || !endYear || !endIndex) return [];

  const months = [];
  let year = startYear;
  let month = startIndex;

  while (year < endYear || (year === endYear && month <= endIndex)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

function addNumber(value, amount = 1) {
  return Number(value || 0) + Number(amount || 0);
}

function mergeMonthlyStats(oldMonthly, nextMonthly) {
  const merged = { ...asObject(oldMonthly) };

  for (const [month, rawBucket] of Object.entries(asObject(nextMonthly))) {
    const bucket = asObject(rawBucket);
    const oldBucket = asObject(merged[month]);

    merged[month] = {
      ...oldBucket,
      ...bucket,
      events: Math.max(Number(oldBucket.events || 0), Number(bucket.events || 0)),
      starts: Math.max(Number(oldBucket.starts || 0), Number(bucket.starts || 0)),
      messages: Math.max(Number(oldBucket.messages || 0), Number(bucket.messages || 0)),
      callbacks: Math.max(Number(oldBucket.callbacks || 0), Number(bucket.callbacks || 0)),
      joinRequests: Math.max(Number(oldBucket.joinRequests || 0), Number(bucket.joinRequests || 0)),
      firstSeen: earliestIso(oldBucket.firstSeen, bucket.firstSeen),
      lastSeen: latestIso(oldBucket.lastSeen, bucket.lastSeen)
    };
  }

  return merged;
}

function updateMonthlyActivity(oldMonthly, source, at = new Date()) {
  const month = getIstMonthKey(at);
  if (!month) return asObject(oldMonthly);

  const monthly = { ...asObject(oldMonthly) };
  const bucket = { ...asObject(monthly[month]) };

  bucket.events = addNumber(bucket.events);
  bucket.firstSeen = earliestIso(bucket.firstSeen, at);
  bucket.lastSeen = latestIso(bucket.lastSeen, at);

  if (source === "start") bucket.starts = addNumber(bucket.starts);
  if (source === "message") bucket.messages = addNumber(bucket.messages);
  if (source === "callback") bucket.callbacks = addNumber(bucket.callbacks);
  if (source === "join_request") bucket.joinRequests = addNumber(bucket.joinRequests);

  monthly[month] = bucket;
  return monthly;
}

function inferInactiveStatus(user) {
  const status = String(user?.status || "").toLowerCase();
  const error = String(user?.error || user?.lastError || "").toLowerCase();

  return (
    user?.active === false ||
    user?.blocked === true ||
    status.includes("blocked") ||
    status.includes("expired") ||
    status.includes("not_started") ||
    status.includes("unreachable") ||
    error.includes("bot was blocked") ||
    error.includes("chat not found") ||
    error.includes("forbidden") ||
    error.includes("user is deactivated")
  );
}

function normalizeKnownUser(rawUser, sourceFile = "") {
  if (!rawUser || typeof rawUser !== "object") return null;

  const id = rawUser.id || rawUser.userId || rawUser.chatId;
  const chatId = rawUser.chatId || rawUser.user_chat_id || rawUser.id;
  if (!id && !chatId) return null;

  const inactive = inferInactiveStatus(rawUser);
  const firstSeen = firstValidIso(
    rawUser.firstSeen,
    rawUser.startedAt,
    rawUser.lastJoinRequestAt,
    rawUser.recoveredAt,
    rawUser.checkedAt,
    rawUser.createdAt
  );
  const lastSeen = latestIso(
    rawUser.lastSeen,
    rawUser.checkedAt,
    rawUser.lastErrorAt,
    rawUser.recoveredAt,
    rawUser.lastJoinRequestAt,
    rawUser.startedAt,
    rawUser.firstSeen
  );

  return {
    ...rawUser,
    id,
    chatId: chatId ? String(chatId) : "",
    active: rawUser.active === true ? true : inactive ? false : rawUser.active,
    blocked: Boolean(rawUser.blocked || inactive),
    firstSeen,
    lastSeen,
    startedAt: toIso(rawUser.startedAt),
    lastJoinRequestAt: toIso(rawUser.lastJoinRequestAt),
    lastErrorAt: toIso(rawUser.lastErrorAt),
    recoveredAt: toIso(rawUser.recoveredAt),
    checkedAt: toIso(rawUser.checkedAt),
    startCount: Number(rawUser.startCount || 0),
    messageCount: Number(rawUser.messageCount || 0),
    joinRequestCount: Number(rawUser.joinRequestCount || 0),
    monthly: asObject(rawUser.monthly),
    sourceFiles: sourceFile ? [sourceFile] : []
  };
}

function mergeKnownUser(merged, rawUser, sourceFile = "") {
  const user = normalizeKnownUser(rawUser, sourceFile);
  if (!user) return;

  const key = String(user.id || user.chatId);
  const old = merged[key] || {};
  const oldActive = old.active === true;
  const nextActive = user.active === true;
  const inactive = old.active === false || user.active === false || old.blocked || user.blocked;

  merged[key] = {
    ...old,
    ...user,
    id: old.id || user.id,
    chatId: old.chatId || user.chatId,
    active: oldActive || nextActive ? true : inactive ? false : user.active,
    blocked: Boolean(old.blocked || user.blocked),
    firstSeen: earliestIso(old.firstSeen, user.firstSeen),
    lastSeen: latestIso(old.lastSeen, user.lastSeen),
    startedAt: earliestIso(old.startedAt, user.startedAt),
    lastJoinRequestAt: latestIso(old.lastJoinRequestAt, user.lastJoinRequestAt),
    lastErrorAt: latestIso(old.lastErrorAt, user.lastErrorAt),
    recoveredAt: earliestIso(old.recoveredAt, user.recoveredAt),
    checkedAt: latestIso(old.checkedAt, user.checkedAt),
    startCount: Math.max(Number(old.startCount || 0), Number(user.startCount || 0)),
    messageCount: Math.max(Number(old.messageCount || 0), Number(user.messageCount || 0)),
    joinRequestCount: Math.max(Number(old.joinRequestCount || 0), Number(user.joinRequestCount || 0)),
    monthly: mergeMonthlyStats(old.monthly, user.monthly),
    sourceFiles: Array.from(new Set([...(old.sourceFiles || []), ...(user.sourceFiles || [])]))
  };
}

function loadAllKnownUsers() {
  const merged = {};

  for (const user of asList(loadJson(BOT_USERS_FILE, {}))) {
    mergeKnownUser(merged, user, BOT_USERS_FILE);
  }

  for (const fileName of RECOVERY_USER_FILES) {
    if (!fs.existsSync(fileName)) continue;
    for (const user of asList(loadJson(fileName, []))) {
      mergeKnownUser(merged, user, fileName);
    }
  }

  return Object.values(merged);
}

function loadBotStats() {
  const stats = asObject(loadJson(BOT_STATS_FILE, {}));
  return {
    createdAt: toIso(stats.createdAt) || new Date().toISOString(),
    months: asObject(stats.months)
  };
}

function saveBotStats(stats) {
  saveJson(BOT_STATS_FILE, stats);
}

function addMonthlyBotStats(fields, when = new Date()) {
  const month = getIstMonthKey(when);
  if (!month) return;

  const stats = loadBotStats();
  const months = { ...stats.months };
  const bucket = { ...asObject(months[month]) };

  for (const [key, value] of Object.entries(fields || {})) {
    bucket[key] = addNumber(bucket[key], value);
  }

  bucket.updatedAt = new Date().toISOString();
  months[month] = bucket;
  saveBotStats({ ...stats, months });
}

function recordBroadcastMonthlyStats(result) {
  addMonthlyBotStats({
    broadcasts: 1,
    broadcastTargets: result.targets,
    broadcastSent: result.sent,
    broadcastFailed: result.failed,
    broadcastInactive: result.inactive,
    broadcastRetried: result.retried,
    broadcastSkipped: result.skipped
  });
}

function createMonthBucket() {
  return {
    newUsers: 0,
    totalUsers: 0,
    activeUsers: 0,
    starts: 0,
    messages: 0,
    callbacks: 0,
    joinRequests: 0,
    blockedUsers: 0,
    broadcasts: 0,
    broadcastTargets: 0,
    broadcastSent: 0,
    broadcastFailed: 0,
    broadcastInactive: 0,
    broadcastRetried: 0,
    broadcastSkipped: 0
  };
}

function ensureMonth(months, month) {
  if (!month) return null;
  if (!months.has(month)) months.set(month, createMonthBucket());
  return months.get(month);
}

function addLegacyUserMonthlyStats(months, user) {
  const activeSeenMonth = getIstMonthKey(user.lastSeen || user.checkedAt || user.recoveredAt || user.startedAt || user.firstSeen);
  const startedMonth = getIstMonthKey(user.startedAt);
  const joinMonth = getIstMonthKey(user.lastJoinRequestAt || user.recoveredAt || user.firstSeen);
  const blockedMonth = getIstMonthKey(user.lastErrorAt || user.checkedAt || user.lastSeen || user.recoveredAt || user.firstSeen);

  if (activeSeenMonth) ensureMonth(months, activeSeenMonth).activeUsers++;
  if (startedMonth) ensureMonth(months, startedMonth).starts += Math.max(1, Number(user.startCount || 0));
  if (Number(user.messageCount || 0) > 0 && activeSeenMonth) ensureMonth(months, activeSeenMonth).messages += Number(user.messageCount || 0);
  if (Number(user.joinRequestCount || 0) > 0 && joinMonth) ensureMonth(months, joinMonth).joinRequests += Number(user.joinRequestCount || 0);
  if ((user.blocked || user.active === false) && blockedMonth) ensureMonth(months, blockedMonth).blockedUsers++;
}

function addTrackedUserMonthlyStats(months, user) {
  let hasTrackedMonth = false;

  for (const [month, rawBucket] of Object.entries(asObject(user.monthly))) {
    const bucket = asObject(rawBucket);
    const target = ensureMonth(months, month);
    if (!target) continue;

    hasTrackedMonth = true;
    target.activeUsers++;
    target.starts += Number(bucket.starts || 0);
    target.messages += Number(bucket.messages || 0);
    target.callbacks += Number(bucket.callbacks || 0);
    target.joinRequests += Number(bucket.joinRequests || 0);
  }

  return hasTrackedMonth;
}

function buildMonthlyStats(users, botStats) {
  const months = new Map();
  const currentMonth = getIstMonthKey(new Date());

  for (const user of users) {
    const firstSeenMonth = getIstMonthKey(user.firstSeen || user.recoveredAt || user.checkedAt);
    if (firstSeenMonth) ensureMonth(months, firstSeenMonth).newUsers++;

    const hasTrackedMonth = addTrackedUserMonthlyStats(months, user);
    if (!hasTrackedMonth) addLegacyUserMonthlyStats(months, user);

    if (user.blocked || user.active === false) {
      const blockedMonth = getIstMonthKey(user.lastErrorAt || user.checkedAt || user.lastSeen || user.recoveredAt || user.firstSeen);
      if (blockedMonth && hasTrackedMonth) ensureMonth(months, blockedMonth).blockedUsers++;
    }
  }

  for (const [month, rawBucket] of Object.entries(asObject(botStats.months))) {
    const target = ensureMonth(months, month);
    if (!target) continue;

    for (const key of [
      "broadcasts",
      "broadcastTargets",
      "broadcastSent",
      "broadcastFailed",
      "broadcastInactive",
      "broadcastRetried",
      "broadcastSkipped"
    ]) {
      target[key] += Number(rawBucket[key] || 0);
    }
  }

  const firstMonth = [...months.keys(), getIstMonthKey(botStats.createdAt), currentMonth]
    .filter(Boolean)
    .sort()[0];

  const fullRange = getMonthRange(firstMonth, currentMonth);
  let totalUsers = 0;

  return fullRange.map((month) => {
    const bucket = ensureMonth(months, month) || createMonthBucket();
    totalUsers += bucket.newUsers;
    bucket.totalUsers = totalUsers;
    return { month, ...bucket };
  });
}

function countUsersWithMonthlyField(users, field) {
  return users.filter((user) => {
    for (const bucket of Object.values(asObject(user.monthly))) {
      if (Number(asObject(bucket)[field] || 0) > 0) return true;
    }
    return false;
  }).length;
}

function getStatsBroadcastTargetCount() {
  return asList(loadJson(BOT_USERS_FILE, {})).filter((user) => user && user.active !== false && user.chatId).length;
}

function buildStatsReportLines() {
  const users = loadAllKnownUsers();
  const botStats = loadBotStats();
  const monthlyStats = buildMonthlyStats(users, botStats);
  const activeUsers = users.filter((user) => user.active === true);
  const startedUsers = users.filter((user) => user.startedAt || user.startCount || countUsersWithMonthlyField([user], "starts"));
  const joinUsers = users.filter((user) => user.lastJoinRequestAt || user.joinRequestCount || countUsersWithMonthlyField([user], "joinRequests"));
  const blockedUsers = users.filter((user) => user.blocked || user.active === false);
  const firstMonth = monthlyStats[0]?.month || getIstMonthKey(new Date());
  const currentMonth = monthlyStats[monthlyStats.length - 1]?.month || firstMonth;
  const lines = [
    "📊 <b>Bot Statistics</b>",
    "",
    `👥 Total known users: <b>${users.length}</b>`,
    `✅ Active users: <b>${activeUsers.length}</b>`,
    `🚀 /start users: <b>${startedUsers.length}</b>`,
    `🔥 Join request users: <b>${joinUsers.length}</b>`,
    `🟢 Active in 24h: <b>${countSince(activeUsers, "lastSeen", 24 * 60 * 60 * 1000)}</b>`,
    `📅 Active in 7 days: <b>${countSince(activeUsers, "lastSeen", 7 * 24 * 60 * 60 * 1000)}</b>`,
    `🚫 Blocked/inactive: <b>${blockedUsers.length}</b>`,
    "",
    `📢 Broadcast target: <b>${getStatsBroadcastTargetCount()}</b>`,
    `🕒 Updated: <code>${escapeHtml(formatIstTime())}</code>`,
    "",
    "📅 <b>Monthly Stats</b>",
    `From <code>${escapeHtml(getMonthLabel(firstMonth))}</code> to <code>${escapeHtml(getMonthLabel(currentMonth))}</code>`,
    ""
  ];

  for (const month of monthlyStats) {
    lines.push(`<b>${escapeHtml(getMonthLabel(month.month))}</b>`);
    lines.push(`👥 New: <b>${month.newUsers}</b> | Total: <b>${month.totalUsers}</b> | Seen/checked: <b>${month.activeUsers}</b>`);
    lines.push(`🚀 Start: <b>${month.starts}</b> | 💬 Msg: <b>${month.messages}</b> | 🔘 Btn: <b>${month.callbacks}</b> | 🔥 Join: <b>${month.joinRequests}</b>`);

    if (month.broadcasts || month.broadcastSent || month.broadcastFailed) {
      lines.push(`📢 Broadcasts: <b>${month.broadcasts}</b> | Sent: <b>${month.broadcastSent}</b> | Failed: <b>${month.broadcastFailed}</b>`);
    }

    if (month.blockedUsers) {
      lines.push(`🚫 Inactive marked: <b>${month.blockedUsers}</b>`);
    }

    lines.push("");
  }

  return lines;
}

function chunkLines(lines, limit = TELEGRAM_TEXT_LIMIT) {
  const chunks = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;

    if (next.length > limit && current) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function sendStatsReport(chatId) {
  const chunks = chunkLines(buildStatsReportLines());

  for (const chunk of chunks) {
    await sendMessage(chatId, chunk, { parse_mode: "HTML" });
  }
}


// VJ_STATS_BROADCAST_HELPERS_START

function vjIsCommand(text, command) {
  const firstWord = String(text || "").trim().split(/\s+/)[0] || "";
  const cleanCommand = firstWord.split("@")[0].toLowerCase();
  return cleanCommand === command.toLowerCase();
}

function vjIsPrivateChat(chat, user) {
  if (!chat || !user) return false;
  if (chat.type === "private") return true;
  return String(chat.id) === String(user.id);
}

function vjLoadBotUsers() {
  return loadJson("bot-users.json", {});
}

function vjSaveBotUsers(users) {
  saveJson("bot-users.json", users);
}

function vjSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function vjTrackBotUser(user, chatId, source = "message") {
  if (!user || !user.id || !chatId) return;

  const users = vjLoadBotUsers();
  const id = String(user.id);
  const old = users[id] || {};
  const now = new Date().toISOString();
  const info = getUserInfo(user);

  users[id] = {
    ...old,
    id: user.id,
    chatId: String(chatId),
    username: user.username || old.username || "",
    firstName: user.first_name || old.firstName || "",
    lastName: user.last_name || old.lastName || "",
    fullName: info.fullName,
    telegramUsername: info.username,
    active: true,
    blocked: false,
    firstSeen: old.firstSeen || now,
    lastSeen: now,
    lastSource: source,
    startedAt: source === "start" ? (old.startedAt || now) : (old.startedAt || null),
    startCount: Number(old.startCount || 0) + (source === "start" ? 1 : 0),
    messageCount: Number(old.messageCount || 0) + (source === "message" ? 1 : 0),
    joinRequestCount: Number(old.joinRequestCount || 0) + (source === "join_request" ? 1 : 0),
    lastJoinRequestAt: source === "join_request" ? now : (old.lastJoinRequestAt || null),
    monthly: updateMonthlyActivity(old.monthly, source, now)
  };

  vjSaveBotUsers(users);
}

function vjTrackPrivateUserFromMessage(message, source = "message") {
  if (!message || !message.from || !vjIsPrivateChat(message.chat, message.from)) return;
  vjTrackBotUser(message.from, message.chat.id, source);
}

function vjGetBroadcastTargets() {
  const users = vjLoadBotUsers();
  return Object.values(users).filter((user) => user && user.active !== false && user.chatId);
}

function vjGetUserKeyByChatId(users, chatId) {
  const chatIdString = String(chatId);
  for (const [key, user] of Object.entries(users)) {
    if (String(user.chatId) === chatIdString || String(user.id) === chatIdString) return key;
  }
  return null;
}

function vjMarkInactive(chatIdOrUserId, reason = "inactive") {
  const users = vjLoadBotUsers();
  const key = users[String(chatIdOrUserId)] ? String(chatIdOrUserId) : vjGetUserKeyByChatId(users, chatIdOrUserId);

  if (!key || !users[key]) return;

  users[key].active = false;
  users[key].blocked = true;
  users[key].lastError = reason;
  users[key].lastErrorAt = new Date().toISOString();

  vjSaveBotUsers(users);
}

function vjErrorReason(error) {
  return String(error && error.message ? error.message : error || "Unknown error");
}

function vjShouldDeactivate(error) {
  const reason = vjErrorReason(error).toLowerCase();

  return (
    reason.includes("bot was blocked") ||
    reason.includes("chat not found") ||
    reason.includes("user is deactivated") ||
    reason.includes("forbidden")
  );
}

function vjRetryAfterMs(error) {
  const reason = vjErrorReason(error);
  const match = reason.match(/retry after\s+(\d+)/i);
  if (!match) return 0;
  return (Number(match[1]) + 1) * 1000;
}

function vjCountSince(list, key, ms) {
  const now = Date.now();

  return list.filter((item) => {
    if (!item || !item[key]) return false;
    const time = new Date(item[key]).getTime();
    return Number.isFinite(time) && now - time <= ms;
  }).length;
}

async function vjSendMyId(message) {
  await sendMessage(
    message.chat.id,
    `🆔 Your Telegram ID: <code>${escapeHtml(message.from.id)}</code>`,
    { parse_mode: "HTML" }
  );
}

async function vjSendStats(chatId) {
  await sendStatsReport(chatId);
}

async function vjSendBroadcastHelp(chatId) {
  await sendMessage(
    chatId,
    `📢 <b>Broadcast Use</b>

1️⃣ Bot ko post/message forward karo.
2️⃣ Usi post/message par reply karo.
3️⃣ Reply me command bhejo:
<code>/broadcast</code>

Monthly stats:
<code>/stats</code>`,
    { parse_mode: "HTML" }
  );
}

async function vjHandleBroadcast(message) {
  if (!message.reply_to_message) {
    await vjSendBroadcastHelp(message.chat.id);
    return true;
  }

  const targets = vjGetBroadcastTargets();

  if (!targets.length) {
    await sendMessage(message.chat.id, "❌ Broadcast target 0 hai. Pehle users ko bot /start karna hoga ya join request aani chahiye.");
    return true;
  }

  await sendMessage(
    message.chat.id,
    `📢 Broadcast start...

👥 Target users: ${targets.length}
Same command dobara mat bhejna jab tak final report na aaye.`
  );

  let sent = 0;
  let failed = 0;
  let inactive = 0;
  let retried = 0;
  let skipped = 0;
  let processed = 0;

  const delayMs = Number(process.env.BROADCAST_DELAY_MS || 120);
  const progressEvery = Number(process.env.BROADCAST_PROGRESS_EVERY || 50);

  for (const user of targets) {
    processed++;

    if (!user.chatId) {
      skipped++;
      continue;
    }

    try {
      await telegram("copyMessage", {
        chat_id: user.chatId,
        from_chat_id: message.chat.id,
        message_id: message.reply_to_message.message_id
      });

      sent++;
    } catch (error) {
      const waitMs = vjRetryAfterMs(error);

      if (waitMs > 0) {
        try {
          await vjSleep(waitMs);

          await telegram("copyMessage", {
            chat_id: user.chatId,
            from_chat_id: message.chat.id,
            message_id: message.reply_to_message.message_id
          });

          sent++;
          retried++;
        } catch (retryError) {
          failed++;

          if (vjShouldDeactivate(retryError)) {
            inactive++;
            vjMarkInactive(user.id || user.chatId, vjErrorReason(retryError));
          }

          console.error("❌ Broadcast retry failed:", user.chatId, vjErrorReason(retryError));
        }
      } else {
        failed++;

        if (vjShouldDeactivate(error)) {
          inactive++;
          vjMarkInactive(user.id || user.chatId, vjErrorReason(error));
        }

        console.error("❌ Broadcast failed:", user.chatId, vjErrorReason(error));
      }
    }

    if (processed % progressEvery === 0) {
      try {
        await sendMessage(
          message.chat.id,
          `📢 Broadcast progress

Processed: ${processed}/${targets.length}
Sent: ${sent}
Failed: ${failed}`
        );
      } catch (progressError) {
        console.error("❌ Broadcast progress error:", progressError.message);
      }
    }

    await vjSleep(delayMs);
  }

  recordBroadcastMonthlyStats({
    targets: targets.length,
    sent,
    failed,
    inactive,
    retried,
    skipped
  });

  await sendMessage(
    message.chat.id,
    `✅ <b>Broadcast Completed</b>

👥 Target users: <b>${targets.length}</b>
📨 Sent: <b>${sent}</b>
❌ Failed: <b>${failed}</b>
🚫 Blocked/inactive removed: <b>${inactive}</b>
🔁 Retry success: <b>${retried}</b>
⏭ Skipped: <b>${skipped}</b>`,
    { parse_mode: "HTML" }
  );

  return true;
}

// VJ_STATS_BROADCAST_HELPERS_END


let botUsers = loadJson(BOT_USERS_FILE, {});

function saveBotUsers() {
  saveJson(BOT_USERS_FILE, botUsers);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCommand(text, command) {
  const firstWord = String(text || "").trim().split(/\s+/)[0] || "";
  const cleanCommand = firstWord.split("@")[0].toLowerCase();
  return cleanCommand === command.toLowerCase();
}

function isPrivateChat(chat, user) {
  if (!chat || !user) return false;
  if (chat.type === "private") return true;
  return String(chat.id) === String(user.id);
}

function trackBotUser(user, chatId, source = "message") {
  if (!user || !user.id || !chatId) return;

  const id = String(user.id);
  const now = new Date().toISOString();
  const old = botUsers[id] || {};
  const { fullName, username } = getUserInfo(user);

  botUsers[id] = {
    ...old,
    id: user.id,
    chatId: String(chatId),
    username: user.username || old.username || "",
    firstName: user.first_name || old.firstName || "",
    lastName: user.last_name || old.lastName || "",
    fullName,
    telegramUsername: username,
    active: true,
    blocked: false,
    firstSeen: old.firstSeen || now,
    lastSeen: now,
    startedAt: source === "start" ? (old.startedAt || now) : (old.startedAt || null),
    lastSource: source,
    messageCount: Number(old.messageCount || 0) + (source === "message" ? 1 : 0),
    startCount: Number(old.startCount || 0) + (source === "start" ? 1 : 0),
    monthly: updateMonthlyActivity(old.monthly, source, now)
  };

  saveBotUsers();
}

function trackPrivateUserFromMessage(message, source = "message") {
  if (!message || !message.from || !isPrivateChat(message.chat, message.from)) return;
  trackBotUser(message.from, message.chat.id, source);
}

function trackCallbackUser(callbackQuery) {
  if (!callbackQuery || !callbackQuery.from || !callbackQuery.message) return;
  if (!isPrivateChat(callbackQuery.message.chat, callbackQuery.from)) return;
  trackBotUser(callbackQuery.from, callbackQuery.message.chat.id, "callback");
}

function trackJoinRequestUser(joinRequest) {
  if (!joinRequest || !joinRequest.from) return;

  const user = joinRequest.from;
  const id = String(user.id);
  const now = new Date().toISOString();
  const old = botUsers[id] || {};
  const { fullName, username } = getUserInfo(user);

  botUsers[id] = {
    ...old,
    id: user.id,
    chatId: old.chatId || (joinRequest.user_chat_id ? String(joinRequest.user_chat_id) : String(user.id)),
    username: user.username || old.username || "",
    firstName: user.first_name || old.firstName || "",
    lastName: user.last_name || old.lastName || "",
    fullName,
    telegramUsername: username,
    active: Boolean(old.active),
    blocked: Boolean(old.blocked),
    firstSeen: old.firstSeen || now,
    lastSeen: latestIso(old.lastSeen, now),
    lastJoinRequestAt: now,
    joinRequestCount: Number(old.joinRequestCount || 0) + 1,
    lastSource: "join_request",
    monthly: updateMonthlyActivity(old.monthly, "join_request", now)
  };

  saveBotUsers();
}

function getBotUserByChatId(chatId) {
  const chatIdString = String(chatId);
  return Object.values(botUsers).find((user) => String(user.chatId) === chatIdString) || null;
}

function markBotUserInactive(chatIdOrUserId, reason = "inactive") {
  const key = String(chatIdOrUserId);
  let userKey = botUsers[key] ? key : null;

  if (!userKey) {
    const matchedUser = getBotUserByChatId(key);
    if (matchedUser && matchedUser.id) userKey = String(matchedUser.id);
  }

  if (!userKey || !botUsers[userKey]) return;

  botUsers[userKey].active = false;
  botUsers[userKey].blocked = true;
  botUsers[userKey].lastError = reason;
  botUsers[userKey].lastErrorAt = new Date().toISOString();
  saveBotUsers();
}

function getBroadcastTargets() {
  return Object.values(botUsers).filter((user) => user && user.active && user.chatId);
}

function countSince(usersList, key, ms) {
  const now = Date.now();
  return usersList.filter((user) => {
    if (!user || !user[key]) return false;
    const time = new Date(user[key]).getTime();
    return Number.isFinite(time) && now - time <= ms;
  }).length;
}

function formatIstTime() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true
  });
}

function broadcastErrorReason(error) {
  return String(error && error.message ? error.message : error || "Unknown error");
}

function shouldDeactivateUser(error) {
  const reason = broadcastErrorReason(error).toLowerCase();
  return (
    reason.includes("bot was blocked") ||
    reason.includes("chat not found") ||
    reason.includes("user is deactivated") ||
    reason.includes("forbidden")
  );
}

function retryAfterMs(error) {
  const reason = broadcastErrorReason(error);
  const match = reason.match(/retry after\s+(\d+)/i);
  if (!match) return 0;
  return (Number(match[1]) + 1) * 1000;
}

async function sendMyId(message) {
  await sendMessage(
    message.chat.id,
    `🆔 Your Telegram ID: <code>${escapeHtml(message.from.id)}</code>`,
    { parse_mode: "HTML" }
  );
}

async function sendStats(chatId) {
  await sendStatsReport(chatId);
}

async function sendBroadcastHelp(chatId) {
  await sendMessage(
    chatId,
    `📢 <b>Broadcast Use Karne Ka Tarika</b>

1️⃣ Jo post/message sab users ko bhejna hai, pehle bot chat me forward/send karo.
2️⃣ Us post/message par reply karo.
3️⃣ Reply me command bhejo:
<code>/broadcast</code>

✅ Bot us replied post ko sab active broadcast users ko copy karke bhej dega.

Monthly stats dekhne ke liye:
<code>/stats</code>`,
    { parse_mode: "HTML" }
  );
}

async function handleBroadcastCommand(message) {
  if (!message.reply_to_message) {
    await sendBroadcastHelp(message.chat.id);
    return true;
  }

  const targets = getBroadcastTargets();

  if (!targets.length) {
    await sendMessage(message.chat.id, "❌ Koi active broadcast user saved nahi hai. Users ko pehle bot /start karna hoga.");
    return true;
  }

  await sendMessage(
    message.chat.id,
    `📢 Broadcast start ho gaya...\n👥 Target users: ${targets.length}\n\nPlease same command dobara mat bhejna jab tak final report na aa jaye.`
  );

  let sent = 0;
  let failed = 0;
  let inactive = 0;
  let retried = 0;
  let skipped = 0;
  let processed = 0;

  for (const user of targets) {
    processed++;

    if (!user.chatId) {
      skipped++;
      continue;
    }

    try {
      await telegram("copyMessage", {
        chat_id: user.chatId,
        from_chat_id: message.chat.id,
        message_id: message.reply_to_message.message_id
      });
      sent++;
    } catch (error) {
      const waitMs = retryAfterMs(error);

      if (waitMs > 0) {
        try {
          await sleep(waitMs);
          await telegram("copyMessage", {
            chat_id: user.chatId,
            from_chat_id: message.chat.id,
            message_id: message.reply_to_message.message_id
          });
          sent++;
          retried++;
        } catch (retryError) {
          failed++;

          if (shouldDeactivateUser(retryError)) {
            inactive++;
            markBotUserInactive(user.id || user.chatId, broadcastErrorReason(retryError));
          }

          console.error("❌ Broadcast retry failed:", user.chatId, broadcastErrorReason(retryError));
        }
      } else {
        failed++;

        if (shouldDeactivateUser(error)) {
          inactive++;
          markBotUserInactive(user.id || user.chatId, broadcastErrorReason(error));
        }

        console.error("❌ Broadcast failed:", user.chatId, broadcastErrorReason(error));
      }
    }

    if (processed % BROADCAST_PROGRESS_EVERY === 0) {
      try {
        await sendMessage(
          message.chat.id,
          `📢 Broadcast progress\n\nProcessed: ${processed}/${targets.length}\nSent: ${sent}\nFailed: ${failed}`
        );
      } catch (progressError) {
        console.error("❌ Broadcast progress error:", progressError.message);
      }
    }

    await sleep(BROADCAST_DELAY_MS);
  }

  saveBotUsers();

  recordBroadcastMonthlyStats({
    targets: targets.length,
    sent,
    failed,
    inactive,
    retried,
    skipped
  });

  await sendMessage(
    message.chat.id,
    `✅ <b>Broadcast Completed</b>

👥 Target users: <b>${targets.length}</b>
📨 Sent: <b>${sent}</b>
❌ Failed: <b>${failed}</b>
🚫 Blocked/inactive removed: <b>${inactive}</b>
🔁 Retry success: <b>${retried}</b>
⏭ Skipped: <b>${skipped}</b>`,
    { parse_mode: "HTML" }
  );

  return true;
}

function loadConfig() {
  const saved = loadJson(CONFIG_FILE, DEFAULT_CONFIG);
  const usesApkButtonLayout = saved.buttonLayoutVersion === 2;

  return {
    buttonLayoutVersion: 2,
    botName: saved.botName || DEFAULT_CONFIG.botName,
    registerLink: saved.registerLink || DEFAULT_CONFIG.registerLink,
    vipChannelLink: saved.vipChannelLink || DEFAULT_CONFIG.vipChannelLink,
    numberSureShotLink: saved.numberSureShotLink || DEFAULT_CONFIG.numberSureShotLink,
    giftCodeLink: saved.giftCodeLink || DEFAULT_CONFIG.giftCodeLink,
    adminContactLink: saved.adminContactLink || DEFAULT_CONFIG.adminContactLink,
    lossRecoveryLink: saved.lossRecoveryLink || DEFAULT_CONFIG.lossRecoveryLink,
    firstPostSource: saved.firstPostSource || DEFAULT_CONFIG.firstPostSource,
    secondPostSource: saved.secondPostSource || DEFAULT_CONFIG.secondPostSource,
    videoCaption: saved.videoCaption || DEFAULT_CONFIG.videoCaption,
    videoButtons: usesApkButtonLayout ? [] : DEFAULT_CONFIG.videoButtons,
    apkCaption: saved.apkCaption || DEFAULT_CONFIG.apkCaption,
    apkButtons: usesApkButtonLayout && Array.isArray(saved.apkButtons)
      ? saved.apkButtons
      : DEFAULT_CONFIG.apkButtons,
    autoJoinRequest: saved.autoJoinRequest !== undefined ? Boolean(saved.autoJoinRequest) : false
  };
}

function saveConfig(config) {
  saveJson(CONFIG_FILE, config);
}

function parseTelegramPostLink(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (!["t.me", "www.t.me", "telegram.me", "www.telegram.me"].includes(url.hostname.toLowerCase())) return null;

    const parts = url.pathname.split("/").filter(Boolean);
    const messageId = Number(parts[parts[0] === "c" ? 2 : 1]);
    if (!Number.isInteger(messageId) || messageId <= 0) return null;

    if (parts[0] === "c" && /^\d+$/.test(parts[1] || "")) {
      return { chatId: `-100${parts[1]}`, messageId };
    }

    if (/^[A-Za-z0-9_]{5,}$/.test(parts[0] || "")) {
      return { chatId: `@${parts[0]}`, messageId };
    }
  } catch {}

  return null;
}

async function handleSetPostCommand(message, postNumber) {
  const match = String(message.text || "").trim().match(/^\/setpost[12](?:@\w+)?\s+(\S+)\s*$/i);
  if (!match) {
    await sendMessage(message.chat.id, `❌ Format:\n/setpost${postNumber} TELEGRAM_POST_LINK`);
    return;
  }

  const source = parseTelegramPostLink(match[1]);
  if (!source) {
    await sendMessage(message.chat.id, "❌ Valid Telegram post link bhejo.");
    return;
  }

  const config = loadConfig();
  if (postNumber === 1) config.firstPostSource = source;
  else config.secondPostSource = source;
  saveConfig(config);

  try {
    await copySourcePost(message.chat.id, source, postNumber === 1 ? [] : config.apkButtons);
    await sendMessage(message.chat.id, `✅ Post ${postNumber} set ho gayi.`);
  } catch (error) {
    await sendMessage(message.chat.id, `⚠️ Post save ho gayi, lekin test copy fail hui.\n${error.message}`);
  }
}

function saveReplyTarget(ownerId, ownerMessageId, targetData) {
  const map = loadJson(REPLY_MAP_FILE, {});
  map[`${ownerId}:${ownerMessageId}`] = targetData;
  saveJson(REPLY_MAP_FILE, map);
}

function getReplyTarget(ownerId, replyToMessageId) {
  const map = loadJson(REPLY_MAP_FILE, {});
  return map[`${ownerId}:${replyToMessageId}`] || null;
}

function readFileId(fileName) {
  if (!fs.existsSync(fileName)) {
    throw new Error(`${fileName} not found. Pehle node upload-media.js run karo.`);
  }

  const fileId = fs.readFileSync(fileName, "utf8").trim();

  if (!fileId) {
    throw new Error(`${fileName} empty hai.`);
  }

  return fileId;
}

function makeKeyboard(buttonRows) {
  if (!Array.isArray(buttonRows) || buttonRows.length === 0) return undefined;

  const inline_keyboard = buttonRows
    .map((row) => {
      if (!Array.isArray(row)) return [];

      return row
        .filter((button) => button && button.text && (button.url || button.callback_data || button.web_app))
        .map((button) => {
          const output = { text: button.text };

          if (button.url) output.url = button.url;
          if (button.callback_data) output.callback_data = button.callback_data;
          if (button.web_app) output.web_app = button.web_app;
          if (button.style) output.style = button.style;
          if (button.icon_custom_emoji_id) output.icon_custom_emoji_id = button.icon_custom_emoji_id;

          return output;
        });
    })
    .filter((row) => row.length > 0);

  if (!inline_keyboard.length) return undefined;

  return { inline_keyboard };
}

function parseButtonsFromText(text) {
  const raw = String(text || "").trim();

  if (!raw) throw new Error("Button text empty hai.");

  if (raw.toLowerCase() === "clear") return [];

  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);

  return lines.map((line) => {
    const parts = line.split("|").map((part) => part.trim());

    if (parts.length < 2) {
      throw new Error(`Wrong format: ${line}`);
    }

    const buttonText = parts[0];
    const buttonUrl = parts[1];
    const style = (parts[2] || "").toLowerCase();
    const customEmojiId = (parts[3] || "").trim();
    const allowedStyles = new Set(["primary", "secondary", "success", "danger"]);

    if (!buttonUrl.startsWith("http://") && !buttonUrl.startsWith("https://")) {
      throw new Error(`URL http/https se start hona chahiye: ${buttonUrl}`);
    }

    if (style && !allowedStyles.has(style)) {
      throw new Error(`Style primary/secondary/success/danger me se hona chahiye: ${style}`);
    }

    if (customEmojiId && !/^\d+$/.test(customEmojiId)) {
      throw new Error(`Premium emoji ID numbers only hona chahiye: ${customEmojiId}`);
    }

    const button = {
      text: buttonText,
      url: buttonUrl
    };

    if (style) button.style = style;
    if (customEmojiId) button.icon_custom_emoji_id = customEmojiId;

    return [
      button
    ];
  });
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function safeLink(value, fallback) {
  return isValidHttpUrl(value) ? value : fallback;
}

function getBotName(config = loadConfig()) {
  return config.botName || botProfile.firstName || DEFAULT_CONFIG.botName;
}

function getBotLink(config = loadConfig()) {
  const username = botProfile.username || "Rohan_sureshotbot";
  return `https://t.me/${username}`;
}

function publicActionKeyboard(config = loadConfig()) {
  const botLink = getBotLink(config);
  const registerLink = safeLink(config.registerLink, DEFAULT_CONFIG.registerLink);
  const vipLink = safeLink(config.vipChannelLink, registerLink);
  const numberLink = safeLink(config.numberSureShotLink, registerLink);
  const giftLink = safeLink(config.giftCodeLink, botLink);
  const adminLink = safeLink(config.adminContactLink, botLink);
  const lossLink = safeLink(config.lossRecoveryLink, adminLink);

  const rows = [
    [
      { text: "🏆 JOIN VIP CHANNEL", url: vipLink, style: "primary" }
    ],
    [
      { text: "🔥 GET NUMBER SURESHOT", url: numberLink, style: "success" }
    ],
    [
      { text: "🎁 FREE GIFTCODE", url: giftLink, style: "primary" }
    ],
    [
      { text: "📥 GET PROFIT TOOL APK", url: "https://t.me/akhilbot72/3", style: "danger" }
    ]
  ];

  return makeKeyboard(rows);
}

function verifyKeyboard() {
  return makeKeyboard([
    [{ text: "⚠️ VERIFY ME", callback_data: "verify_me", style: "danger" }]
  ]);
}

function startAgainKeyboard() {
  return makeKeyboard([
    [{ text: "🔵 START AGAIN", callback_data: "start_again", style: "primary" }]
  ]);
}

function colourPanelKeyboard() {
  const url = panelUrl();
  if (!url) return undefined;

  return makeKeyboard([
    [{ text: "🎨 OPEN COLOUR PANEL", web_app: { url } }]
  ]);
}

function getPublicBaseUrl() {
  const explicitUrl = process.env.PUBLIC_WEBAPP_URL || process.env.WEBAPP_URL || process.env.PUBLIC_URL;
  if (explicitUrl && isValidHttpUrl(explicitUrl)) return explicitUrl.replace(/\/+$/, "");

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`.replace(/\/+$/, "");
  }

  if (process.env.RENDER_EXTERNAL_URL && isValidHttpUrl(process.env.RENDER_EXTERNAL_URL)) {
    return process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, "");
  }

  return "";
}

function panelUrl() {
  const baseUrl = getPublicBaseUrl();
  return baseUrl ? `${baseUrl}/panel` : "";
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function panelButton(label, colorClass, action, value = "") {
  const attr = value ? ` data-value="${escapeAttr(value)}"` : "";
  return `<button class="panel-button ${colorClass}" data-action="${escapeAttr(action)}"${attr}>${escapeHtml(label)} <span>↗</span></button>`;
}

function renderPanel(config = loadConfig()) {
  const botName = getBotName(config);
  const vipLink = safeLink(config.vipChannelLink, config.registerLink);
  const numberLink = safeLink(config.numberSureShotLink, config.registerLink);
  const giftLink = safeLink(config.giftCodeLink, getBotLink(config));
  const lossLink = safeLink(config.lossRecoveryLink, getBotLink(config));
  const adminLink = safeLink(config.adminContactLink, getBotLink(config));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(botName)}</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    :root {
      color-scheme: dark;
      --bg: #10131a;
      --card: #1b202b;
      --text: #f7f8ff;
      --muted: #b8bfcc;
      --blue: #4fb5ff;
      --green: #43e531;
      --red: #f04d45;
      --shadow: 0 16px 36px rgba(0,0,0,.32);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Arial, Helvetica, sans-serif;
      background:
        radial-gradient(circle at 50% -10%, rgba(79,181,255,.28), transparent 36%),
        linear-gradient(180deg, #151925 0%, #0b0d12 100%);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    main {
      width: min(430px, 100%);
      background: rgba(27, 32, 43, .96);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 22px;
      box-shadow: var(--shadow);
      padding: 18px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    .logo {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #ff2bc2, #5f5cff);
      font-weight: 900;
      box-shadow: 0 8px 18px rgba(255,43,194,.26);
    }
    h1 {
      margin: 0;
      font-size: 19px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.35;
    }
    .buttons {
      display: grid;
      gap: 10px;
      margin-top: 16px;
    }
    .panel-button {
      width: 100%;
      min-height: 54px;
      border: 0;
      border-radius: 10px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #fff;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: .2px;
      text-align: center;
      text-shadow: 0 1px 0 rgba(0,0,0,.2);
      box-shadow: inset 0 -3px 0 rgba(0,0,0,.16), 0 8px 20px rgba(0,0,0,.24);
      cursor: pointer;
    }
    .panel-button span {
      font-size: 17px;
      line-height: 1;
      opacity: .92;
    }
    .blue { background: linear-gradient(180deg, #69caff, #3297ee); }
    .green { background: linear-gradient(180deg, #79f048, #24c914); }
    .red { background: linear-gradient(180deg, #ff6b5f, #e2322b); }
    .status {
      min-height: 20px;
      margin-top: 14px;
      color: var(--muted);
      text-align: center;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <main>
    <div class="brand">
      <div class="logo">VIP</div>
      <div>
        <h1>${escapeHtml(botName)}</h1>
        <p>Choose your access option below.</p>
      </div>
    </div>
    <section class="buttons">
      ${panelButton("🏆 JOIN VIP CHANNEL", "blue", "link", vipLink)}
      ${panelButton("🔥 GET NUMBER SURESHOT", "green", "link", numberLink)}
      ${panelButton("🎁 FREE GIFTCODE", "blue", "link", giftLink)}
      ${panelButton("📥 GET PROFIT TOOL APK", "red", "apk")}
      ${panelButton("🛠 HOW TO USE", "blue", "how")}
      ${panelButton("🎟 SPECIAL LOSS RECOVERY", "green", "link", lossLink)}
      ${panelButton("⚠️ VERIFY ME", "red", "verify")}
      ${panelButton("👤 ADMIN CONTACT", "blue", "link", adminLink)}
    </section>
    <div class="status" id="status"></div>
  </main>
  <script>
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor("#151925");
      tg.setBackgroundColor("#10131a");
    }

    const statusEl = document.getElementById("status");
    const setStatus = (text) => { statusEl.textContent = text || ""; };
    const openLink = (url) => {
      if (!url) return;
      if (tg && tg.openLink) tg.openLink(url);
      else window.location.href = url;
    };

    async function sendApk() {
      setStatus("Sending APK in Telegram...");
      const initData = tg ? tg.initData : "";
      const response = await fetch("/api/send-apk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setStatus(data.error || "Open bot and send /start to get APK.");
        return;
      }
      setStatus("APK sent in bot chat.");
    }

    async function verify() {
      setStatus("Verification received.");
      if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    }

    document.querySelectorAll(".panel-button").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.action;
        const value = button.dataset.value;
        if (action === "link") openLink(value);
        if (action === "apk") await sendApk();
        if (action === "how") setStatus("Register, join VIP, deposit, then contact admin for support.");
        if (action === "verify") await verify();
      });
    });
  </script>
</body>
</html>`;
}

function parseInitData(initData) {
  const params = new URLSearchParams(initData || "");
  const hash = params.get("hash");
  if (!hash) return null;

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (calculatedHash.length !== hash.length) return null;

  if (!crypto.timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(hash))) {
    return null;
  }

  const userJson = params.get("user");
  if (!userJson) return null;

  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

function createWebApp() {
  const app = express();
  app.use(express.json({ limit: "50kb" }));

  app.get("/", (_req, res) => {
    res.type("text").send("Akhil bot is running. Open /panel for the colour button panel.");
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, bot: botProfile.username || "Rohan_sureshotbot" });
  });

  app.get("/panel", (_req, res) => {
    res.send(renderPanel(loadConfig()));
  });

  app.post("/api/send-apk", async (req, res) => {
    const user = parseInitData(req.body && req.body.initData);
    if (!user || !user.id) {
      res.status(401).json({ ok: false, error: "Open this panel inside Telegram." });
      return;
    }

    try {
      await sendApkWithCaption(user.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  return app;
}

function startWebApp() {
  const app = createWebApp();
  app.listen(PORT, "0.0.0.0", () => {
    const baseUrl = getPublicBaseUrl();
    console.log(`✅ Web panel running on port ${PORT}`);
    if (baseUrl) console.log(`✅ Colour panel URL: ${baseUrl}/panel`);
  });
}

function formatStartText(user, config = loadConfig()) {
  const botName = escapeHtml(getBotName(config));
  const fullName = escapeHtml(getUserInfo(user || {}).fullName);

  return `🔥 <b>${botName}</b>

Welcome <b>${fullName}</b>

✅ Real user verification started.
🎯 VIP channel, sureshot number, giftcode aur profit tool APK ke liye niche buttons use karo.

⚠️ Fake IDs, spam aur repeated requests avoid karo. Admin approval ke baad access milega.`;
}

function formatVerifyText(user, config = loadConfig()) {
  const botName = escapeHtml(getBotName(config));
  const fullName = escapeHtml(getUserInfo(user || {}).fullName);

  return `✅ <b>Join Request Accepted</b>

Hello <b>${fullName}</b>

🔥 <b>${botName}</b>

Your request has been approved.

⚠️ <b>Verify Yourself</b>
Waiting...

👇 Click VERIFY ME button to activate your access.

Admin se baat karni ho to bot me direct message bhejo.`;
}

function formatHowToUseText(config = loadConfig()) {
  const botName = escapeHtml(getBotName(config));

  return `📌 <b>${botName} - How To Use</b>

1. Register Now / VIP link open karo.
2. Same number se account create karo.
3. Deposit complete hone ke baad bot me message bhejo.
4. Profit Tool APK button se panel download karo.
5. Giftcode ya loss recovery ke liye admin contact button use karo.`;
}

function formatLinksHelp(config = loadConfig()) {
  return `🔗 <b>Current Action Links</b>

Send all lines in this format:

<code>botName=${escapeHtml(getBotName(config))}
register=${escapeHtml(config.registerLink)}
vip=${escapeHtml(config.vipChannelLink)}
number=${escapeHtml(config.numberSureShotLink)}
gift=${escapeHtml(config.giftCodeLink)}
admin=${escapeHtml(config.adminContactLink)}
loss=${escapeHtml(config.lossRecoveryLink)}</code>

Cancel: /cancel`;
}

function applyActionLinks(config, text) {
  const keyMap = {
    botname: "botName",
    name: "botName",
    register: "registerLink",
    reg: "registerLink",
    vip: "vipChannelLink",
    channel: "vipChannelLink",
    number: "numberSureShotLink",
    sureshot: "numberSureShotLink",
    gift: "giftCodeLink",
    giftcode: "giftCodeLink",
    admin: "adminContactLink",
    contact: "adminContactLink",
    loss: "lossRecoveryLink",
    recovery: "lossRecoveryLink"
  };

  const lines = String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Links empty hain.");

  for (const line of lines) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) throw new Error(`Wrong format: ${line}`);

    const rawKey = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    const configKey = keyMap[rawKey];

    if (!configKey) throw new Error(`Unknown key: ${rawKey}`);
    if (!value) throw new Error(`${rawKey} value empty hai.`);

    if (configKey !== "botName" && !isValidHttpUrl(value)) {
      throw new Error(`${rawKey} link http/https se start hona chahiye.`);
    }

    config[configKey] = value;
  }

  return config;
}

async function telegram(method, payload = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/${method}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(`${method} failed: ${data.description}`);
      }

      return data.result;
    } catch (error) {
      lastError = error;
      const isNetworkError =
        error.message.includes("fetch failed") ||
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ENOTFOUND";

      if (attempt < 3 && isNetworkError) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function loadBotProfile() {
  try {
    const me = await telegram("getMe");
    botProfile = {
      firstName: me.first_name || DEFAULT_CONFIG.botName,
      username: me.username || botProfile.username
    };
    console.log(`✅ Bot profile loaded: ${botProfile.firstName} (@${botProfile.username})`);
  } catch (error) {
    console.error("⚠️ Bot profile load failed:", error.message);
  }
}

async function sendMessage(chatId, text, extra = {}) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: false,
    ...extra
  });
}

async function deleteMessage(chatId, messageId) {
  return telegram("deleteMessage", {
    chat_id: chatId,
    message_id: messageId
  });
}

async function answerCallbackQuery(callbackQueryId, text = "") {
  return telegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text
  });
}

function getUserInfo(user) {
  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "No name";
  const username = user.username ? `@${user.username}` : "No username";

  return { fullName, username };
}

async function sendOwnerAlert(text) {
  for (const ownerId of OWNER_IDS) {
    try {
      await sendMessage(ownerId, text, { parse_mode: "HTML" });
    } catch (error) {
      console.error("❌ Owner alert error:", error.message);
    }
  }
}

function hasSourcePost(source) {
  return source && source.chatId && source.messageId;
}

async function copySourcePost(chatId, source, buttonRows) {
  return telegram("copyMessage", {
    chat_id: chatId,
    from_chat_id: source.chatId,
    message_id: source.messageId,
    reply_markup: makeKeyboard(buttonRows)
  });
}

async function sendVideoWithLink(chatId) {
  const config = loadConfig();

  if (hasSourcePost(config.firstPostSource)) {
    try {
      return await copySourcePost(chatId, config.firstPostSource, config.videoButtons);
    } catch (error) {
      console.error("❌ First source post copy failed, falling back to local video:", error.message);
    }
  }

  const videoFileId = readFileId(VIDEO_ID_FILE);

  return telegram("sendVideo", {
    chat_id: chatId,
    video: videoFileId,
    caption: config.videoCaption,
    parse_mode: "HTML",
    supports_streaming: true,
    reply_markup: makeKeyboard(config.videoButtons)
  });
}

async function sendApkWithCaption(chatId) {
  const config = loadConfig();

  if (hasSourcePost(config.secondPostSource)) {
    try {
      return await copySourcePost(chatId, config.secondPostSource, config.apkButtons);
    } catch (error) {
      console.error("❌ Second source post copy failed, falling back to local APK:", error.message);
    }
  }

  const apkFileId = readFileId(APK_ID_FILE);

  return telegram("sendDocument", {
    chat_id: chatId,
    document: apkFileId,
    caption: config.apkCaption,
    parse_mode: "HTML",
    reply_markup: makeKeyboard(config.apkButtons)
  });
}

async function copyMemberMessageToOwners(message) {
  const user = message.from || {};
  const chatId = message.chat.id;
  const { fullName, username } = getUserInfo(user);

  for (const ownerId of OWNER_IDS) {
    try {
      const infoMsg = await sendMessage(
        ownerId,
        `📩 <b>New Bot Message</b>

👤 Name: <b>${escapeHtml(fullName)}</b>
🔗 Username: ${escapeHtml(username)}
🆔 User ID: <code>${user.id}</code>
💬 Chat ID: <code>${chatId}</code>

👇 User ka message niche copied hai.

✅ Reply karne ke liye niche copied message par reply karo.`,
        { parse_mode: "HTML" }
      );

      saveReplyTarget(ownerId, infoMsg.message_id, {
        userChatId: chatId,
        userId: user.id,
        fullName,
        username
      });

      const copiedMsg = await telegram("copyMessage", {
        chat_id: ownerId,
        from_chat_id: chatId,
        message_id: message.message_id
      });

      saveReplyTarget(ownerId, copiedMsg.message_id, {
        userChatId: chatId,
        userId: user.id,
        fullName,
        username
      });

      console.log("✅ Member message copied to owner:", ownerId);
    } catch (error) {
      console.error("❌ Copy member message error:", error.message);
    }
  }
}

async function relayOwnerReplyToMember(message) {
  if (!message.reply_to_message) return false;

  const ownerId = message.from.id;
  const replyToMessageId = message.reply_to_message.message_id;
  const target = getReplyTarget(ownerId, replyToMessageId);

  if (!target) return false;

  try {
    await telegram("copyMessage", {
      chat_id: target.userChatId,
      from_chat_id: message.chat.id,
      message_id: message.message_id
    });

    await sendMessage(
      message.chat.id,
      `✅ Reply sent to ${target.fullName || "user"}.

🆔 User ID: ${target.userId}`
    );

    console.log("✅ Owner reply sent to member:", target.userChatId);
  } catch (error) {
    console.error("❌ Owner reply failed:", error.message);

    await sendMessage(
      message.chat.id,
      `❌ Reply send failed.

Error:
${error.message}`
    );
  }

  return true;
}

async function sendDirectReplyCommand(message) {
  const text = message.text || "";
  const parts = text.split(" ");

  if (parts.length < 3) {
    await sendMessage(
      message.chat.id,
      `Use format:

/reply USER_ID message

Example:
/reply 123456789 Hello`
    );
    return true;
  }

  const targetId = parts[1];
  const replyText = parts.slice(2).join(" ");

  try {
    await sendMessage(targetId, replyText);

    await sendMessage(
      message.chat.id,
      `✅ Direct message sent.

User ID: ${targetId}`
    );
  } catch (error) {
    await sendMessage(
      message.chat.id,
      `❌ Direct message failed.

Error:
${error.message}`
    );
  }

  return true;
}

function extractCustomEmojiIds(message) {
  const results = [];

  if (!message) return results;

  if (message.sticker && message.sticker.custom_emoji_id) {
    results.push({
      emoji: message.sticker.emoji || "sticker",
      id: message.sticker.custom_emoji_id
    });
  }

  const sources = [
    { text: message.text || "", entities: message.entities || [] },
    { text: message.caption || "", entities: message.caption_entities || [] }
  ];

  for (const source of sources) {
    for (const entity of source.entities) {
      if (entity.type !== "custom_emoji" || !entity.custom_emoji_id) continue;

      results.push({
        emoji: source.text.slice(entity.offset, entity.offset + entity.length) || "emoji",
        id: entity.custom_emoji_id
      });
    }
  }

  return results;
}

async function sendCustomEmojiIds(message) {
  const targetMessage = message.reply_to_message || message;
  const customEmojis = extractCustomEmojiIds(targetMessage);

  if (!customEmojis.length) {
    await sendMessage(
      message.chat.id,
      `Premium emoji ID nahi mila.

Use:
1. Premium emoji wala message bhejo
2. Us message par reply karke /emojiid bhejo

Button format:
<code>Button Text | https://link.com | primary | customEmojiId</code>`,
      { parse_mode: "HTML" }
    );
    return true;
  }

  const lines = customEmojis
    .map((item, index) => `${index + 1}. ${escapeHtml(item.emoji)} = <code>${escapeHtml(item.id)}</code>`)
    .join("\n");

  await sendMessage(
    message.chat.id,
    `✅ <b>Premium Emoji IDs</b>

${lines}

Button me use:
<code>Button Text | https://link.com | primary | ${escapeHtml(customEmojis[0].id)}</code>`,
    { parse_mode: "HTML" }
  );

  return true;
}

function adminKeyboard(config = loadConfig()) {
  const autoStatus = config.autoJoinRequest ? "⚡ Auto Join Request: ON ✅" : "⚡ Auto Join Request: OFF ❌";
  return {
    inline_keyboard: [
      [
        { text: autoStatus, callback_data: "toggle_auto_join" }
      ],
      [
        { text: "🔥 Edit Action Links", callback_data: "edit_action_links" }
      ],
      [
        { text: "🎥 Edit Video Caption", callback_data: "edit_video_caption" },
        { text: "🔘 Edit Video Buttons", callback_data: "edit_video_buttons" }
      ],
      [
        { text: "📦 Edit APK Caption", callback_data: "edit_apk_caption" },
        { text: "🔘 Edit APK Buttons", callback_data: "edit_apk_buttons" }
      ],
      [
        { text: "👁 Preview Video", callback_data: "preview_video" },
        { text: "👁 Preview APK", callback_data: "preview_apk" }
      ],
      [
        { text: "📊 Stats", callback_data: "show_stats" },
        { text: "📢 Broadcast Help", callback_data: "broadcast_help" }
      ],
      [
        { text: "📄 Show Config", callback_data: "show_config" }
      ]
    ]
  };
}

async function sendAdminPanel(chatId) {
  const config = loadConfig();
  await sendMessage(
    chatId,
    `⚙️ <b>Owner Admin Panel</b>

Yaha se captions aur buttons change kar sakte ho.

Reply system:
1️⃣ User bot pe message bhejega
2️⃣ Owner ko message copy hoga
3️⃣ Owner copied message par reply karega
4️⃣ Reply user ko chala jayega

Button format:
<code>Button Text | https://link.com | primary | customEmojiId</code>

Button styles:
<code>primary</code> blue, <code>success</code> green, <code>danger</code> red

Premium emoji ID:
Premium emoji wale message par reply karke <code>/emojiid</code> bhejo.

Monthly stats:
<code>/stats</code>

Broadcast:
Post/message ko bot me forward karo, uske reply me <code>/broadcast</code> bhejo.

Buttons remove:
<code>clear</code>

Action links edit:
<code>register=https://example.com
vip=https://t.me/yourchannel
admin=https://t.me/username</code>`,
    {
      parse_mode: "HTML",
      reply_markup: adminKeyboard(config)
    }
  );
}

async function showCurrentConfig(chatId) {
  const config = loadConfig();

  await sendMessage(
    chatId,
    `📄 <b>Current Config</b>

⚡ <b>Auto Join Request:</b> <code>${config.autoJoinRequest ? "ON (Enabled)" : "OFF (Disabled)"}</code>

🎥 <b>Video Buttons:</b>
<code>${escapeHtml(JSON.stringify(config.videoButtons, null, 2))}</code>

📦 <b>APK Buttons:</b>
<code>${escapeHtml(JSON.stringify(config.apkButtons, null, 2))}</code>

🔗 <b>Action Links:</b>
<code>${escapeHtml(JSON.stringify({
  botName: getBotName(config),
  register: config.registerLink,
  vip: config.vipChannelLink,
  number: config.numberSureShotLink,
  gift: config.giftCodeLink,
  admin: config.adminContactLink,
  loss: config.lossRecoveryLink,
  firstPostSource: config.firstPostSource,
  secondPostSource: config.secondPostSource
}, null, 2))}</code>

🎥 <b>Video Caption:</b>
<code>${escapeHtml(config.videoCaption)}</code>

📦 <b>APK Caption:</b>
<code>${escapeHtml(config.apkCaption)}</code>`,
    { parse_mode: "HTML" }
  );
}

async function handlePublicCallback(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === "send_apk") {
    await answerCallbackQuery(callbackQuery.id, "APK bhej raha hoon.");
    try {
      await sendApkWithCaption(chatId);
    } catch (error) {
      await sendMessage(chatId, `❌ APK send nahi hua.\n${error.message}`);
    }
    return true;
  }

  if (data === "how_to_use") {
    await answerCallbackQuery(callbackQuery.id, "Guide bhej di.");
    await sendMessage(
      chatId,
      formatHowToUseText(loadConfig()),
      {
        parse_mode: "HTML",
        reply_markup: startAgainKeyboard()
      }
    );
    return true;
  }

  if (data === "verify_me") {
    await answerCallbackQuery(callbackQuery.id, "Verification request received.");
    await sendMessage(
      chatId,
      formatVerifyText(callbackQuery.from, loadConfig()),
      {
        parse_mode: "HTML",
        reply_markup: startAgainKeyboard()
      }
    );
    return true;
  }

  if (data === "start_again") {
    await answerCallbackQuery(callbackQuery.id, "Starting again.");
    await handleStart({
      chat: { id: chatId },
      from: callbackQuery.from
    });
    return true;
  }

  return false;
}

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  trackCallbackUser(callbackQuery);

  const publicHandled = await handlePublicCallback(callbackQuery);
  if (publicHandled) return;

  if (!isOwner(userId)) {
    await answerCallbackQuery(callbackQuery.id, "Only owner.");
    return;
  }

  if (data === "toggle_auto_join") {
    const config = loadConfig();
    config.autoJoinRequest = !config.autoJoinRequest;
    saveConfig(config);
    const newStatusStr = config.autoJoinRequest ? "ON ✅" : "OFF ❌";
    await answerCallbackQuery(callbackQuery.id, `Auto Join Request: ${newStatusStr}`);
    try {
      await telegram("editMessageReplyMarkup", {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: adminKeyboard(config)
      });
    } catch (err) {
      await sendAdminPanel(chatId);
    }
    return;
  }

  await answerCallbackQuery(callbackQuery.id, "OK");

  if (data === "edit_action_links") {
    adminStates.set(String(userId), "action_links");
    await sendMessage(chatId, formatLinksHelp(loadConfig()), { parse_mode: "HTML" });
    return;
  }

  if (data === "edit_video_caption") {
    adminStates.set(String(userId), "video_caption");
    await sendMessage(chatId, "🎥 New video caption bhejo. Cancel: /cancel");
    return;
  }

  if (data === "edit_video_buttons") {
    adminStates.set(String(userId), "video_buttons");
    await sendMessage(
      chatId,
      `🔘 New video buttons bhejo.

Format:
<code>Button Text | https://link.com | success | customEmojiId</code>

Styles: primary / success / danger
Premium emoji ID optional hai.

Remove:
<code>clear</code>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (data === "edit_apk_caption") {
    adminStates.set(String(userId), "apk_caption");
    await sendMessage(chatId, "📦 New APK caption bhejo. HTML bold allowed. Cancel: /cancel");
    return;
  }

  if (data === "edit_apk_buttons") {
    adminStates.set(String(userId), "apk_buttons");
    await sendMessage(
      chatId,
      `🔘 New APK button bhejo.

Format:
<code>🔗 Number Vip Channel | https://t.me/m/PYvjs15vMjM1 | primary | customEmojiId</code>

Styles: primary / success / danger
Premium emoji ID optional hai.

Remove:
<code>clear</code>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (data === "preview_video") {
    try {
      await sendVideoWithLink(chatId);
    } catch (error) {
      await sendMessage(chatId, `❌ Video preview error:\n${error.message}`);
    }
    return;
  }

  if (data === "preview_apk") {
    try {
      await sendApkWithCaption(chatId);
    } catch (error) {
      await sendMessage(chatId, `❌ APK preview error:\n${error.message}`);
    }
    return;
  }

  if (data === "show_stats") {
    await sendStats(chatId);
    return;
  }

  if (data === "broadcast_help") {
    await sendBroadcastHelp(chatId);
    return;
  }

  if (data === "show_config") {
    await showCurrentConfig(chatId);
  }
}

async function handleAdminState(message) {
  const chatId = message.chat.id;
  const userId = String(message.from.id);
  const text = message.text || "";
  const state = adminStates.get(userId);

  if (!state) return false;

  if (text.trim() === "/cancel") {
    adminStates.delete(userId);
    await sendMessage(chatId, "✅ Cancelled.");
    return true;
  }

  const config = loadConfig();

  try {
    if (state === "action_links") applyActionLinks(config, text);
    if (state === "video_caption") config.videoCaption = text;
    if (state === "video_buttons") config.videoButtons = parseButtonsFromText(text);
    if (state === "apk_caption") config.apkCaption = text;
    if (state === "apk_buttons") config.apkButtons = parseButtonsFromText(text);

    saveConfig(config);
    adminStates.delete(userId);

    await sendMessage(chatId, "✅ Updated successfully.");
    return true;
  } catch (error) {
    await sendMessage(chatId, `❌ Update failed:\n${error.message}\n\nTry again ya /cancel bhejo.`);
    return true;
  }
}

async function handleStart(message) {
  const chatId = message.chat.id;
  const user = message.from;
  const { fullName, username } = getUserInfo(user);

  vjTrackBotUser(user, chatId, "start");

  trackBotUser(user, chatId, "start");

  let videoStatus = "Not sent";
  let apkStatus = "Not sent";

  try {
    await sendVideoWithLink(chatId);
    videoStatus = "Video sent ✅";
  } catch (error) {
    videoStatus = `Video failed ❌ ${error.message}`;
  }

  try {
    await sendApkWithCaption(chatId);
    apkStatus = "APK sent ✅";
  } catch (error) {
    apkStatus = `APK failed ❌ ${error.message}`;
  }

  await sendOwnerAlert(
    `👤 <b>Bot Started</b>

Name: <b>${escapeHtml(fullName)}</b>
Username: ${escapeHtml(username)}
User ID: <code>${user.id}</code>

🎥 ${escapeHtml(videoStatus)}
📦 ${escapeHtml(apkStatus)}`
  );
}

async function sendColourPanel(chatId) {
  const url = panelUrl();

  if (!url) {
    await sendMessage(
      chatId,
      `🎨 Colour panel ready hai, lekin cloud URL env me set nahi hai.

Railway/Render me PUBLIC_WEBAPP_URL ya RAILWAY_PUBLIC_DOMAIN set hone ke baad panel button active hoga.`
    );
    return;
  }

  await sendMessage(
    chatId,
    `🎨 <b>Colour Button Panel</b>

Video jaisa blue/green/red button look yaha milega.`,
    {
      parse_mode: "HTML",
      reply_markup: colourPanelKeyboard()
    }
  );
}

async function handleJoinRequest(joinRequest) {
  const user = joinRequest.from;
  const chat = joinRequest.chat;
  const { fullName, username } = getUserInfo(user);

  trackJoinRequestUser(joinRequest);

  console.log("🔥 JOIN REQUEST RECEIVED:");
  console.log(JSON.stringify(joinRequest, null, 2));

  if (String(chat.id) !== String(CHANNEL_ID)) {
    console.log("⚠️ Wrong channel skipped:", chat.id, "expected:", CHANNEL_ID);
    return;
  }

  const userChatId = joinRequest.user_chat_id || user.id;

  vjTrackBotUser(user, userChatId, "join_request");

  const config = loadConfig();
  let approveStatus = "Bot ne approve nahi kiya (Auto Join: OFF)";

  if (config.autoJoinRequest) {
    try {
      await telegram("approveChatJoinRequest", {
        chat_id: chat.id,
        user_id: user.id
      });
      approveStatus = "Join Request Auto-Approved ✅";
      console.log(`✅ Auto approved join request for ${user.id} in channel ${chat.id}`);
    } catch (approveError) {
      approveStatus = `Auto Approve Failed ❌ ${approveError.message}`;
      console.error("❌ approveChatJoinRequest error:", approveError.message);
    }
  }

  let verifyStatus = "Not sent";
  let videoStatus = "Not sent";
  let apkStatus = "Not sent";

  try {
    await sendMessage(
      userChatId,
      formatVerifyText(user, config),
      {
        parse_mode: "HTML",
        reply_markup: verifyKeyboard()
      }
    );
    verifyStatus = "Verify message sent ✅";
  } catch (error) {
    verifyStatus = `Verify failed ❌ ${error.message}`;
  }

  try {
    await sendVideoWithLink(userChatId);
    videoStatus = "Video sent ✅";
  } catch (error) {
    videoStatus = `Video failed ❌ ${error.message}`;
  }

  try {
    await sendApkWithCaption(userChatId);
    apkStatus = "APK sent ✅";
  } catch (error) {
    apkStatus = `APK failed ❌ ${error.message}`;
  }

  await sendOwnerAlert(
    `🔥 <b>New Channel Join Request</b>

👤 Name: <b>${escapeHtml(fullName)}</b>
🔗 Username: ${escapeHtml(username)}
🆔 User ID: <code>${user.id}</code>
💬 Chat ID: <code>${userChatId}</code>

✅ ${escapeHtml(verifyStatus)}
🎥 ${escapeHtml(videoStatus)}
📦 ${escapeHtml(apkStatus)}

${approveStatus.includes("✅") ? "✅" : "❌"} ${escapeHtml(approveStatus)}`
  );
}

async function handleMessage(message) {
  const text = message.text ? message.text.trim() : "";

  if (!vjIsCommand(text, "/start")) {
    vjTrackPrivateUserFromMessage(message, "message");
  }

  if (vjIsCommand(text, "/myid")) {
    await vjSendMyId(message);
    return;
  }

  if (message.from && isOwner(message.from.id)) {
    if (vjIsCommand(text, "/stats")) {
      await vjSendStats(message.chat.id);
      return;
    }

    if (vjIsCommand(text, "/broadcasthelp")) {
      await vjSendBroadcastHelp(message.chat.id);
      return;
    }

    if (vjIsCommand(text, "/broadcast")) {
      await vjHandleBroadcast(message);
      return;
    }

    if (vjIsCommand(text, "/setpost1")) {
      await handleSetPostCommand(message, 1);
      return;
    }

    if (vjIsCommand(text, "/setpost2")) {
      await handleSetPostCommand(message, 2);
      return;
    }

    const stateHandled = await handleAdminState(message);
    if (stateHandled) return;

    const replyHandled = await relayOwnerReplyToMember(message);
    if (replyHandled) return;

    if (text.startsWith("/admin")) {
      await sendAdminPanel(message.chat.id);
      return;
    }

    if (text.startsWith("/reply")) {
      await sendDirectReplyCommand(message);
      return;
    }

    if (text.startsWith("/emojiid") || text.startsWith("/emoji")) {
      await sendCustomEmojiIds(message);
      return;
    }

    if (text.startsWith("/panel") || text.startsWith("/colour") || text.startsWith("/color")) {
      await sendColourPanel(message.chat.id);
      return;
    }

    if (text.startsWith("/start")) {
      await handleStart(message);
      return;
    }

    return;
  }

  if (vjIsCommand(text, "/stats") || vjIsCommand(text, "/broadcast") || vjIsCommand(text, "/broadcasthelp")) {
    await sendMessage(message.chat.id, "❌ Ye command sirf owner ke liye hai.");
    return;
  }

  if (text.startsWith("/start")) {
    await handleStart(message);
    return;
  }

  if (text.startsWith("/panel") || text.startsWith("/colour") || text.startsWith("/color")) {
    await sendColourPanel(message.chat.id);
    return;
  }

  await copyMemberMessageToOwners(message);

  try {
    const autoReply = await sendMessage(
      message.chat.id,
      `✅ Message received.

Admin ko aapka message mil gaya hai.`
    );

    setTimeout(async () => {
      try {
        await deleteMessage(message.chat.id, autoReply.message_id);
      } catch (deleteError) {
        console.error("❌ Auto reply delete error:", deleteError.message);
      }
    }, 5000);
  } catch (error) {
    console.error("❌ User auto reply error:", error.message);
  }
}

async function pollUpdates() {
  while (true) {
    try {
      const updates = await telegram("getUpdates", {
        offset,
        timeout: 5,
        allowed_updates: ["message", "chat_join_request", "callback_query"]
      });

      for (const update of updates) {
        offset = update.update_id + 1;

        if (update.message) await handleMessage(update.message);
        if (update.callback_query) await handleCallbackQuery(update.callback_query);
        if (update.chat_join_request) await handleJoinRequest(update.chat_join_request);
      }
    } catch (error) {
      console.error("Polling error:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function main() {
  saveConfig(loadConfig());
  saveBotUsers();
  saveBotStats(loadBotStats());
  startWebApp();
  await loadBotProfile();

  console.log("✅ Two Way Support Bot running...");
  console.log("✅ Video-style welcome/buttons enabled.");
  console.log("✅ Members ke messages owner ko copied jayenge.");
  console.log("✅ Owner copied message par reply karega to user ko reply jayega.");
  console.log("✅ /reply USER_ID message command bhi available hai.");
  console.log("✅ /stats monthly report available.");
  console.log("✅ /broadcast reply command available.");
  console.log("✅ /admin panel available.");

  await pollUpdates();
}

main();
