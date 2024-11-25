import {Plugin, PluginConfigService} from "@wocker/core";

import {MongodbController} from "./controllers/MongodbController";
import {MongodbService} from "./services/MongodbService";


@Plugin({
    name: "mongodb",
    controllers: [MongodbController],
    providers: [
        PluginConfigService,
        MongodbService
    ]
})
export default class MongodbPlugin {
    public async load() {
        console.log(">_<");
    }
}
