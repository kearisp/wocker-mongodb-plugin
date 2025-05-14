export type DatabaseProps = {
    name: string;
    imageName?: string;
    imageVersion?: string;
    username: string;
    password: string;
    configStorage?: string;
    storage?: string;
    volume?: string;
    configVolume?: string;
};

export class Database {
    public name: string;
    public imageName?: string;
    public imageVersion?: string;
    public username: string;
    public password: string;
    protected _configVolume?: string;
    protected _volume?: string;

    public constructor(props: DatabaseProps) {
        const {
            name,
            imageName,
            imageVersion,
            username,
            password,
            configStorage,
            configVolume,
            storage,
            volume
        } = props;

        this.name = name;
        this.imageName = imageName;
        this.imageVersion = imageVersion;
        this.username = username;
        this.password = password;
        this._configVolume = configStorage || configVolume;
        this._volume = storage || volume;
    }

    public get containerName(): string {
        return `mongodb-${this.name}.ws`;
    }

    public get image(): string {
        const imageName = this.imageName || "mongo",
            imageVersion = this.imageVersion;

        if(!imageVersion) {
            return imageName;
        }

        return `${imageName}:${imageVersion}`;
    }

    public get volume(): string {
        if(!this._volume) {
            this._volume = this.defaultStorage;
        }

        return this._volume;
    }

    public set volume(volume: string) {
        this._volume = volume;
    }

    public get configVolume(): string {
        if(!this._configVolume) {
            this._configVolume = this.defaultConfigStorage;
        }

        return this._configVolume;
    }

    public set configVolume(configVolume: string) {
        this._configVolume = configVolume;
    }

    public get defaultStorage(): string {
        return `wocker-mongodb-${this.name}`;
    }

    public get defaultConfigStorage(): string {
        return `wocker-mongodb-config-${this.name}`;
    }

    public toObject(): DatabaseProps {
        return {
            name: this.name,
            imageName: this.imageName,
            imageVersion: this.imageVersion,
            username: this.username,
            password: this.password,
            volume: this._volume,
            configVolume: this._configVolume
        };
    }
}
