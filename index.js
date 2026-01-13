import express from "express";
import fs from "fs";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;

// ==================================================
// Middleware (VIGTIG for Twilio)
// ==================================================
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ==================================================
// OpenAI client
// ==================================================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==================================================
// Load traffic controller prompt
// ==================================================
let trafficPrompt = "";

try {
  trafficPrompt = fs.readFileSync(
    "./prompts/traffic-controller.txt",
    "utf8"
  );

  console.log("================================");
  console.log("🚦 TRAFFIC CONTROLLER LOADED");
  console.log("================================");
  console.log(trafficPrompt);
  console.log("================================");
} catch (err) {
  console.error("❌ Could not load traffic-controller.txt");
  console.error(err.message);
}

// ==================================================
// Basic routes
// ==================================================
app.get("/", (req, res) => {
  res.send("MyData AI Voice is running 🚀");
});

app.get("/healthz", (req, res) => {
  res.send("ok");
});

// ==================================================
// POST /voice  (TEST + TWILIO ENTRYPOINT)
// ==================================================
app.post("/voice", async (req, res) => {
  try {
    // 🔹 1. User input
    // Twilio: req.body.SpeechResult
    // Test fallback:
    const userText =
      req.body.SpeechResult || "Min printer virker ikke";

    console.log("USER TEXT:");
    console.log(userText);

    // 🔹 2. Call OpenAI traffic controller
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: trafficPrompt,
        },
        {
          role: "user",
          content: userText,
        },
      ],
    });

    const aiReply = completion.choices[0].message.content;

    console.log("AI RAW OUTPUT:");
    console.log(aiReply);

    // 🔹 3. Simple parse (V1)
    let flow = "ESCALATE";

    if (aiReply.includes("OPENING_HOURS")) flow = "OPENING_HOURS";
    else if (aiReply.includes("CANCELLATION")) flow = "CANCELLATION";
    else if (aiReply.includes("COMPUTER_SETUP")) flow = "COMPUTER_SETUP";
    else if (aiReply.includes("PRINTER_SUPPORT")) flow = "PRINTER_SUPPORT";

    console.log("FINAL FLOW:", flow);

    // 🔹 4. Respond to Twilio
    res.type("text/xml");
    res.send(`
<Response>
  <Say voice="alice">
    Tak. Jeg har registreret din henvendelse.
    Flowet er: ${flow}.
  </Say>
</Response>
`);
  } catch (err) {
    console.error("❌ ERROR in /voice");
    console.error(err.message);

    res.type("text/xml");
    res.send(`
<Response>
  <Say voice="alice">
    Der opstod en teknisk fejl. Du bliver stillet videre.
  </Say>
</Response>
`);
  }
});

// ==================================================
// START SERVER (ALTID SIDST)
// ==================================================
app.listen(port, () => {
  console.log("================================");
  console.log(`🚀 Server running on port ${port}`);
  console.log("================================");
});
