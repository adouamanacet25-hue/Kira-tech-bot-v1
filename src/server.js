// ============================================================
//  KIRA TECH BOT - Test Telegram + WhatsApp Pairing
//  Auteur : Mr KIRA TECH
//  But : /pair génère un code, /start et /menu fonctionnent
// ============================================================

import TelegramBot from 'node-telegram-bot-api';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';
import pino from 'pino';

// ---------- CONFIGURATION ----------
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'TON_TOKEN_ICI';
const PREFIX = '.';
const BOT_IMAGE = 'https://i.ibb.co/hJqtxPrb/52-C1-EBD9-25-DC-44-E8-894-E-BE9755-E9-CB2-A.jpg';

// ---------- LOGGER SILENCIEUX ----------
const logger = pino({ level: 'silent' });

// ---------- VARIABLES GLOBALES ----------
let waSocket = null;
let waConnected = false;

// ============================================================
//  PARTIE TELEGRAM
// ============================================================

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ---------- /start ----------
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const text =
    `╔══════════════════════════════════════════╗\n` +
    `   ✦  WELCOME IN BOT TELEGRAM  ✦\n` +
    `╚══════════════════════════════════════════╝\n\n` +
    `✅ NAME       :  Kira Tech Bot 🌹\n` +
    `👑 CREATOR   :  Mr KIRA TECH 🌹\n\n` +
    `───────────────────────────────────────────\n` +
    `  DESCRIPTION\n` +
    `───────────────────────────────────────────\n` +
    `It's a Telegram bot that connects to\n` +
    `a WhatsApp account for use many commands\n\n` +
    `───────────────────────────────────────────\n` +
    `  JOIN MY CHANNEL\n` +
    `───────────────────────────────────────────\n\n` +
    `📱 WhatsApp Channel:\n` +
    `https://whatsapp.com/channel/0029Vb7WJzp84OmBD0fEEJ2X\n\n` +
    `📢 Telegram Channel:\n` +
    `https://t.me/+mQ3aQpCsEqI0YmY0\n\n` +
    `👥 Telegram Group:\n` +
    `https://t.me/+Z-P_xjUgJjU0MjM0\n\n` +
    `───────────────────────────────────────────\n` +
    `  EXAMPLE COMMAND\n` +
    `───────────────────────────────────────────\n` +
    `⚡ Type : /pair 242...  (to use the bot) ✅\n\n` +
    `═══════════════════════════════════════════`;

  await bot.sendPhoto(chatId, BOT_IMAGE, { caption: text });
});

// ---------- /help ----------
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const text =
    `📖 *AIDE - KIRA TECH BOT* 🌹\n\n` +
    `*Commandes disponibles :*\n\n` +
    `/start  - Message de bienvenue\n` +
    `/help   - Cette aide\n` +
    `/pair   - Connecter le bot à WhatsApp\n` +
    `/menu   - Voir les commandes WhatsApp\n\n` +
    `*Pour connecter WhatsApp :*\n` +
    `1. Tape : /pair suivi de ton numéro\n` +
    `   Ex: /pair 242061234567\n` +
    `2. Récupère le code de pairing\n` +
    `3. Ouvre WhatsApp → Appareils connectés\n` +
    `4. Connecte avec le numéro\n` +
    `5. Entre le code\n\n` +
    `> Kira Tech Bot 🌹`;

  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ---------- /pair ----------
bot.onText(/\/pair(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const phoneNumber = match[1]?.replace(/[^0-9]/g, '');

  if (!phoneNumber) {
    return bot.sendMessage(chatId,
      `❌ *Format incorrect*\n\n` +
      `Utilisation : \`/pair 242061234567\`\n` +
      `(numéro sans le +, avec indicatif pays)`,
      { parse_mode: 'Markdown' });
  }

  // Message d'attente
  await bot.sendMessage(chatId,
    `🔄 *Demande de pairing en cours...*\n` +
    `Veuillez patienter 🙏\n\n` +
    `> Kira Tech Bot 🌹`,
    { parse_mode: 'Markdown' });

  try {
    // Génère le code de pairing
    const code = await requestPairingCode(phoneNumber);

    if (!code) {
      return bot.sendMessage(chatId,
        `❌ *Échec*\n` +
        `Le code de pairing n'a pas pu être généré.\n` +
        `Tape /pair pour réessayer 🥀`);
    }

    const formattedCode = code.match(/.{1,4}/g).join('-');

    await bot.sendPhoto(chatId`, BOT_IMAGE, {
      caption:
        `✅ *Code de pairing généré*\n\n` +
        `📱 Numéro : \`+${phoneNumber}\`\n\n 🔑` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `       🔑 \`${form\attedCode}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `*Comment connecter :*\n\n` +
        `📱 *Android :*\n` +
        `1. WhatsApp → ⋮ → Appareils connectés\n` +
        `2. Connecter un appareil\n` +
        `3. Connecter avec un numéro\n` +
        `4. Entre le code ci-dessus\n\n` +
        `🍎 *iPhone :*\n` +
        `1. WhatsApp → Réglages → Appareils connectés\n` +
        `2. Connecter un appareil\n` +
        `3. Connecter avec un numéro\n` +
        `4. Entre le code ci-dessus\n\n` +
        `⏱️ Le code expire dans 5 minutes.\n\n` +
        `> Kira Tech Bot 🌹`,
      parse_mode: 'Markdown'
    });

  } catch (err) {
    console.error('Erreur pairing:', err.message);
    await bot.sendMessage(chatId,
      `❌ *Échec*\n` +
      `Erreur : ${err.message}\n\n` +
      `Tape /pair pour réessayer 🥀`);
  }
});

// ---------- /menu ----------
bot.onText(/\/menu/, async (msg) => {
  const chatId = msg.chat.id;
  const text =
    `▉ *KIRA TECH BOT* 🌹 ▉\n` +
    `▰▰▰▰▰▰▰▰▰▰\n` +
    `➠ Auteur : Mr Kira Tech 🌹\n` +
    `➠ Prefix: *[ . ]*\n` +
    `➠ Statut WhatsApp: *${waConnected ? '✅ Connecté' : '❌ Non connecté'}*\n\n` +
    `______________________\n\n` +
    `> ╢ GENERAL ♰\n` +
    `╭▰▰▰▰▰▰▰◈\n` +
    `┆❏ .ping\n` +
    `┆❏ .alive\n` +
    `┆❏ .menu\n` +
    `┆❏ .owner\n` +
    `╰▰▰▰▰▰▰▰◈\n\n` +
    `> ╢ GROUP ♰\n` +
    `╭▰▰▰▰▰▰▰◈\n` +
    `┆❏ .kick\n` +
    `┆❏ .promote\n` +
    `┆❏ .tagall\n` +
    `┆❏ .welcome\n` +
    `┆❏ .goodbye\n` +
    `╰▰▰▰▰▰▰▰◈\n\n` +
    `> ╢ FUN ♰\n` +
    `╭▰▰▰▰▰▰▰◈\n` +
    `┆❏ .blague\n` +
    `┆❏ .quote\n` +
    `╰▰▰▰▰▰▰▰◈\n\n` +
    `═══════════════════════════════════════════\n` +
    `> Power by Kira Tech`;

  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
//  PARTIE WHATSAPP (BAILEYS)
// ============================================================

async function requestPairingCode(phoneNumber) {
  // Si un socket existe déjà, on le ferme
  if (waSocket) {
    try { waSocket.end(); } catch (e) {}
    waSocket = null;
  }

  const { state, saveCreds } = await useMultiFileAuthState('./session');

  // Si déjà connecté, pas besoin de nouveau code
  if (state.creds.registered) {
    console.log('✅ Session existante trouvée');
    return 'DEJA_CONNECTE';
  }

  waSocket = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['Kira Tech Bot', 'Chrome', '1.0.0']
  });

  // Sauvegarde des credentials
  waSocket.ev.on('creds.update', saveCreds);

  // Attendre que le socket soit prêt pour demander le code
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout : WhatsApp n\'a pas répondu à temps'));
    }, 30000);

    let codeRequested = false;

    waSocket.ev.on('connection.update', async (update) => {
      const { connection, qr, lastDisconnect } = update;

      // Demander le code quand le QR est émis (socket prêt)
      if (qr && !codeRequested && !state.creds.registered) {
        codeRequested = true;
        try {
          const code = await waSocket.requestPairingCode(phoneNumber);
          clearTimeout(timeout);
          resolve(code);
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      }

      // Connexion ouverte
      if (connection === 'open') {
        waConnected = true;
        console.log('✅ WhatsApp connecté avec succès !');
        console.log(`   Compte : ${waSocket.user?.id}`);
        clearTimeout(timeout);
      }

      // Connexion fermée
      if (connection === 'close') {
        waConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`⚠️ Connexion fermée (code ${statusCode})`);

        if (shouldReconnect && !codeRequested) {
          // Reconnexion
          setTimeout(() => requestPairingCode(phoneNumber), 3000);
        }
      }
    });
  });
}

// ============================================================
//  LANCEMENT
// ============================================================

console.log('═══════════════════════════════════════════');
console.log('   ✦  KIRA TECH BOT DÉMARRÉ  ✦');
console.log('═══════════════════════════════════════════');
console.log('📡 Telegram : en ligne');
console.log('📱 WhatsApp : en attente de /pair');
console.log('═══════════════════════════════════════════');

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n👋 Arrêt du bot...');
  process.exit(0);
});
