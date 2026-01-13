import Fastify from "fastify";
import WebSocket from "ws";
import dotenv from "dotenv";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";

dotenv.config();

const { OPENAI_API_KEY } = process.env;
if (!OPENAI_API_KEY) {
  console.error("❌ Mangler OPENAI_API_KEY");
  process.exit(1);
}

const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

const PORT = process.env.PORT || 3000;

// ==================================================
// SYSTEM PROMPT (DANSK)
// ==================================================
const SYSTEM_MESSAGE = `
Du er MyData Support.

Du tager imod telefonopkald fra kunder.
Tal dansk.
Tal roligt og professionelt.
Stil ét spørgsmål ad gangen.

Du hjælper med:
- printerproblemer
- computeropsætning
- åbningstider
- opsigelse af abonnement

Hvis du ikke kan løse problemet,
så sig at du stiller videre til en medarbejder.
`;

// ==================================================
// Health + root
// ==================================================
fastify.get("/", async () => {
  return { status: "MyData AI Voice (Realtime) running" };
});

fastify.get("/healthz", async () => "ok");

// ==================================================
// Twilio webhook (A call comes in)
// ==================================================
fastify.all("/voice", async (request, reply) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Du bliver nu forbundet til MyData support.</Say>
  <Connect>
    <Stream url="wss://${request.headers.host}/media-stream" />
  </Connect>
</Response>`;
  reply.type("text/xml").send(twiml);
});

// ==================================================
// WebSocket: Twilio ↔ OpenAI Realtime
// ==================================================
fastify.register(async (fastify) => {
  fastify.get("/media-stream", { websocket: true }, (connection) => {
    console.log("📞 Twilio Media Stream connected");

    let openaiReady = false;

    const openaiWs = new WebSocket(
      // ✅ BRUG DENNE MODEL
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    // ==================================================
    // Når OpenAI er klar
    // ==================================================
    openaiWs.on("open", () => {
      console.log("🤖 OpenAI Realtime connected");
      openaiReady = true;

      // Session setup
      openaiWs.send(JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          output_modalities: ["audio"],
          audio: {
            input: {
              format: { type: "audio/pcmu" },
              turn_detection: { type: "server_vad" }
            },
            output: {
              format: { type: "audio/pcmu" },
              voice: "alloy"
            }
          },
          instructions: SYSTEM_MESSAGE,
        }
      }));

      // AI starter samtalen
      openaiWs.send(JSON.stringify({
        type: "response.create",
        response: {
          instructions: "Hej, du taler med MyData Support. Hvordan kan jeg hjælpe?"
        }
      }));
    });

    // ==================================================
    // OpenAI → Twilio (audio ud)
    // ==================================================
    openaiWs.on("message", (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.type === "response.output_audio.delta") {
        connection.send(JSON.stringify({
          event: "media",
          media: { payload: msg.delta }
        }));
      }
    });

    // ==================================================
    // Twilio → OpenAI (audio ind)
    // ==================================================
    connection.on("message", (message) => {
      if (!openaiReady) return; // 🔑 KRITISK FIX

      const data = JSON.parse(message.toString());

      if (data.event === "media" && openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: data.media.payload
        }));
      }
    });

    // ==================================================
    // Cleanup
    // ==================================================
    connection.on("close", () => {
      console.log("📞 Twilio disconnected");
      if (openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
    });

    openaiWs.on("close", () => {
      console.log("🤖 OpenAI disconnected");
    });

    openaiWs.on("error", console.error);
    connection.on("error", console.error);
  });
});

// ==================================================
// Start server
// ==================================================
fastify.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server running on port ${PORT}`);
});
