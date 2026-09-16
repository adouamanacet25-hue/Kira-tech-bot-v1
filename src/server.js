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

// ===== CONFIG =====
const WA_CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb7WJzp84OmBD0fEEJ2X';
const BOT_IMAGE_URL = 'https://i.ibb.co/hJqtxPrb/52-C1-EBD9-25-DC-44-E8-894-E-BE9755-E9-CB2-A.jpg';
const SESSION_DIR = path.join(__dirname, 'sessions');

// ===== EXPRESS =====
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== STATE =====
let waSocket = null;
let connectionStatus = 'disconnected';
let connectedUser = null;
let pairingInProgress = false;
const logger = pino({ level: 'silent' });

// ===== DOSSIER SESSION =====
function ensureSessionDir() {
    if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    return SESSION_DIR;
}

// Nettoyer la session (utile si elle est corrompue)
function clearSession() {
    try {
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            console.log('🗑️ Session nettoyée');
        }
    } catch (e) {
        console.error('Erreur nettoyage:', e.message);
    }
}

// ===== DÉMARRER WHATSAPP =====
async function startWhatsApp() {
    try {
        const sessionPath = ensureSessionDir();
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();

        console.log('🚀 Démarrage WhatsApp...');

        waSocket = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.ubuntu('Chrome'),
            syncFullHistory: false,
            markOnlineOnConnect: false,
            getMessage: async () => undefined
        });

        waSocket.ev.on('creds.update', saveCreds);

        waSocket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error instanceof Boom)
                    ? lastDisconnect.error.output?.statusCode
                    : 0;

                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                connectionStatus = 'disconnected';
                connectedUser = null;

                console.log(`❌ Fermé (code ${statusCode}) - reconnexion: ${shouldReconnect}`);

                if (shouldReconnect) {
                    setTimeout(() => startWhatsApp(), 3000);
                } else {
                    clearSession();
                    setTimeout(() => startWhatsApp(), 3000);
                }
            } else if (connection === 'open') {
                connectionStatus = 'connected';
                connectedUser = waSocket.user?.id || null;
                console.log('✅ WhatsApp connecté:', connectedUser);
            }
        });

        // ===== MESSAGES =====
        waSocket.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;

            for (const msg of messages) {
                try {
                    if (!msg.message || msg.key.fromMe) continue;

                    const text = msg.message.conversation ||
                                msg.message.extendedTextMessage?.text ||
                                msg.message.imageMessage?.caption || '';
                    const from = msg.key.remoteJid;
                    const cmd = text.trim().toLowerCase();

                    if (cmd === '.menu' || cmd === 'menu') {
                        await waSocket.sendMessage(from, {
                            image: { url: BOT_IMAGE_URL },
                            caption: MENU_TEXT
                        });
                    } else if (cmd === '.ping' || cmd === 'ping') {
                        await waSocket.sendMessage(from, { text: '🏓 Pong !' });
                    } else if (cmd === '.alive') {
                        await waSocket.sendMessage(from, {
                            text: `✅ Bot vivant\n⏱️ Uptime: ${Math.floor(process.uptime())}s`
                        });
                    } else if (cmd === '.owner') {
                        await waSocket.sendMessage(from, {
                            text: `👑 Mr KIRA_TECH\n📢 ${WA_CHANNEL_LINK}`
                        });
                    } else if (cmd === '.blague') {
                        const blagues = [
                            "Pourquoi les bots ne se battent jamais ? Parce qu'ils ont peur de perdre la connexion ! 😂",
                            "Un dev en hiver ? Un dev qui a froid aux doigts... code ! 🥶",
                        ];
                        await waSocket.sendMessage(from, {
                            text: blagues[Math.floor(Math.random() * blagues.length)]
                        });
                    } else if (cmd === '.groupinfo' && from.endsWith('@g.us')) {
                        const meta = await waSocket.groupMetadata(from);
                        await waSocket.sendMessage(from, {
                            text: `📛 ${meta.subject}\n👥 ${meta.participants.length} membres\n📝 ${meta.desc || 'Aucune desc'}`
                        });
                    } else if (cmd === '.link' && from.endsWith('@g.us')) {
                        const code = await waSocket.groupInviteCode(from);
                        await waSocket.sendMessage(from, {
                            text: `🔗 https://chat.whatsapp.com/${code}`
                        });
                    }
                } catch (e) {
                    console.error('Erreur message:', e.message);
                }
            }
        });

        // ===== WELCOME / GOODBYE =====
        waSocket.ev.on('group-participants.update', async (update) => {
            try {
                const { id, participants, action } = update;
                for (const p of participants) {
                    const number = p.split('@')[0];
                    const meta = await waSocket.groupMetadata(id);

                    if (action === 'add') {
                        await waSocket.sendMessage(id, {
                            image: { url: BOT_IMAGE_URL },
                            caption: `╔══════════════════════╗\n   ✦ WELCOME ✦\n╚══════════════════════╝\n\n👋 Bienvenue @${number} !\n\n📛 ${meta.subject}\n👥 ${meta.participants.length} membres\n🔗 ${WA_CHANNEL_LINK}\n\n> power by kira tech`,
                            mentions: [p]
                        });
                    } else if (action === 'remove') {
                        await waSocket.sendMessage(id, {
                            image: { url: BOT_IMAGE_URL },
                            caption: `╔══════════════════════╗\n   ✦ GOOD BYE ✦\n╚══════════════════════╝\n\n👋 Au revoir @${number}\n\n📛 ${meta.subject}\n👥 ${meta.participants.length} membres\n\n> power by kira tech`,
                            mentions: [p]
                        });
                    }
                }
            } catch (e) {
                console.error('Erreur welcome:', e.message);
            }
        });

    } catch (err) {
        console.error('Erreur startWhatsApp:', err.message);
        setTimeout(() => startWhatsApp(), 5000);
    }
}

const MENU_TEXT =
`▉ KIRA TECH B0T🌹▉
➠ Auteur : Mr kira tech 🌹
➠ Prefix: *[ . ]*

> ╢ GENERAL ♰
┆❏ .menu
┆❏ .ping
┆❏ .alive
┆❏ .owner
┆❏ .blague
┆❏ .groupinfo
┆❏ .link

> power by kira tech`;

// ===== ROUTES =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
    res.json({
        status: connectionStatus,
        connected: connectionStatus === 'connected',
        user: connectedUser,
        uptime: Math.floor(process.uptime())
    });
});

// ===== PAIRING CODE (CORRIGÉ) =====
app.post('/api/pair', async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, error: 'Numéro manquant' });
        }

        // Nettoyer : garder uniquement les chiffres
        const cleanPhone = phone.replace(/\D/g, '');

        if (cleanPhone.length < 8 || cleanPhone.length > 15) {
            return res.status(400).json({
                success: false,
                error: 'Numéro invalide (8-15 chiffres, sans +)'
            });
        }

        // Déjà connecté ?
        if (connectionStatus === 'connected') {
            return res.json({
                success: true,
                alreadyConnected: true,
                message: 'Bot déjà connecté'
            });
        }

        // Éviter les demandes simultanées
        if (pairingInProgress) {
            return res.status(429).json({
                success: false,
                error: 'Une demande est déjà en cours. Attendez 10 secondes.'
            });
        }

        pairingInProgress = true;

        // ⚠️ IMPORTANT : supprimer la session existante pour forcer un fresh pairing
        // Sinon Baileys ne génère pas de code
        if (waSocket) {
            try { waSocket.end(undefined); } catch (e) {}
        }
        clearSession();
        await new Promise(r => setTimeout(r, 1500));

        // Redémarrer un socket frais
        const sessionPath = ensureSessionDir();
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();

        console.log(`🔑 Nouveau socket pour ${cleanPhone}`);

        const tempSocket = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.ubuntu('Chrome'),
            syncFullHistory: false,
            markOnlineOnConnect: false,
            getMessage: async () => undefined
        });

        tempSocket.ev.on('creds.update', saveCreds);

        // Réattacher les listeners globaux
        tempSocket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error instanceof Boom)
                    ? lastDisconnect.error.output?.statusCode : 0;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                connectionStatus = 'disconnected';
                connectedUser = null;
                if (shouldReconnect) setTimeout(() => startWhatsApp(), 3000);
                else { clearSession(); setTimeout(() => startWhatsApp(), 3000); }
            } else if (connection === 'open') {
                connectionStatus = 'connected';
                connectedUser = tempSocket.user?.id || null;
                console.log('✅ Connecté après pairing:', connectedUser);
                // Le socket principal devient ce socket
                waSocket = tempSocket;
            }
        });

        tempSocket.ev.on('messages.upsert', async (data) => {
            // On laisse startWhatsApp gérer après connexion
        });

        // ⚠️ Attendre que le socket soit prêt (2 secondes)
        await new Promise(r => setTimeout(r, 2500));

        // Demander le code
        let code;
        try {
            code = await tempSocket.requestPairingCode(cleanPhone);
        } catch (err) {
            console.error('Erreur requestPairingCode:', err.message);
            pairingInProgress = false;
            return res.status(500).json({
                success: false,
                error: `Erreur WhatsApp: ${err.message}`
            });
        }

        if (!code) {
            pairingInProgress = false;
            return res.status(500).json({
                success: false,
                error: 'Aucun code reçu. Réessayez dans 10s.'
            });
        }

        // Format XXXX-XXXX
        const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;

        console.log(`✅ Code pour ${cleanPhone} : ${formattedCode}`);

        // Réinitialiser le flag après 10s (pour permettre une nouvelle demande)
        setTimeout(() => { pairingInProgress = false; }, 10000);

        return res.json({
            success: true,
            code: formattedCode,
            rawCode: code,
            phone: cleanPhone
        });

    } catch (err) {
        console.error('Erreur /api/pair:', err);
        pairingInProgress = false;
        return res.status(500).json({
            success: false,
            error: err.message || 'Erreur inconnue'
        });
    }
});

// Logout
app.post('/api/logout', async (req, res) => {
    try {
        if (waSocket && connectionStatus === 'connected') {
            await waSocket.logout();
            connectionStatus = 'disconnected';
            connectedUser = null;
            return res.json({ success: true });
        }
        return res.json({ success: false, message: 'Non connecté' });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ===== LANCEMENT =====
app.listen(PORT, () => {
    console.log(`🌐 http://localhost:${PORT}`);
});

startWhatsApp();

process.on('SIGINT', async () => {
    try { if (waSocket) await waSocket.end(undefined); } catch (e) {}
    process.exit(0);
});
