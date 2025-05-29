// Fallback untuk Node 18 agar mendukung crypto.subtle
if (typeof globalThis.crypto === 'undefined') {
    const { webcrypto } = require('crypto');
    globalThis.crypto = webcrypto;
}

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            const qrPath = path.join(__dirname, 'qr.png');
            try {
                await qrcode.toFile(qrPath, qr);
                console.log("✅ QR Code dibuat: qr.png");
            } catch (err) {
                console.error("❌ Gagal buat QR:", err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log("🔄 Reconnect...");
                startBot();
            } else {
                console.log("❌ Harus scan ulang QR.");
            }
        }

        if (connection === 'open') {
            console.log("✅ Bot aktif!");
        }
    });

    sock.ev.on('creds.update', saveCreds);

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
