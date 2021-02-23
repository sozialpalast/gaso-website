const webserver = require("./webserver.js");
const fs = require("fs/promises");

class main extends webserver {
    constructor() {
        super();
    }
    async loadConfig() {
        this.config = JSON.parse(await fs.readFile("config.json", "utf-8"));
    }
    async init() {
        await this.loadConfig();
        this.connectionString = this.config.sequelize_db;
        this.initTemplate();
        this.createConnection();
        this.loadModel();
        await this.syncModel();
    }
}

var thread = new main();
(async () => {
    thread.init();
})();