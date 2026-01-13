import express from "express";

const app = express();
const port = process.env.PORT || 3000;

// 👇 VIGTIG for Twilio
app.use(express.urlencoded({ extended: false }));

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
