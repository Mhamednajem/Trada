require('dotenv').config();
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = "0x32e6E7aFdFc1F6d50f8941b9Bdb19084FF7b98Be";

const RPC_URLS = [
    "https://bsc-dataseed1.binance.org/",
    "https://bsc-dataseed2.binance.org/",
    "https://bsc-dataseed3.binance.org/",
    "https://bsc.meowrpc.com",
    "https://1rpc.io/bnb"
];

let currentRpcIndex = 0;
let provider;
let wallet;
let contract;

const CONTRACT_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "uint256", "name": "id", "name": "id", "type": "uint256"},
            {"indexed": false, "internalType": "string", "name": "itemType", "type": "string"},
            {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
            {"indexed": false, "internalType": "bool", "name": "success", "type": "bool"}
        ],
        "name": "TradeEvent",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "Charlink",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "DealProcessing",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

function initializeProvider() {
    const rpcUrl = RPC_URLS[currentRpcIndex];
    provider = new ethers.JsonRpcProvider(rpcUrl);
    
    if (!process.env.PRIVATE_KEY) {
        console.error("PRIVATE_KEY is missing!");
        process.exit(1);
    }

    wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
}

function rotateRpc() {
    currentRpcIndex = (currentRpcIndex + 1) % RPC_URLS.length;
    console.log(`[تحويل] تم الانتقال إلى الـ RPC رقم ${currentRpcIndex + 1}`);
    initializeProvider();
}

async function executeDealProcessing() {
    try {
        const tx = await contract.DealProcessing();
        await tx.wait();
    } catch (error) {
        console.error("[خطأ في المعالجة]:", error.message);
        if (error.code === 'NETWORK_ERROR' || error.timeout || error.message.includes('timeout') || error.message.includes('provider')) {
            rotateRpc();
        }
    }
}

async function startMonitoring() {
    initializeProvider();
    console.log("بوت شغال ويارقب");

    setInterval(async () => {
        try {
            const isReady = await contract.Charlink();

            if (isReady === true) {
                console.log("[تنبيه] تم رصد True! جاري تشغيل المعالجة فوراً...");
                executeDealProcessing(); 
            } else {
                console.log("false");
            }
        } catch (error) {
            console.log("false (Network/RPC Error handled)");
            if (error.code === 'NETWORK_ERROR' || error.timeout || error.message.includes('timeout') || error.message.includes('provider')) {
                rotateRpc();
            }
        }
    }, 2000);
}

process.on('uncaughtException', (error) => {
    console.error('[خطأ غير متوقع تم التقاطه وتجاوزه]:', error.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('[رفض غير متوقع تم التقاطه وتجاوزه]:', reason);
});

startMonitoring();
