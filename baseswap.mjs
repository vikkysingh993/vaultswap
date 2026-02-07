import express from "express";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const router = express.Router(); 

/* ===============================
   BASE CHAIN CONFIG
================================ */
const provider = new ethers.JsonRpcProvider(
  "https://site1.moralis-nodes.com/base/c33a445381944db09bb4440571d2ac9c",
  {
    chainId: 8453,
    name: "base"
  }
);

/* ===============================
   ROUTER (BASE)
================================ */

const ROUTER_ADDRESS =
  "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24";

const routerAbi = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory)",
  "function swapExactETHForTokens(uint amountOutMin,address[] calldata path,address to,uint deadline) payable external",
  "function swapExactTokensForETH(uint amountIn,uint amountOutMin,address[] calldata path,address to,uint deadline) external",
  "function swapExactTokensForTokens(uint amountIn,uint amountOutMin,address[] calldata path,address to,uint deadline) external"
];

/* ===============================
   TOKENS (BASE)
================================ */

const TOKENS_BASE = {
  ETH: {
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18
  },
  USDC: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6
  },
  USDT: {
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    decimals: 6
  }
};

/* ===============================
   ERC20 ABI
================================ */

const erc20Abi = [
  "function approve(address spender,uint amount) external returns(bool)",
  "function allowance(address owner,address spender) external view returns(uint)",
  "function balanceOf(address owner) external view returns(uint)"
];

async function approveIfNeeded(token, wallet, amount) {
  const allowance = await token.allowance(wallet.address, ROUTER_ADDRESS);
  if (allowance < amount) {
    await (await token.approve(
      ROUTER_ADDRESS,
      ethers.MaxUint256
    )).wait();
  }
}

/* =====================================================
   🔹 PRICE / QUOTE
===================================================== */

router.get("/quote", async (req, res) => {
  try {
    const { from, to, amount = "1" } = req.query;

    if (!TOKENS_BASE[from] || !TOKENS_BASE[to]) {
      return res.status(400).json({ error: "Invalid token" });
    }

    const routerC = new ethers.Contract(
      ROUTER_ADDRESS,
      routerAbi,
      provider
    );

    const amountIn = ethers.parseUnits(
      amount,
      TOKENS_BASE[from].decimals
    );

    const path = [
      TOKENS_BASE[from].address,
      TOKENS_BASE[to].address
    ];

    const out = await routerC.getAmountsOut(amountIn, path);

    res.json({
      success: true,
      chain: "BASE",
      from,
      to,
      inputAmount: amount,
      outputAmount: ethers.formatUnits(
        out[1],
        TOKENS_BASE[to].decimals
      )
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =====================================================
   6️⃣ BASE SWAPS
===================================================== */

// 1️⃣ ETH → USDC
router.post("/swap/eth-to-usdc", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;
    const wallet = new ethers.Wallet(privateKey, provider);
    const routerC = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);

    const amountIn = ethers.parseUnits(amount, 18);
    const path = [TOKENS_BASE.ETH.address, TOKENS_BASE.USDC.address];

    const out = await routerC.getAmountsOut(amountIn, path);

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
      expectedUSDC: ethers.formatUnits(out[1], 6),
      txHash: tx.hash
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2️⃣ ETH → USDT
router.post("/swap/eth-to-usdt", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;
    const wallet = new ethers.Wallet(privateKey, provider);
    const routerC = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);

    const amountIn = ethers.parseUnits(amount, 18);
    const path = [TOKENS_BASE.ETH.address, TOKENS_BASE.USDT.address];

    const out = await routerC.getAmountsOut(amountIn, path);

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
      expectedUSDT: ethers.formatUnits(out[1], 6),
      txHash: tx.hash
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3️⃣ USDC → ETH
router.post("/swap/usdc-to-eth", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;
    const wallet = new ethers.Wallet(privateKey, provider);
    const routerC = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);

    const usdc = new ethers.Contract(
      TOKENS_BASE.USDC.address,
      erc20Abi,
      wallet
    );

    const amountIn = ethers.parseUnits(amount, 6);
    await approveIfNeeded(usdc, wallet, amountIn);

    const path = [TOKENS_BASE.USDC.address, TOKENS_BASE.ETH.address];
    const out = await routerC.getAmountsOut(amountIn, path);

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
      expectedETH: ethers.formatUnits(out[1], 18),
      txHash: tx.hash
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4️⃣ USDT → ETH
router.post("/swap/usdt-to-eth", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;
    const wallet = new ethers.Wallet(privateKey, provider);
    const routerC = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);

    const usdt = new ethers.Contract(
      TOKENS_BASE.USDT.address,
      erc20Abi,
      wallet
    );

    const amountIn = ethers.parseUnits(amount, 6);
    await approveIfNeeded(usdt, wallet, amountIn);

    const path = [TOKENS_BASE.USDT.address, TOKENS_BASE.ETH.address];
    const out = await routerC.getAmountsOut(amountIn, path);

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
      expectedETH: ethers.formatUnits(out[1], 18),
      txHash: tx.hash
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 5️⃣ USDC → USDT
router.post("/swap/usdc-to-usdt", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;
    const wallet = new ethers.Wallet(privateKey, provider);
    const routerC = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);

    const usdc = new ethers.Contract(
      TOKENS_BASE.USDC.address,
      erc20Abi,
      wallet
    );

    const amountIn = ethers.parseUnits(amount, 6);
    await approveIfNeeded(usdc, wallet, amountIn);

    const path = [TOKENS_BASE.USDC.address, TOKENS_BASE.USDT.address];
    const out = await routerC.getAmountsOut(amountIn, path);

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
      expectedUSDT: ethers.formatUnits(out[1], 6),
      txHash: tx.hash
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 6️⃣ USDT → USDC
router.post("/swap/usdt-to-usdc", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;
    const wallet = new ethers.Wallet(privateKey, provider);
    const routerC = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);

    const usdt = new ethers.Contract(
      TOKENS_BASE.USDT.address,
      erc20Abi,
      wallet
    );

    const amountIn = ethers.parseUnits(amount, 6);
    await approveIfNeeded(usdt, wallet, amountIn);

    const path = [TOKENS_BASE.USDT.address, TOKENS_BASE.USDC.address];
    const out = await routerC.getAmountsOut(amountIn, path);

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
      expectedUSDC: ethers.formatUnits(out[1], 6),
      txHash: tx.hash
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
