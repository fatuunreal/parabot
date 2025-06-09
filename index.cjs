// ✅ Fallback untuk Node < 19 agar mendukung crypto.subtle
if (typeof globalThis.crypto === 'undefined') {
    const { webcrypto } = require('crypto');
    globalThis.crypto = webcrypto;
}

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const path = require('path');
const qrcode = require('qrcode');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state
    });

    // ✅ Tampilkan QR & simpan ke qr.png
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            const qrPath = path.join(__dirname, 'qr.png');
            try {
                await qrcode.toFile(qrPath, qr);
                console.log("📸 QR code dibuat di:", qrPath);
            } catch (err) {
                console.error("❌ Gagal membuat QR:", err);
            }
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnect...");
                startBot();
            } else {
                console.log("❌ Logout permanen. Scan QR ulang.");
            }
        }

        if (connection === 'open') {
            console.log("✅ Bot sudah aktif dan login!");
        }
    });

    // ✅ Simpan sesi login
    sock.ev.on('creds.update', saveCreds);

    // ✅ Forward semua pesan yang masuk
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;

        try {
            await sock.sendMessage(from, { forward: msg });
            console.log("📨 Pesan diforward!");
        } catch (err) {
            console.error("❌ Gagal forward:", err);
        }
    });
}

startBot();
