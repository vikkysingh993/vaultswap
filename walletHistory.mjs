import express from "express";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const TATUM_BASE = "https://api.tatum.io/v3";

/* ===============================
   CHAIN CONFIG
================================ */

// EVM chains supported by Tatum
const EVM_CHAINS = {
  eth: "ethereum",
  pol: "polygon",
  base: "base",
  sonic: "sonic" // only if enabled in your Tatum plan
};

/* ===============================
   WALLET HISTORY API (TATUM ONLY)
   GET /wallet/history?chain=eth&address=0x...
================================ */

router.get("/wallet/history", async (req, res) => {
  try {
    const { chain, address, limit = 20 } = req.query;

    if (!chain || !address) {
      return res.status(400).json({
        success: false,
        error: "chain & address required"
      });
    }

    /* ========= EVM CHAINS ========= */
    if (EVM_CHAINS[chain]) {
      const url = `${TATUM_BASE}/${EVM_CHAINS[chain]}/transaction/account/${address}?pageSize=${limit}`;

      const response = await fetch(url, {
        headers: {
          "x-api-key": process.env.TATUM_API_KEY
        }
      });

      const data = await response.json();

      return res.json({
        success: true,
        provider: "tatum",
        chain,
        type: "evm",
        address,
        count: Array.isArray(data) ? data.length : 0,
        activity: data || []
      });
    }

    /* ========= BITCOIN ========= */
    if (chain === "btc") {
      const url = `${TATUM_BASE}/bitcoin/transaction/address/${address}?pageSize=${limit}`;

      const response = await fetch(url, {
        headers: {
          "x-api-key": process.env.TATUM_API_KEY
        }
      });

      const data = await response.json();

      return res.json({
        success: true,
        provider: "tatum",
        chain,
        type: "utxo",
        address,
        count: Array.isArray(data) ? data.length : 0,
        activity: data || []
      });
    }

    /* ========= SOLANA ========= */
    if (chain === "sol") {
      const url = `${TATUM_BASE}/solana/transaction/address/${address}?pageSize=${limit}`;

      const response = await fetch(url, {
        headers: {
          "x-api-key": process.env.TATUM_API_KEY
        }
      });

      const data = await response.json();

      return res.json({
        success: true,
        provider: "tatum",
        chain,
        type: "account",
        address,
        count: Array.isArray(data) ? data.length : 0,
        activity: data || []
      });
    }

    /* ========= CARDANO ========= */
    if (chain === "ada") {
      const url = `${TATUM_BASE}/cardano/transaction/address/${address}?pageSize=${limit}`;

      const response = await fetch(url, {
        headers: {
          "x-api-key": process.env.TATUM_API_KEY
        }
      });

      const data = await response.json();

      return res.json({
        success: true,
        provider: "tatum",
        chain,
        type: "utxo",
        address,
        count: Array.isArray(data) ? data.length : 0,
        activity: data || []
      });
    }

    return res.status(400).json({
      success: false,
      error: "Unsupported chain"
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;
