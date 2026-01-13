import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

// ==================================================
// App + server
// ==================================================
const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ==================================================
// Routes
// ==================================================
app.get("/", (req, res) => {
  res.send("MyData AI Voice (Realtime) running");
});

app.get("/healthz", (req, res) => {
  res.send("ok");
});

// ==================================================
// Twilio voice webhook
// ==================================================
app.post("/voice", (req, res) => {
  res.type("text/xml");
  res.send(`
<Response>
  <Start>
    <Stream url="wss://mydata-ai-realtime-poc.onrender.com/ws/twilio" />
  </Start>

  <Say>Du er nu forbundet.</Say>

  <!-- Holder opkaldet åbent -->
  <Pause length="600" />
</Response>
`);
});

// ==================================================
// HTTP + WebSocket
// ==================================================
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ==================================================
// μ-law → PCM16 converter (Twilio → OpenAI)
// ==================================================
function ulawToLinearSample(u_val) {
  u_val = ~u_val;
  const sign = u_val & 0x80;
  const exponent = (u_val >> 4) & 0x07;
  const mantissa = u_val & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  return sign ? (0x84 - sample) : (sample - 0x84);
}

function ulawBufferToPCM16(buffer) {
  const pcm = Buffer.alloc(buffer.length * 2);
  for (let i = 0; i < buffer.length; i++) {
    const sample = ulawToLinearSample(buffer[i]);
    pcm.writeInt16LE(sample, i * 2);
  }
  return pcm;
}

// ==================================================
// WebSocket bridge: Twilio ↔ OpenAI Realtime
// ==================================================
wss.on("connection", (twilioWs, req) => {
  if (!req.url.includes("/ws/twilio")) return;

  console.log("📞 Twilio Media Stream connected");

  const openaiWs = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    }
  );

  let openaiReady = false;

  // ==================================================
  // OpenAI connected
  // ==================================================
  openaiWs.on("open", () => {
    openaiReady = true;
    console.log("🤖 OpenAI Realtime connected");

    // 1️⃣ Definér hvem AI er (support-agent)
    openaiWs.send(JSON.stringify({
      type: "session.update",
      session: {
        instructions: `
Du er MyData Support.

Du tager imod telefonopkald fra kunder.
Tal dansk.
Tal roligt og professionelt.
Stil ét spørgsmål ad gangen.

Du hjælper med:
- printerproblemer
- computeropsætning
- åbningstider
- opsigelse af aftaler

Hvis du ikke kan løse problemet,
så sig at du stiller videre til en medarbejder.
`,
      },
    }));

    // 2️⃣ Få AI til at starte samtalen
    openaiWs.send(JSON.stringify({
      type: "response.create",
      response: {
        modalities: ["audio"],
        instructions: "Sig hej og spørg hvordan du kan hjælpe.",
      },
    }));
  });

  // ==================================================
  // OpenAI → Twilio (audio ud)
  // ==================================================
  openaiWs.on("message", (msg) => {
    const data = JSON.parse(msg.toString());

    if (data.type === "response.audio.delta") {
      if (twilioWs.readyState === WebSocket.OPEN) {
        twilioWs.send(JSON.stringify({
          event: "media",
          media: {
            payload: data.delta,
          },
        }));
      }
    }
  });

  // ==================================================
  // Twilio → OpenAI (audio ind)
  // ==================================================
  twilioWs.on("message", (msg) => {
    if (!openaiReady) return;

    const data = JSON.parse(msg.toString());

    if (data.event === "media") {
      const ulaw = Buffer.from(data.media.payload, "base64");
      const pcm16 = ulawBufferToPCM16(ulaw);

      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: pcm16.toString("base64"),
        }));

        // 👉 Fortæl OpenAI at den må svare igen
        openaiWs.send(JSON.stringify({
          type: "response.create",
          response: {
            modalities: ["audio"],
          },
        }));
      }
    }
  });

  // ==================================================
  // Cleanup
  // ==================================================
  twilioWs.on("close", () => {
    console.log("📞 Twilio closed");
    if (openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
  });

  openaiWs.on("close", () => {
    console.log("🤖 OpenAI closed");
    if (twilioWs.readyState === WebSocket.OPEN) twilioWs.close();
  });

  twilioWs.on("error", console.error);
  openaiWs.on("error", console.error);
});

// ==================================================
// Start server
// ==================================================
server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
