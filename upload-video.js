require("dotenv").config();

const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_IDS = (process.env.OWNER_IDS || "").split(",").map(x => x.trim()).filter(Boolean);

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const VIDEO_FILE = "akhil-bot.mp4";
const LINK_URL = "https://www.6clubp.com/#/register?invitationCode=44523479915";

const VIDEO_CAPTION = `👍 Full video watch karo 💥💥

🔗🔤🔤
${LINK_URL}`;

async function uploadVideo() {
  if (!BOT_TOKEN) {
    console.log("❌ BOT_TOKEN missing");
    return;
  }

  if (!OWNER_IDS.length) {
    console.log("❌ OWNER_IDS missing");
    return;
  }

  if (!fs.existsSync(VIDEO_FILE)) {
    console.log("❌ Video file not found:", VIDEO_FILE);
    return;
  }

  const ownerId = OWNER_IDS[0];

  console.log("⏳ Uploading video to owner first...");
  console.log("Owner:", ownerId);
  console.log("Video:", VIDEO_FILE);

  const buffer = fs.readFileSync(VIDEO_FILE);
  const blob = new Blob([buffer], { type: "video/mp4" });

  const form = new FormData();
  form.append("chat_id", ownerId);
  form.append("video", blob, VIDEO_FILE);
  form.append("caption", VIDEO_CAPTION);
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

  const response = await fetch(`${API_BASE}/sendVideo`, {
    method: "POST",
    body: form
  });

  const data = await response.json();

  console.log(JSON.stringify(data, null, 2));

  if (!data.ok) {
    console.log("❌ Upload failed:", data.description);
    return;
  }

  const fileId = data.result?.video?.file_id;

  if (!fileId) {
    console.log("❌ file_id not found");
    return;
  }

  fs.writeFileSync("video-file-id.txt", fileId);
  console.log("✅ video-file-id.txt created");
  console.log("✅ Ab users ko video fast jayega");
}

uploadVideo();
