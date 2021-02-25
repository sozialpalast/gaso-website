const template = require("./template.js");
const express = require('express');
const session = require('express-session')
const bodyParser = require('body-parser');
const crypto = require('crypto');

class webserver extends template {
    constructor() {
        super();
        this.app = express();

        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.set('trust proxy', 1) // trust first proxy
        

    }
    async startWebserver(port) {
        
        this.app.use(session({
            secret: this.config.cookieSecret,
            resave: false,
            saveUninitialized: true,
            cookie: { secure: false }
        }))
        await this.registerFrontends();
        await this.registerBackend();
        this.app.listen(port);
        console.log("Webserver online @:" + port);
    }
    async registerFrontends() {
        this.app.get("/", (req, res) => {
            try {
                console.log(this.htmls)
                let homepage = this.htmls[this.config.homepageBaseTemplate][this.config.homepageTemplate][this.config.standardLang];
                res.send(homepage);
                res.end();
            } catch (e) {
                res.status(500).end("Template Error")
                console.log(e);
            }
        })
    }
    async registerBackend() {
        this.app.post("/backend/login", async (req, res) => {
            req.session.destroy((err) => {

            });
            let user = await this.user.findOne({
                where: {
                    [this.Op.and]: {
                        "username": req.body.username,
                        "password": crypto.createHash('sha256').update(
                            this.sequelize.col("salt") + req.body.password + this.sequelize.col("salt")).digest('hex')

                    }
                }
            });
            if (user != null) {
                req.session.user = user;
            }
            res.end(JSON.stringify(user));
            
        });
        this.app.get("/backend/login", async (req, res) => {
            res.send(await this.renderTemplate("baseTemplate", "login", req.query.lang, {}, false));
            res.end();
        });
    }

}
module.exports = webserver;