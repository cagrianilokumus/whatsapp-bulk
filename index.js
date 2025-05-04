const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const moment = require('moment-timezone');
const schedule = require('node-schedule');
const express = require('express');
app.set('trust proxy', true);
const http = require('http');
const path = require('path');
const multer = require('multer');
const { MessageMedia } = require('whatsapp-web.js');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
    path: '/wp/socket.io',
    cors: {
      origin: "https://server.mustakil.co",
      methods: ["GET", "POST"]
    }
  });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

client.on('qr', (qr) => {
    io.emit('qr', qr);
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    io.emit('ready');
    console.log('WhatsApp istemcisi hazır!');
});

client.initialize();

async function mesajGonder(numara, mesaj) {
    const chatId = numara.includes('@c.us') ? numara : `${numara}@c.us`;
    await client.sendMessage(chatId, mesaj);
}

const upload = multer({ storage: multer.memoryStorage() });

app.post('/wp/api/send', upload.single('image'), async (req, res) => {
    let { numbers, message, delay } = req.body;
    if (!numbers || !message) {
        return res.status(400).json({ error: 'Numara ve mesaj gerekli.' });
    }
    try {
        numbers = JSON.parse(numbers);
        console.log('Gelen numbers:', numbers);
        if (!Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({ error: 'Numara listesi boş veya hatalı.', total: 0, sent: 0, failed: 0, details: [] });
        }
        delay = parseInt(delay) || 1000;
        let imageBuffer = null;
        let imageMimetype = null;
        let imageOriginalname = null;
        if (req.file) {
            imageBuffer = req.file.buffer;
            imageMimetype = req.file.mimetype;
            imageOriginalname = req.file.originalname;
        }
        const details = [];
        let sent = 0;
        let failed = 0;
        for (const num of numbers) {
            console.log('Gönderiliyor:', num);
            try {
                if (imageBuffer) {
                    const media = new MessageMedia(
                        imageMimetype,
                        imageBuffer.toString('base64'),
                        imageOriginalname
                    );
                    await client.sendMessage(num.includes('@c.us') ? num : `${num}@c.us`, media, { caption: message });
                } else {
                    await mesajGonder(num, message);
                }
                details.push({ number: num, status: 'success' });
                sent++;
            } catch (err) {
                details.push({ number: num, status: 'error', error: err.message });
                failed++;
            }
            await new Promise(r => setTimeout(r, delay));
        }
        res.json({
            success: true,
            total: numbers.length,
            sent,
            failed,
            details
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/wp/api/reset', async (req, res) => {
    try {
        await client.logout();
        setTimeout(() => {
            client.initialize();
        }, 1000);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});