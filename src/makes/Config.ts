import {ConfigCollection} from "@wocker/core";

import {Database, DatabaseProps} from "./Database";


export type ConfigProps = {
    default?: string;
    databases?: DatabaseProps[];
};

export abstract class Config {
    public default?: string;
    public databases: ConfigCollection<Database, DatabaseProps>;

    public constructor(props: ConfigProps) {
        const {
            default: defaultDatabase,
            databases = []
        } = props;

        this.default = defaultDatabase;
        this.databases = new ConfigCollection(Database, databases);
    }

    public setDatabase(database: Database): void {
        this.databases.setConfig(database);
    }

    public hasDatabase(name: string): boolean {
        return !!this.databases.getConfig(name);
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
        // if(!name) {
        //     if(!this.default) {
        //         throw new Error("Default database is not defined");
        //     }
        //
        //     const database = this.databases.getConfig(this.default);
        //
        //     if(!database) {
        //         throw new Error(`Default database ${this.default} not found`);
        //     }
        //
        //     return database;
        // }

        const database = this.databases.getConfig(name);

        if(!database) {
            throw new Error(`Database ${name} not found`);
        }

        return database;
    }

    public removeDatabase(name: string): void {
        const database = this.databases.getConfig(name);

        if(!database) {
            throw new Error(`Storage ${name} not found`);
        }

        this.databases.removeConfig(name);
    }

    public abstract save(): void;

    public toJSON(): ConfigProps {
        return {
            default: this.default,
            databases: this.databases.toArray()
        };
    }
}
