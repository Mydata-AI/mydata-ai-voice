import express from "express";

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("MyData AI Voice is running 🚀");
});

app.get("/healthz", (req, res) => {
  res.send("ok");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
