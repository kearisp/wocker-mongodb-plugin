import {Config, ConfigProperties} from "@wocker/core";


export type DatabaseProps = ConfigProperties & {
    username: string;
    password: string;
    configStorage?: string;
    storage?: string;
};

export class Database extends Config<DatabaseProps> {
    public username: string;
    public password: string;
    public configStorage: string;
    public storage: string;

    public constructor(props: DatabaseProps) {
        super(props);

        const {
            username,
            password,
            configStorage,
            storage
        } = props;

        this.username = username;
        this.password = password;
        this.configStorage = configStorage || this.defaultConfigStorage;
        this.storage = storage || this.defaultStorage;
    }

    public get containerName(): string {
        return `mongodb-${this.name}.ws`;
    }

    public get defaultStorage(): string {
        return `wocker-mongodb-${this.name}`;
    }

    public get defaultConfigStorage(): string {
        return `wocker-mongodb-config-${this.name}`;
    }
}
