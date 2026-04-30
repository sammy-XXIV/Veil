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
async function connectWallet() {
  if (!window.ethereum) {
    showToast('MetaMask not detected. Please install MetaMask.', 'error');
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    currentUser = accounts[0];
    
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    
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
  if (!window.ethereum) return;
  
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  const wrongNetwork = document.getElementById('wrong-network');
  
  if (chainId !== SEPOLIA_CHAIN_ID) {
    wrongNetwork.style.display = 'flex';
  } else {
    wrongNetwork.style.display = 'none';
  }
}

async function switchToSepolia() {
  if (!window.ethereum) return;
  
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    });
    checkNetwork();
  } catch (error) {
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
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
  if (!currentUser) {
    showToast('Connect wallet first', 'error');
    return;
  }
  
  showToast('Faucet action triggered (implement backend)', 'info');
  // TODO: Implement actual faucet logic
}

async function addCwethToWallet() {
  if (!window.ethereum) return;
  
  try {
    await window.ethereum.request({
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
async function handleClosePosition() {
  if (!signer) return;
  
  try {
    showFheModal('Closing Position', 'Please wait while we close your position...');
    
    // TODO: Implement close position logic
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    closeFheModal();
    showToast('Position closed! ✨', 'success');
  } catch (error) {
    console.error('Close position error:', error);
    closeFheModal();
    showToast('Failed to close position', 'error');
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
  if (window.ethereum) {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
      currentUser = accounts[0];
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      await checkNetwork();
      updateUI();
    }
  }
  
  // Listen to account changes
  window.ethereum?.on('accountsChanged', (accounts) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else if (accounts[0] !== currentUser) {
      currentUser = accounts[0];
      updateUI();
    }
  });
  
  // Listen to chain changes
  window.ethereum?.on('chainChanged', () => {
    checkNetwork();
    window.location.reload();
  });
});
