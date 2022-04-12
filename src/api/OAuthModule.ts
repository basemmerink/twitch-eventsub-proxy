import {RequestOptions} from 'https';
import {RestAPIModule, EndpointOptions} from './RestAPIModule';
import {persistenceModule} from "./PersistenceModule";

export interface OAuthOptions
{
    endpoint: EndpointOptions;
    clientId: string;
    clientSecret: string;
    redirectTo: string;
}

export interface OAuthAccessToken
{
    access_token: string;
    refresh_token?: string;
    expires_in?: string;
    scope?: string[];
    token_type?: string;
    expirationDate?: number;
}

export abstract class OAuthModule extends RestAPIModule
{
    private readonly oauthOptions: OAuthOptions;

    private accessTokens: Map<string, OAuthAccessToken>;

    private code: string;

    protected constructor(oauthOptions: OAuthOptions, restEndpoint: EndpointOptions)
    {
        super(restEndpoint);
        this.oauthOptions = oauthOptions;
        this.accessTokens = new Map();

        persistenceModule.loadAsync<[]>(oauthOptions.endpoint.host, data =>
        {
            this.accessTokens = new Map(data);
            console.log('tokens loaded for ' + oauthOptions.endpoint.host);
            this.onTokensLoaded();
        }, []);
    }

    abstract onTokensLoaded(): void;

    public setCode(code: string)
    {
        this.code = code;
        this.getAccessToken()
            .then(token => 'Client token registered for ' + this.oauthOptions.endpoint.host)
            .catch(console.log);
    }

    // https://github.com/twitchdev/eventsub-webhooks-node-sample/blob/main/index.js
    // eventsub needs grant_type=client_credentials
    protected getAccessToken(grantType = 'client_credentials'): Promise<string>
    {
        return new Promise<string>((resolve, reject) =>
        {
            const accessToken = this.accessTokens.get(grantType);
            if (accessToken && accessToken.expirationDate && Date.now() < accessToken.expirationDate)
            {
                if (Date.now() < accessToken.expirationDate)
                {
                    resolve(accessToken.access_token);
                    return;
                } else if (grantType === 'client_credentials') {
                    this.accessTokens.set(grantType, undefined);
                    this.saveAccessTokens();
                }
            }
            if (!accessToken && grantType === 'authorization_code' && !this.code)
            {
                reject('Trying to access OAuth features without having a code');
                return;
            }
            const request = this.buildRequest(this.getRequestOptions(), result =>
            {
                if (result.status !== 400)
                {
                    this.saveTokens(grantType, result as OAuthAccessToken);
                    resolve(this.accessTokens.get(grantType).access_token);
                }
                else
                {
                    console.log('http status not 400', result);
                    reject('error requesting accessToken for ' + grantType);
                }
            });
            request.write(this.queryParamsToString(this.buildQueryParams(grantType, accessToken)));
            request.end();
        });
    }

    private buildQueryParams(grantType: string, accessToken: OAuthAccessToken): Map<string, string>
    {
        const useRefreshToken = this.accessTokens.has(grantType);
        const queryParams = new Map<string, string>();
        queryParams.set('grant_type', useRefreshToken ? 'refresh_token' : grantType);
        queryParams.set('client_id', this.oauthOptions.clientId);
        queryParams.set('client_secret', this.oauthOptions.clientSecret);
        if (useRefreshToken)
        {
            queryParams.set('refresh_token', accessToken.refresh_token);
        }
        else if (grantType === 'authorization_code')
        {
            queryParams.set('redirect_uri', `${process.env.EXTERNAL_DOMAIN}/${this.oauthOptions.redirectTo}`);
            queryParams.set('code', this.code);
        }
        return queryParams;
    }

    private queryParamsToString(queryParams: Map<string, string>): string
    {
        return [...queryParams]
            .map(([key, value]) => `${key}=${value}`)
            .join('&');
    }

    private getAuthorizationToken()
    {
        return 'Basic ' +
            Buffer.from(this.oauthOptions.clientId + ':' + this.oauthOptions.clientSecret)
                .toString('base64');
    }

    private getRequestOptions(): RequestOptions
    {
        return {
            hostname: this.oauthOptions.endpoint.host,
            path: this.oauthOptions.endpoint.path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: this.getAuthorizationToken()
            }
        };
    }

    private saveTokens(grantType: string, oauthAccessToken: OAuthAccessToken)
    {
        oauthAccessToken.expirationDate = Date.now() + (parseInt(oauthAccessToken.expires_in) || 3600) * 1000;
        this.accessTokens.set(grantType, oauthAccessToken);
        this.saveAccessTokens();
    }

    private saveAccessTokens()
    {
        persistenceModule.writeAsync(this.oauthOptions.endpoint.host, [...this.accessTokens]);
    }
}
