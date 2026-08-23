require('dotenv').config();
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.BOT_PRIVATE_KEY, provider);

const CONTRACT_ABI = [
  "event Deposit(address indexed user, uint256 amount)",
  "event InvestmentEnded(address indexed user, uint256 amount)",
  "function getPendingPayouts() external view returns (address[] memory)",
  "function processBatchPayouts(address[] memory users) external",
  "function requestGasRefill() external",
  "function isPaid(address user) external view returns (bool)"
];

const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

let payoutQueue = [];
let isProcessing = false;

async function checkAndRefillGas() {
  try {
    const balance = await provider.getBalance(wallet.address);
    const minBalance = ethers.parseEther("0.005");

    if (balance < minBalance) {
      console.log("Refill Gas Triggered");
      const tx = await contract.requestGasRefill();
      await tx.wait();
    }
  } catch (error) {
    console.error("Gas Error:", error.message);
  }
}

async function processQueue() {
  if (isProcessing || payoutQueue.length === 0) return;
  isProcessing = true;

  await checkAndRefillGas();

  const batch = payoutQueue.splice(0, 20);
  const validUsers = [];

  for (const user of batch) {
    const alreadyPaid = await contract.isPaid(user);
    if (!alreadyPaid && !validUsers.includes(user)) {
      validUsers.push(user);
    }
  }

  if (validUsers.length > 0) {
    try {
      console.log(`Processing ${validUsers.length} users...`);
      const tx = await contract.processBatchPayouts(validUsers);
      await tx.wait();
      console.log("Batch Success");
    } catch (error) {
      console.error("Batch Error:", error.message);
      payoutQueue.unshift(...validUsers);
    }
  }

  isProcessing = false;

  if (payoutQueue.length > 0) {
    setTimeout(processQueue, 3000);
  }
}

function startEventListener() {
  contract.on("InvestmentEnded", (user, amount) => {
    payoutQueue.push(user);
    processQueue();
  });

  contract.on("Deposit", (user, amount) => {
    // Handled inside contract
  });
}

async function pollPendingPayouts() {
  try {
    const pendingUsers = await contract.getPendingPayouts();
    if (pendingUsers.length > 0) {
      for (const user of pendingUsers) {
        if (!payoutQueue.includes(user)) {
          payoutQueue.push(user);
        }
      }
      processQueue();
    }
  } catch (error) {
    console.error("Poll Error:", error.message);
  }
}

async function main() {
  console.log("Bot Active:", wallet.address);
  startEventListener();
  setInterval(pollPendingPayouts, 120000);
}

main().catch((err) => console.error("Main Error:", err));
