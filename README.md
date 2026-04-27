# VEIL Finance — Confidential Lending Protocol

> **Zama Developer Program Season 2 — Builder Track Submission**
> Built on Zama FHEVM | Deployed on Sepolia Testnet

**Live Demo:** [sammy-xxiv.github.io/veil-finance](https://sammy-xxiv.github.io/veil-finance)
**Compare Page:** [sammy-xxiv.github.io/veil-finance/compare.html](https://sammy-xxiv.github.io/veil-finance/compare.html)
**Contract:** [0x937D2A53114330C623c669cD7Cb5364acd7FbD9f](https://sepolia.etherscan.io/address/0x937D2A53114330C623c669cD7Cb5364acd7FbD9f)
**vETH Token:** [0x297788e88472B22f4441754Eec328800A1A17023](https://sepolia.etherscan.io/address/0x297788e88472B22f4441754Eec328800A1A17023)

---

## The Problem

On every lending protocol today — Aave, Compound, Euler — your position is completely public.

Any bot can call `getUserAccountData(yourAddress)` and instantly read:
- Your exact collateral amount
- Your exact debt amount
- Your health factor
- Your precise liquidation price

This means liquidation bots sit and wait for your health factor to drop below the threshold, then snipe you the moment you become undercollateralized. Whales can also monitor large positions and front-run or manipulate prices to trigger cascading liquidations.

**DeFi's transparency is a feature for security — but a vulnerability for users.**

---

## The Solution

VEIL Finance is the first lending protocol where your position is encrypted onchain using Fully Homomorphic Encryption (FHE).

- Collateral stored as `euint64` ciphertext — not readable by anyone
- Debt stored as `euint64` ciphertext — not readable by anyone
- Health factor computed in FHE using `FHE.lt()` — never decrypted onchain
- Liquidation bots are completely blind — they cannot calculate when to liquidate you

**This is real FHE encryption — not obfuscation.**

---

## Onchain Proof

Compare real transaction input data from Aave vs VEIL:

### Aave V3 `supply()` — Amount Fully Readable
```
Function: supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)
MethodID: 0x617ba037

[0] asset:      00000000000000000000000029f2d40b0605204364af54ec677bd022da425d03
[1] amount:     00000000000000000000000000000000000000000000000000000000000249f0
                ↑ Decodes to 150,000 — exact deposit amount visible to everyone
[2] onBehalfOf: 00000000000000000000000012aa015326add9963ffd10197a2caa2a832cc47b
[3] referral:   0000000000000000000000000000000000000000000000000000000000000000
```

### VEIL `openPosition()` — FHE Encrypted
```
Function: openPosition(bytes32 inputCollateral, bytes inputProof)
MethodID: 0xfe292ba9

[0] handle: fa22595f1b42861fb3bf36c58481e80831d6925e1d000000000000aa36a70500
[1] offset: 0000000000000000000000000000000000000000000000000000000000000040
[2] length: 0000000000000000000000000000000000000000000000000000000000000064
[3] proof:  0101fa22595f1b42861fb3bf36c58481e80831d6925e1d000000000000aa36a7
[4] proof:  0500f15173080e9db74abac96dcd8f7022cee1d3880427e1cb8f6a833515e9ef
[5] proof:  034e08144e2004e77e3f93593044a787aff29ce35aa0e5c9d19a6c3d2e74c28e
[6] proof:  37d31c0000000000000000000000000000000000000000000000000000000000
            ↑ FHE ciphertext — no amount visible anywhere. Mathematically impossible
              to decode without the Zama KMS private key.
```

---

## How It Works

### Architecture

```
User Browser
    │
    ├── Frontend (GitHub Pages)
    │       sammy-xxiv.github.io/veil-finance
    │
    ├── Encryption Backend (Render Node.js)
    │       veil-backend-2gki.onrender.com
    │       Uses @zama-fhe/relayer-sdk v0.4.0-5
    │       Generates FHE proof via Zama Relayer
    │
    └── Smart Contracts (Sepolia)
            VeilLendingV3 — lending logic
            VeilETH (vETH) — ERC20 receipt token
```

### Deposit Flow

1. User enters collateral amount in frontend
2. Frontend calls Render backend with `{amount, contractAddress, userAddress}`
3. Backend calls Zama Relayer SDK → generates `euint64` ciphertext + ZKP proof
4. Frontend calls `openPosition(encryptedHandle, inputProof)` with ETH value
5. Contract stores encrypted collateral using `FHE.fromExternal()`
6. Contract mints vETH 1:1 as receipt token
7. Transaction confirms on Sepolia — input data shows only ciphertext

### Blind Liquidation

This is the core innovation. On VEIL:

```solidity
// Health factor computed entirely in FHE — never decrypted
euint64 scaledCollateral = FHE.mul(pos.collateral, FHE.asEuint64(100));
euint64 liquidationLevel = FHE.mul(pos.debt, FHE.asEuint64(LIQUIDATION_THRESHOLD));
ebool isLiquidatable = FHE.lt(scaledCollateral, liquidationLevel);
ebool hasDebt = FHE.gt(pos.debt, FHE.asEuint64(0));
ebool shouldLiquidate = FHE.and(isLiquidatable, hasDebt);
```

The health factor comparison happens on encrypted values. The result is never exposed as plaintext. A liquidation bot cannot call a function to check if your position is liquidatable — it must attempt blindly. If your position is healthy, the transaction reverts and the bot loses gas.

**Bot economics on Aave:**
1. Call `getUserAccountData(victim)` → reads health factor instantly (free)
2. Calculate liquidation price → set automated alert
3. Fire liquidation when price hits → guaranteed profit

**Bot economics on VEIL:**
1. Try to read health factor → function does not exist
2. Cannot calculate liquidation price → no data
3. Attempt liquidation blindly → tx reverts if healthy, loses gas
4. Must repeat on every address every block → thousands in wasted gas → gives up

---

## Smart Contracts

### VeilLendingV3.sol

| Function | Description |
|---|---|
| `openPosition(euint64, bytes)` | Deposit ETH as encrypted collateral, mint vETH |
| `addCollateral(euint64, bytes)` | Add more collateral to existing position |
| `borrow(euint64, bytes, uint256)` | Borrow ETH against encrypted collateral |
| `repay(euint64, bytes)` | Repay debt, return ETH to pool |
| `closePosition()` | Burn vETH, return collateral |
| `liquidate(address)` | Blind liquidation attempt — reverts if healthy |
| `addLiquidity()` | Owner: add ETH to lending pool |
| `getPositionMeta(address)` | Returns position existence and plaintext collateral |

**Key FHE types used:**
- `euint64` — encrypted 64-bit unsigned integer (collateral, debt)
- `ebool` — encrypted boolean (liquidation decision)
- `externalEuint64` — external encrypted input with ZKP proof
- `FHE.fromExternal()` — verify and import encrypted input
- `FHE.lt()`, `FHE.gt()`, `FHE.and()` — encrypted comparisons
- `FHE.allow()` — ACL: only position owner can decrypt their data
- `FHE.allowThis()` — contract retains access to encrypted state

### VeilETH.sol (vETH)

ERC20 receipt token minted 1:1 when collateral is deposited. Burned when position is closed or liquidated. Proves ownership of locked collateral. Only the VeilLending contract can mint or burn.

---

## Protocol Parameters

| Parameter | Value |
|---|---|
| Liquidation Threshold | 150% |
| Max LTV | 66% |
| Liquidation Bonus | 5% |
| Borrow APR | 5% |
| Min Collateral | 0.01 ETH |
| Network | Sepolia Testnet |

---

## Known Limitations & Roadmap

### Current Limitations

**1. Collateral partially inferable from tx history**
`collateralPlain` is stored as a plaintext `uint256` to enable vETH minting and collateral return. The ETH `msg.value` in deposit transactions is also public. A determined observer watching wallet transactions can infer collateral amounts. In production, this would be addressed by using a commitment scheme or fully encrypted collateral with a ZKP for minting.

**2. Borrow amount visible via internal transaction**
The ETH transfer from pool to borrower is a public internal transaction on Ethereum. The `plaintextAmount` parameter in `borrow()` is also visible in calldata. The debt record in contract storage is encrypted, but the initial borrow amount can be observed from transaction history.

**3. No keeper mechanism**
Liquidators must attempt blindly and lose gas on failed attempts. This reduces liquidation efficiency. A production protocol would implement a keeper network with incentives for monitoring positions.

**4. Fixed interest rate**
Simple flat fee of 0.0001 ETH/day. A production protocol would use a dynamic interest rate model based on pool utilization.

**5. Single asset**
ETH only. Multi-asset support would require price oracle integration (Chainlink) and per-asset risk parameters.

### Why This Still Matters

Despite these limitations, VEIL demonstrates the core value proposition: **health factor computation in FHE**. Even if a sophisticated observer can infer collateral from transaction history, they cannot call a contract function to get your current health factor. The liquidation threshold check happens entirely in encrypted computation. Bots cannot efficiently target positions — the economic cost of blind liquidation attempts makes predatory liquidation irrational.

This is a meaningful step toward confidential DeFi, built on real FHE infrastructure.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.24, Zama FHEVM |
| FHE Library | `@fhevm/solidity` — `FHE.sol`, `ZamaConfig.sol` |
| Receipt Token | OpenZeppelin ERC20 v4.9.3 |
| Frontend | Vanilla HTML/CSS/JS, ethers.js v6 |
| Encryption Backend | Node.js, Express, `@zama-fhe/relayer-sdk` v0.4.0-5 |
| Hosting | GitHub Pages (frontend), Render (backend) |
| Network | Sepolia Testnet |
| Wallet Support | MetaMask, Rabby, OKX, Brave, Coinbase, Rainbow, Trust, Phantom |

---

## Local Development

### Prerequisites
- Node.js 18+
- MetaMask or any EVM wallet
- Sepolia ETH (get from [sepoliafaucet.com](https://sepoliafaucet.com))

### Backend Setup
```bash
git clone https://github.com/sammy-xxiv/veil-backend
cd veil-backend
npm install
node server.js
```

### Frontend
The frontend is a single HTML file. Open `index.html` in any browser or serve with:
```bash
npx serve .
```

Update `CONFIG.FHE_WORKER` in `index.html` to point to your local backend:
```javascript
FHE_WORKER: 'http://localhost:3000/encrypt',
```

### Smart Contracts
Contracts are deployed on Sepolia. To redeploy:
1. Open [Remix IDE](https://remix.ethereum.org)
2. Import `VeilETH.sol` and `VeilLendingV3.sol`
3. Deploy `VeilETH` first, copy address
4. Deploy `VeilLendingV3` with `(300000, vETH_address)`
5. Call `setLendingContract(lending_address)` on VeilETH
6. Call `addLiquidity()` with ETH on VeilLendingV3

---

## Addressing the "Obfuscation" Critique

ChatGPT and other tools may claim VEIL is "just obfuscating" rather than truly securing. This is incorrect.

**Obfuscation** = hiding data through encoding, proprietary formats, or making it hard to read. The underlying data is still there and can be recovered.

**FHE** = mathematically encrypted data that cannot be decoded without the private key held by the Zama KMS. The contract operates on ciphertext directly using homomorphic operations.

Proof: the `euint64` types in VEIL's contract are Zama's FHE ciphertext types. `FHE.lt()` performs a less-than comparison on encrypted values without ever decrypting them. The result (`ebool`) is also encrypted. This is not obfuscation — it is the same mathematical foundation used in modern cryptography.

See the [Zama FHEVM documentation](https://docs.zama.ai) for technical details on how FHE operations work onchain.

---

## Acknowledgements

Built with [Zama FHEVM](https://github.com/zama-ai/fhevm) for the Zama Developer Program Season 2.

---

*Made by SAMMY — VEIL Finance 2026*

