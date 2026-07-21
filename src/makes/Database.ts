import {Image} from "@wocker/utils";


export type DatabaseProps = {
    name: string;
    image?: string;
    /** @deprecated use "image" */
    imageName?: string;
    /** @deprecated use "image" */
    imageVersion?: string;
    username: string;
    password: string;
    configStorage?: string;
    storage?: string;
    volume?: string;
    configVolume?: string;
    containerPort?: number;
};

export class Database {
    public name: string;
    public username: string;
    public password: string;
    public containerPort?: number;
    protected _image?: string;
    protected _configVolume?: string;
    protected _volume?: string;

    public constructor(props: DatabaseProps) {
        const {
            name,
            image,
            imageName,
            imageVersion,
            username,
            password,
            configStorage,
            configVolume,
            storage,
            volume,
            containerPort
        } = props;

        this.name = name;
        this._image = image || (imageName ? new Image(imageName, imageVersion).toString() : undefined);
        this.username = username;
        this.password = password;
        this._configVolume = configStorage || configVolume;
        this._volume = storage || volume;
        this.containerPort = containerPort;
    }

    public get containerName(): string {
        return `mongodb-${this.name}.ws`;
    }

    public get image(): string {
        if(!this._image) {
            return "mongo:latest";
        }

        return this._image;
    }

    public set image(image: string | undefined) {
        if(!image) {
            delete this._image;
            return;
        }

        if(!Image.isValid(image)) {
            throw new Error(`Invalid image ${image}`);
        }

        this._image = image;
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
            image: this._image,
            username: this.username,
            password: this.password,
            volume: this._volume,
            configVolume: this._configVolume,
            containerPort: this.containerPort
        };
    }
}
