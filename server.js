// ============================================================
//  KIRA TECH BOT - Test Telegram + WhatsApp Pairing
//  Auteur : Mr KIRA TECH
// ============================================================

import TelegramBot from 'node-telegram-bot-api';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';
import pino from 'pino';

// ---------- CONFIGURATION ----------
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const BOT_IMAGE = 'https://i.ibb.co/hJqtxPrb/52-C1-EBD9-25-DC-44-E8-894-E-BE9755-E9-CB2-A.jpg';

if (!TELEGRAM_TOKEN) {
  console.error('ERREUR: TELEGRAM_TOKEN manquant dans les variables d environnement');
  process.exit(1);
}

const logger = pino({ level: 'silent' });

let waSocket = null;
let waConnected = false;

// ============================================================
//  TELEGRAM
// ============================================================

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ---------- /start ----------
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const text =
    '╔══════════════════════════════════════════╗\n' +
    '   ✦  WELCOME IN BOT TELEGRAM  ✦\n' +
    '╚══════════════════════════════════════════╝\n\n' +
    '✅ NAME       :  Kira Tech Bot 🌹\n' +
    '👑 CREATOR   :  Mr KIRA TECH 🌹\n\n' +
    '───────────────────────────────────────────\n' +
    '  DESCRIPTION\n' +
    '───────────────────────────────────────────\n' +
    'Bot Telegram qui se connecte à un compte\n' +
    'WhatsApp pour utiliser plusieurs commandes.\n\n' +
    '───────────────────────────────────────────\n' +
    '  JOIN MY CHANNEL\n' +
    '───────────────────────────────────────────\n\n' +
    '📱 WhatsApp Channel:\n' +
    'https://whatsapp.com/channel/0029Vb7WJzp84OmBD0fEEJ2X\n\n' +
    '📢 Telegram Channel:\n' +
    'https://t.me/+mQ3aQpCsEqI0YmY0\n\n' +
    '👥 Telegram Group:\n' +
    'https://t.me/+Z-P_xjUgJjU0MjM0\n\n' +
    '───────────────────────────────────────────\n' +
    '  EXAMPLE COMMAND\n' +
    '───────────────────────────────────────────\n' +
    '⚡ Tape : /pair 242...  (pour utiliser le bot)\n\n' +
    '═══════════════════════════════════════════';

  try {
    await bot.sendPhoto(chatId, BOT_IMAGE, { caption: text });
  } catch (err) {
    console.error('Erreur /start:', err.message);
    await bot.sendMessage(chatId, text);
  }
});

// ---------- /help ----------
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const text =
    '📖 AIDE - KIRA TECH BOT 🌹\n\n' +
    'Commandes disponibles :\n\n' +
    '/start  - Message de bienvenue\n' +
    '/help   - Cette aide\n' +
    '/pair   - Connecter le bot à WhatsApp\n' +
    '/menu   - Voir les commandes WhatsApp\n\n' +
    'Pour connecter WhatsApp :\n' +
    '1. Tape : /pair suivi de ton numéro\n' +
    '   Ex: /pair 242061234567\n' +
    '2. Récupère le code de pairing\n' +
    '3. Ouvre WhatsApp → Appareils connectés\n' +
    '4. Connecte avec le numéro\n' +
    '5. Entre le code\n\n' +
    '> Kira Tech Bot 🌹';

  await bot.sendMessage(chatId, text);
});

// ---------- /pair ----------
bot.onText(/\/pair(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const rawNumber = match[1];

  if (!rawNumber) {
    await bot.sendMessage(chatId,
      '❌ Format incorrect\n\n' +
      'Utilisation : /pair 242061234567\n' +
      '(numéro sans le +, avec indicatif pays)');
    return;
  }

  const phoneNumber = rawNumber.replace(/[^0-9]/g, '');

  if (phoneNumber.length < 8) {
    await bot.sendMessage(chatId, '❌ Numéro invalide. Réessaie avec /pair 242061234567');
    return;
  }

  await bot.sendMessage(chatId,
    '🔄 Demande de pairing en cours...\n' +
    'Veuillez patienter 🙏\n\n' +
    '> Kira Tech Bot 🌹');

  try {
    const code = await requestPairingCode(phoneNumber);

    if (!code) {
      await bot.sendMessage(chatId,
        '❌ Échec\n' +
        'Le code de pairing n a pas pu être généré.\n' +
        'Tape /pair pour réessayer 🥀');
      return;
    }

    if (code === 'DEJA_CONNECTE') {
      await bot.sendMessage(chatId,
        '✅ Le bot est déjà connecté à WhatsApp.\n' +
        'Utilise /menu pour voir les commandes.');
      return;
    }

    const formattedCode = code.match(/.{1,4}/g).join('-');

    const caption =
      '✅ Code de pairing généré\n\n' +
      '📱 Numéro : +' + phoneNumber + '\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '       🔑  ' + formattedCode + '  🔑\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      'Comment connecter :\n\n' +
      '📱 Android :\n' +
      '1. WhatsApp → ⋮ → Appareils connectés\n' +
      '2. Connecter un appareil\n' +
      '3. Connecter avec un numéro\n' +
      '4. Entre le code ci-dessus\n\n' +
      '🍎 iPhone :\n' +
      '1. WhatsApp → Réglages → Appareils connectés\n' +
      '2. Connecter un appareil\n' +
      '3. Connecter avec un numéro\n' +
      '4. Entre le code ci-dessus\n\n' +
      '⏱️ Le code expire dans 5 minutes.\n\n' +
      '> Kira Tech Bot 🌹';

    try {
      await bot.sendPhoto(chatId, BOT_IMAGE, { caption });
    } catch (err) {
      await bot.sendMessage(chatId, caption);
    }

  } catch (err) {
    console.error('Erreur pairing:', err.message);
    await bot.sendMessage(chatId,
      '❌ Échec\n' +
      'Erreur : ' + err.message + '\n\n' +
      'Tape /pair pour réessayer 🥀');
  }
});

// ---------- /menu ----------
bot.onText(/\/menu/, async (msg) => {
  const chatId = msg.chat.id;
  const statut = waConnected ? '✅ Connecté' : '❌ Non connecté';

  const text =
    '▉ KIRA TECH BOT 🌹 ▉\n' +
    '▰▰▰▰▰▰▰▰▰▰\n' +
    '➠ Auteur : Mr Kira Tech 🌹\n' +
    '➠ Prefix  : [ . ]\n' +
    '➠ WhatsApp: ' + statut + '\n\n' +
    '______________________\n\n' +
    '> ╢ GENERAL ♰\n' +
    '╭▰▰▰▰▰▰▰◈\n' +
    '┆❏ .ping\n' +
    '┆❏ .alive\n' +
    '┆❏ .menu\n' +
    '┆❏ .owner\n' +
    '╰▰▰▰▰▰▰▰◈\n\n' +
    '> ╢ GROUP ♰\n' +
    '╭▰▰▰▰▰▰▰◈\n' +
    '┆❏ .kick\n' +
    '┆❏ .promote\n' +
    '┆❏ .tagall\n' +
    '╰▰▰▰▰▰▰▰◈\n\n' +
    '═══════════════════════════════════════════\n' +
    '> Power by Kira Tech';

  await bot.sendMessage(chatId, text);
});

// ============================================================
//  WHATSAPP - BAILEYS
// ============================================================

async function requestPairingCode(phoneNumber) {
  if (waSocket) {
    try { waSocket.end(undefined); } catch (e) {}
    waSocket = null;
  }

  const { state, saveCreds } = await useMultiFileAuthState('./session');

  if (state.creds.registered) {
    console.log('Session existante trouvée');
    return 'DEJA_CONNECTE';
  }

  waSocket = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['Kira Tech Bot', 'Chrome', '1.0.0']
  });

  waSocket.ev.on('creds.update', saveCreds);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout : WhatsApp n a pas répondu'));
    }, 60000);

    let codeRequested = false;
    let resolved = false;

    waSocket.ev.on('connection.update', async (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr && !codeRequested && !state.creds.registered) {
        codeRequested = true;
        try {
          const code = await waSocket.requestPairingCode(phoneNumber);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(code);
          }
        } catch (err) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            reject(err);
          }
        }
      }

      if (connection === 'open') {
        waConnected = true;
        console.log('WhatsApp connecté :', waSocket.user?.id);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve('DEJA_CONNECTE');
        }
      }

      if (connection === 'close') {
        waConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log('Connexion fermée, code:', statusCode);

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('Déconnecté définitivement (loggedOut)');
        }
      }
    });
  });
}

// ============================================================
//  LANCEMENT
// ============================================================

console.log('═══════════════════════════════════════════');
console.log('   KIRA TECH BOT DEMARRE');
console.log('═══════════════════════════════════════════');
console.log('Telegram : en ligne');
console.log('WhatsApp : en attente de /pair');
console.log('═══════════════════════════════════════════');

process.on('SIGINT', () => {
  console.log('\nArrêt du bot...');
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
