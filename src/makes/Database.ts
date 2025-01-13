import {Config, ConfigProperties} from "@wocker/core";


export type DatabaseProps = ConfigProperties & {
    imageName?: string;
    imageVersion?: string;
    username: string;
    password: string;
    configStorage?: string;
    storage?: string;
};

export class Database extends Config<DatabaseProps> {
    public imageName?: string;
    public imageVersion?: string;
    public username: string;
    public password: string;
    public configStorage: string;
    public storage: string;

    public constructor(props: DatabaseProps) {
        super(props);

        const {
            imageName,
            imageVersion,
            username,
            password,
            configStorage,
            storage
        } = props;

        this.imageName = imageName;
        this.imageVersion = imageVersion;
        this.username = username;
        this.password = password;
        this.configStorage = configStorage || this.defaultConfigStorage;
        this.storage = storage || this.defaultStorage;
    }

    public get containerName(): string {
        return `mongodb-${this.name}.ws`;
    }

    public get image(): string
    {
        const imageName = this.imageName || "mongo",
            imageVersion = this.imageVersion || "latest";

        return `${imageName}:${imageVersion}`;
    }

    public get defaultStorage(): string {
        return `wocker-mongodb-${this.name}`;
    }

    public get defaultConfigStorage(): string {
        return `wocker-mongodb-config-${this.name}`;
    }
}
