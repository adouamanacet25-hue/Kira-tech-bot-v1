// ============================================================
//  KIRA TECH BOT - Test de connexion WhatsApp (Baileys)
//  Auteur : Mr KIRA TECH
//  But : Générer un code de pairing et tester la connexion
// ============================================================

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'readline';
import { rmSync, existsSync } from 'fs';

// ---------- Configuration ----------
const SESSION_DIR = './session';          // Dossier où la session est stockée
const USE_PAIRING_CODE = true;            // true = code de pairing, false = QR code
const PHONE_NUMBER = '';                  // ← METS TON NUMÉRO ICI (format international, sans +)
                                          // Exemple : '242061234567'

// ---------- Logger silencieux (Baileys est très bavard) ----------
const logger = pino({ level: 'silent' });

// ---------- Fonction pour demander une entrée utilisateur ----------
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, answer => {
    rl.close();
    resolve(answer.trim());
  }));
}

// ---------- Démarrage du socket WhatsApp ----------
async function startWhatsApp() {
  console.log('═══════════════════════════════════════════');
  console.log('   ✦  KIRA TECH BOT - TEST CONNEXION  ✦');
  console.log('═══════════════════════════════════════════\n');

  // Récupère la version la plus récente de WhatsApp Web
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`📡 Version WhatsApp Web : ${version.join('.')} (latest: ${isLatest})`);

  // Charge ou crée l'état d'authentification
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  // Crée le socket
  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: !USE_PAIRING_CODE,
    auth: state,
    browser: ['Kira Tech Bot', 'Chrome', '1.0.0'],
    generateHighQualityLinkPreview: true
  });

  // ---------- Demande du code de pairing ----------
  if (USE_PAIRING_CODE && !sock.authState.creds.registered) {
    let phoneNumber = PHONE_NUMBER;

    // Si aucun numéro n'est défini dans le fichier, on le demande
    if (!phoneNumber) {
      phoneNumber = await askQuestion(
        '📱 Entre ton numéro WhatsApp (format international, sans +) : '
      );
    }

    // Petit délai pour être sûr que le socket est prêt
    await new Promise(r => setTimeout(r, 3000));

    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log('\n═══════════════════════════════════════════');
      console.log('   🔑  CODE DE PAIRING WHATSAPP  🔑');
      console.log('═══════════════════════════════════════════');
      console.log(`\n         👉  ${code}  👈\n`);
      console.log('═══════════════════════════════════════════');
      console.log('\n📖 Comment se connecter :');
      console.log('   1. Ouvre WhatsApp sur ton téléphone');
      console.log('   2. Va dans Paramètres → Appareils connectés');
      console.log('   3. Appuie sur "Connecter un appareil"');
      console.log('   4. Choisis "Connecter avec un numéro de téléphone"');
      console.log('   5. Entre le code ci-dessus');
      console.log('\n⏱️  Le code expire dans 5 minutes.\n');
    } catch (err) {
      console.error('❌ Erreur lors de la génération du code :', err.message);
    }
  }

  // ---------- Gestion des mises à jour de connexion ----------
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Affichage du QR si mode QR activé
    if (qr && !USE_PAIRING_CODE) {
      const qrcode = await import('qrcode-terminal');
      qrcode.default.generate(qr, { small: true });
    }

    // Connexion ouverte
    if (connection === 'open') {
      console.log('\n═══════════════════════════════════════════');
      console.log('   ✅  BOT CONNECTÉ AVEC SUCCÈS  ✅');
      console.log('═══════════════════════════════════════════');
      console.log(`   📅 Date : ${new Date().toLocaleString('fr-FR')}`);
      console.log(`   👤 Compte : ${sock.user?.id || 'inconnu'}`);
      console.log('   📶 Statut : OPEN');
      console.log('═══════════════════════════════════════════\n');
      console.log('💡 Test : envoie ".ping" à ton propre numéro depuis un autre téléphone');
      console.log('   (ou ajoute le bot dans un groupe et tape .ping)\n');
    }

    // Connexion fermée
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log('\n⚠️  Connexion fermée.');
      console.log(`   Code : ${statusCode}`);
      console.log(`   Raison : ${lastDisconnect?.error?.message || 'inconnue'}`);

      if (shouldReconnect) {
        console.log('🔄 Tentative de reconnexion dans 3 secondes...\n');
        setTimeout(startWhatsApp, 3000);
      } else {
        console.log('❌ Déconnecté (loggedOut). Supprime le dossier ./session et relance.\n');
        if (existsSync(SESSION_DIR)) {
          rmSync(SESSION_DIR, { recursive: true, force: true });
          console.log('🗑️  Dossier session supprimé.');
        }
      }
    }
  });

  // ---------- Sauvegarde des credentials à chaque mise à jour ----------
  sock.ev.on('creds.update', saveCreds);

  // ---------- Réception des messages ----------
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key.fromMe) continue; // ignore nos propres messages

      const from = msg.key.remoteJid;
      const pushName = msg.pushName || 'Inconnu';

      // Extrait le texte du message
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '';

      if (!text) continue;

      console.log(`📩 [${pushName}] ${from} : ${text}`);

      // ---------- Commande .ping ----------
      if (text.trim().toLowerCase() === '.ping') {
        const start = Date.now();
        await sock.sendMessage(from, { text: '🏓 Pong !' }, { quoted: msg });
        const latency = Date.now() - start;
        await sock.sendMessage(from, {
          text: `⚡ Latence : ${latency} ms\n\n> Kira Tech Bot 🌹`
        });
      }

      // ---------- Commande .alive ----------
      if (text.trim().toLowerCase() === '.alive') {
        await sock.sendMessage(from, {
          text:
            '✅ *Bot en ligne*\n\n' +
            `📅 ${new Date().toLocaleString('fr-FR')}\n` +
            `👤 Compte : ${sock.user?.id}\n\n` +
            '> Kira Tech Bot 🌹'
        }, { quoted: msg });
      }
    }
  });

  return sock;
}

// ---------- Lancement ----------
startWhatsApp().catch(err => {
  console.error('❌ Erreur fatale :', err);
  process.exit(1);
});

// ---------- Nettoyage à l'arrêt ----------
process.on('SIGINT', () => {
  console.log('\n👋 Arrêt du bot...');
  process.exit(0);
});
