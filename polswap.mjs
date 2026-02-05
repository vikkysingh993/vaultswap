import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { ethers } from "ethers";

import { ROUTER_ADDRESS, routerAbi } from "./config/router.mjs";
import { TOKENS } from "./config/tokens.mjs";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const router = express.Router(); // ✅ MUST

const provider = new ethers.JsonRpcProvider(
  "https://site1.moralis-nodes.com/polygon/1df3791b7c6b4df0a1f691fb1b1f902a",
  {
    chainId: 137,
    name: "polygon"
  }
);

// test once
await provider.getBlockNumber();
console.log("✅ Moralis Polygon RPC connected");

console.log("Provider:", provider);



const erc20Abi = [
  "function approve(address spender, uint amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint)",
  "function balanceOf(address owner) external view returns (uint)"
];



const wmaticAbi = [
  "function deposit() payable",
  "function withdraw(uint wad)",
  "function balanceOf(address owner) external view returns (uint)",
  "function approve(address spender, uint amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint)"
];

router.get("/quote", async (req, res) => {
  try {
    const { from, to, amount = "1" } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: "from & to required" });
    }

    if (!TOKENS[from] && from !== "POL") {
      return res.status(400).json({ error: "Invalid from token" });
    }

    if (!TOKENS[to] && to !== "POL") {
      return res.status(400).json({ error: "Invalid to token" });
    }

    const router = new ethers.Contract(
      ROUTER_ADDRESS,
      routerAbi,
      provider
    );

    let path;
    let amountIn;

    /* ===============================
       CASE 1: POL → TOKEN
    =============================== */
    if (from === "POL" && to !== "POL") {
      amountIn = ethers.parseUnits(amount, 18);

      path = [
        TOKENS.POL.address,   // WMATIC
        TOKENS[to].address
      ];
    }

    /* ===============================
       CASE 2: TOKEN → POL
    =============================== */
    else if (from !== "POL" && to === "POL") {
      amountIn = ethers.parseUnits(
        amount,
        TOKENS[from].decimals
      );

      path = [
        TOKENS[from].address,
        TOKENS.POL.address   // WMATIC
      ];
    }

    /* ===============================
       CASE 3: TOKEN → TOKEN (USDT ↔ USDC)
    =============================== */
    else if (from !== "POL" && to !== "POL") {
      amountIn = ethers.parseUnits(
        amount,
        TOKENS[from].decimals
      );

      path = [
        TOKENS[from].address,
        TOKENS[to].address
      ];
    }

    else {
      return res.status(400).json({ error: "Invalid pair" });
    }

    const amountsOut = await router.getAmountsOut(amountIn, path);

    const outputDecimals =
      to === "POL" ? 18 : TOKENS[to].decimals;

    const outputAmount = ethers.formatUnits(
      amountsOut[1],
      outputDecimals
    );

    res.json({
      success: true,
      from,
      to,
      inputAmount: amount,
      outputAmount,
      message: `${amount} ${from} ≈ ${outputAmount} ${to}`
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* =====================
   POL → USDT API
===================== */

router.post("/swap/pol-to-usdt", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    if (!amount || !privateKey) {
      return res.status(400).json({ error: "amount & privateKey required" });
    }

    const wallet = new ethers.Wallet(privateKey, provider);

    const router = new ethers.Contract(
      ROUTER_ADDRESS,
      routerAbi,
      wallet
    );

    const wmatic = new ethers.Contract(
      TOKENS.POL.address, // WMATIC
      wmaticAbi,
      wallet
    );

    const amountIn = ethers.parseUnits(amount, 18);

    /* ========= STEP 1: POL → WMATIC ========= */
    const wrapTx = await wmatic.deposit({ value: amountIn });
    await wrapTx.wait();

    /* ========= STEP 2: APPROVAL ========= */
    const allowance = await wmatic.allowance(
      wallet.address,
      ROUTER_ADDRESS
    );

    if (allowance < amountIn) {
      const approveTx = await wmatic.approve(
        ROUTER_ADDRESS,
        ethers.MaxUint256
      );
      await approveTx.wait();
    }

    /* ========= STEP 3: QUOTE ========= */
    const path = [
      TOKENS.POL.address,
      TOKENS.USDT.address
    ];

    const amountsOut = await router.getAmountsOut(amountIn, path);
    const expectedUSDT = ethers.formatUnits(
      amountsOut[1],
      TOKENS.USDT.decimals
    );

    const amountOutMin = (amountsOut[1] * 95n) / 100n;

    /* ========= STEP 4: SWAP ========= */
    const swapTx = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 600
    );

    await swapTx.wait();

    /* ========= RESPONSE ========= */
    res.json({
      success: true,
      swap: "POL → USDT",
      inputPOL: amount,
      expectedUSDT: expectedUSDT,
      txHash: swapTx.hash
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// pol to usdc swap 

router.post("/swap/pol-to-usdc", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    if (!amount || !privateKey) {
      return res.status(400).json({ error: "amount & privateKey required" });
    }

    const wallet = new ethers.Wallet(privateKey, provider);

    const router = new ethers.Contract(
      ROUTER_ADDRESS,
      routerAbi,
      wallet
    );

    const wmatic = new ethers.Contract(
      TOKENS.POL.address, // WMATIC
      wmaticAbi,
      wallet
    );

    const amountIn = ethers.parseUnits(amount, 18);

    /* ========= STEP 1: POL → WMATIC ========= */
    const wrapTx = await wmatic.deposit({
      value: amountIn
    });
    await wrapTx.wait();

    /* ========= STEP 2: APPROVAL ========= */
    const allowance = await wmatic.allowance(
      wallet.address,
      ROUTER_ADDRESS
    );

    if (allowance < amountIn) {
      const approveTx = await wmatic.approve(
        ROUTER_ADDRESS,
        ethers.MaxUint256
      );
      await approveTx.wait();
    }

    /* ========= STEP 3: QUOTE ========= */
    const path = [
      TOKENS.POL.address,   // WMATIC
      TOKENS.USDC.address
    ];

    const amountsOut = await router.getAmountsOut(amountIn, path);

    const expectedUSDC = ethers.formatUnits(
      amountsOut[1],
      TOKENS.USDC.decimals
    );

    const amountOutMin = (amountsOut[1] * 95n) / 100n; // 5% slippage

    /* ========= STEP 4: SWAP ========= */
    const swapTx = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 600
    );

    await swapTx.wait();

    /* ========= RESPONSE ========= */
    res.json({
      success: true,
      swap: "POL → USDC",
      inputPOL: amount,
      expectedUSDC: expectedUSDC,
      txHash: swapTx.hash
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post("/swap/usdt-to-pol", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    if (!amount || !privateKey) {
      return res.status(400).json({ error: "amount & privateKey required" });
    }

    const wallet = new ethers.Wallet(privateKey, provider);

    const router = new ethers.Contract(
      ROUTER_ADDRESS,
      routerAbi,
      wallet
    );

    const usdt = new ethers.Contract(
      TOKENS.USDT.address,
      erc20Abi,
      wallet
    );

    const wmatic = new ethers.Contract(
      TOKENS.POL.address, // WMATIC
      wmaticAbi,
      wallet
    );

    const amountIn = ethers.parseUnits(amount, TOKENS.USDT.decimals);

    /* ========= STEP 1: USDT BALANCE CHECK ========= */
    const usdtBal = await usdt.balanceOf(wallet.address);
    if (usdtBal < amountIn) {
      return res.status(400).json({ error: "Insufficient USDT balance" });
    }

    /* ========= STEP 2: APPROVAL ========= */
    const allowance = await usdt.allowance(
      wallet.address,
      ROUTER_ADDRESS
    );

    if (allowance < amountIn) {
      const approveTx = await usdt.approve(
        ROUTER_ADDRESS,
        ethers.MaxUint256
      );
      await approveTx.wait();
    }

    /* ========= STEP 3: QUOTE ========= */
    const path = [
      TOKENS.USDT.address,
      TOKENS.POL.address // WMATIC
    ];

    const amountsOut = await router.getAmountsOut(amountIn, path);
    const expectedWMATIC = amountsOut[1];

    /* ========= STEP 4: SWAP (USDT → WMATIC) ========= */
    const swapTx = await router.swapExactTokensForTokens(
      amountIn,
      (expectedWMATIC * 95n) / 100n,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 600
    );

    await swapTx.wait();

    /* ========= STEP 5: UNWRAP (WMATIC → POL) ========= */
    const unwrapTx = await wmatic.withdraw(expectedWMATIC);
    await unwrapTx.wait();

    /* ========= RESPONSE ========= */
    const polReceived = ethers.formatUnits(expectedWMATIC, 18);

    res.json({
      success: true,
      swap: "USDT → POL",
      inputUSDT: amount,
      receivedPOL: polReceived,
      txHash: swapTx.hash
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post("/swap/usdc-to-pol", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    if (!amount || !privateKey) {
      return res.status(400).json({ error: "amount & privateKey required" });
    }

    const wallet = new ethers.Wallet(privateKey, provider);

    const router = new ethers.Contract(
      ROUTER_ADDRESS,
      routerAbi,
      wallet
    );

    const usdc = new ethers.Contract(
      TOKENS.USDC.address,
      erc20Abi,
      wallet
    );

    const wmatic = new ethers.Contract(
      TOKENS.POL.address, // WMATIC
      wmaticAbi,
      wallet
    );

    const amountIn = ethers.parseUnits(
      amount,
      TOKENS.USDC.decimals
    );

    /* ========= STEP 1: BALANCE CHECK ========= */
    const usdcBal = await usdc.balanceOf(wallet.address);
    if (usdcBal < amountIn) {
      return res.status(400).json({ error: "Insufficient USDC balance" });
    }

    /* ========= STEP 2: APPROVAL ========= */
    const allowance = await usdc.allowance(
      wallet.address,
      ROUTER_ADDRESS
    );

    if (allowance < amountIn) {
      const approveTx = await usdc.approve(
        ROUTER_ADDRESS,
        ethers.MaxUint256
      );
      await approveTx.wait();
    }

    /* ========= STEP 3: QUOTE ========= */
    const path = [
      TOKENS.USDC.address,
      TOKENS.POL.address // WMATIC
    ];

    const amountsOut = await router.getAmountsOut(amountIn, path);
    const expectedWMATIC = amountsOut[1];

    const amountOutMin = (expectedWMATIC * 95n) / 100n;

    /* ========= STEP 4: SWAP ========= */
    const swapTx = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 600
    );

    await swapTx.wait();

    /* ========= STEP 5: UNWRAP ========= */
    const unwrapTx = await wmatic.withdraw(expectedWMATIC);
    await unwrapTx.wait();

    const polReceived = ethers.formatUnits(
      expectedWMATIC,
      18
    );

    /* ========= RESPONSE ========= */
    res.json({
      success: true,
      swap: "USDC → POL",
      inputUSDC: amount,
      receivedPOL: polReceived,
      txHash: swapTx.hash
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post("/swap/usdt-to-usdc", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    if (!amount || !privateKey) {
      return res.status(400).json({ error: "amount & privateKey required" });
    }

    const wallet = new ethers.Wallet(privateKey, provider);

    const router = new ethers.Contract(
      ROUTER_ADDRESS,
      routerAbi,
      wallet
    );

    const usdt = new ethers.Contract(
      TOKENS.USDT.address,
      erc20Abi,
      wallet
    );

    const amountIn = ethers.parseUnits(
      amount,
      TOKENS.USDT.decimals
    );

    /* ========= STEP 1: BALANCE CHECK ========= */
    const usdtBal = await usdt.balanceOf(wallet.address);
    if (usdtBal < amountIn) {
      return res.status(400).json({ error: "Insufficient USDT balance" });
    }

    /* ========= STEP 2: ALLOWANCE CHECK ========= */
    const allowance = await usdt.allowance(
      wallet.address,
      ROUTER_ADDRESS
    );

    if (allowance < amountIn) {
      const approveTx = await usdt.approve(
        ROUTER_ADDRESS,
        ethers.MaxUint256
      );
      await approveTx.wait();
    }

    /* ========= STEP 3: QUOTE ========= */
    const path = [
      TOKENS.USDT.address,
      TOKENS.USDC.address
    ];

    const amountsOut = await router.getAmountsOut(amountIn, path);

    const expectedUSDC = ethers.formatUnits(
      amountsOut[1],
      TOKENS.USDC.decimals
    );

    const amountOutMin = (amountsOut[1] * 95n) / 100n; // 5% slippage

    /* ========= STEP 4: SWAP ========= */
    const swapTx = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 600
    );

    await swapTx.wait();

    /* ========= RESPONSE ========= */
    res.json({
      success: true,
      swap: "USDT → USDC",
      inputUSDT: amount,
      expectedUSDC: expectedUSDC,
      txHash: swapTx.hash
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post("/swap/usdc-to-usdt", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    if (!amount || !privateKey) {
      return res.status(400).json({ error: "amount & privateKey required" });
    }

    const wallet = new ethers.Wallet(privateKey, provider);

    const router = new ethers.Contract(
      ROUTER_ADDRESS,
      routerAbi,
      wallet
    );

    const usdc = new ethers.Contract(
      TOKENS.USDC.address,
      erc20Abi,
      wallet
    );

    const amountIn = ethers.parseUnits(
      amount,
      TOKENS.USDC.decimals
    );

    /* ========= STEP 1: BALANCE CHECK ========= */
    const usdcBal = await usdc.balanceOf(wallet.address);
    if (usdcBal < amountIn) {
      return res.status(400).json({ error: "Insufficient USDC balance" });
    }

    /* ========= STEP 2: ALLOWANCE CHECK ========= */
    const allowance = await usdc.allowance(
      wallet.address,
      ROUTER_ADDRESS
    );

    if (allowance < amountIn) {
      const approveTx = await usdc.approve(
        ROUTER_ADDRESS,
        ethers.MaxUint256
      );
      await approveTx.wait();
    }

    /* ========= STEP 3: QUOTE ========= */
    const path = [
      TOKENS.USDC.address,
      TOKENS.USDT.address
    ];

    const amountsOut = await router.getAmountsOut(amountIn, path);

    const expectedUSDT = ethers.formatUnits(
      amountsOut[1],
      TOKENS.USDT.decimals
    );

    const amountOutMin = (amountsOut[1] * 95n) / 100n; // 5% slippage

    /* ========= STEP 4: SWAP ========= */
    const swapTx = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 600
    );

    await swapTx.wait();

    /* ========= RESPONSE ========= */
    res.json({
      success: true,
      swap: "USDC → USDT",
      inputUSDC: amount,
      expectedUSDT: expectedUSDT,
      txHash: swapTx.hash
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
  
});



export default router;
