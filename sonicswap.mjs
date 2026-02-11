import express from "express";
import { ethers } from "ethers";

const router = express.Router();

/* ===============================
   CONFIG
================================ */


const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)"
];


const SONIC_RPC = "https://rpc.soniclabs.com";
const CHAIN_ID = 146; // Sonic

const TOKENS = {
  SONIC: {
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18
  },
  USDT: {
    address: "0x6047828dc181963ba44974801ff68e538da5eaf9",
    decimals: 6
  },
  USDC: {
    address: "0x29219dd400f2bf60e5a23d13be72b486d4038894",
    decimals: 6
  }
};

// Shadow / Universal Router
const UNIVERSAL_ROUTER =
  "0x92643dc4f75c374b689774160cdea09a0704a9c2";

const provider = new ethers.JsonRpcProvider(SONIC_RPC);






/* =====================================================
   🔹 PRICE / QUOTE
===================================================== */

router.get("/quote", async (req, res) => {
  try {
    const { from, to, amount = "1" } = req.query;

    if (!TOKENS[from] || !TOKENS[to]) {
      return res.status(400).json({
        success: false,
        error: "Invalid token"
      });
    }

    const amountIn = ethers.parseUnits(
      amount,
      TOKENS[from].decimals
    );

    const quoteRes = await fetch("https://api.odos.xyz/sor/quote/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainId: CHAIN_ID,
        inputTokens: [{
          tokenAddress: TOKENS[from].address,
          amount: amountIn.toString()
        }],
        outputTokens: [{
          tokenAddress: TOKENS[to].address,
          proportion: 1
        }],
        userAddr: "0x0000000000000000000000000000000000000001",
        slippageLimitPercent: 1
      })
    });

    const quote = await quoteRes.json();
    if (!quote.outAmounts) throw new Error("Quote failed");

    res.json({
      success: true,
      chain: "SONIC",
      from,
      to,
      inputAmount: amount,
      outputAmount: ethers.formatUnits(
        quote.outAmounts[0],
        TOKENS[to].decimals
      )
    });

  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

/* =====================================================
   🔹 CORE ODOS SWAP FUNCTION
===================================================== */




// async function doSwap({ fromToken, toToken, amount, privateKey }) {
//   const wallet = new ethers.Wallet(privateKey, provider);
//   const userAddress = wallet.address;

//   // 1️⃣ Quote
//   const quoteRes = await fetch("https://api.odos.xyz/sor/quote/v2", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       chainId: CHAIN_ID,
//       inputTokens: [{
//         tokenAddress: TOKENS[fromToken].address,
//         amount: ethers.parseUnits(
//           amount,
//           TOKENS[fromToken].decimals
//         ).toString()
//       }],
//       outputTokens: [{
//         tokenAddress: TOKENS[toToken].address,
//         proportion: 1
//       }],
//       userAddr: userAddress,
//       slippageLimitPercent: 1
//     })
//   });

//   const quote = await quoteRes.json();
//   if (!quote.pathId) throw new Error("Odos quote failed");

//   const expectedOut = ethers.formatUnits(
//     quote.outAmounts[0],
//     TOKENS[toToken].decimals
//   );

//   // 2️⃣ Assemble
//   const assembleRes = await fetch("https://api.odos.xyz/sor/assemble", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       userAddr: userAddress,
//       pathId: quote.pathId
//     })
//   });

//   const assembled = await assembleRes.json();
//   if (!assembled.transaction) throw new Error("Assemble failed");

//   // 3️⃣ Send TX
//   const tx = await wallet.sendTransaction({
//     to: assembled.transaction.to,
//     data: assembled.transaction.data,
//     value: assembled.transaction.value
//   });

//   // 4️⃣ Receipt check
//   const receipt = await tx.wait();
//   if (receipt.status !== 1) {
//     throw new Error("Transaction reverted on-chain");
//   }

//   return {
//     txHash: tx.hash,
//     expectedOut
//   };
// }


async function doSwap({ fromToken, toToken, amount, privateKey }) {

  const wallet = new ethers.Wallet(privateKey, provider);
  const userAddress = wallet.address;

  const amountIn = ethers.parseUnits(
    amount,
    TOKENS[fromToken].decimals
  );

  // 1️⃣ QUOTE
  const quoteRes = await fetch("https://api.odos.xyz/sor/quote/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chainId: CHAIN_ID,
      inputTokens: [{
        tokenAddress: TOKENS[fromToken].address,
        amount: amountIn.toString()
      }],
      outputTokens: [{
        tokenAddress: TOKENS[toToken].address,
        proportion: 1
      }],
      userAddr: userAddress,
      slippageLimitPercent: 1
    })
  });

  const quote = await quoteRes.json();
  if (!quote.pathId) throw new Error("Odos quote failed");

  // 2️⃣ ASSEMBLE
  const assembleRes = await fetch("https://api.odos.xyz/sor/assemble", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userAddr: userAddress,
      pathId: quote.pathId
    })
  });

  const assembled = await assembleRes.json();
  if (!assembled.transaction) throw new Error("Assemble failed");

  // 3️⃣ APPROVE (Only ERC20, not native SONIC)
  if (TOKENS[fromToken].address !== ethers.ZeroAddress) {

    const ERC20_ABI = [
      "function approve(address spender, uint256 amount) external returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)"
    ];

    const tokenContract = new ethers.Contract(
      TOKENS[fromToken].address,
      ERC20_ABI,
      wallet
    );

    const allowance = await tokenContract.allowance(
      userAddress,
      assembled.transaction.to
    );

    if (allowance < amountIn) {
      const approveTx = await tokenContract.approve(
        assembled.transaction.to,
        ethers.MaxUint256   // infinite approve (better)
      );

      await approveTx.wait();
    }
  }

  // 4️⃣ SEND SWAP TX
  const tx = await wallet.sendTransaction({
    to: assembled.transaction.to,
    data: assembled.transaction.data,
    value: assembled.transaction.value
  });

  const receipt = await tx.wait();
  if (receipt.status !== 1) {
    throw new Error("Transaction reverted on-chain");
  }

  return {
    txHash: tx.hash,
    expectedOut: ethers.formatUnits(
      quote.outAmounts[0],
      TOKENS[toToken].decimals
    )
  };
}


/* =====================================================
   🔹 SWAP ROUTES (ALL)
===================================================== */

router.post("/usdc-to-usdt", async (req, res) => {
  try {
    const r = await doSwap({ fromToken: "USDC", toToken: "USDT", ...req.body });
    res.json({
      success: true,
      swap: "USDC → USDT",
      inputUSDC: req.body.amount,
      expectedUSDT: r.expectedOut,
      txHash: r.txHash
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/usdt-to-usdc", async (req, res) => {
  try {
    const r = await doSwap({ fromToken: "USDT", toToken: "USDC", ...req.body });
    res.json({
      success: true,
      swap: "USDT → USDC",
      inputUSDT: req.body.amount,
      expectedUSDC: r.expectedOut,
      txHash: r.txHash
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/usdt-to-sonic", async (req, res) => {
  try {
    const r = await doSwap({ fromToken: "USDT", toToken: "SONIC", ...req.body });
    res.json({
      success: true,
      swap: "USDT → SONIC",
      inputUSDT: req.body.amount,
      expectedSONIC: r.expectedOut,
      txHash: r.txHash
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/sonic-to-usdt", async (req, res) => {
  try {
    const r = await doSwap({ fromToken: "SONIC", toToken: "USDT", ...req.body });
    res.json({
      success: true,
      swap: "SONIC → USDT",
      inputSONIC: req.body.amount,
      expectedUSDT: r.expectedOut,
      txHash: r.txHash
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/sonic-to-usdc", async (req, res) => {
  try {
    const r = await doSwap({ fromToken: "SONIC", toToken: "USDC", ...req.body });
    res.json({
      success: true,
      swap: "SONIC → USDC",
      inputSONIC: req.body.amount,
      expectedUSDC: r.expectedOut,
      txHash: r.txHash
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Universal Router
router.post("/usdc-to-sonic-universal", async (req, res) => {
  try {
    const r = await doUniversalUSDCtoSONIC(req.body);
    res.json({
      success: true,
      router: "UniversalRouter (Shadow)",
      swap: "USDC → SONIC",
      inputUSDC: req.body.amount,
      expectedSONIC: r.expectedOut,
      txHash: r.txHash
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// USDC → SONIC (ODOS ROUTER)
router.post("/usdc-to-sonic", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;

    if (!amount || !privateKey) {
      return res.status(400).json({
        success: false,
        error: "amount and privateKey required"
      });
    }

    const r = await doSwap({
      fromToken: "USDC",
      toToken: "SONIC",
      amount,
      privateKey
    });

    res.json({
      success: true,
      swap: "USDC → SONIC",
      inputUSDC: amount,
      expectedSONIC: r.expectedOut,
      txHash: r.txHash
    });

  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});


export default router;
