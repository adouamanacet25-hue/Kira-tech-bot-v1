const express = require('express');
const path = require('path');
const fs = require('fs');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');

// ===== CONFIGURATION =====
const WA_CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb7WJzp84OmBD0fEEJ2X';
const TG_CHANNEL_LINK = 'https://t.me/+mQ3aQpCsEqI0YmY0';
const TG_GROUP_LINK = 'https://t.me/+Z-P_xjUgJjU0MjM0';
const BOT_IMAGE_URL = 'https://i.ibb.co/hJqtxPrb/52-C1-EBD9-25-DC-44-E8-894-E-BE9755-E9-CB2-A.jpg';
const SESSION_DIR = './sessions';

// ===== EXPRESS =====
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== WHATSAPP (Baileys) =====
let waSocket = null;
let isConnecting = false;
let currentQR = null;
let connectionStatus = 'disconnected';
let connectedUser = null;
let pairingRequests = new Map(); // Stocke les demandes en cours par phone

// Liste des messages reçus (pour admin/debug)
const recentMessages = [];

// ===== LOGGER SILENCIEUX =====
const logger = pino({ level: 'silent' });

// ===== GARANTIR LE DOSSIER SESSION =====
function ensureSessionDir() {
    const sessionPath = path.join(__dirname, SESSION_DIR);
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }
    return sessionPath;
}

// ===== DÉMARRER WHATSAPP =====
async function startWhatsApp() {
    if (isConnecting) return;
    isConnecting = true;

    try {
        const sessionPath = ensureSessionDir();
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();

        waSocket = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.ubuntu('Chrome'),
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            getMessage: async () => undefined
        });

        waSocket.ev.on('creds.update', saveCreds);

        waSocket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                currentQR = qr;
                connectionStatus = 'qr';
                console.log('📱 QR Code généré');
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error instanceof Boom)
                    ? lastDisconnect.error.output?.statusCode
                    : 0;

                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                connectionStatus = 'disconnected';
                connectedUser = null;
                currentQR = null;
                isConnecting = false;

                console.log(`❌ Connexion fermée. Code: ${statusCode}, Reconnexion: ${shouldReconnect}`);

                if (shouldReconnect) {
                    setTimeout(() => startWhatsApp(), 5000);
                } else {
                    // Déconnecté volontairement : nettoyer la session
                    try {
                        const sessionPath = path.join(__dirname, SESSION_DIR);
                        if (fs.existsSync(sessionPath)) {
                            fs.rmSync(sessionPath, { recursive: true, force: true });
                            console.log('🗑️ Session nettoyée (logged out)');
                        }
                    } catch (e) {
                        console.error('Erreur nettoyage session:', e.message);
                    }
                    setTimeout(() => startWhatsApp(), 3000);
                }
            } else if (connection === 'open') {
                connectionStatus = 'connected';
                currentQR = null;
                isConnecting = false;
                connectedUser = waSocket.user?.id || null;
                console.log('✅ WhatsApp connecté !');
                console.log('👤 Utilisateur:', connectedUser);
            }
        });

        // ===== MESSAGES WHATSAPP =====
        waSocket.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;

            for (const msg of messages) {
                try {
                    if (!msg.message) continue;
                    if (msg.key.fromMe) continue;

                    const text = msg.message.conversation ||
                                msg.message.extendedTextMessage?.text ||
                                msg.message.imageMessage?.caption ||
                                msg.message.videoMessage?.caption ||
                                '';
                    const from = msg.key.remoteJid;

                    // Stocker pour debug
                    recentMessages.push({
                        from,
                        text,
                        timestamp: Date.now(),
                        pushName: msg.pushName
                    });
                    if (recentMessages.length > 50) recentMessages.shift();

                    const trimmed = text.trim().toLowerCase();

                    // ===== COMMANDES =====
                    if (trimmed === '.menu' || trimmed === 'menu') {
                        await waSocket.sendMessage(from, {
                            image: { url: BOT_IMAGE_URL },
                            caption: MENU_TEXT
                        });
                    } else if (trimmed === '.ping' || trimmed === 'ping') {
                        const start = Date.now();
                        await waSocket.sendMessage(from, { text: '🏓 Pong !' });
                        const latency = Date.now() - start;
                        await waSocket.sendMessage(from, { text: `⚡ Latence: ${latency}ms` });
                    } else if (trimmed === '.blague') {
                        const blagues = [
                            "Pourquoi les bots ne se battent jamais ? Parce qu'ils ont peur de perdre la connexion ! 😂",
                            "Qu'est-ce qu'un développeur en hiver ? Un développeur qui a froid aux doigts... code ! 🥶",
                            "Pourquoi WhatsApp n'a jamais faim ? Parce qu'il a toujours des messages à lire ! 📱"
                        ];
                        const blague = blagues[Math.floor(Math.random() * blagues.length)];
                        await waSocket.sendMessage(from, { text: blague });
                    } else if (trimmed === '.alive') {
                        await waSocket.sendMessage(from, {
                            text: `✅ *Kira Tech Bot est vivant !*\n\n⏱️ Uptime: ${Math.floor(process.uptime())}s\n👤 Connecté: ${connectedUser ? 'Oui' : 'Non'}\n🌐 Statut: ${connectionStatus}`
                        });
                    } else if (trimmed === '.owner') {
                        await waSocket.sendMessage(from, {
                            text: `👑 *Propriétaire*\n\n⫸ »͜͡𝐌𝐫 KIRA_TECH ⫷\n\n📢 Chaîne WA: ${WA_CHANNEL_LINK}`
                        });
                    } else if (trimmed === '.groupinfo') {
                        if (from.endsWith('@g.us')) {
                            try {
                                const metadata = await waSocket.groupMetadata(from);
                                const info =
                                    `📛 *Nom:* ${metadata.subject}\n` +
                                    `👥 *Membres:* ${metadata.participants.length}\n` +
                                    `📝 *Description:* ${metadata.desc || 'Aucune'}\n` +
                                    `🆔 *ID:* ${metadata.id}`;
                                await waSocket.sendMessage(from, { text: info });
                            } catch (e) {
                                await waSocket.sendMessage(from, { text: '❌ Impossible de récupérer les infos.' });
                            }
                        } else {
                            await waSocket.sendMessage(from, { text: '❌ Commande uniquement en groupe.' });
                        }
                    } else if (trimmed === '.link') {
                        if (from.endsWith('@g.us')) {
                            try {
                                const code = await waSocket.groupInviteCode(from);
                                await waSocket.sendMessage(from, {
                                    text: `🔗 *Lien du groupe:*\nhttps://chat.whatsapp.com/${code}`
                                });
                            } catch (e) {
                                await waSocket.sendMessage(from, { text: '❌ Impossible de générer le lien.' });
                            }
                        }
                    } else if (trimmed === '.tagall') {
                        if (from.endsWith('@g.us')) {
                            try {
                                const metadata = await waSocket.groupMetadata(from);
                                const mentions = metadata.participants.map(p => p.id);
                                const textMsg = `📢 *Annonce*\n\n${metadata.participants.map(p => `@${p.id.split('@')[0]}`).join(' ')}`;
                                await waSocket.sendMessage(from, {
                                    text: textMsg,
                                    mentions
                                });
                            } catch (e) {
                                await waSocket.sendMessage(from, { text: '❌ Erreur tagall.' });
                            }
                        }
                    }
                } catch (err) {
                    console.error('Erreur traitement message:', err.message);
                }
            }
        });

        // ===== ÉVÉNEMENTS GROUPE (WELCOME/GOODBYE) =====
        waSocket.ev.on('group-participants.update', async (update) => {
            try {
                const { id, participants, action } = update;

                for (const participant of participants) {
                    const number = participant.split('@')[0];
                    const metadata = await waSocket.groupMetadata(id);

                    if (action === 'add') {
                        const welcomeMsg =
                            `╔══════════════════════════════════╗\n` +
                            `   ✦  WELCOME IN GROUP ✦\n` +
                            `╚══════════════════════════════════╝\n\n` +
                            `- NAME: @${number}\n\n` +
                            `───────────────────────────────────\n` +
                            `📛 Nom: ${metadata.subject}\n` +
                            `👥 Membres: ${metadata.participants.length}\n` +
                            `───────────────────────────────────\n` +
                            `🔗 Chaîne WA: ${WA_CHANNEL_LINK}\n` +
                            `───────────────────────────────────\n` +
                            `> power by kira tech`;

                        await waSocket.sendMessage(id, {
                            image: { url: BOT_IMAGE_URL },
                            caption: welcomeMsg,
                            mentions: [participant]
                        });
                    } else if (action === 'remove') {
                        const goodbyeMsg =
                            `╔══════════════════════════════════╗\n` +
                            `   ✦  GOOD BYE ✦\n` +
                            `╚══════════════════════════════════╝\n\n` +
                            `- NAME: @${number}\n\n` +
                            `───────────────────────────────────\n` +
                            `📛 Nom: ${metadata.subject}\n` +
                            `👥 Membres restants: ${metadata.participants.length}\n` +
                            `───────────────────────────────────\n` +
                            `> power by kira tech`;

                        await waSocket.sendMessage(id, {
                            image: { url: BOT_IMAGE_URL },
                            caption: goodbyeMsg,
                            mentions: [participant]
                        });
                    }
                }
            } catch (err) {
                console.error('Erreur welcome/goodbye:', err.message);
            }
        });

        isConnecting = false;
    } catch (err) {
        console.error('Erreur startWhatsApp:', err.message);
        isConnecting = false;
        setTimeout(() => startWhatsApp(), 5000);
    }
}

// ===== TEXTE DU MENU =====
const MENU_TEXT =
`▉ KIRA TECH B0T🌹▉
▰▰▰▰▰▰▰▰▰▰
➠ Auteur : Mr kira tech 🌹
➠ Prefix: *[ . ]*

______________________

> ╢ GENERAL ♰
╭▰▰▰▰▰▰▰◈
┆❏ .menu
┆❏ .ping
┆❏ .alive
┆❏ .owner
┆❏ .blague
┆❏ .groupinfo
┆❏ .link
┆❏ .tagall
╰▰▰▰▰▰▰▰◈

> power by kira tech`;

// ===== ROUTES API =====

// Route santé
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
    res.json({
        status: connectionStatus,
        connected: connectionStatus === 'connected',
        user: connectedUser,
        hasQR: !!currentQR,
        uptime: Math.floor(process.uptime())
    });
});

// Route pour demander un code de jumelage
app.post('/api/pair', async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'Numéro manquant'
            });
        }

        // Nettoyer le numéro
        const cleanPhone = phone.replace(/\D/g, '');

        if (cleanPhone.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Numéro invalide. Format international requis (ex: 242061234567)'
            });
        }

        // Vérifier que WhatsApp est prêt
        if (!waSocket) {
            return res.status(503).json({
                success: false,
                error: 'Le bot WhatsApp n\'est pas initialisé. Réessayez dans quelques secondes.'
            });
        }

        // Vérifier si déjà connecté
        if (waSocket.authState?.creds?.registered || connectionStatus === 'connected') {
            return res.json({
                success: true,
                alreadyConnected: true,
                message: '✅ Le bot est déjà connecté à WhatsApp !'
            });
        }

        // Éviter les demandes multiples en parallèle pour le même numéro
        if (pairingRequests.has(cleanPhone)) {
            const existing = pairingRequests.get(cleanPhone);
            if (Date.now() - existing.timestamp < 60000) {
                return res.json({
                    success: true,
                    code: existing.formattedCode,
                    message: 'Code déjà généré (réutilisé)'
                });
            }
        }

        // Attendre un peu que la connexion soit stable
        if (isConnecting || !waSocket.authState) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`🔑 Demande de code pour: ${cleanPhone}`);

        // Demander le code de jumelage
        let code;
        try {
            code = await waSocket.requestPairingCode(cleanPhone);
        } catch (err) {
            console.error('Erreur requestPairingCode:', err.message);
            return res.status(500).json({
                success: false,
                error: `Erreur WhatsApp: ${err.message}`
            });
        }

        if (!code) {
            return res.status(500).json({
                success: false,
                error: 'Aucun code reçu de WhatsApp. Réessayez.'
            });
        }

        // Formater le code (ex: ABCD-EFGH)
        const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;

        // Stocker la demande
        pairingRequests.set(cleanPhone, {
            code,
            formattedCode,
            timestamp: Date.now()
        });

        // Nettoyer les vieilles demandes
        for (const [key, val] of pairingRequests.entries()) {
            if (Date.now() - val.timestamp > 5 * 60 * 1000) {
                pairingRequests.delete(key);
            }
        }

        console.log(`✅ Code généré pour ${cleanPhone}: ${formattedCode}`);

        return res.json({
            success: true,
            code: formattedCode,
            rawCode: code,
            phone: cleanPhone,
            message: 'Code généré ! Entrez-le dans WhatsApp.'
        });

    } catch (err) {
        console.error('Erreur /api/pair:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Erreur inconnue'
        });
    }
});

// Route debug : messages récents
app.get('/api/messages', (req, res) => {
    res.json(recentMessages);
});

// Route pour déconnecter (logout)
app.post('/api/logout', async (req, res) => {
    try {
        if (waSocket && connectionStatus === 'connected') {
            await waSocket.logout();
            connectionStatus = 'disconnected';
            connectedUser = null;
            return res.json({ success: true, message: 'Déconnecté' });
        }
        return res.json({ success: false, message: 'Non connecté' });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ===== LANCEMENT =====
app.listen(PORT, () => {
    console.log(`🌐 Serveur web sur http://localhost:${PORT}`);
});

startWhatsApp();

// Nettoyage à l'arrêt
process.on('SIGINT', async () => {
    console.log('\n🛑 Arrêt en cours...');
    try {
        if (waSocket) await waSocket.end(undefined);
    } catch (e) {}
    process.exit(0);
});
