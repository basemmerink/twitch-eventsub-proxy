import {OAuthModule} from './OAuthModule';
import {Subject, Subscription} from 'rxjs';
import open = require('open');

class TwitchSubscription {
    public id: string;
    public status: string;
    public type: string;
    public version: string;
    public condition: any;
    public created_at: string;
    public transport: any;
    public cost: number;
}

class TwitchModule extends OAuthModule
{
    private broadcasterId: string;
    private subscriptions: Map<string, TwitchSubscription> = new Map();
    private subscriptionEvents: Map<string, Subject<any>> = new Map();

    constructor()
    {
        super({
            endpoint: {
                host: 'id.twitch.tv',
                path: '/oauth2/token',
            },
            clientId: process.env.TWITCH_CLIENT_ID,
            clientSecret: process.env.TWITCH_CLIENT_SECRET,
            redirectTo: 'twitch'
        }, {
            host: 'api.twitch.tv',
            path: '/helix'
        });
    }

    getHeaders(grantType = 'client_credentials'): Promise<{}>
    {
        return new Promise<{}>(resolve =>
        {
            this.getAccessToken(grantType)
                .then(token =>
                {
                    resolve({
                        'Client-ID': process.env.TWITCH_CLIENT_ID,
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    });
                })
                .catch(console.log);
        });
    }

    onTokensLoaded(hasAccessToken: boolean): void
    {
        if (hasAccessToken)
        {
            this.initSubscriptions();
        }
        else
        {
            const scope = ['bits:read', 'channel:read:redemptions', 'channel:read:subscriptions'];
            open(`https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=https://${process.env.PUBLIC_DOMAIN_OR_IP}/twitch&scope=${scope.join('%20')}&force_verify=true&response_type=code`);
        }
    }

    onAccessToken()
    {
        this.initSubscriptions();
    }

    private initSubscriptions(): void
    {
        this.getHeaders('authorization_code').then(headers => {
            this.doGet('/users', headers, new Map([['login', process.env.TWITCH_CHANNEL]]))
                .then(result => {
                    if (!result.data || result.data.length === 0)
                    {
                        console.log(`User ${process.env.TWITCH_CHANNEL} does not exist on Twitch, or there was an API error`);
                        process.exit(-1);
                    }
                    else
                    {
                        this.broadcasterId = result.data[0].id;
                        this.listSubscriptions();
                    }
                });
        })
    }

    private listSubscriptions(): void
    {
        this.doGet('/eventsub/subscriptions')
            .then(result =>
            {
                result.data.forEach((subscription: TwitchSubscription) => {
                    console.log('Subscription initialized', subscription.type, subscription.status);
                    switch (subscription.status) {
                        case 'webhook_callback_verification_failed':
                        case 'notification_failures_exceeded':
                            this.deleteSubscription(subscription.id);
                            break;
                        case 'enabled':
                            this.subscriptions.set(subscription.type, subscription);
                            if (!this.subscriptionEvents.has(subscription.type))
                            {
                                this.subscriptionEvents.set(subscription.type, new Subject());
                            }
                            break;
                        default:
                            break;
                    }
                });
                this.onSubscriptionsInitialized();
            })
            .catch(err => console.log('list eventsub error: ' + err));
    }

    private onSubscriptionsInitialized()
    {
        this.createSubscriptionIfNotExist('channel.update', { broadcaster_user_id: this.broadcasterId });
        this.createSubscriptionIfNotExist('channel.follow', { broadcaster_user_id: this.broadcasterId });
        this.createSubscriptionIfNotExist('channel.subscribe', { broadcaster_user_id: this.broadcasterId }); // channel:read:subscriptions
        this.createSubscriptionIfNotExist('channel.subscription.gift', { broadcaster_user_id: this.broadcasterId }); // channel:read:subscriptions
        this.createSubscriptionIfNotExist('channel.subscription.message', { broadcaster_user_id: this.broadcasterId }); // channel:read:subscriptions
        this.createSubscriptionIfNotExist('channel.cheer', { broadcaster_user_id: this.broadcasterId }); // bits:read
        this.createSubscriptionIfNotExist('channel.raid', { to_broadcaster_user_id: this.broadcasterId });
        this.createSubscriptionIfNotExist('channel.channel_points_custom_reward_redemption.add', { broadcaster_user_id: this.broadcasterId }); // channel:read:redemptions
        this.createSubscriptionIfNotExist('stream.online', { broadcaster_user_id: this.broadcasterId });
        this.createSubscriptionIfNotExist('stream.offline', { broadcaster_user_id: this.broadcasterId });
    }

    private createSubscriptionIfNotExist(type: string, condition: any)
    {
        if (!this.subscriptions.has(type))
        {
            this.createSubscription(type, condition);
        }
    }

    private deleteSubscription(id: string) {
        this.doDelete('/eventsub/subscriptions', undefined, new Map([['id', id]]))
            .then(result =>
            {
                console.log(`Subscription ${id} deleted`);
            })
            .catch(err => console.log('Error deleting eventsub subscription', err));
    }

    public createSubscription(type: string, condition: any): void
    {
        this.doPost('/eventsub/subscriptions', undefined, undefined, {
            type,
            version: '1',
            condition,
            transport: {
                method: 'webhook',
                callback: `${process.env.PUBLIC_DOMAIN_OR_IP}/eventsub`,
                secret: process.env.TWITCH_WEBHOOK_SECRET
            }
        })
            .then(result => {
                if (!this.subscriptionEvents.has(type))
                {
                    this.subscriptionEvents.set(type, new Subject());
                }
                console.log('Subscription create result', result);
            })
            .catch(err => console.log('Eventsub subscription create error', err));
    }

    public subscribeTwitchEvent(type: string, callback: (event) => void): Subscription
    {
        if (!this.subscriptionEvents.has(type)) {
            this.subscriptionEvents.set(type, new Subject());
        }
        return this.subscriptionEvents.get(type).subscribe(event => callback(event));
    }

    public onEventSubNotification(type: string, event: any)
    {
        if (this.subscriptionEvents.has(type)) {
            this.subscriptionEvents.get(type).next(event);
        }
    }
}

export const twitchModule = new TwitchModule();
