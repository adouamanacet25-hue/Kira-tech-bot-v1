const TelegramBot = require('node-telegram-bot-api');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');

// ============ CONFIGURATION ============
const TELEGRAM_TOKEN = '8717824473:AAFt2phoLICy9tBdKnAdnvn0tOguz7YVZH4';
const BOT_NAME = 'KIRA TECH BOT 🌹';
const AUTEUR = 'Mr KIRA TECH';
const IMAGE_URL = 'https://i.ibb.co/hJb/52-C1-EBD9-25-DC-44-E8-894-E-BE9755-E9-CB2-A.jpg';
const CHANNEL_WA = 'https://whatsapp.com/channel/0029Vb7WJzp84OmBD0fEEJ2X';
const CHANNEL_TG = 'https://t.me/+mQ3aQpCsEqI0YmY0';
const PREFIX = '.';

// Stockage des sessions WhatsApp par utilisateur Telegram
const userSessions = new Map();
const pairingCodes = new Map();

// ============ BOT TELEGRAM ============
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ---- /start ----
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  
  const startMessage = `
═══════════════════════════════════════════
   ✦  WELCOME IN BOT TELEGRAM ✦
═══════════════════════════════════════════

✅ NAME       :  KIRA TECH BOT 🌹

👑 CREATOR   : MR KIRA TECH ✨

───────────────────────────────────────────
  DESCRIPTION
───────────────────────────────────────────
It's a Telegram bot that connects to
a WhatsApp account for use many commands

───────────────────────────────────────────
  JOIN MY CHANNEL
───────────────────────────────────────────

${CHANNEL_WA}

🔗 ${CHANNEL_TG}

───────────────────────────────────────────
  EXAMPLE COMMAND
───────────────────────────────────────────
⚡ Type : /pair 242...  (to use the bot) ✅

═══════════════════════════════════════════
  `;

  await bot.sendPhoto(chatId, IMAGE_URL, {
    caption: startMessage,
    parse_mode: 'Markdown'
  });
});

// ---- /help ----
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `
📖 *KIRA TECH BOT - AIDE*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*COMMANDES DISPONIBLES :*

/start - Message de bienvenue
/help - Cette aide
/pair <numéro> - Connecter WhatsApp
/menu - Menu des commandes WhatsApp

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*COMMENT SE CONNECTER :*

1️⃣ Tape : \`/pair 242061234567\`
   (sans le +, format international)

2️⃣ Récupère le code de pairage

3️⃣ Ouvre WhatsApp sur ton téléphone

4️⃣ Va dans : Paramètres → Appareils connectés

5️⃣ Clique sur "Connecter un appareil"

6️⃣ Choisis "Connecter avec un numéro de téléphone"

7️⃣ Entre le code de pairage

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*POUR IPHONE :*
Paramètres → Appareils connectés → Lier un appareil

*POUR ANDROID :*
Menu (⋮) → Appareils connectés → Lier un appareil

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌹 *${BOT_NAME}* par *${AUTEUR}*
  `;

  await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// ---- /pair ----
bot.onText(/\/pair (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const phoneNumber = match[1].replace(/[^0-9]/g, ''); // Enlever tout sauf les chiffres

  if (!phoneNumber || phoneNumber.length < 10) {
    return bot.sendMessage(chatId, '❌ Numéro invalide. Format : /pair 242061234567');
  }

  await bot.sendMessage(chatId, `Demande de pairing code..... 🔄`);

  try {
    const code = await createWhatsAppSession(chatId, phoneNumber);
    
    const pairMessage = `
Name : KIRA_BOT_TECH 🌹

Demande de paring au ${phoneNumber}

___________||||||||||||||||||||||||||||||__________

           \`${code}\`

________||||||||||||||||||||||||||||||||||||____________

Merci à ${AUTEUR} 🌹 pour ton bot 🤖

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*COMMENT CONNECTER :*

📱 *ANDROID :*
WhatsApp → Menu (⋮) → Appareils connectés
→ Lier un appareil → Lier avec numéro de téléphone
→ Entre le code ci-dessus

📱 *IPHONE :*
WhatsApp → Paramètres → Appareils connectés
→ Lier un appareil → Lier avec numéro de téléphone
→ Entre le code ci-dessus

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Le code expire dans 5 minutes
    `;

    await bot.sendMessage(chatId, pairMessage, { parse_mode: 'Markdown' });
    
    // Le code expire après 5 minutes
    setTimeout(() => {
      pairingCodes.delete(chatId);
      bot.sendMessage(chatId, '⏰ Le code de pairage a expiré. Utilise /pair à nouveau.');
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('Erreur pairing:', error);
    await bot.sendMessage(chatId, `❌ Erreur lors de la demande de pairage.\n${error.message}`);
  }
});

// ---- /menu ----
bot.onText(/\/menu/, async (msg) => {
  const chatId = msg.chat.id;
  
  const menuMessage = `
▉ *KIRA TECH B0T* 🌹▉
▰▰▰▰▰▰▰▰▰▰
➠ Auteur : ${AUTEUR}
➠ Prefix: *[ . ]*
➠ Total Cmds: *100*

______________________

> ╢ GROUP ♰
╭▰▰▰▰▰▰▰◈
┆❏ .add
┆❏ .antibadword
┆❏ .antibot
┆❏ .antilink
┆❏ .antispam
┆❏ .antitag
┆❏ .goodbye
┆❏ .del
┆❏ .ppgroup
┆❏ .groupinfo
┆❏ .groupname
┆❏ .kick
┆❏ .left
┆❏ .link
┆❏ .listadmin
┆❏ .mute
┆❏ .promote
┆❏ .purge
┆❏ .resetlink
┆❏ .revoke
┆❏ .setgdesc
┆❏ .staff
┆❏ .tag
┆❏ .tagall
┆❏ .unmute
┆❏ .welcome
╰▰▰▰▰▰▰▰◈

> ╢ FUN ♰
╭▰▰▰▰▰▰▰◈
┆❏ .blague
┆❏ .character
┆❏ .compliment
┆❏ .dare
┆❏ .fact
┆❏ .flirt
┆❏ .gif
┆❏ .goodnight
┆❏ .meme
┆❏ .news
┆❏ .quote
┆❏ .roseday
┆❏ .ship
┆❏ .stupid
┆❏ .trivia
┆❏ .truth
┆❏ .valentine
╰▰▰▰▰▰▰▰◈

> ╢ OWNER ♰
╭▰▰▰▰▰▰▰◈
┆❏ .allkaya
┆❏ .autoreact
┆❏ .autostatus
┆❏ .ban
┆❏ .block
┆❏ .blockinbox
┆❏ .getpp
┆❏ .private
┆❏ .recording
┆❏ .report
┆❏ .sudo
┆❏ .typing
┆❏ .unban
┆❏ .update
╰▰▰▰▰▰▰▰◈

> ╢ MEDIA ♰
╭▰▰▰▰▰▰▰◈
┆❏ .instagram
┆❏ .video
┆❏ .apk
┆❏ .capcut
┆❏ .facebook
┆❏ .getstatus
┆❏ .img
┆❏ .mediafire
┆❏ .movie
┆❏ .pinterest
┆❏ .wallpapers
╰▰▰▰▰▰▰▰◈

> ╢ GENERAL ♰
╭▰▰▰▰▰▰▰◈
┆❏ .alive
┆❏ .antidelete
┆❏ .channelid
┆❏ .fancy
┆❏ .gpstatus
┆❏ .menu
┆❏ .owner
┆❏ .pair
┆❏ .ping
┆❏ .repo
┆❏ .voice
╰▰▰▰▰▰▰▰◈

> ╢ AI ♰
╭▰▰▰▰▰▰▰◈
┆❏ .tts
┆❏ .ai
┆❏ .chatbot
┆❏ .imagine
┆❏ .manga
┆❏ .pixelart
┆❏ .gsticker
┆❏ .traduc
╰▰▰▰▰▰▰▰◈

> ╢ TOOLS ♰
╭▰▰▰▰▰▰▰◈
┆❏ .attp
┆❏ .photo
┆❏ .sticker
┆❏ .tg
┆❏ .take
┆❏ .textmaker
┆❏ .url
┆❏ .vv
╰▰▰▰▰▰▰▰◈

> ╢ SYSTEM ♰
╭▰▰▰▰▰▰▰◈
┆❏ .allprefix
┆❏ .botimage
┆❏ .botname
┆❏ .delprefix
┆❏ .online
┆❏ .prefix
┆❏ .speed
╰▰▰▰▰▰▰▰◈

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌹 *${BOT_NAME}* par *${AUTEUR}*
  `;

  await bot.sendMessage(chatId, menuMessage, { parse_mode: 'Markdown' });
});

// ============ FONCTION WHATSAPP ============
async function createWhatsAppSession(telegramChatId, phoneNumber) {
  return new Promise(async (resolve, reject) => {
    try {
      const { state, saveCreds } = await useMultiFileAuthState('auth_info');
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['KIRA TECH', 'Chrome', '1.0.0'],
      });

      sock.ev.on('creds.update', saveCreds);

      // Demander le code de pairage
      const code = await sock.requestPairingCode(phoneNumber);
      
      userSessions.set(telegramChatId, sock);
      pairingCodes.set(telegramChatId, code);

      // Écouter les événements de connexion
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
          await bot.sendMessage(telegramChatId, `
Succès 🎉🎉🎉🎉
Bot is connect ✅
Statut : open ✅
Maintenant utiliser les commandes du bot

Merci à ${AUTEUR}
          `);

          // Envoyer le menu WhatsApp
          await sock.sendMessage(sock.user.id, {
            image: { url: IMAGE_URL },
            caption: '🌹 KIRA TECH BOT connecté ! Tape .menu pour voir les commandes.'
          });
        }

        if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
          if (shouldReconnect) {
            console.log('Reconnexion...');
          }
        }
      });

      // Écouter les messages WhatsApp
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.message || msg.key.fromMe) continue;

          const messageText = msg.message.conversation || 
                             msg.message.extendedTextMessage?.text || '';

          if (!messageText.startsWith(PREFIX)) continue;

          const command = messageText.slice(PREFIX.length).trim().split(' ')[0].toLowerCase();
          const args = messageText.slice(PREFIX.length).trim().split(' ').slice(1);

          await handleWhatsAppCommand(sock, msg, command, args);
        }
      });

      resolve(code);
    } catch (error) {
      reject(error);
    }
  });
}

// ============ GESTION DES COMMANDES WHATSAPP ============
async function handleWhatsAppCommand(sock, msg, command, args) {
  const from = msg.key.remoteJid;
  const isGroup = from.endsWith('@g.us');
  const sender = msg.key.participant || msg.key.remoteJid;

  const reply = async (text) => {
    await sock.sendMessage(from, { text }, { quoted: msg });
  };

  switch (command) {
    case 'ping':
      await reply(`🏓 Pong !\nLatence: ${Date.now() - msg.messageTimestamp * 1000}ms`);
      break;

    case 'menu':
      await reply('📋 Menu WhatsApp\n\nTape .help pour la liste complète des commandes.');
      break;

    case 'alive':
      await reply('✅ KIRA TECH BOT est en ligne !');
      break;

    case 'owner':
      await reply(`👑 Owner: ${AUTEUR}\n📞 Contact: https://t.me/+242061167625`);
      break;

    case 'blague':
      const blagues = [
        "Pourquoi les plongeurs plongent-ils toujours en arrière ?\nParce que sinon ils tombent dans le bateau !",
        "Que dit un informaticien quand il est fatigué ?\nJe vais faire un break... point.",
        "Pourquoi les développeurs préfèrent-ils le noir ?\nParce que le light attire les bugs !"
      ];
      await reply(`😄 ${blagues[Math.floor(Math.random() * blagues.length)]}`);
      break;

    case 'quote':
      const quotes = [
        "La vie, c'est comme une bicyclette, il faut avancer pour ne pas perdre l'équilibre. - Albert Einstein",
        "Le succès, c'est tomber sept fois et se relever huit. - Proverbe japonais",
        "La meilleure façon de prédire l'avenir, c'est de le créer. - Peter Drucker"
      ];
      await reply(`💬 ${quotes[Math.floor(Math.random() * quotes.length)]}`);
      break;

    case 'fact':
      const facts = [
        "Les pieuvres ont trois cœurs.",
        "Une journée sur Vénus est plus longue qu'une année sur Vénus.",
        "Le miel ne se périme jamais."
      ];
      await reply(`🤓 Le saviez-vous ?\n${facts[Math.floor(Math.random() * facts.length)]}`);
      break;

    case 'help':
      await reply(`
📖 *AIDE KIRA TECH BOT*

Commandes disponibles :
.ping - Test de latence
.menu - Menu principal
.alive - Statut du bot
.owner - Contacter le propriétaire
.blague - Blague aléatoire
.quote - Citation inspirante
.fact - Fait intéressant
.help - Cette aide

D'autres commandes arrivent bientôt !
      `);
      break;

    default:
      await reply(`❌ Commande inconnue : .${command}\nTape .help pour voir les commandes disponibles.`);
  }
}

// ============ GESTION DES GROUPES (WELCOME/GOODBYE) ============
function setupGroupEvents(sock) {
  sock.ev.on('group-participants.update', async (update) => {
    const { id, participants, action } = update;
    
    try {
      const groupMetadata = await sock.groupMetadata(id);
      const groupName = groupMetadata.subject;
      const groupDesc = groupMetadata.desc || 'Aucune description';
      const memberCount = groupMetadata.participants.length;

      for (const participant of participants) {
        const phoneNumber = participant.split('@')[0];
        
        if (action === 'add') {
          // Message de bienvenue
          const welcomeMsg = `
═══════════════════════════════════════════
   ✦  WELCOME IN GROUPES ✦
═══════════════════════════════════════════

- NAME: @${phoneNumber}
- Numbers phone : ${phoneNumber}

───────────────────────────────────────────
  ${groupName}
───────────────────────────────────────────
${groupDesc}
───────────────────────────────────────────
  JOIN MY CHANNEL
──────────────────────────────────────────

${CHANNEL_WA}

🔗 ${CHANNEL_TG}

───────────────────────────────────────────
Nombre de membres : ${memberCount}
───────────────────────────────────────────

> power by kira tech
═══════════════════════════════════════════
          `;

          await sock.sendMessage(id, {
            image: { url: IMAGE_URL },
            caption: welcomeMsg,
            mentions: [participant]
          });
        }

        if (action === 'remove') {
          // Message de départ
          const goodbyeMsg = `
═══════════════════════════════════════════
   ✦  GOOD BYE IN GROUPES ✦
═══════════════════════════════════════════

- NAME: @${phoneNumber}
- Numbers phone : ${phoneNumber}

───────────────────────────────────────────
  ${groupName}
───────────────────────────────────────────
${groupDesc}
───────────────────────────────────────────
  JOIN MY CHANNEL
──────────────────────────────────────────

${CHANNEL_WA}

🔗 ${CHANNEL_TG}

───────────────────────────────────────────
Nombre de membres : ${memberCount}
───────────────────────────────────────────

> power by kira tech
═══════════════════════════════════════════
          `;

          await sock.sendMessage(id, {
            image: { url: IMAGE_URL },
            caption: goodbyeMsg,
            mentions: [participant]
          });
        }
      }
    } catch (error) {
      console.error('Erreur événement groupe:', error);
    }
  });
}

// ============ DÉMARRAGE ============
console.log(`
═══════════════════════════════════════════
   ✦  KIRA TECH BOT 🌹  ✦
═══════════════════════════════════════════
   Auteur : ${AUTEUR}
   Statut : Démarrage...
═══════════════════════════════════════════
`);

console.log('✅ Bot Telegram démarré');
console.log('📱 En attente de connexions WhatsApp...');
