import express from "express";
import fs from "fs";

const app = express();
const port = process.env.PORT || 3000;

// ==================================================
// Middleware (VIGTIG for Twilio POST)
// ==================================================
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

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
// GET /voice (BROWSER TEST)
// ==================================================
app.post("/voice", (req, res) => {
  // 👇 SIMULERET kunde-input (kun til test)
  const simulatedUserText = "Min printer virker ikke";

  console.log("SIMULATED USER TEXT:");
  console.log(simulatedUserText);

  // 👇 MEGET simpel trafik-betjent logik (uden AI)
  let flow = "ESCALATE";

  if (simulatedUserText.toLowerCase().includes("åben")) {
    flow = "OPENING_HOURS";
  } else if (simulatedUserText.toLowerCase().includes("opsig")) {
    flow = "CANCELLATION";
  } else if (simulatedUserText.toLowerCase().includes("printer")) {
    flow = "PRINTER_SUPPORT";
  } else if (
    simulatedUserText.toLowerCase().includes("pc") ||
    simulatedUserText.toLowerCase().includes("computer")
  ) {
    flow = "COMPUTER_SETUP";
  }

  console.log("TRAFFIC CONTROLLER RESULT:");
  console.log(flow);

  res.type("text/xml");
  res.send(`
    <Response>
      <Say voice="alice">
        Trafik-betjenten har valgt flowet: ${flow}
      </Say>
    </Response>
  `);
});


// ==================================================
// POST /voice (TWILIO CALL ENTRYPOINT)
// ==================================================
app.post("/voice", (req, res) => {
  console.log("📞 Incoming call from Twilio");
  console.log("From:", req.body.From);

  res.type("text/xml");
  res.send(`
<Response>
  <Say voice="alice">
    Hej, MyData AI Voice kører nu.
    Hvordan kan jeg hjælpe dig?
  </Say>
</Response>
`);
});

// ==================================================
// START SERVER (ALTID SIDST)
// ==================================================
app.listen(port, () => {
  console.log("================================");
  console.log(`🚀 Server running on port ${port}`);
  console.log("================================");
});
