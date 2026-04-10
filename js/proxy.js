// proxy.js — เพิ่มไฟล์นี้ถ้าต้องการ proxy สำหรับ Anthropic
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/proxy', async (req, res) => {
    const { url, headers, body } = req.body;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        const data = await response.text();
        res.status(response.status).send(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3001, () => console.log('Proxy running on :3001'));
