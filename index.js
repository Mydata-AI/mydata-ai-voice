import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

// ==================================================
// App + server
// ==================================================
const app = express();
const port = process.env.PORT || 3000;

// Twilio middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ==================================================
// Basic routes
// ==================================================
app.get("/", (req, res) => {
  res.send("MyData AI Voice (Realtime) is running 🚀");
});

app.get("/healthz", (req, res) => {
  res.send("ok");
});

// ==================================================
// POST /voice  (Twilio entrypoint)
// Starter Media Stream – ingen AI her
// ==================================================
app.post("/voice", (req, res) => {
  res.type("text/xml");
  res.send(`
<Response>
  <Start>
    <Stream url="wss://mydata-ai-realtime-poc.onrender.com/ws/twilio" />
  </Start>
  <Say>Du bliver nu forbundet.</Say>
</Response>
`);
});

// ==================================================
// HTTP server (krævet for WebSocket)
// ==================================================
const server = http.createServer(app);

// ==================================================
// WebSocket: Twilio ↔ ChatGPT Realtime Audio
// ==================================================
const wss = new WebSocketServer({ server });

wss.on("connection", (twilioWs, req) => {
  if (!req.url.includes("/ws/twilio")) return;

  console.log("📞 Twilio Media Stream connected");

  const openaiWs = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    }
  );

  openaiWs.on("open", () => {
    console.log("🤖 OpenAI Realtime connected");
  });

  openaiWs.on("message", (msg) => {
    // OpenAI → Twilio (audio tilbage)
    if (twilioWs.readyState === WebSocket.OPEN) {
      twilioWs.send(msg);
    }
  });

  twilioWs.on("message", (msg) => {
    // Twilio → OpenAI (audio ind)
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(msg);
    }
  });

  twilioWs.on("close", () => {
    console.log("📞 Twilio stream closed");
    openaiWs.close();
  });

  openaiWs.on("close", () => {
    console.log("🤖 OpenAI realtime closed");
    twilioWs.close();
  });

  twilioWs.on("error", console.error);
  openaiWs.on("error", console.error);
});

// ==================================================
// START SERVER
// ==================================================
server.listen(port, () => {
  console.log("================================");
  console.log(`🚀 Server running on port ${port}`);
  console.log("================================");
});
