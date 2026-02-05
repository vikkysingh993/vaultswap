import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import polswapRoutes from "./polswap.mjs";
import ethswapRoutes from "./ethswap.mjs";
import baseswapRoutes from "./baseswap.mjs";
import sonicswap from "./sonicswap.mjs";



dotenv.config();

/* ===============================
   APP INIT
================================ */
const app = express();

// middlewares
app.use(cors());
app.use(express.json());

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.json({
    status: "VaultSwap API Running 🚀",
    chains: ["POLYGON", "ETHEREUM", "BASE"]
  });
});

/* ===============================
   ROUTES
================================ */

// 🔁 Polygon
app.use("/api/pol", polswapRoutes);

// 🔁 Ethereum
app.use("/api/eth", ethswapRoutes);

// 🔁 Base
app.use("/api/base", baseswapRoutes);

// sonic
app.use("/swap", sonicswap);

/* ===============================
   SERVER START
================================ */
const PORT = process.env.PORT || 4001;

app.listen(PORT, () => {
  console.log(`✅ VaultSwap API running on port ${PORT}`);
});
