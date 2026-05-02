// ═══════════════════════════════════════════════════════════════════
// VEIL Finance — JavaScript Application
// ═══════════════════════════════════════════════════════════════════

// ─── STATE ───
let currentUser = null;
let provider = null;
let signer = null;
let txHistory = [];

const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in hex
const SEPOLIA_RPC = 'https://sepolia.drpc.org';

// ─── WALLET CONNECTION ───

// Resolve the active wallet provider — OKX injects window.okxwallet,
// MetaMask and most others use window.ethereum.
function getWalletProvider() {
  if (window.okxwallet) return window.okxwallet
  if (window.ethereum) return window.ethereum
  return null
}

async function connectWallet() {
  const walletProvider = getWalletProvider()
  if (!walletProvider) {
    showToast('No wallet detected. Install MetaMask or OKX Wallet.', 'error');
    return;
  }

  try {
    const accounts = await walletProvider.request({ method: 'eth_requestAccounts' });
    currentUser = accounts[0];

    provider = new ethers.BrowserProvider(walletProvider);
    signer = await provider.getSigner();

    console.log('[WALLET] connected via', window.okxwallet ? 'OKX' : 'window.ethereum',
      '| address:', currentUser)

    await checkNetwork();
    updateUI();
    showPage('dashboard');
    showToast('Wallet connected! 🔗', 'success');
  } catch (error) {
    console.error('Wallet connection error:', error);
    showToast('Failed to connect wallet', 'error');
  }
}

async function disconnectWallet() {
  currentUser = null;
  provider = null;
  signer = null;
  updateUI();
  showPage('connect');
  closeModal('account-modal');
  showToast('Wallet disconnected', 'success');
}

async function checkNetwork() {
  const wp = getWalletProvider()
  if (!wp) return;

  const chainId = await wp.request({ method: 'eth_chainId' });
  const wrongNetwork = document.getElementById('wrong-network');

  if (chainId !== SEPOLIA_CHAIN_ID) {
    wrongNetwork.style.display = 'flex';
  } else {
    wrongNetwork.style.display = 'none';
  }
}

async function switchToSepolia() {
  const wp = getWalletProvider()
  if (!wp) return;

  try {
    await wp.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    });
    checkNetwork();
  } catch (error) {
    if (error.code === 4902) {
      try {
        await wp.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: SEPOLIA_CHAIN_ID,
              chainName: 'Sepolia Testnet',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [SEPOLIA_RPC],
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            },
          ],
        });
      } catch (addError) {
        showToast('Failed to add Sepolia network', 'error');
      }
    }
  }
}

// ─── PAGE NAVIGATION ───
function showPage(pageName) {
  // Hide all pages
  const pages = document.querySelectorAll('.app-page');
  pages.forEach(page => page.classList.remove('active'));
  
  // Show selected page
  const selectedPage = document.getElementById(`page-${pageName}`);
  if (selectedPage) {
    selectedPage.classList.add('active');
  }
  
  // Update nav links
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => link.classList.remove('active'));
  
  const activeLink = document.getElementById(`nl-${pageName}`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
  
  // Close mobile nav
  closeMobileNav();
}

// ─── MODAL MANAGEMENT ───
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
  }
}

// Click outside modal to close
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ─── MOBILE NAVIGATION ───
function toggleMobileNav() {
  const mobileNav = document.getElementById('mobile-nav');
  mobileNav.classList.toggle('open');
}

function closeMobileNav() {
  const mobileNav = document.getElementById('mobile-nav');
  mobileNav.classList.remove('open');
}

// ─── ACCOUNT ACTIONS ───
function copyAddress() {
  if (!currentUser) return;
  navigator.clipboard.writeText(currentUser);
  showToast('Address copied to clipboard! 📋', 'success');
}

// ─── FAUCET & WALLET ACTIONS ───
async function handleFaucet() {
  if (!signer) {
    showToast('Connect wallet first', 'error')
    return
  }
  showToast('Requesting cWETH from faucet...', 'info')
  try {
    const userAddress = await signer.getAddress()
    const res = await fetch(`${BACKEND_URL}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress }),
    })
    const body = await res.json()
    if (!res.ok || !body.success) throw new Error(body.error || res.status)
    showToast(`Faucet sent! Tx: ${body.txHash?.slice(0, 12)}...`, 'success')
  } catch (err) {
    console.error('[FAUCET] error:', err)
    showToast(`Faucet failed: ${err.message}`, 'error')
  }
}

async function addCwethToWallet() {
  const wp = getWalletProvider()
  if (!wp) return;

  try {
    await wp.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: '0x...', // TODO: Add cWETH contract address
          symbol: 'cWETH',
          decimals: 18,
          image: 'https://...',
        },
      },
    });
    showToast('cWETH added to wallet! 🎉', 'success');
  } catch (error) {
    showToast('Failed to add token', 'error');
  }
}

// ─── POSITION MANAGEMENT ───

const CONTRACT_ADDRESS = '0x1689b2e699bD28Dc21A8442Ec8e3D39F5d52dDCB'
const CONTRACT_ABI = [
  'function openPosition(bytes32 encryptedAmount, bytes inputProof, uint256 plainAmount) external',
  'function addCollateral(bytes32 encryptedAmount, bytes inputProof, uint256 plainAmount) external',
  'function borrow(bytes32 encryptedAmount, bytes inputProof, uint256 plainAmount) external',
  'function repay(bytes32 encryptedAmount, bytes inputProof, uint256 plainAmount) external',
  'function hasPosition(address user) external view returns (bool)',
  'function closePosition() external',
  'function getCollateral(address user) external view returns (uint256)',
  'function getDebt(address user) external view returns (uint256)',
]
const BACKEND_URL = 'https://veil-backend-2gki.onrender.com'

// Known custom error selectors (FHEVM + contract)
const KNOWN_ERRORS = {
  '0x5ff91cdc': 'FHEVM: encrypted input proof rejected — handle or proof invalid for this contract',
  '0x09bde339': 'InvalidProof()',
  '0xaac34bd8': 'NotAllowedToHandleCiphertext()',
  '0x3d693ada': 'NotAllowed()',
  '0x9fd8296a': 'ACLNotAllowed()',
  '0xfb8f41b2': 'ERC20InsufficientAllowance',
  '0xe450d38c': 'ERC20InsufficientBalance',
}

function decodeRevertError(err) {
  const data = err?.data || err?.error?.data || err?.info?.error?.data || ''
  if (!data) return err.message || 'Transaction reverted'
  const sel = typeof data === 'string' ? data.slice(0, 10).toLowerCase() : ''
  if (KNOWN_ERRORS[sel]) return `Revert: ${KNOWN_ERRORS[sel]}`
  return `Revert ${sel}: ${data.slice(0, 80)}`
}

function advanceFheStep(stepNum) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`fhe-step-${i}`)
    el.classList.remove('active', 'done', 'error')
    if (i < stepNum) el.classList.add('done')
    else if (i === stepNum) el.classList.add('active')
  }
}

async function handleDeposit() {
  if (!signer || !currentUser) {
    showToast('Connect wallet first', 'error')
    return
  }

  const input = document.getElementById('deposit-amount-input')
  const rawAmount = parseFloat(input?.value)
  if (!rawAmount || rawAmount <= 0) {
    showToast('Enter a valid amount', 'error')
    return
  }

  // Backend requires integer — round to whole token units
  const amountInt = Math.round(rawAmount)
  if (amountInt <= 0) {
    showToast('Amount must be at least 1 cWETH', 'error')
    return
  }

  showFheModal('Depositing Collateral', 'Encrypting amount with FHE...')

  try {
    // Step 1 — already active from showFheModal (SDK init)
    console.log('[DEPOSIT] amount raw:', rawAmount, '→ integer:', amountInt)

    // Step 2: call backend to encrypt
    advanceFheStep(2)

    // Always derive address from signer — cached currentUser can differ in OKX/multi-wallet setups
    const userAddress = await signer.getAddress()
    const wp = getWalletProvider()
    console.log('[DEPOSIT] signer.getAddress()      :', userAddress)
    console.log('[DEPOSIT] provider.selectedAddress :', wp?.selectedAddress || 'n/a')
    console.log('[DEPOSIT] cached currentUser       :', currentUser)
    console.log('[DEPOSIT] using for backend        :', userAddress)

    const encryptRes = await fetch(`${BACKEND_URL}/encrypt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountInt,
        contractAddress: CONTRACT_ADDRESS,
        userAddress,
      }),
    })
    const encryptBody = await encryptRes.json()
    if (!encryptRes.ok || !encryptBody.success) {
      throw new Error(`Encrypt failed: ${encryptBody.error || encryptRes.status}`)
    }

    const { handle, inputProof } = encryptBody

    // Validate handle: must be 0x + 64 hex chars (32 bytes)
    const handleClean = handle?.startsWith('0x') ? handle : `0x${handle}`
    const handleHex = handleClean.replace(/^0x/, '')
    if (handleHex.length !== 64) {
      throw new Error(`Bad handle length: got ${handleHex.length} hex chars, expected 64`)
    }
    const handleBytes32 = `0x${handleHex}` // correct bytes32 format

    console.log('[DEPOSIT] handle:', handleBytes32, '(', handleHex.length, 'hex chars =', handleHex.length / 2, 'bytes)')
    console.log('[DEPOSIT] inputProof:', inputProof?.slice(0, 20), '... length:', inputProof?.length)
    console.log('[DEPOSIT] inputProof bytes:', (inputProof?.length - 2) / 2)

    // Step 3: sign & send transaction
    advanceFheStep(3)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

    let hasPos = false
    try { hasPos = await contract.hasPosition(userAddress) } catch {}
    console.log('[DEPOSIT] hasPosition:', hasPos)

    // ── PRE-CALL DEBUG ──
    console.log('[DEPOSIT] handle value   :', handleBytes32)
    console.log('[DEPOSIT] handle length  :', handleBytes32.length, '(should be 66: 0x + 64 hex chars)')
    console.log('[DEPOSIT] inputProof[0:20]:', inputProof?.slice(0, 20))
    console.log('[DEPOSIT] plainAmount    :', amountInt)
    console.log('[DEPOSIT] calling        :', hasPos ? 'addCollateral' : 'openPosition')

    const tx = hasPos
      ? await contract.addCollateral(handleBytes32, inputProof, BigInt(amountInt), { gasLimit: 1_000_000n })
      : await contract.openPosition(handleBytes32, inputProof, BigInt(amountInt), { gasLimit: 1_000_000n })
    console.log('[DEPOSIT] tx sent:', tx.hash)

    // Step 4: wait for confirmation
    advanceFheStep(4)
    const receipt = await tx.wait()
    console.log('[DEPOSIT] confirmed in block:', receipt.blockNumber)

    closeFheModal()
    showToast(`Deposited ${amountInt} cWETH! 🔒`, 'success')
    input.value = ''
    showPage('dashboard')

  } catch (err) {
    const msg = decodeRevertError(err)
    console.error('[DEPOSIT] error:', err)
    console.error('[DEPOSIT] decoded:', msg)
    console.error('[DEPOSIT] raw data:', err?.data || err?.error?.data || 'none')
    const activeStep = document.querySelector('.fhe-step.active')
    if (activeStep) { activeStep.classList.remove('active'); activeStep.classList.add('error') }
    setTimeout(closeFheModal, 2500)
    showToast(msg, 'error')
  }
}

async function handleBorrow() {
  if (!signer) { showToast('Connect wallet first', 'error'); return }
  const input = document.getElementById('borrow-amount-input')
  const rawAmount = parseFloat(input?.value)
  if (!rawAmount || rawAmount <= 0) { showToast('Enter a valid amount', 'error'); return }
  const amountInt = Math.round(rawAmount)
  if (amountInt <= 0) { showToast('Amount must be at least 1', 'error'); return }

  showFheModal('Borrowing USDC', 'Encrypting borrow amount with FHE...')
  try {
    advanceFheStep(2)
    const userAddress = await signer.getAddress()
    console.log('[BORROW] userAddress:', userAddress, '| amount:', amountInt)

    const encryptRes = await fetch(`${BACKEND_URL}/encrypt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountInt, contractAddress: CONTRACT_ADDRESS, userAddress }),
    })
    const encryptBody = await encryptRes.json()
    if (!encryptRes.ok || !encryptBody.success) throw new Error(`Encrypt failed: ${encryptBody.error || encryptRes.status}`)

    const { handle, inputProof } = encryptBody
    const handleBytes32 = handle.startsWith('0x') ? handle : `0x${handle}`
    console.log('[BORROW] handle:', handleBytes32, '| inputProof:', inputProof?.slice(0, 20), '...')

    advanceFheStep(3)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
    const tx = await contract.borrow(handleBytes32, inputProof, BigInt(amountInt), { gasLimit: 2_000_000n })
    console.log('[BORROW] tx sent:', tx.hash)

    advanceFheStep(4)
    const receipt = await tx.wait()
    console.log('[BORROW] confirmed block:', receipt.blockNumber)

    closeFheModal()
    showToast(`Borrowed ${amountInt} USDC!`, 'success')
    input.value = ''
    showPage('dashboard')
  } catch (err) {
    const msg = decodeRevertError(err)
    console.error('[BORROW] error:', err)
    const activeStep = document.querySelector('.fhe-step.active')
    if (activeStep) { activeStep.classList.remove('active'); activeStep.classList.add('error') }
    setTimeout(closeFheModal, 2500)
    showToast(msg, 'error')
  }
}

async function handleRepay() {
  if (!signer) { showToast('Connect wallet first', 'error'); return }
  const input = document.getElementById('repay-amount-input')
  const rawAmount = parseFloat(input?.value)
  if (!rawAmount || rawAmount <= 0) { showToast('Enter a valid amount', 'error'); return }
  const amountInt = Math.round(rawAmount)
  if (amountInt <= 0) { showToast('Amount must be at least 1', 'error'); return }

  showFheModal('Repaying Debt', 'Encrypting repay amount with FHE...')
  try {
    advanceFheStep(2)
    const userAddress = await signer.getAddress()
    console.log('[REPAY] userAddress:', userAddress, '| amount:', amountInt)

    const encryptRes = await fetch(`${BACKEND_URL}/encrypt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountInt, contractAddress: CONTRACT_ADDRESS, userAddress }),
    })
    const encryptBody = await encryptRes.json()
    if (!encryptRes.ok || !encryptBody.success) throw new Error(`Encrypt failed: ${encryptBody.error || encryptRes.status}`)

    const { handle, inputProof } = encryptBody
    const handleBytes32 = handle.startsWith('0x') ? handle : `0x${handle}`
    console.log('[REPAY] handle:', handleBytes32, '| inputProof:', inputProof?.slice(0, 20), '...')

    advanceFheStep(3)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
    const tx = await contract.repay(handleBytes32, inputProof, BigInt(amountInt), { gasLimit: 2_000_000n })
    console.log('[REPAY] tx sent:', tx.hash)

    advanceFheStep(4)
    const receipt = await tx.wait()
    console.log('[REPAY] confirmed block:', receipt.blockNumber)

    closeFheModal()
    showToast(`Repaid ${amountInt} USDC!`, 'success')
    input.value = ''
    showPage('dashboard')
  } catch (err) {
    const msg = decodeRevertError(err)
    console.error('[REPAY] error:', err)
    const activeStep = document.querySelector('.fhe-step.active')
    if (activeStep) { activeStep.classList.remove('active'); activeStep.classList.add('error') }
    setTimeout(closeFheModal, 2500)
    showToast(msg, 'error')
  }
}

async function handleClosePosition() {
  if (!signer) { showToast('Connect wallet first', 'error'); return }
  showFheModal('Closing Position', 'Sending close transaction...')
  try {
    advanceFheStep(3)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
    const tx = await contract.closePosition({ gasLimit: 1_000_000n })
    console.log('[CLOSE] tx sent:', tx.hash)
    advanceFheStep(4)
    await tx.wait()
    closeFheModal()
    showToast('Position closed!', 'success')
    showPage('dashboard')
  } catch (err) {
    const msg = decodeRevertError(err)
    console.error('[CLOSE] error:', err)
    const activeStep = document.querySelector('.fhe-step.active')
    if (activeStep) { activeStep.classList.remove('active'); activeStep.classList.add('error') }
    setTimeout(closeFheModal, 2500)
    showToast(msg, 'error')
  }
}

const CWETH_ADDRESS = '0x46208622DA27d91db4f0393733C8BA082ed83158'
const CWETH_ABI = [
  'function confidentialBalanceOf(address user) external view returns (bytes32)',
]

async function loadCwethBalance() {
  openModal('balance-modal')
  if (!signer) return
  const el = document.getElementById('balance-modal-value')
  const usdEl = document.getElementById('balance-modal-usd')
  el.textContent = '...'
  if (usdEl) usdEl.textContent = ''

  try {
    const userAddress = await signer.getAddress()
    console.log('[BALANCE] userAddress:', userAddress)

    // Step 1: get encrypted handle from cWETH contract
    const cweth = new ethers.Contract(CWETH_ADDRESS, CWETH_ABI, provider)
    const handle = await cweth.confidentialBalanceOf(userAddress)
    console.log('[BALANCE] encrypted handle:', handle)

    // Step 2: request decrypt parameters from backend
    const prepareRes = await fetch(`${BACKEND_URL}/decrypt-prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, contractAddress: CWETH_ADDRESS, userAddress }),
    })
    const prepareBody = await prepareRes.json()
    if (!prepareRes.ok || !prepareBody.success) {
      throw new Error(`decrypt-prepare failed: ${prepareBody.error || prepareRes.status}`)
    }
    const { keypair, eip712, startTimestamp, durationDays } = prepareBody
    console.log('[BALANCE] eip712 domain:', eip712.domain)
    console.log('[BALANCE] keypair.publicKey  type:', typeof keypair.publicKey,  '| first 20:', keypair.publicKey?.slice(0, 20))
    console.log('[BALANCE] keypair.privateKey type:', typeof keypair.privateKey, '| first 20:', keypair.privateKey?.slice(0, 20))

    // Step 3: sign the EIP-712 typed data
    // ethers v6 signTypedData: (domain, types without EIP712Domain, message)
    const { domain, types: allTypes, message } = eip712
    const { EIP712Domain: _, ...signTypes } = allTypes  // strip EIP712Domain — ethers adds it
    // domain.chainId must be a number/bigint for ethers
    const signDomain = { ...domain, chainId: Number(domain.chainId) }
    console.log('[BALANCE] signing typed data, primaryType: UserDecryptRequestVerification')
    const signature = await signer.signTypedData(signDomain, signTypes, message)
    console.log('[BALANCE] signature:', signature.slice(0, 20), '...')

    // Step 4: POST to decrypt-balance with signature + keypair
    console.log('[BALANCE] → decrypt-balance payload:')
    console.log('  userAddress     :', userAddress)
    console.log('  handle          :', handle)
    console.log('  contractAddress :', CWETH_ADDRESS)
    console.log('  startTimestamp  :', startTimestamp, typeof startTimestamp)
    console.log('  durationDays    :', durationDays,   typeof durationDays)
    console.log('  keypair.publicKey  type:', typeof keypair.publicKey,  'len:', keypair.publicKey?.length)
    console.log('  keypair.privateKey type:', typeof keypair.privateKey, 'len:', keypair.privateKey?.length)

    const decryptRes = await fetch(`${BACKEND_URL}/decrypt-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        contractAddress: CWETH_ADDRESS,
        userAddress,
        signature,
        keypair,
        startTimestamp,
        durationDays,
      }),
    })
    const decryptBody = await decryptRes.json()
    if (!decryptRes.ok || !decryptBody.success) {
      throw new Error(`decrypt-balance failed: ${decryptBody.error || decryptRes.status}`)
    }
    console.log('[BALANCE] decrypted response:', decryptBody)

    const balance = decryptBody.balance ?? decryptBody.value ?? decryptBody.result ?? '—'
    el.textContent = balance.toString()
    if (usdEl) usdEl.textContent = 'cWETH (decrypted via FHE)'

  } catch (err) {
    console.error('[BALANCE] error:', err)
    el.textContent = '—'
    if (usdEl) usdEl.textContent = err.message
  }
}

// ─── FHE PROGRESS MODAL ───
function showFheModal(title, subtitle) {
  const modal = document.getElementById('fhe-modal');
  const titleEl = document.getElementById('fhe-modal-title');
  const subEl = document.getElementById('fhe-modal-sub');
  
  titleEl.textContent = title;
  subEl.textContent = subtitle;
  
  // Reset steps
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`fhe-step-${i}`);
    step.classList.remove('active', 'done', 'error');
    if (i === 1) step.classList.add('active');
  }
  
  openModal('fhe-modal');
  startFheTimer();
}

function closeFheModal() {
  closeModal('fhe-modal');
  stopFheTimer();
}

let fheTimerInterval = null;
let fheStartTime = Date.now();

function startFheTimer() {
  fheStartTime = Date.now();
  fheTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - fheStartTime) / 1000);
    document.getElementById('fhe-timer').textContent = `${elapsed}s elapsed`;
  }, 100);
}

function stopFheTimer() {
  if (fheTimerInterval) clearInterval(fheTimerInterval);
}

// ─── TOAST NOTIFICATIONS ───
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── UI UPDATES ───
function updateUI() {
  const connectBtn = document.getElementById('nav-connect-btn');
  const addressChip = document.getElementById('address-chip');
  const mobileAccountBtn = document.getElementById('mobile-account-btn');
  const mobileConnectBtn = document.getElementById('mobile-connect-btn');

  if (currentUser) {
    connectBtn.style.display = 'none';
    addressChip.style.display = 'block';
    addressChip.textContent = `${currentUser.slice(0, 6)}...${currentUser.slice(-4)}`;

    if (mobileConnectBtn) mobileConnectBtn.style.display = 'none';
    mobileAccountBtn.style.display = 'block';

    document.getElementById('account-full-addr').textContent = currentUser;
    document.getElementById('account-etherscan').href = `https://sepolia.etherscan.io/address/${currentUser}`;

    document.getElementById('nav-pill').style.display = 'flex';
  } else {
    connectBtn.style.display = 'block';
    addressChip.style.display = 'none';
    if (mobileConnectBtn) mobileConnectBtn.style.display = 'block';
    mobileAccountBtn.style.display = 'none';
    document.getElementById('nav-pill').style.display = 'none';
    showPage('connect');
  }
}

// ─── INITIALIZATION ───
window.addEventListener('load', async () => {
  const wp = getWalletProvider()
  if (wp) {
    const accounts = await wp.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
      currentUser = accounts[0];
      provider = new ethers.BrowserProvider(wp);
      signer = await provider.getSigner();
      await checkNetwork();
      updateUI();
    }

    wp.on?.('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== currentUser) {
        currentUser = accounts[0];
        updateUI();
      }
    });

    wp.on?.('chainChanged', () => {
      checkNetwork();
      window.location.reload();
    });
  }
});
