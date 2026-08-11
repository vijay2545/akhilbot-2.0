require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

async function telegram(method, payload = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      console.log(JSON.stringify(data, null, 2));
      return;
    } catch (error) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      console.error("❌ Network error:", error.message);
    }
  }
}

telegram("getChatMember", {
  chat_id: CHANNEL_ID,
  user_id: BOT_TOKEN.split(":")[0]
});
