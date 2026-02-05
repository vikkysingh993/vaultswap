// Uniswap V2 (QuickSwap - Polygon)

export const ROUTER_ADDRESS =
  "0xedf6066a2b290C185783862C7F4776A2C8077AD1";

export const routerAbi = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn,uint amountOutMin,address[] calldata path,address to,uint deadline) external returns (uint[] memory amounts)"
];


