import {
    Controller,
    Description,
    Completion,
    Command,
    Param,
    Option
} from "@wocker/core";

import {MongodbService} from "../services/MongodbService";


@Controller()
@Description("MongoDB commands")
export class MongodbController {
    public constructor(
        protected readonly mongodbService: MongodbService
    ) {}

    @Command("mongodb:create [name]")
    @Description("Creates a MongoDB service with configurable credentials, host, and storage options.")
    public async create(
        @Param("name")
        name?: string,
        @Option("user", {
            type: "string",
            alias: "u",
            description: "The username to start the service with"
        })
        username?: string,
        @Option("password", {
            type: "string",
            alias: "p",
            description: "The password to start the service with"
        })
        password?: string,
        @Option("image", {
            type: "string",
            alias: "i",
            description: "The image name to start the service with",
        })
        imageName?: string,
        @Option("image-version", {
            type: "string",
            alias: "I",
            description: "The image version to start the service with"
        })
        imageVersion?: string
    ): Promise<void> {
        await this.mongodbService.create({
            name,
            username,
            password,
            imageName,
            imageVersion
        });
    }

    @Command("mongodb:upgrade [name]")
    @Description("Upgrades a specified MongoDB service instance.")
    public async upgrade(
        @Param("name")
        name?: string,
        @Option("image", {
            type: "string",
            alias: "i",
            description: "The image name to start the service with"
        })
        imageName?: string,
        @Option("image-version", {
            type: "string",
            alias: "I",
            description: "The image version to start the service with"
        })
        imageVersion?: string,
        @Option("volume", {
            type: "string",
            alias: "v",
            description: "The volume name to start the service with"
        })
        volume?: string,
        @Option("config-volume", {
            type: "string",
            alias: "V",
            description: "The config volume name to start the service with"
        })
        configVolume?: string
    ): Promise<void> {
        await this.mongodbService.upgrade({
            name,
            imageName,
            imageVersion,
            volume,
            configVolume
        });
    }

    @Command("mongodb:destroy <name>")
    @Description("Destroys a specified MongodbDB service instance with an option to force deletion.")
    public async destroy(
        @Param("name")
        name: string,
        @Option("yes", {
            type: "boolean",
            alias: "y",
            description: "Skip confirmation"
        })
        yes?: boolean,
        @Option("force", {
            type: "boolean",
            alias: "f",
            description: "Force deletion"
        })
        force?: boolean
    ): Promise<void> {
        await this.mongodbService.stop(name);
        await this.mongodbService.destroy(name, yes, force);
        await this.mongodbService.admin();
    }

    @Command("mongodb:use <name>")
    @Description("Sets a specified MongoDB service as the default.")
    public async use(
        @Param("name")
        name: string
    ): Promise<void> {
        this.mongodbService.use(name);
    }

    @Command("mongodb:start [name]")
    @Description("Starts a specified MongoDB service and optionally restarts it if already running.")
    public async start(
        @Param("name")
        name?: string,
        @Option("restart", {
            type: "boolean",
            alias: "r",
            description: "Restart the service if already running"
        })
        restart?: boolean
    ): Promise<void> {
        await this.mongodbService.start(name, restart);
        await this.mongodbService.admin();
    }

    @Command("mongodb:stop [name]")
    @Description("Stops a specified MongoDB service instance.")
    public async stop(
        @Param("name")
        name?: string
    ): Promise<void> {
        await this.mongodbService.stop(name);
        await this.mongodbService.admin();
    }

    @Command("mongodb:ls")
    @Description("Lists all available MongoDB services.")
    public async list(): Promise<string> {
        return this.mongodbService.list();
    }

    @Completion("name", "mongodb:start [name]")
    @Completion("name", "mongodb:stop [name]")
    public async getNames(): Promise<string[]> {
        return this.mongodbService.config.databases.map((database) => {
            return database.name;
        });
    }
}
