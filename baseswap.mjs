import express from "express";
import { ethers } from "ethers";

const router = express.Router();

/* ===============================
   CONFIG
================================ */

const SONIC_RPC = "https://rpc.soniclabs.com";
const CHAIN_ID = 146; // Sonic

const TOKENS = {
  USDT: "0x6047828dc181963ba44974801ff68e538da5eaf9",
  USDC: "0x29219dd400f2bf60e5a23d13be72b486d4038894",
  SONIC: "0x0000000000000000000000000000000000000000"
};

const provider = new ethers.JsonRpcProvider(SONIC_RPC);

/* ===============================
   CORE SWAP FUNCTION
================================ */

async function doSwap({ fromToken, toToken, amount, privateKey }) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const userAddress = wallet.address;

  const inDecimals = fromToken === "SONIC" ? 18 : 6;
  const outDecimals = toToken === "SONIC" ? 18 : 6;

  /* ---------- 1️⃣ ODOS QUOTE ---------- */
  const quoteRes = await fetch("https://api.odos.xyz/sor/quote/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chainId: CHAIN_ID,
      inputTokens: [{
        tokenAddress: TOKENS[fromToken],
        amount: ethers.parseUnits(amount, inDecimals).toString()
      }],
      outputTokens: [{
        tokenAddress: TOKENS[toToken],
        proportion: 1
      }],
      userAddr: userAddress,
      slippageLimitPercent: 1
    })
  });

  const quote = await quoteRes.json();
  if (!quote.pathId) {
    throw new Error("Odos quote failed");
  }

  const expectedOutRaw = quote.outAmounts[0];

  /* ---------- 2️⃣ ASSEMBLE TX ---------- */
  const assembleRes = await fetch("https://api.odos.xyz/sor/assemble", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userAddr: userAddress,
      pathId: quote.pathId
    })
  });

  const assembled = await assembleRes.json();
  if (!assembled.transaction) {
    throw new Error("Odos assemble failed");
  }

  /* ---------- 3️⃣ SEND TX ---------- */
  const tx = await wallet.sendTransaction({
    to: assembled.transaction.to,
    data: assembled.transaction.data,
    value: assembled.transaction.value
  });

  return {
    txHash: tx.hash,
    expectedOut: ethers.formatUnits(expectedOutRaw, outDecimals)
  };
}

/* ===============================
   ROUTES
================================ */

// USDC → USDT
router.post("/usdc-to-usdt", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    const result = await doSwap({
      fromToken: "USDC",
      toToken: "USDT",
      amount,
      privateKey
    });

    res.json({
      success: true,
      swap: "USDC → USDT",
      inputUSDC: amount,
      expectedUSDT: result.expectedOut,
      txHash: result.txHash
    });

  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// USDT → USDC
router.post("/usdt-to-usdc", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    const result = await doSwap({
      fromToken: "USDT",
      toToken: "USDC",
      amount,
      privateKey
    });

    res.json({
      success: true,
      swap: "USDT → USDC",
      inputUSDT: amount,
      expectedUSDC: result.expectedOut,
      txHash: result.txHash
    });

  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// USDT → SONIC
router.post("/usdt-to-sonic", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    const result = await doSwap({
      fromToken: "USDT",
      toToken: "SONIC",
      amount,
      privateKey
    });

    res.json({
      success: true,
      swap: "USDT → SONIC",
      inputUSDT: amount,
      expectedSONIC: result.expectedOut,
      txHash: result.txHash
    });

  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// SONIC → USDT
router.post("/sonic-to-usdt", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    const result = await doSwap({
      fromToken: "SONIC",
      toToken: "USDT",
      amount,
      privateKey
    });

     // 🔥 CONSOLE OUTPUT
    console.log("✅ SWAP SUCCESS");
    console.log("Pair        :", "SONIC → USDT");
    console.log("Input SONIC :", amount);
    console.log("Expected USDT:", result.expectedOut);
    console.log("Tx Hash     :", result.txHash);


    res.json({
      success: true,
      swap: "SONIC → USDT",
      inputSONIC: amount,
      expectedUSDT: result.expectedOut,
      txHash: result.txHash
    });



  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// SONIC → USDC
router.post("/sonic-to-usdc", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    const result = await doSwap({
      fromToken: "SONIC",
      toToken: "USDC",
      amount,
      privateKey
    });

    res.json({
      success: true,
      swap: "SONIC → USDC",
      inputSONIC: amount,
      expectedUSDC: result.expectedOut,
      txHash: result.txHash
    });

  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

export default router;
