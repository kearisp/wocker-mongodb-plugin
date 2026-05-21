import {PluginConfig} from "@wocker/core";
import {Database, DatabaseProps} from "./Database";


export type AdminConfig = {
    enabled: boolean;
};

export type ConfigProps = {
    default?: string;
    databases?: DatabaseProps[];
    admin?: AdminConfig;
};

export class MongodbPluginConfig extends PluginConfig {
    public default?: string;
    public databases: Database[];
    public admin: AdminConfig;

    public constructor(data: ConfigProps) {
        super(data);

        const {
            default: defaultDatabase,
            databases = [],
            admin: {
                enabled: enabledAdmin = true
            } = {}
        } = data;

        this.default = defaultDatabase;
        this.databases = databases.map(database => new Database(database));
        this.admin = {
            enabled: enabledAdmin
        };
    }

    public setDatabase(database: Database): void {
        let exists = false;

        for(let i = 0; i < this.databases.length; i++) {
            if(this.databases[i].name === database.name) {
                exists = true;
                this.databases[i] = database;
            }
        }

        if(!exists) {
            this.databases.push(database);
        }

        if(!this.default) {
            this.default = database.name;
        }
    }

    public hasDatabase(name: string): boolean {
        const database = this.databases.find(database => database.name === name);

        return !!database;
    }

    public getDefault(): Database {
        if(!this.default) {
            throw new Error("Default database is not defined");
        }

        return this.getDatabase(this.default);
    }

    public getDatabaseOrDefault(name?: string): Database {
        if(!name) {
            return this.getDefault();
        }

        return this.getDatabase(name);
    }

    public getDatabase(name: string): Database {
        const database = this.databases.find((database) => {
            return database.name === name;
        });

        if(!database) {
            throw new Error(`Database "${name}" not found`);
        }

        return database;
    }

    public removeDatabase(name: string): void {
        this.databases = this.databases.filter((database) => {
            return database.name !== name;
        });

        if(this.default === name) {
            delete this.default;
        }
    }

    public toObject(): ConfigProps {
        return {
            default: this.default,
            databases: this.databases.length > 0
                ? this.databases.map((database) => database.toObject())
                : [],
            admin: this.admin
        };
    }
}
