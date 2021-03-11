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
            "username": "mala",
            "password": "lol",
            "isAdmin": true,
            "displayName": "Mala"
        }));
        await this.category.create({
            "title": "Testkategorie 1",
            "language": "de_DE",
            "translations": [{
                "content": "Test Category 1",
                "language": "en_US"
            }]
        }, {include: "translations"});*/
        
    }
    
}

var thread = new main();
(async () => {
    thread.init();
})();