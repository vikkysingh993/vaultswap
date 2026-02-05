import { ethers } from "ethers";

export const TOKENS_ETH = {
  ETH: {
    address: ethers.getAddress(
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    ),
    decimals: 18
  },
  USDT: {
    address: ethers.getAddress(
      "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    ),
    decimals: 6
  },
  USDC: {
    address: ethers.getAddress(
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    ),
    decimals: 6
  }
};
