const axios = require('axios');
const fs = require('fs');
const readline = require('readline');

function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function random3to6() {
    return getRandomNumber(3000, 6000);
}

function random1to3() {
    return getRandomNumber(1000, 3000);
}

function random4to10() {
    return getRandomNumber(4000, 10000);
}

function random30to40() {
    return getRandomNumber(30000, 40000);
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const queries = fs.readFileSync('hash.txt', 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
        const [query, ...proxies] = line.split('|');
        return { query, proxies };
    });

plus = "[\x1b[32m+\x1b[0m]";
mins = "[\x1b[31m-\x1b[0m]"; 
seru = "[\x1b[34m!\x1b[0m]";
tanya = "[\x1b[33m?\x1b[0m]";

const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";

async function getToken(query, proxyConfig) {
    const config = {
        headers: { 'User-Agent': userAgent },
        ...(proxyConfig ? { proxy: proxyConfig } : {})
    };
    try {
        const response = await axios.post(`https://user-domain.blum.codes/api/v1/auth/provider/PROVIDER_TELEGRAM_MINI_APP`, { query }, config);
        return response.data.token.access;
    } catch (err) {
        if (err.response) {
            //console.log(`    ${mins} Response: ${JSON.stringify(err.response.data, null, 2)}`);
        } else {
            //console.log(`    ${mins} Error Mendapatkan Token: ${err.message}`);
        }
        throw err;
    }
}


async function getTokenWithRetry(query, proxyConfig, maxRetries = 5, delayMs = random1to3()) {
    return retryOperation(() => getToken(query, proxyConfig), maxRetries, delayMs);
}

async function getUsername(accessToken, proxyConfig) {
    const config = {
        headers: { 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` },
        ...(proxyConfig ? { proxy: proxyConfig } : {})
    };

    try {
        const response = await axios.get(`https://user-domain.blum.codes/api/v1/user/me`, config);
        return response.data.username;
    } catch (err) {
        //console.error(`    ${mins} Error Mendapatkan Username: ${err.message}`);
        throw err;
    }
}


async function checkTribe(accessToken, proxyConfig) {
    try {
        const config = {
            headers: { 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` },
            ...(proxyConfig ? { proxy: proxyConfig } : {})
        };
        const response = await axios.get(`https://game-domain.blum.codes/api/v1/tribe/my`, config);
        return response.data;
    } catch (err) {
        if (err.response && err.response.status === 404) {
            console.log(`    ${plus} Tribe        : \x1b[33mBelum Join\x1b[0m`);
            return null;
        }
        throw err;
    }
}

async function joinTribe(accessToken) {
    try {
        const config = {
            headers: { 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` }
        };
        await axios.post(`https://game-domain.blum.codes/api/v1/tribe/0999c4b7-1bbd-4825-a7a0-afc1bfb3fff6/join`, {}, config);
        console.log(`    ${plus} Join Tribe   : \x1b[32mSukses\x1b[0m`);
    } catch (err) {
        console.error(`    ${mins} Join Tribe   : \x1b[31mERROR\x1b[0m`, err.message);
    }
}

async function checkinDaily(accessToken) {
    try {
        const config = {
            headers: { 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` }
        };
        const response = await axios.post(`https://game-domain.blum.codes/api/v1/daily-reward?offset=-420`, {}, config);
        if (response.status === 200 && response.data === 'OK') {
            console.log(`    ${plus} Checkin      : \x1b[32mSukses\x1b[0m`);
        }
    } catch (err) {
        if (err.response && err.response.status === 400) {
            console.log(`    ${mins} Checkin      : \x1b[31mBelum Saatnya\x1b[0m`);
        }
    }
}


async function checkinDailyWithRetry(accessToken, proxyConfig, maxRetries = 5, delayMs = random1to3()) {
    return retryOperation(() => checkinDaily(accessToken, proxyConfig), maxRetries, delayMs);
}

async function handleFarming(accessToken) {
    try {
        const config = {
            headers: { 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` }
        };
        const response = await axios.get(`https://game-domain.blum.codes/api/v1/user/balance`, config);
        const farming = response.data.farming;

        if (!farming) {
            await axios.post(`https://game-domain.blum.codes/api/v1/farming/start`, {}, config);
            console.log(`    ${plus} Farming      : \x1b[32mStart\x1b[0m`);
            return;
        }

        if (!farming.endTime) {
            await axios.post(`https://game-domain.blum.codes/api/v1/farming/start`, {}, config);
            console.log(`    ${plus} Farming      : \x1b[32mStart\x1b[0m`);
        } else {
            const now = Date.now();
            if (now >= farming.endTime) {
                await axios.post(`https://game-domain.blum.codes/api/v1/farming/claim`, {}, config);
                console.log(`    ${plus} Farming      : \x1b[32m+${farming.balance}\x1b[0m`);
                delay(random1to3());
                await axios.post(`https://game-domain.blum.codes/api/v1/farming/start`, {}, config);
                console.log(`    ${plus} Farming      : \x1b[32mStart\x1b[0m`);
            } else {
                const remainingTime = farming.endTime - now;
                const remainingHours = Math.floor(remainingTime / 3600000);
                console.log(`    ${mins} Farming      : \x1b[31m${remainingHours} jam lagi\x1b[0m`);
            }
        }
    } catch (err) {
        console.error(`[!] Error on farming for account:`, err.message);
    }
}

async function handleFarmingWithRetry(accessToken, proxyConfig, maxRetries = 3, delayMs = random1to3()) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await handleFarming(accessToken, proxyConfig);
            return;
        } catch (err) {
            //console.error(`    [-] Farming Error: Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
            if (attempt === maxRetries) {
                console.log(`    ${mins} Farming Error.`);
                return;
            }
            await delay(delayMs);
        }
    }
}

async function checkBalance(accessToken, proxyConfig) {
    const config = {
        headers: { 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` },
        ...(proxyConfig ? { proxy: proxyConfig } : {})
    };
    const response = await axios.get(`https://game-domain.blum.codes/api/v1/user/balance`, config);
    const farming = response.data;
    globalTotalBalance += parseFloat(farming.availableBalance);
    console.log(`    ${plus} Balance      : \x1b[33m${farming.availableBalance}\x1b[0m`);
}


async function checkBalanceWithRetry(accessToken, proxyConfig, maxRetries = 5, delayMs = random1to3()) {
    return retryOperation(() => checkBalance(accessToken, proxyConfig), maxRetries, delayMs);
}


async function checkAndClaimReferral(accessToken) {
    const config = {
        headers: { 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` }
    };
    const response = await axios.get(`https://user-domain.blum.codes/api/v1/friends/balance`, config);
    if (response.data.canClaim) {
        const claimResponse = await axios.post(`https://user-domain.blum.codes/api/v1/friends/claim`, {}, config);
        console.log(`    ${plus} Farming Reff : \x1b[32m+${claimResponse.data.claimBalance}\x1b[0m`);
    } else {
        console.log(`    ${mins} Farming Reff : \x1b[31mBelum Saatnya\x1b[0m`);
    }
}


async function checkAndClaimReferralWithRetry(accessToken, maxRetries = 5, delayMs = random1to3()) {
    return retryOperation(() => checkAndClaimReferral(accessToken), maxRetries, delayMs);
}

async function retryOperation(operation, maxRetries = 5, delayMs = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation(); 
        } catch (err) {
            if (attempt === maxRetries) {
                throw err; 
            }
            //console.log(`${seru} Operation failed: Retry attempt ${attempt}/${maxRetries}`);
            await delay(delayMs);  
        }
    }
}

async function playGame(accessToken) {
    try {
        let playPasses;

        do {
            const response = await axios.get(`https://game-domain.blum.codes/api/v1/user/balance`, {
                headers: { 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` }
            });

            playPasses = response.data.playPasses;

            if (playPasses > 0) {
                console.log(`    ${plus} Tiket        : \x1b[33m${playPasses}\x1b[0m`);

                const playResponse = await axios.post(`https://game-domain.blum.codes/api/v1/game/play`, {}, {
                    headers: { 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` }
                });

                console.log(`    ${plus} Game ID      : \x1b[33m${playResponse.data.gameId}\x1b[0m`);
                console.log(`    ${plus} Delay 30 Detik`);
                
                await delay(random30to40());  

                const points = Math.floor(Math.random() * 31) + 250; 
                
                await axios.post(`https://game-domain.blum.codes/api/v1/game/claim`, {
                    gameId: playResponse.data.gameId,
                    points: points
                }, {
                    headers: { 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` }
                });

                console.log(`    ${plus} Reward Game  : \x1b[32m+${points}\x1b[0m`);
            } else {
                console.log(`    ${mins} Tiket        : \x1b[31m0\x1b[0m`);
            }

        } while (playPasses > 0);

    } catch (err) {
        if (err.response && err.response.status === 400) {
            //console.error(`    [-] Error Playing Game: ${err.message}`);
            console.error(`    [-] Response Data: ${JSON.stringify(err.response.data)}`);

            await retryOperation(
                async () => await playGame(accessToken),
                3,
                'Game         : Error'
            );
        } else {
            console.error(`[!] Unexpected error on playing game: ${err.message}`);
        }
    }
}

async function listTasks(accessToken) {
    try {
        const response = await axios.get(`https://earn-domain.blum.codes/api/v1/tasks`, {
            headers: { 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` }
        });
        return response.data;
    } catch (err) {
        //console.error(`[!] Error fetching tasks:`, err.message);
        return [];
    }
}

async function startTask(accessToken, taskId) {
    try {
        const response = await axios.post(`https://earn-domain.blum.codes/api/v1/tasks/${taskId}/start`, {}, {
            headers: { 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` }
        });
        //console.log(`    ${plus} Task Started  : \x1b[33m${response.data.title}\x1b[0m`);
        return response.data;
    } catch (err) {
        //console.error(`[!] Error starting task ${taskId}:`, err.message);
        return null;
    }
}

const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/najibyahya/validate-task/refs/heads/main/blum-validate.json';

async function loadValidationPayload() {
    try {
        const response = await axios.get(GITHUB_JSON_URL);
        return response.data;
    } catch (err) {
        //console.error(`[!] Error loading validation payload from GitHub:`, err.message);
        return {};
    }
}

async function validateTask(accessToken, taskId, taskTitle, validationPayload) {
    const keyword = validationPayload[taskTitle] || null;

    if (!keyword) {
        //console.error(`[!] No validation keyword found for task title: ${taskTitle}`);
        return null;
    }

    try {
        const response = await axios.post(`https://earn-domain.blum.codes/api/v1/tasks/${taskId}/validate`, { keyword }, {
            headers: { 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` }
        });
        //console.log(`    ${plus} Task Validated : \x1b[34m${response.data.title}\x1b[0m`);
        return response.data;
    } catch (err) {
        //console.error(`[!] Error validating task ${taskId}:`, err.message);
        return null;
    }
}

async function claimTask(accessToken, taskId) {
    try {
        const response = await axios.post(`https://earn-domain.blum.codes/api/v1/tasks/${taskId}/claim`, {}, {
            headers: { 
                'User-Agent': userAgent, 
                Authorization: `Bearer ${accessToken}` 
            }
        });
        console.log(`    ${plus} Task Claimed : \x1b[32mReward: ${response.data.reward}, Title: ${response.data.title}\x1b[0m`);
        return response.data;
    } catch (err) {
        //console.error(`[!] Error claiming task ${taskId}: ${err.message}`);
        return null;
    }
}

async function processTasks(accessToken) {
    const validationPayload = await loadValidationPayload();

    let tasks = await listTasks(accessToken);

    for (const section of tasks) {
        if (section.tasks) {
            for (const task of section.tasks) {
                if (task.status === "NOT_STARTED") {
                    await startTask(accessToken, task.id);
                    await delay(500);
                } else if (task.status === "READY_FOR_VERIFY") {
                    await validateTask(accessToken, task.id, task.title, validationPayload);
                    await delay(500);
                }

                if (task.subTasks) {
                    for (const subTask of task.subTasks) {
                        if (subTask.status === "NOT_STARTED") {
                            await startTask(accessToken, subTask.id);
                            await delay(500);
                        } else if (subTask.status === "READY_FOR_VERIFY") {
                            await validateTask(accessToken, subTask.id, subTask.title, validationPayload);
                            await delay(500);
                        }
                    }
                }
            }
        }

        if (section.subSections) {
            for (const subSection of section.subSections) {
                if (subSection.tasks) {
                    for (const task of subSection.tasks) {
                        if (task.status === "NOT_STARTED") {
                            await startTask(accessToken, task.id);
                            await delay(500);
                        } else if (task.status === "READY_FOR_VERIFY") {
                            await validateTask(accessToken, task.id, task.title, validationPayload);
                            await delay(500);
                        }

                        if (task.subTasks) {
                            for (const subTask of task.subTasks) {
                                if (subTask.status === "NOT_STARTED") {
                                    await startTask(accessToken, subTask.id);
                                    await delay(500);
                                } else if (subTask.status === "READY_FOR_VERIFY") {
                                    await validateTask(accessToken, subTask.id, subTask.title, validationPayload);
                                    await delay(500);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    tasks = await listTasks(accessToken);

    for (const section of tasks) {
        if (section.tasks) {
            for (const task of section.tasks) {
                if (task.status === "READY_FOR_CLAIM") {
                    await claimTask(accessToken, task.id);
                    await delay(500);
                }

                if (task.subTasks) {
                    for (const subTask of task.subTasks) {
                        if (subTask.status === "READY_FOR_CLAIM") {
                            await claimTask(accessToken, subTask.id);
                            await delay(500);
                        }
                    }
                }
            }
        }

        if (section.subSections) {
            for (const subSection of section.subSections) {
                if (subSection.tasks) {
                    for (const task of subSection.tasks) {
                        if (task.status === "READY_FOR_CLAIM") {
                            await claimTask(accessToken, task.id);
                            await delay(500);
                        }

                        if (task.subTasks) {
                            for (const subTask of task.subTasks) {
                                if (subTask.status === "READY_FOR_CLAIM") {
                                    await claimTask(accessToken, subTask.id);
                                    await delay(500);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  
  async function countdown(duration) {
    let remaining = duration;
    const animationChars = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
    let animationIndex = 0;
  
    while (remaining > 0) {
      process.stdout.write(`\r[\x1b[34m${animationChars[animationIndex]}\x1b[0m] ${formatTime(remaining)}`);


      await delay(100);
      remaining -= 100;
      animationIndex = (animationIndex + 1) % animationChars.length;
    }
    process.stdout.write(`\r${seru} Delay Selesai        `);

 
    console.log('');
  }

  async function checkTribeWithRetry(accessToken, proxyConfig) {
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await checkTribe(accessToken, proxyConfig);
        } catch (err) {
            if (attempt === maxRetries) {
                console.error(`    ${mins} Tribe        : Error`);
                throw err;
            }
            //console.log(`    ${seru} Tribe        : Retry attempt ${attempt}/${maxRetries}`);
            await delay(random1to3());
        }
    }
}

let globalTotalBalance = 0; 

async function processAccount({ query, proxies }, index) {
    const currentTime = new Date().toLocaleTimeString();
    console.log(``);
    console.log(`${seru} \x1b[34mAkun Ke-${index + 1}\x1b[0m \x1b[33m- ${currentTime}\x1b[0m`);

    let accessToken = null;
    let proxyConfig = null;

    for (let i = 0; i < proxies.length; i++) {
        proxyConfig = parseProxy(proxies[i]);

        try {
            accessToken = await getTokenWithRetry(query, proxyConfig); 
            if (accessToken) {
                console.log(`    ${plus} Proxy ${i + 1} Berhasil`);
                break; 
            }
        } catch (err) {
            console.log(`    ${mins} Proxy ${i + 1} Gagal: ${err.message}`);
        }
    }

    if (!accessToken) {
        //console.log(`    ${seru} Mencoba tanpa proxy`);
        try {
            accessToken = await getTokenWithRetry(query, null); 
        } catch (err) {
            console.error(`    [-] Gagal tanpa proxy: ${err.message}`);
            return; 
        }
    }

    try {
        const username = await getUsername(accessToken, proxyConfig);
        console.log(`    ${plus} Username     : \x1b[33m${username}\x1b[0m`);

        let tribeData = null;
        try {
            tribeData = await checkTribeWithRetry(accessToken, proxyConfig);
            if (tribeData) {
                console.log(`    ${plus} Tribe        : \x1b[33m${tribeData.title}\x1b[0m`);
            } else {
                await joinTribe(accessToken, proxyConfig);
                tribeData = await checkTribe(accessToken, proxyConfig);
                if (tribeData) {
                    console.log(`    ${plus} Tribe        : \x1b[33m${tribeData.title}\x1b[0m`);
                }
            }
        } catch (err) {
            console.error(`    [!] Error on tribe check: ${err.message}`);
        }

        await delay(random1to3());

        try {
            await checkinDailyWithRetry(accessToken, proxyConfig);
        } catch (err) {
            console.error(`    [!] Error on daily check-in: ${err.message}`);
        }

        await delay(random3to6());

        try {
            await handleFarmingWithRetry(accessToken, proxyConfig);
        } catch (err) {
            console.error(`    [!] Error on farming: ${err.message}`);
        }

        await delay(random4to10() );

        try {
            await checkAndClaimReferralWithRetry(accessToken); 
        } catch (err) {
            console.error(`    [!] Error on claiming referral: ${err.message}`);
        }

        await delay(random3to6());

        try {
            await playGame(accessToken, proxyConfig);
        } catch (err) {
            console.error(`    [!] Error on playing game: ${err.message}`);
        }

        await delay(random1to3());

        try {
            await processTasks(accessToken, proxyConfig);
        } catch (err) {
            console.error(`    [!] Error processing tasks: ${err.message}`);
        }

        await delay(random1to3());

        try {
            await checkBalanceWithRetry(accessToken, proxyConfig);
        } catch (err) {
            console.error(`    [!] Error checking balance: ${err.message}`);
        }
        

        await delay(random4to10());

    } catch (err) {
        //console.error(`    [-] Error on account ${index + 1}: ${err.message}`);
        
        if (proxies.length > 0) {
            console.log(`    ${seru} \x1b[34mProxy Error, Mencoba Tanpa Proxy\x1b[0m`);
            try {
                accessToken = await getTokenWithRetry(query, null); 
                const username = await getUsername(accessToken, null);
                console.log(`    ${plus} Username     : \x1b[33m${username}\x1b[0m`);
                
                await delay(random3to6());

                let tribeData = null;
                try {
                    tribeData = await checkTribeWithRetry(accessToken, null);
                    if (tribeData) {
                        console.log(`    ${plus} Tribe        : \x1b[33m${tribeData.title}\x1b[0m`);
                    } else {
                        await joinTribe(accessToken, null);
                        tribeData = await checkTribe(accessToken, null);
                        if (tribeData) {
                            console.log(`    ${plus} Tribe        : \x1b[33m${tribeData.title}\x1b[0m`);
                        }
                    }
                } catch (err) {
                    console.error(`    [!] Error on tribe check: ${err.message}`);
                }

                await delay(random3to6());

                try {
                    await checkinDailyWithRetry(accessToken, null);
                } catch (err) {
                    console.error(`    [!] Error on daily check-in: ${err.message}`);
                }

                await delay(random4to10());

                try {
                    await handleFarmingWithRetry(accessToken, null);
                } catch (err) {
                    console.error(`    [!] Error on farming: ${err.message}`);
                }

                await delay(random1to3());

                try {
                    await checkAndClaimReferralWithRetry(accessToken, null);
                } catch (err) {
                    console.error(`    [!] Error on claiming referral: ${err.message}`);
                }

                await delay(random3to6());

                try {
                    await playGame(accessToken, null);
                } catch (err) {
                    console.error(`    [!] Error on playing game: ${err.message}`);
                }

                await delay(random3to6());

                try {
                    await processTasks(accessToken, null);
                } catch (err) {
                    console.error(`    [!] Error processing tasks: ${err.message}`);
                }

                await delay(random3to6());

                try {
                    await checkBalanceWithRetry(accessToken, null);
                } catch (err) {
                    console.error(`    [!] Error checking balance: ${err.message}`);
                }

                await delay(random4to10());

            } catch (retryErr) {
                console.error(`    [!] Error on account ${index + 1} without proxy: ${retryErr.message}`);
            }
        }
    }
}


function parseProxy(proxyString) {
    const [host, port, username, password] = proxyString.split(':');
    const protocol = host.includes('socks') ? host.split('://')[0] : 'http';

    return {
        host: host.includes('://') ? host.split('://')[1] : host,
        port: parseInt(port),
        protocol: protocol,
        auth: username && password ? { username, password } : undefined,
    };
}



const asciiArt = `
   ___ _                   ___                 _        
  / __\\ |_   _ _ __ ___   / __\\ __ _   _ _ __ | |_ ___  
 /__\\/| | | |   '_ \` _ \\ / / | '__| | | | '_ \\| __/ _ \\ 
/ \\/  \\ | |_| | | | | | / /__| |  | |_| | |_) | || (_) |
\\_____/_|\\__,_|_| |_| |_\\____/_|   \\__, | .__/ \\__\\___/ 
   \x1b[34mt.me/andraz404 - ADFMIDN VIP\x1b[0m    |___/|_|                               
`;

async function main() {
    console.log(asciiArt);
    while (true) {
        globalTotalBalance = 0;

        for (let i = 0; i < queries.length; i++) {
            await processAccount(queries[i], i);
        }

        console.log(`\n${seru} \x1b[33mTotal Balance Dari ${queries.length} Akun : ${globalTotalBalance.toFixed(4)}\x1b[0m`);
        console.log(``);

        let minTime = 50 * 60 * 1000;
        let maxTime = 2 * 60 * 60 * 1000;

        let randomTime = Math.random() * (maxTime - minTime) + minTime;
        await countdown(randomTime);
    }
}


main();
