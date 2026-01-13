import express from "express";
import fs from "fs"; // 👈 NYT: gør det muligt at læse filer

const app = express();
const port = process.env.PORT || 3000;

// 👇 VIGTIG for Twilio
app.use(express.urlencoded({ extended: false }));

// 👇 NYT: Læs trafik-betjenten fra fil
const trafficPrompt = fs.readFileSync(
  "./prompts/traffic-controller.txt",
  "utf8"
);

// 👇 Kun til test – viser i Render logs at filen er loaded
console.log("=== TRAFFIC CONTROLLER LOADED ===");
console.log(trafficPrompt);
console.log("================================");

app.get("/", (req, res) => {
  res.send("MyData AI Voice is running 🚀");
});

app.get("/healthz", (req, res) => {
  res.send("ok");
});

// 👇 Twilio webhook
app.post("/voice", (req, res) => {
  res.type("text/xml");
  res.send(`
    <Response>
      <Say voice="alice">Hej, MyData AI Voice kører nu.</Say>
    </Response>
  `);
});

// 👇 ALTID nederst
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
