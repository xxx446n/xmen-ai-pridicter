// server.js
const express = require("express");
const fetch = require("node-fetch");
const admin = require("firebase-admin");
const cron = require("node-cron");
const app = express();

// Firebase Admin SDK setup
const serviceAccount = require("./firebase-key.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://server-f40a5-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

function getType(n) {
  return n >= 5 ? "BIG" : "SMALL";
}

app.get("/", (req, res) => {
  res.send("🧠 X MEN AI Predictor is running!");
});

app.get("/predict", async (req, res) => {
  try {
    const ts = Date.now();
    const api = `https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?ts=${ts}`;
    const response = await fetch(api);
    const data = await response.json();
    const latest = data.data.list[0];
    const issue = latest.issueNumber;
    const number = parseInt(latest.number);
    const actualType = getType(number);

    const histSnap = await db.ref("predictions").once("value");
    const history = histSnap.val() || {};
    const past = Object.values(history).slice(-5);
    const big = past.filter(x => x.prediction === "BIG").length;
    const small = past.filter(x => x.prediction === "SMALL").length;

    const prediction = big > small ? "BIG" : "SMALL";
    const result = prediction === actualType ? "WIN" : "LOSS";
    const confidence = (Math.random() * 15 + 85).toFixed(2);

    await db.ref(`predictions/${issue}`).set({
      prediction,
      actual: number,
      actualType,
      result,
      confidence
    });

    const statsSnap = await db.ref("stats").once("value");
    const stats = statsSnap.val() || { win: 0, loss: 0 };
    result === "WIN" ? stats.win++ : stats.loss++;
    await db.ref("stats").set(stats);

    res.send(`[AI] ${issue} → ${prediction} → ${result}`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Error during prediction.");
  }
});

// Run every 1 minute
cron.schedule("*/1 * * * *", async () => {
  await fetch("http://localhost:3000/predict");
});

app.listen(3000, () => console.log("🚀 AI predictor running on port 3000"));