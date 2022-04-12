import {ChatUserstate, Client} from 'tmi.js';
import {Observable} from 'rxjs';

export interface TMIMessage
{
    channel: string;
    userState: ChatUserstate;
    message: string;
    senderIsSelf: boolean;
}

class TwitchChatModule
{
    private client: Client;

    constructor()
    {
        this.client = Client({
            identity: {
                username: process.env.TWITCH_BOT_NAME,
                password: process.env.TWITCH_OAUTH_TOKEN
            },
            channels: [process.env.TWITCH_CHANNEL],
            connection: {
                reconnect: true
            }
        });
        this.client.on('connected', () => console.log('Connected to Twitch chat'));
        this.client.connect();
    }

    public onMessage(): Observable<TMIMessage>
    {
        return new Observable(subscriber =>
        {
            this.client.on('message', (c: string, u: ChatUserstate, m: string, s: boolean) => subscriber.next({
                channel: c,
                userState: u,
                message: m,
                senderIsSelf: s
            }));
        });
    }

    public sendChat(message: string)
    {
        this.client.say(process.env.TWITCH_CHANNEL, message);
    }
}

export const twitchChatModule = new TwitchChatModule();
