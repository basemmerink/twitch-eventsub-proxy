import {request as httpsRequest, RequestOptions} from 'https';

export interface EndpointOptions
{
    host: string;
    path: string;
}

export abstract class RestAPIModule
{
    private readonly endpoint: EndpointOptions;

    protected constructor(endpoint: EndpointOptions)
    {
        this.endpoint = endpoint;
    }

    abstract getHeaders(): Promise<{}>;

    public doGet(path: string, httpHeaders?: {}, query?: Map<string, any>): Promise<any>
    {
        return this.doRequest('GET', path, httpHeaders, query);
    }

    public doPost(path: string, httpHeaders?: {}, query?: Map<string, any>, data?: any): Promise<any>
    {
        return this.doRequest('POST', path, httpHeaders, query, data);
    }

    public doPut(path: string, httpHeaders?: {}, query?: Map<string, any>, data?: any): Promise<any>
    {
        return this.doRequest('PUT', path, httpHeaders, query, data);
    }

    public doPatch(path: string, httpHeaders?: {}, query?: Map<string, any>, data?: any): Promise<any>
    {
        return this.doRequest('PATCH', path, httpHeaders, query, data);
    }

    public doDelete(path: string, httpHeaders?: {}, query?: Map<string, any>, data?: any): Promise<any>
    {
        return this.doRequest('DELETE', path, httpHeaders, query, data);
    }

    protected buildRequest(options, resolve: (value?: (PromiseLike<any> | any)) => void)
    {
        return httpsRequest(options, res =>
        {
            let result = '';
            res.on('data', partial => result += partial);
            res.on('end', () =>
            {
                if (result.length > 0)
                {
                    resolve(JSON.parse(result.toString()));
                }
                else
                {
                    resolve({});
                }
            });
            res.on('error', err => {
                throw err;
            });
        });
    }

    private doRequest(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, httpHeaders?: {}, query?: Map<string, any>,
                      data?: any): Promise<any>
    {
        data = data && JSON.stringify(data);
        const headerPromise = httpHeaders ? new Promise<{}>(resolve => resolve(httpHeaders)) : this.getHeaders();

        return new Promise((resolve, reject) =>
        {
            headerPromise.then(headers =>
            {
                const options: RequestOptions = {
                    hostname: this.endpoint.host,
                    path: this.endpoint.path + path,
                    method,
                    headers
                };
                if (query && query.size > 0)
                {
                    options.path += '?' + [...query.entries()].map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
                }
                if (data)
                {
                    options.headers = {
                        ...options.headers,
                        'Content-Length': data.length
                    };
                }
                const request = this.buildRequest(options, resolve);
                request.on('error', error =>
                {
                    reject(error);
                });
                if (data)
                {
                    request.write(data);
                }
                request.end();
            });
        });
    }
}
