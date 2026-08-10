require("dotenv").config();

const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_IDS = (process.env.OWNER_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

const VIDEO_FILE = "akhil-bot.mp4";
const APK_FILE = "Number_panel.apk";

const LINK_URL = "https://www.6clubp.com/#/register?invitationCode=44523479915";

const VIDEO_CAPTION = `👍 Full video watch karo 💥💥

🔗🔤🔤
${LINK_URL}`;

const APK_CAPTION = `🌟𝟏𝟎𝟎% 𝐖ᴏʀᴋɪɴɢ 𝐀ɪ 𝐒ᴇʀᴠᴇʀ ‼ 
😒 𝐏ʀɪᴠᴇᴛ 𝐒ᴇʀᴠᴇʀ  🌟
👍 𝐎ɴʟʏ 𝐒ᴜʀᴇꜱʜᴏʀᴛ 🌟

✔ Number Sure Shot Panel 🎊

⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡

DEPOSIT ONLY 300 TO ACTIVATE THE PANEL ✅✅`;

async function uploadFile(type) {
  if (!BOT_TOKEN) {
    console.log("❌ BOT_TOKEN missing in .env");
    return;
  }

  if (!OWNER_IDS.length) {
    console.log("❌ OWNER_IDS missing in .env");
    return;
  }

  const ownerId = OWNER_IDS[0];

  const isVideo = type === "video";
  const fileName = isVideo ? VIDEO_FILE : APK_FILE;
  const caption = isVideo ? VIDEO_CAPTION : APK_CAPTION;
  const method = isVideo ? "sendVideo" : "sendDocument";
  const fieldName = isVideo ? "video" : "document";
  const cacheFile = isVideo ? "video-file-id.txt" : "apk-file-id.txt";
  const mimeType = isVideo ? "video/mp4" : "application/vnd.android.package-archive";

  if (!fs.existsSync(fileName)) {
    console.log(`❌ File not found: ${fileName}`);
    return;
  }

  console.log(`⏳ Uploading ${fileName} to owner first...`);

  const buffer = fs.readFileSync(fileName);
  const blob = new Blob([buffer], { type: mimeType });

  const form = new FormData();
  form.append("chat_id", ownerId);
  form.append(fieldName, blob, fileName);
  form.append("caption", caption);

  if (isVideo) {
    form.append("supports_streaming", "true");
    form.append(
      "reply_markup",
      JSON.stringify({
        inline_keyboard: [
          [
            {
              text: "🔗 OPEN LINK",
              url: LINK_URL
            }
          ]
        ]
      })
    );
  }

  const response = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    body: form
  });

  const data = await response.json();

  if (!data.ok) {
    console.log(`❌ Upload failed for ${fileName}:`, data.description);
    return;
  }

  const fileId = isVideo
    ? data.result?.video?.file_id
    : data.result?.document?.file_id;

  if (!fileId) {
    console.log(`❌ file_id not found for ${fileName}`);
    return;
  }

  fs.writeFileSync(cacheFile, fileId);
  console.log(`✅ ${cacheFile} created`);
  console.log(`✅ ${fileName} ab users ko fast jayega`);
}

async function main() {
  await uploadFile("video");
  await uploadFile("apk");
  console.log("✅ Video + APK upload/cache complete");
}

main();
