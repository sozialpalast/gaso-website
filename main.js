const webserver = require("./webserver.js");
const fs = require("fs/promises");

class main extends webserver {
    constructor() {
        super();
    }
    
    async init() {
        await this.loadConfig();
        this.connectionString = this.config.sequelize_db;
        await this.initTemplate();
        this.createConnection();
        this.loadModel();
        await this.syncModel();
        await this.renderLanding();
        await this.startWebserver(this.config.webserverPort);
        /*console.log(await this.createUser({
            "username": "mala3",
            "password": "lol",
            "isAdmin": true,
            "displayName": "Mala"
        }));*/
    }
    
}

var thread = new main();
(async () => {
    thread.init();
})();