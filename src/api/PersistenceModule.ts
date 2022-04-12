import {existsSync, NoParamCallback, readFile, readFileSync, writeFile, writeFileSync} from 'fs';

class PersistenceModule
{
    public loadSync<T>(file: string, defaultValue?: T): any
    {
        file = this.saveJsonToDataFolder(file);
        if (!existsSync(file))
        {
            this.writeSync(file, defaultValue);
            return defaultValue;
        }
        return JSON.parse(readFileSync(file).toString());
    }

    public loadAsync<T>(file: string, callback: (data: T) => void, defaultValue?: T): any
    {
        file = this.saveJsonToDataFolder(file);
        return readFile(file, (err, dataBuffer) =>
        {
            if (err)
            {
                this.writeAsync(file, defaultValue);
                callback(defaultValue);
            }
            else
            {
                callback(JSON.parse(dataBuffer.toString()));
            }
        });
    }

    public writeSync(file: string, content: any): void
    {
        file = this.saveJsonToDataFolder(file);
        writeFileSync(file, JSON.stringify(content));
    }

    public writeAsync(file: string, content: any, callback?: NoParamCallback): void
    {
        file = this.saveJsonToDataFolder(file);
        if (!callback)
        {
            callback = () => {};
        }
        writeFile(file, JSON.stringify(content), callback);
    }

    private saveJsonToDataFolder(file: string): string
    {
        return `${file.startsWith('data/') ? '' : 'data/'}${file}${file.endsWith('.json') ? '' : '.json'}`;
    }
}

export const persistenceModule = new PersistenceModule();
