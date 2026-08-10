require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN missing in .env");
  process.exit(1);
}

async function deleteWebhook() {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      drop_pending_updates: true
    })
  });

  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
}

deleteWebhook();
