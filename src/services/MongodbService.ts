import {
    AppConfigService,
    Injectable,
    PluginConfigService,
    DockerService,
    ProxyService,
    FileSystem
} from "@wocker/core";
import {promptInput, promptConfirm, promptSelect, demuxOutput} from "@wocker/utils";
import {formatDate} from "date-fns/format";
import CliTable from "cli-table3";
import {Config, ConfigProps} from "../makes/Config";
import {Database, DatabaseProps} from "../makes/Database";


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

                    fs.writeJSON("config.json", this.toObject());
                }
            }(data);
        }

        return this._config;
    }

    public get fs(): FileSystem {
        return this.pluginConfigService.fs;
    }

    public async create(props: Partial<DatabaseProps> = {}): Promise<void> {
        if(props.name && this.config.hasDatabase(props.name)) {
            console.info(`Database name "${props.name}" is already taken`);
            delete props.name;
        }

        if(!props.name) {
            props.name = await promptInput({
                message: "Mongodb name",
                type: "text",
                validate: (name?: string) => {
                    if(!name) {
                        return "Name is required";
                    }

                    if(this.config.hasDatabase(name)) {
                        return `Database name "${name}" is already taken`;
                    }

                    return true;
                }
            }) as string;
        }

        if(!props.username) {
            props.username = await promptInput({
                message: "Username:",
                type: "text",
                required: true
            });
        }

        if(!props.password) {
            props.password = await promptInput({
                message: "Password:",
                type: "password",
                required: true
            }) as string;

            const confirmPassword = await promptInput({
                message: "Confirm password:",
                type: "password",
                required: true
            });

            if(props.password !== confirmPassword) {
                throw new Error("Passwords do not match");
            }
        }

        const database = new Database({
            name: props.name,
            imageName: props.imageName,
            imageVersion: props.imageVersion,
            username: props.username as string,
            password: props.password as string
        });

        this.config.setDatabase(database);
        this.config.save();
    }

    public async upgrade(props: Partial<DatabaseProps>): Promise<void> {
        const service = this.config.getDatabaseOrDefault(props.name);

        let changed = false;

        if(props.imageName) {
            service.imageName = props.imageName;
            changed = true;
        }

        if(props.imageVersion) {
            service.imageVersion = props.imageVersion;
            changed = true;
        }

        if(props.volume) {
            service.volume = props.volume;
            changed = true;
        }

        if(props.configVolume) {
            service.configVolume = props.configVolume;
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

        if(database.configVolume === database.defaultConfigStorage && await this.dockerService.hasVolume(database.configVolume)) {
            await this.dockerService.rmVolume(database.configVolume);
        }

        if(database.volume === database.defaultStorage && await this.dockerService.hasVolume(database.volume)) {
            await this.dockerService.rmVolume(database.volume);
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
        if(!this.pluginConfigService.isVersionGTE("1.0.22")) {
            throw new Error("Please update @wocker/ws");
        }

        if(!name && !this.config.default) {
            await this.create();
        }

        const database = this.config.getDatabaseOrDefault(name);

        let container = await this.dockerService.getContainer(database.containerName);

        if(restart && container) {
            await this.dockerService.removeContainer(database.containerName);

            container = null;
        }

        if(!container) {
            if(!await this.dockerService.hasVolume(database.configVolume)) {
                await this.dockerService.createVolume(database.configVolume);
            }

            if(!await this.dockerService.hasVolume(database.volume)) {
                await this.dockerService.createVolume(database.volume);
            }

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
                    `${database.configVolume}:/data/configdb`,
                    `${database.volume}:/data/db`
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

        for(const database of this.config.databases) {
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
                    // Mongo-express does not support multiple servers
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

    public async backup(name?: string, database?: string): Promise<void> {
        const service = this.config.getDatabaseOrDefault(name);

        if(!database) {
            database = await promptSelect({
                message: "Database",
                required: true,
                options: await this.getDatabases(service)
            });
        }

        if(!this.fs.exists(`dump/${service.name}/${database}`)) {
            this.fs.mkdir(`dump/${service.name}/${database}`, {
                recursive: true
            });
        }

        let filename = formatDate(new Date(), "yyyy-MM-dd HH-mm") + ".sql";

        const fileStream = this.fs.createWriteStream(`dump/${service.name}/${database}/${filename}`);

        const stream = await this.dockerService.exec(service.containerName, [
            "mongodump",
            "--authenticationDatabase", "admin",
            "--host", `${service.containerName}:27017`,
            "--username", "root",
            "--password", "toor",
            "--db", database,
            "--archive",
            "--gzip"
        ], false);

        stream.on("data", (chunk) => {
            fileStream.write(demuxOutput(chunk));
        });

        try {
            await new Promise((resolve, reject) => {
                stream.on("end", resolve);
                stream.on("error", reject);
            });
        }
        finally {
            fileStream.close();
        }
    }

    public async deleteBackup(name?: string, database?: string, filename?: string, confirm?: boolean): Promise<void> {
        const service = this.config.getDatabaseOrDefault(name);

        if(!database) {
            const databases = this.fs.readdir(`dumps/${service.name}`);

            if(databases.length === 0) {
                throw new Error(`No backups were found for the "${service.name}" service`);
            }

            database = await promptSelect({
                message: "Database",
                required: true,
                options: databases
            });
        }

        if(!filename) {
            const files = this.fs.readdir(`dumps/${service.name}/${database}`);

            if(files.length === 0) {
                throw new Error(`No backup files found for the "${database}" database`);
            }

            filename = await promptSelect({
                message: "File",
                required: true,
                options: files
            });
        }

        if(!confirm) {
            confirm = await promptConfirm({
                message: "Are you sure you want to delete?",
                default: false
            });
        }

        if(!confirm) {
            throw new Error("Canceled");
        }

        this.fs.rm(`dumps/${service.name}/${database}/${filename}`);

        console.info(`File "${filename}" deleted`);

        const otherFiles = this.fs.readdir(`dump/${service.name}/${database}`);

        if(otherFiles.length === 0) {
            this.fs.rm(`dump/${service.name}/${database}`, {
                force: true,
                recursive: true
            });
        }
    }

    public async restore(name?: string, database?: string, filename?: string): Promise<void> {
        const service = this.config.getDatabaseOrDefault(name);

        if(!database) {
            const databases = this.fs.readdir(`dumps/${service.name}`);

            if(databases.length === 0) {
                throw new Error(`No backups were found for the "${service.name}" service`);
            }

            database = await promptSelect({
                message: "Database",
                required: true,
                options: databases
            });
        }

        if(!filename) {
            const files = this.fs.readdir(`dumps/${service.name}/${database}`);

            if(files.length === 0) {
                throw new Error(`No backup files found for the "${database}" database`);
            }

            filename = await promptSelect({
                message: "File",
                required: true,
                options: files
            });
        }

        const file = this.fs.createReadStream(`dumps/${service.name}/${database}/${filename}`);
        const stream = await this.dockerService.exec(service.containerName, [
             "mongorestore",
            "--authenticationDatabase", "admin",
            "--host", `${service.containerName}:27017`,
            "--username", service.username,
            "--password", service.password,
            "--db", database,
            "--drop",
            "--gzip",
            "--archive"
        ], false);

        await new Promise<void>((resolve, reject): void => {
            file.on("data", (data): void => {
                stream.write(data);
            });

            file.on("error", (err: Error): void => {
                stream.destroy();

                reject(err);
            });

            stream.on("finish", (): void => {
                resolve();
            });

            stream.on("error", (err: Error): void => {
                file.close();

                reject(err);
            });
        });
    }

    public async getDatabases(service: Database): Promise<string[]> {
        const stream = await this.dockerService.exec(service.containerName, [
            "mongosh",
            "--username", service.username,
            "--password", service.password,
            "--quiet",
            "--eval", "db.getMongo().getDBNames().forEach(function(i){print(i)})"
        ], false);

        const res = await new Promise<string>((resolve, reject) => {
            let res = "";

            stream.on("data", (chunk): void => {
                res += demuxOutput(chunk).toString();
            });

            stream.on("end", (): void => {
                resolve(res);
            });

            stream.on("error", reject);
        });

        return res.split(/\r?\n/).filter((database: string) => {
            return !!database;
        });
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

        for(const database of this.config.databases) {
            table.push([
                database.name + (database.name === this.config.default ? " (default)" : ""),
                database.username,
                database.containerName,
                database.image,
                `${database.configVolume}\n${database.volume}`
            ]);
        }

        return table.toString();
    }
}
