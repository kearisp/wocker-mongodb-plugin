import {
    AppConfigService,
    Injectable,
    PluginConfigService,
    DockerService,
    ProxyService
} from "@wocker/core";
import {promptText, promptConfirm} from "@wocker/utils";
import CliTable from "cli-table3";

import {Config, ConfigProps} from "../makes/Config";
import {Database} from "../makes/Database";


@Injectable()
export class MongodbService {
    protected _config?: Config;
    public adminContainerName = "dbadmin-mongodb.workspace";

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly dockerService: DockerService,
        protected readonly proxyService: ProxyService
    ) {}

    public get config(): Config {
        if(!this._config) {
            const fs = this.pluginConfigService.fs;
            const data: ConfigProps = fs.exists("config.json")
                ? fs.readJSON("config.json")
                : {};

            this._config = new class extends Config {
                public save(): void {
                    if(!fs.exists()) {
                        fs.mkdir("", {
                            recursive: true
                        });
                    }

                    fs.writeJSON("config.json", this.toJSON());
                }
            }(data);
        }

        return this._config;
    }

    public async create(name?: string, image?: string, imageVersion?: string, username = "", password = ""): Promise<void> {
        if(name && this.config.databases.getConfig(name)) {
            throw new Error(`${name}`);
        }

        if(!name) {
            name = await promptText({
                message: "Mongodb name:",
                type: "string",
                validate: (name?: string) => {
                    if(!name) {
                        return "Name is required";
                    }

                    if(this.config.databases.getConfig(name)) {
                        return `Database name "${name}" is already taken`;
                    }

                    return true;
                }
            }) as string;
        }

        if(!username) {
            username = await promptText({
                message: "Username:",
                type: "string",
                required: true
            });
        }

        if(!password) {
            password = await promptText({
                message: "Password:",
                type: "password",
                required: true
            });

            const confirmPassword = await promptText({
                message: "Confirm password:",
                type: "password",
                required: true
            });

            if(password !== confirmPassword) {
                throw new Error("Passwords do not match");
            }
        }

        const database = new Database({
            name,
            imageName: image,
            imageVersion,
            username,
            password
        });

        this.config.setDatabase(database);
        this.config.save();
    }

    public async upgrade(name?: string, imageName?: string, imageVersion?: string): Promise<void> {
        const service = this.config.getDatabaseOrDefault(name);
        let changed = false;

        if(imageName) {
            service.imageName = imageName;
            changed = true;
        }

        if(imageVersion) {
            service.imageVersion = imageVersion;
            changed = true;
        }

        if(changed) {
            this.config.setDatabase(service);
            this.config.save();
        }
    }

    public async destroy(name: string, yes?: boolean, force?: boolean): Promise<void> {
        if(!this.pluginConfigService.isVersionGTE("1.0.19")) {
            throw new Error("Please update @wocker/ws");
        }

        const database = this.config.getDatabase(name);

        if(!force && database.name === this.config.default) {
            throw new Error(`Can't delete default database.`);
        }

        if(!yes) {
            const confirm = await promptConfirm({
                message: `Are you sure you want to delete the "${database.name}" database? This action cannot be undone and all data will be lost.`,
                default: false
            });

            if(!confirm) {
                throw new Error("Aborted");
            }
        }

        if(database.configStorage === database.defaultConfigStorage && await this.dockerService.hasVolume(database.configStorage)) {
            await this.dockerService.rmVolume(database.configStorage);
        }

        if(database.storage === database.defaultStorage && await this.dockerService.hasVolume(database.storage)) {
            await this.dockerService.rmVolume(database.storage);
        }

        this.config.removeDatabase(database.name);
        this.config.save();
    }

    public use(name: string): void {
        const database = this.config.getDatabase(name);

        this.config.default = database.name;

        this.config.save();
    }

    public async start(name?: string, restart?: boolean): Promise<void> {
        if(!this.pluginConfigService.isVersionGTE("1.0.19")) {
            throw new Error("Please update @wocker/ws");
        }

        if(!name || !this.config.default) {
            await this.create();
        }

        const database = this.config.getDatabaseOrDefault(name);

        let container = await this.dockerService.getContainer(database.containerName);

        if(restart && container) {
            await this.dockerService.removeContainer(database.containerName);

            container = null;
        }

        if(!container) {
            container = await this.dockerService.createContainer({
                name: database.containerName,
                restart: "always",
                image: database.image,
                env: {
                    MONGO_INITDB_ROOT_USERNAME: database.username,
                    MONGO_INITDB_ROOT_PASSWORD: database.password,
                    MONGO_ROOT_USER: database.username,
                    MONGO_ROOT_PASSWORD: database.password
                },
                volumes: [
                    `${database.configStorage}:/data/configdb`,
                    `${database.storage}:/data/db`
                ]
            });
        }

        const {
            State: {
                Running
            }
        } = await container.inspect();

        if(!Running) {
            console.info(`Starting ${database.name} service...`);

            await container.start();
        }
    }

    public async admin(): Promise<void> {
        const connections: string[] = [];

        for(const database of this.config.databases.items) {
            try {
                const container = await this.dockerService.getContainer(database.containerName);

                if(!container) {
                    continue;
                }

                const {
                    State: {
                        Running
                    }
                } = await container.inspect();

                if(Running) {
                    connections.push(`mongodb://${database.username}:${database.password}@${database.containerName}:27017`);
                    // Multiple servers are not supported by mongo-express
                    break;
                }
            }
            catch(ignore) {}
        }

        await this.dockerService.removeContainer(this.adminContainerName);

        if(connections.length === 0) {
            return;
        }

        let container = await this.dockerService.getContainer(this.adminContainerName);

        if(!container) {
            console.info("Mongodb Admin starting...");

            await this.dockerService.pullImage("mongo-express:latest");

            container = await this.dockerService.createContainer({
                name: this.adminContainerName,
                image: "mongo-express:latest",
                restart: "always",
                env: {
                    VIRTUAL_HOST: this.adminContainerName,
                    VIRTUAL_PORT: "80",
                    VCAP_APP_HOST: this.adminContainerName,
                    PORT: "80",
                    ME_CONFIG_BASICAUTH: "false",
                    ME_CONFIG_BASICAUTH_USERNAME: "",
                    ME_CONFIG_BASICAUTH_PASSWORD: "",
                    ME_CONFIG_MONGODB_ENABLE_ADMIN: "true",
                    ME_CONFIG_MONGODB_URL: connections.join(",")
                }
            });
        }

        const {
            State: {
                Running
            }
        } = await container.inspect();

        if(!Running) {
            await container.start();
            await this.proxyService.start();
        }
    }

    public async stop(name?: string): Promise<void> {
        const database = this.config.getDatabaseOrDefault(name);

        console.info(`Stopping ${database.name}...`);

        await this.dockerService.removeContainer(database.containerName);
    }

    public async list(): Promise<string> {
        const table = new CliTable({
            head: [
                "Name",
                "Username",
                "Host",
                "Image",
                "Storages"
            ]
        });

        for(const database of this.config.databases.items) {
            table.push([
                database.name + (database.name === this.config.default ? " (default)" : ""),
                database.username,
                database.containerName,
                database.image,
                `${database.configStorage}\n${database.storage}`
            ]);
        }

        return table.toString();
    }
}
