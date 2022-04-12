import 'dotenv/config'

import * as fs from 'fs';
import {Server, WebSocket} from 'ws';

import express from 'express';
import crypto from 'crypto';
import {createServer} from 'https';
import {twitchModule} from "./api/TwitchModule";
import {TMIMessage, twitchChatModule} from "./api/TwitchChatModule";


const TWITCH_MESSAGE_ID = 'Twitch-Eventsub-Message-Id'.toLowerCase();
const TWITCH_MESSAGE_TIMESTAMP = 'Twitch-Eventsub-Message-Timestamp'.toLowerCase();
const TWITCH_MESSAGE_SIGNATURE = 'Twitch-Eventsub-Message-Signature'.toLowerCase();
const TWITCH_MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type'.toLowerCase();

const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification';
const MESSAGE_TYPE_NOTIFICATION = 'notification';
const MESSAGE_TYPE_REVOCATION = 'revocation';

const HMAC_PREFIX = 'sha256=';

if (!fs.existsSync(process.env.PRIVKEY_PEM_PATH) ||
    !fs.existsSync(process.env.CHAIN_PEM_PATH) ||
    !fs.existsSync(process.env.CERT_PEM_PATH)) {
    console.log('Please install an SSL certificate first and point to the proper files in .env');
    process.exit(-1);
}


const app = express();

const server = createServer({
    key: fs.readFileSync(process.env.PRIVKEY_PEM_PATH),
    ca: fs.readFileSync(process.env.CHAIN_PEM_PATH),
    cert: fs.readFileSync(process.env.CERT_PEM_PATH)
}, app);

server.listen(process.env.SSL_PORT, () => console.log(`Running https server on port ${process.env.SSL_PORT}`));

var wsServer = new Server({port: process.env.WEBSOCKET_LOCAL_PORT});

twitchModule.subscribeTwitchEvent('channel.update', event => forwardTwitchEvent('channel.update', event));
twitchModule.subscribeTwitchEvent('channel.follow', event => forwardTwitchEvent('channel.follow', event));
twitchModule.subscribeTwitchEvent('channel.subscribe', event => forwardTwitchEvent('channel.subscribe', event));
twitchModule.subscribeTwitchEvent('channel.subscription.gift', event => forwardTwitchEvent('channel.subscription.gift', event));
twitchModule.subscribeTwitchEvent('channel.subscription.message', event => forwardTwitchEvent('channel.subscription.message', event));
twitchModule.subscribeTwitchEvent('channel.cheer', event => forwardTwitchEvent('channel.cheer', event));
twitchModule.subscribeTwitchEvent('channel.raid', event => forwardTwitchEvent('channel.raid', event));
twitchModule.subscribeTwitchEvent('channel.channel_points_custom_reward_redemption.add', event => forwardTwitchEvent('channel.channel_points_custom_reward_redemption.add', event));
twitchModule.subscribeTwitchEvent('stream.online', event => forwardTwitchEvent('stream.online', event));
twitchModule.subscribeTwitchEvent('stream.offline', event => forwardTwitchEvent('stream.offline', event));

function forwardTwitchEvent(key: string, event: any): void
{
    broadcastSocketMessage(key, event);
}

twitchChatModule.onMessage().subscribe((message: TMIMessage) => {
    if (message.senderIsSelf) {
        return;
    }
    forwardTwitchEvent('channel.chat', {user: message.userState['display-name'], message: message.message})
});

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.post('/eventsub', (req, res) => {
    const secret = process.env.TWITCH_WEBHOOK_SECRET;
    const message = getHmacMessage(req);
    const hmac = HMAC_PREFIX + getHmac(secret, message);

    if (true === verifyMessage(hmac, req.headers[TWITCH_MESSAGE_SIGNATURE])) {
        const notification = JSON.parse(req.rawBody);

        if (MESSAGE_TYPE_NOTIFICATION === req.headers[TWITCH_MESSAGE_TYPE]) {
            twitchModule.onEventSubNotification(notification.subscription.type, notification.event);
            res.sendStatus(204);
        }
        else if (MESSAGE_TYPE_VERIFICATION === req.headers[TWITCH_MESSAGE_TYPE]) {
            res.status(200).send(notification.challenge);
        }
        else if (MESSAGE_TYPE_REVOCATION === req.headers[TWITCH_MESSAGE_TYPE]) {
            res.sendStatus(204);

            console.log(`${notification.subscription.type} notifications revoked!`);
            console.log(`reason: ${notification.subscription.status}`);
            console.log(`condition: ${JSON.stringify(notification.subscription.condition, null, 4)}`);
        }
        else {
            res.sendStatus(204);
            console.log(`Unknown message type: ${req.headers[TWITCH_MESSAGE_TYPE]}`);
        }
    }
    else {
        console.log('Error, twitch signature didn\'t match');
        res.sendStatus(403);
    }
});

function getHmacMessage(request) {
    return (request.headers[TWITCH_MESSAGE_ID] +
        request.headers[TWITCH_MESSAGE_TIMESTAMP] +
        request.rawBody);
}

function getHmac(secret, message) {
    return crypto.createHmac('sha256', secret)
        .update(message)
        .digest('hex');
}

function verifyMessage(hmac, verifySignature) {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(verifySignature));
}

function broadcastSocketMessage(key: string, message: any) {
    wsServer.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({key: key, payload: message}));
        }
    });
}
