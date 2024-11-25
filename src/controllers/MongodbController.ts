import {
    Controller,
    Completion,
    Command,
    Param,
    Option
} from "@wocker/core";

import {MongodbService} from "../services/MongodbService";


@Controller()
export class MongodbController {
    public constructor(
        protected readonly mongodbService: MongodbService
    ) {}

    @Command("mongodb:create [name]")
    public async create(
        @Param("name")
        name?: string
    ): Promise<void> {
        await this.mongodbService.create(name);
    }

    @Command("mongodb:destroy <name>")
    public async destroy(
        @Param("name")
        name: string,
        @Option("yes", {alias: "y"})
        yes?: boolean,
        @Option("force", {alias: "f"})
        force?: boolean
    ): Promise<void> {
        await this.mongodbService.stop(name);
        await this.mongodbService.destroy(name, yes, force);
        await this.mongodbService.admin();
    }

    @Command("mongodb:use <name>")
    public async use(
        @Param("name")
        name: string
    ): Promise<void> {
        await this.mongodbService.use(name);
    }

    @Command("mongodb:start [name]")
    public async start(
        @Param("name")
        name?: string,
        @Option("restart", {alias: "r"})
        restart?: boolean
    ): Promise<void> {
        await this.mongodbService.start(name, restart);
        await this.mongodbService.admin();
    }

    @Command("mongodb:stop [name]")
    public async stop(
        @Param("name")
        name?: string
    ): Promise<void> {
        await this.mongodbService.stop(name);
        await this.mongodbService.admin();
    }

    @Command("mongodb:ls")
    public async list(): Promise<string> {
        return this.mongodbService.list();
    }

    @Completion("name", "mongodb:start [name]")
    @Completion("name", "mongodb:stop [name]")
    public async getNames(): Promise<string[]> {
        return [];
    }
}
