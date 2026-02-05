import express from "express";
import dotenv from "dotenv";
import { ethers } from "ethers";

import { ROUTER_ADDRESS, routerAbi } from "./config/router.eth.mjs";
import { TOKENS_ETH } from "./config/tokens.eth.mjs";

dotenv.config();

const router = express.Router();

/* ===============================
   PROVIDER (MORALIS RPC)
================================ */
const provider = new ethers.JsonRpcProvider(
  "https://site1.moralis-nodes.com/eth/edf69d74486f40a0a22fac09f265daad",
  {
    chainId: 1,
    name: "ethereum"
  }
);

/* ===============================
   ERC20 ABI
================================ */
const erc20Abi = [
  "function approve(address spender,uint amount) external returns(bool)",
  "function allowance(address owner,address spender) external view returns(uint)",
  "function balanceOf(address owner) external view returns(uint)"
];

/* ===============================
   HELPERS
================================ */

async function approveIfNeeded(token, wallet, amount) {
  const allowance = await token.allowance(wallet.address, ROUTER_ADDRESS);
  if (allowance < amount) {
    await (await token.approve(
      ROUTER_ADDRESS,
      ethers.MaxUint256
    )).wait();
  }
}

async function checkEthBalance(wallet, amountInWei) {
  const bal = await wallet.provider.getBalance(wallet.address);
  if (bal < amountInWei) {
    throw new Error("Insufficient ETH balance");
  }
}

async function checkTokenBalance(token, wallet, amountInWei, symbol) {
  const bal = await token.balanceOf(wallet.address);
  if (bal < amountInWei) {
    throw new Error(`Insufficient ${symbol} balance`);
  }
}

/* =====================================================
   🔹 QUOTE API
===================================================== */

router.get("/quote", async (req, res) => {
  try {
    const { from, to, amount = "1" } = req.query;

    if (!TOKENS_ETH[from] || !TOKENS_ETH[to]) {
      return res.status(400).json({ success: false, error: "Invalid token" });
    }

    const routerC = new ethers.Contract(
      ROUTER_ADDRESS,
      routerAbi,
      provider
    );

    const amountIn = ethers.parseUnits(amount, TOKENS_ETH[from].decimals);
    const path = [TOKENS_ETH[from].address, TOKENS_ETH[to].address];

    const out = await routerC.getAmountsOut(amountIn, path);

    res.json({
      success: true,
      chain: "ETH",
      from,
      to,
      inputAmount: amount,
      outputAmount: ethers.formatUnits(out[1], TOKENS_ETH[to].decimals)
    });

  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* =====================================================
   1️⃣ ETH → USDT
===================================================== */

router.post("/swap/eth-to-usdt", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    const wallet = new ethers.Wallet(privateKey, provider);
    const routerC = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);

    const amountIn = ethers.parseUnits(amount, 18);
    await checkEthBalance(wallet, amountIn);

    const path = [TOKENS_ETH.ETH.address, TOKENS_ETH.USDT.address];
    const out = await routerC.getAmountsOut(amountIn, path);
    const expectedUSDT = ethers.formatUnits(out[1], 6);

    const tx = await routerC.swapExactETHForTokens(
      (out[1] * 95n) / 100n,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 600,
      { value: amountIn }
    );

    await tx.wait();

    res.json({
      success: true,
      swap: "ETH → USDT",
      inputETH: amount,
      expectedUSDT,
      txHash: tx.hash
    });

  } catch (e) {
    if (e.message.includes("Insufficient")) {
      return res.status(400).json({ success: false, error: e.message });
    }
    res.status(500).json({ success: false, error: "Swap failed" });
  }
});

/* =====================================================
   2️⃣ ETH → USDC
===================================================== */

router.post("/swap/eth-to-usdc", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    const wallet = new ethers.Wallet(privateKey, provider);
    const routerC = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);

    const amountIn = ethers.parseUnits(amount, 18);
    await checkEthBalance(wallet, amountIn);

    const path = [TOKENS_ETH.ETH.address, TOKENS_ETH.USDC.address];
    const out = await routerC.getAmountsOut(amountIn, path);
    const expectedUSDC = ethers.formatUnits(out[1], 6);

    const tx = await routerC.swapExactETHForTokens(
      (out[1] * 95n) / 100n,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 600,
      { value: amountIn }
    );

    await tx.wait();

    res.json({
      success: true,
      swap: "ETH → USDC",
      inputETH: amount,
      expectedUSDC,
      txHash: tx.hash
    });

  } catch (e) {
    if (e.message.includes("Insufficient")) {
      return res.status(400).json({ success: false, error: e.message });
    }
    res.status(500).json({ success: false, error: "Swap failed" });
  }
});

/* =====================================================
   3️⃣ USDT → ETH
===================================================== */

router.post("/swap/usdt-to-eth", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    const wallet = new ethers.Wallet(privateKey, provider);
    const routerC = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);

    const usdt = new ethers.Contract(TOKENS_ETH.USDT.address, erc20Abi, wallet);

    const amountIn = ethers.parseUnits(amount, 6);
    await checkTokenBalance(usdt, wallet, amountIn, "USDT");
    await approveIfNeeded(usdt, wallet, amountIn);

    const path = [TOKENS_ETH.USDT.address, TOKENS_ETH.ETH.address];
    const out = await routerC.getAmountsOut(amountIn, path);
    const expectedETH = ethers.formatUnits(out[1], 18);

    const tx = await routerC.swapExactTokensForETH(
      amountIn,
      (out[1] * 95n) / 100n,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 600
    );

    await tx.wait();

    res.json({
      success: true,
      swap: "USDT → ETH",
      inputUSDT: amount,
      expectedETH,
      txHash: tx.hash
    });

  } catch (e) {
    if (e.message.includes("Insufficient")) {
      return res.status(400).json({ success: false, error: e.message });
    }
    res.status(500).json({ success: false, error: "Swap failed" });
  }
});

/* =====================================================
   4️⃣ USDC → ETH
===================================================== */

router.post("/swap/usdc-to-eth", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    const wallet = new ethers.Wallet(privateKey, provider);
    const routerC = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);

    const usdc = new ethers.Contract(TOKENS_ETH.USDC.address, erc20Abi, wallet);

    const amountIn = ethers.parseUnits(amount, 6);
    await checkTokenBalance(usdc, wallet, amountIn, "USDC");
    await approveIfNeeded(usdc, wallet, amountIn);

    const path = [TOKENS_ETH.USDC.address, TOKENS_ETH.ETH.address];
    const out = await routerC.getAmountsOut(amountIn, path);
    const expectedETH = ethers.formatUnits(out[1], 18);

    const tx = await routerC.swapExactTokensForETH(
      amountIn,
      (out[1] * 95n) / 100n,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 600
    );

    await tx.wait();

    res.json({
      success: true,
      swap: "USDC → ETH",
      inputUSDC: amount,
      expectedETH,
      txHash: tx.hash
    });

  } catch (e) {
    if (e.message.includes("Insufficient")) {
      return res.status(400).json({ success: false, error: e.message });
    }
    res.status(500).json({ success: false, error: "Swap failed" });
  }
});

/* =====================================================
   5️⃣ USDT → USDC
===================================================== */

router.post("/swap/usdt-to-usdc", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    const wallet = new ethers.Wallet(privateKey, provider);
    const routerC = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);

    const usdt = new ethers.Contract(TOKENS_ETH.USDT.address, erc20Abi, wallet);

    const amountIn = ethers.parseUnits(amount, 6);
    await checkTokenBalance(usdt, wallet, amountIn, "USDT");
    await approveIfNeeded(usdt, wallet, amountIn);

    const path = [TOKENS_ETH.USDT.address, TOKENS_ETH.USDC.address];
    const out = await routerC.getAmountsOut(amountIn, path);
    const expectedUSDC = ethers.formatUnits(out[1], 6);

    const tx = await routerC.swapExactTokensForTokens(
      amountIn,
      (out[1] * 95n) / 100n,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 600
    );

    await tx.wait();

    res.json({
      success: true,
      swap: "USDT → USDC",
      inputUSDT: amount,
      expectedUSDC,
      txHash: tx.hash
    });

  } catch (e) {
    if (e.message.includes("Insufficient")) {
      return res.status(400).json({ success: false, error: e.message });
    }
    res.status(500).json({ success: false, error: "Swap failed" });
  }
});

/* =====================================================
   6️⃣ USDC → USDT
===================================================== */

router.post("/swap/usdc-to-usdt", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    const wallet = new ethers.Wallet(privateKey, provider);
    const routerC = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);

    const usdc = new ethers.Contract(TOKENS_ETH.USDC.address, erc20Abi, wallet);

    const amountIn = ethers.parseUnits(amount, 6);
    await checkTokenBalance(usdc, wallet, amountIn, "USDC");
    await approveIfNeeded(usdc, wallet, amountIn);

    const path = [TOKENS_ETH.USDC.address, TOKENS_ETH.USDT.address];
    const out = await routerC.getAmountsOut(amountIn, path);
    const expectedUSDT = ethers.formatUnits(out[1], 6);

    const tx = await routerC.swapExactTokensForTokens(
      amountIn,
      (out[1] * 95n) / 100n,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 600
    );

    await tx.wait();

    res.json({
      success: true,
      swap: "USDC → USDT",
      inputUSDC: amount,
      expectedUSDT,
      txHash: tx.hash
    });

  } catch (e) {
    if (e.message.includes("Insufficient")) {
      return res.status(400).json({ success: false, error: e.message });
    }
    res.status(500).json({ success: false, error: "Swap failed" });
  }
});

export default router;
