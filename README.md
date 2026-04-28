# VEIL Finance — Confidential Lending Protocol

> **Zama Developer Program Season 2 — Builder Track Submission**
> Built on Zama FHEVM | Deployed on Sepolia Testnet

**Live App:** [sammy-xxiv.github.io/veil](https://sammy-xxiv.github.io/veil)
**Compare Page:** [sammy-xxiv.github.io/veil/compare.html](https://sammy-xxiv.github.io/veil/compare.html)
**Contract:** [0x6d69a00107Ed9d487904700a00E31e657dA8a392](https://sepolia.etherscan.io/address/0x6d69a00107Ed9d487904700a00E31e657dA8a392)
**cWETHMock:** [0x46208622DA27d91db4f0393733C8BA082ed83158](https://sepolia.etherscan.io/address/0x46208622DA27d91db4f0393733C8BA082ed83158)

---

## The Problem

On every lending protocol today — Aave, Compound, Euler — your position is completely public.

Any bot can call `getUserAccountData(yourAddress)` and instantly read:
- Your exact collateral amount
- Your exact debt amount
- Your health factor
- Your precise liquidation price

Liquidation bots sit and wait. The moment your health factor drops below the threshold, they snipe you. Whales monitor large positions and front-run price movements to trigger cascading liquidations.

**DeFi transparency is a feature for security — but a vulnerability for users.**

---

## The Solution

VEIL Finance is a lending protocol where your position is encrypted onchain using Fully Homomorphic Encryption (FHE) powered by Zama FHEVM.

- Collateral stored as `euint64` ciphertext — not readable by anyone
- Debt stored as `euint64` ciphertext — not readable by anyone
- Health factor computed using `FHE.lt()` — never decrypted onchain
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
                ^ Decodes to 150,000 — exact deposit amount visible to everyone
[2] onBehalfOf: 00000000000000000000000012aa015326add9963ffd10197a2caa2a832cc47b
[3] referral:   0000000000000000000000000000000000000000000000000000000000000000
```

### VEIL `openPosition()` — FHE Encrypted
```
Function: openPosition(bytes32 inputCollateral, bytes inputProof, uint256 plainAmount)
MethodID: 0xfe292ba9

[0] handle: fa22595f1b42861fb3bf36c58481e80831d6925e1d000000000000aa36a70500
[1] offset: 0000000000000000000000000000000000000000000000000000000000000040
[2] length: 0000000000000000000000000000000000000000000000000000000000000064
[3] proof:  0101fa22595f1b42861fb3bf36c58481e80831d6925e1d000000000000aa36a7
[4] proof:  0500f15173080e9db74abac96dcd8f7022cee1d3880427e1cb8f6a833515e9ef
[5] proof:  034e08144e2004e77e3f93593044a787aff29ce35aa0e5c9d19a6c3d2e74c28e
[6] proof:  37d31c0000000000000000000000000000000000000000000000000000000000
            ^ FHE ciphertext — no amount visible. Impossible to decode without KMS key.
```

---

## Why Bots Cannot Liquidate You

**On Aave:**
1. Call `getUserAccountData(victim)` — reads health factor instantly (free)
2. Calculate liquidation price — set automated alert
3. Fire liquidation when price hits — guaranteed profit

**On VEIL:**
1. Try to read health factor — function does not exist
2. Cannot calculate liquidation price — no readable data
3. Attempt liquidation blindly — tx reverts if healthy, loses gas
4. Must repeat on every address every block — thousands in wasted gas — gives up

---

## Architecture

```
User Browser
    |
    |-- Frontend (GitHub Pages)
    |       sammy-xxiv.github.io/veil
    |
    |-- Encryption Backend (Render Node.js)
    |       veil-backend-2gki.onrender.com
    |       Uses @zama-fhe/relayer-sdk v0.4.1
    |       Generates real FHE proof via Zama Relayer
    |
    └-- Smart Contract (Sepolia)
            VeilLending — lending logic with FHE encrypted state
            Collateral token: cWETHMock (ERC7984)
            Debt token: cWETHMock (ERC7984)
```

---

## Smart Contract

### VeilLending.sol

| Function | Description |
|---|---|
| `openPosition(euint64, bytes, uint256)` | Deposit cWETH as encrypted collateral |
| `addCollateral(euint64, bytes, uint256)` | Add more collateral to position |
| `borrow(euint64, bytes, uint256)` | Borrow cWETH against collateral |
| `repay(euint64, bytes, uint256)` | Repay debt |
| `closePosition()` | Return collateral, close position |
| `liquidate(address)` | Blind liquidation — FHE health check |
| `getPositionMeta(address)` | Returns position metadata |
| `getStats()` | Returns total open positions |

**Key FHE types used:**
- `euint64` — encrypted 64-bit integer (collateral, debt)
- `ebool` — encrypted boolean (liquidation decision)
- `externalEuint64` — external encrypted input with ZKP proof
- `FHE.fromExternal()` — verify and import encrypted input
- `FHE.lt()`, `FHE.gt()`, `FHE.and()` — encrypted comparisons
- `FHE.select()` — conditional execution without revealing result
- `FHE.div()` — division with plaintext divisor
- `FHE.allow()` — ACL: only position owner can decrypt their data
- `FHE.allowThis()` — contract retains access to encrypted state

### Hybrid Design

VEIL uses a hybrid approach for practical UX:

| Field | Type | Purpose |
|---|---|---|
| `collateral` | `euint64` | FHE health factor computation |
| `debt` | `euint64` | FHE health factor computation |
| `collateralPlain` | `uint256` | Dashboard display |
| `debtPlain` | `uint256` | Dashboard display + close position check |

### Blind Liquidation (Core Innovation)

```solidity
// Health check entirely in FHE — never exposed onchain
euint64 scaledCollateral = FHE.mul(pos.collateral, FHE.asEuint64(100));
euint64 liquidationLevel = FHE.mul(pos.debt, FHE.asEuint64(LIQUIDATION_THRESHOLD));
ebool isLiquidatable   = FHE.lt(scaledCollateral, liquidationLevel);
ebool hasDebt          = FHE.gt(pos.debt, FHE.asEuint64(0));
ebool shouldLiquidate  = FHE.and(isLiquidatable, hasDebt);

// Bonus only paid if liquidatable — else 0 (silent no-op)
euint64 bonusToSend = FHE.select(shouldLiquidate, rawBonus, FHE.asEuint64(0));
```

No `require()` on encrypted booleans. `FHE.select()` silently no-ops if position is healthy.

---

## Protocol Parameters

| Parameter | Value |
|---|---|
| Liquidation Threshold | 150% |
| Max LTV | 66% |
| Liquidation Bonus | 5% |
| Collateral Token | cWETHMock (ERC7984, 8 decimals) |
| Debt Token | cWETHMock (ERC7984, 8 decimals) |
| Network | Sepolia Testnet |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Sepolia ETH from [sepoliafaucet.com](https://sepoliafaucet.com)

### 1. Clone and install

```bash
git clone https://github.com/sammy-XXIV/VeilV2.git
cd VeilV2/veil-v2
npm install
```

### 2. Set up environment

```bash
echo "PRIVATE_KEY=your_private_key" > .env
echo "SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com" >> .env
```

### 3. Get cWETH

```bash
npx hardhat run scripts/testWrap.ts --network sepolia
```

Mints 1 WETH and wraps it to cWETH in your wallet.

### 4. Approve VEIL to spend your cWETH

```bash
npx hardhat run scripts/approve.ts --network sepolia
```

### 5. Use the app

Go to [sammy-xxiv.github.io/veil](https://sammy-xxiv.github.io/veil), connect wallet, and deposit.

---

## Known Limitations

**1. cWETH wallet balance not displayed**
ERC7984 balances are encrypted onchain. Standard wallets cannot display them. The dashboard shows position data from `getPositionMeta()` which returns plaintext amounts for UX.

**2. collateralPlain is public**
Stored as plaintext for UI display. An observer can read collateral from `getPositionMeta()`. Health factor remains protected — bots cannot compute liquidation price without the encrypted debt.

**3. ETH transfer amounts visible**
The `plainAmount` parameter in borrow/repay is visible in calldata. The encrypted debt record is what protects the health factor computation.

**4. Single asset**
cWETH only. Multi-asset support requires price oracle integration.

**5. No keeper mechanism**
Liquidators attempt blindly. Production would implement a keeper network.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.24, Zama FHEVM |
| FHE Library | `@fhevm/solidity` |
| Confidential Tokens | `@openzeppelin/confidential-contracts` ERC7984 |
| Frontend | Vanilla HTML/CSS/JS, ethers.js v6 |
| Encryption Backend | Node.js, Express, `@zama-fhe/relayer-sdk` v0.4.1 |
| Frontend Hosting | GitHub Pages |
| Backend Hosting | Render |
| Network | Sepolia Testnet |

---

## Contracts

| Contract | Address |
|---|---|
| VeilLending | [0x6d69a00107Ed9d487904700a00E31e657dA8a392](https://sepolia.etherscan.io/address/0x6d69a00107Ed9d487904700a00E31e657dA8a392) |
| cWETHMock | [0x46208622DA27d91db4f0393733C8BA082ed83158](https://sepolia.etherscan.io/address/0x46208622DA27d91db4f0393733C8BA082ed83158) |
| Underlying WETH | [0xff54739b16576FA5402F211D0b938469Ab9A5f3F](https://sepolia.etherscan.io/address/0xff54739b16576FA5402F211D0b938469Ab9A5f3F) |

---

*Made by SAMMY — VEIL Finance 2026*
