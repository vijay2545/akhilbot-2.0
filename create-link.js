require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!BOT_TOKEN || !CHANNEL_ID) {
  console.log("❌ BOT_TOKEN or CHANNEL_ID missing in .env");
  process.exit(1);
}

async function createLink() {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createChatInviteLink`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: CHANNEL_ID,
      name: `bot_join_request_${Date.now()}`.slice(0, 32),
      creates_join_request: true
    })
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  if (data.ok) {
    console.log("");
    console.log("✅ USE THIS LINK ONLY:");
    console.log(data.result.invite_link);
  }
}

createLink();
