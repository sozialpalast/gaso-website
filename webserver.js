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
            
            let loginUser = await this.user.findOne({
                where: {
                    [this.Op.and]: {
                        "username": req.body.username
                        

                    }
                }
            });
            if (loginUser != null && loginUser.correctPassword(req.body.password)) {
                req.session.user = loginUser;
                res.redirect("/backend");
            } else {
                res.send(await this.renderTemplate("baseTemplate", "login", req.query.lang, {loginFailed: true}, false));
            }
            res.end();
            
        });
        this.app.get("/backend/login", async (req, res) => {
            res.send(await this.renderTemplate("baseTemplate", "login", req.query.lang, {}, false));
            res.end();
        });
        this.app.get("/backend", async (req, res) => {
            if (!req.session.user) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            res.send(await this.renderTemplate("adminTemplate", "adminHome", req.query.lang, { user: req.session.user }, false));
            res.end()
        });
        this.app.get("/backend/users", async (req, res) => {
            if (!req.session.user || !req.session.user.isAdmin) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            let users = await this.user.findAll({ include: "createdByUser" });
            let userList = [];
            users.forEach((curr) => {
                userList.push(curr.dataValues);
            })
            let edit = null;
            if (!(!req.query.edit)) {
                let uff = await this.user.findOne({
                    where: {
                        id: req.query.edit
                    }
                });
                edit = uff.dataValues;
            }
            res.send(await this.renderTemplate("adminTemplate", "userOverview", req.query.lang, { user: req.session.user, userList: userList, edit: edit }, false));
            res.end()
        });
        this.app.post("/backend/createUser", async (req, res) => {
            if (!req.session.user || !req.session.user.isAdmin) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            if (req.body.password == "")
                req.body.password = undefined;
                req.body.password2 = undefined
            if (req.body.password !== req.body.password2) {
                res.send(this.translations[req.query.lang = this.config.standardLang]["passwordUnmatch"]);
                res.end();
                return;
            }
            req.body.password2 = undefined
            
            if (req.body.deleteUser == "lol") {
                let usr = await this.user.findOne({
                    where: {
                        id: req.body.id
                    }
                })
                await usr.destroy();
                res.redirect("/backend/users");
                res.end();
                return;
            }
            req.body.createdBy = req.session.user.id;
            let [ usr, wasCreated ] = await this.user.findOrCreate({
                where: {
                    "username": req.body.username
                }, defaults: req.body
            });
            if (!wasCreated) {
                for (var i in req.body) {
                    usr[i] = req.body[i];
                    if (req.body.isAdmin == "lol") {
                        usr.isAdmin = true;
                    } else {
                        usr.isAdmin = false
                    }
                }
                usr.save();
            }
            res.redirect("/backend/users");
            res.end();
        })
    }

}
module.exports = webserver;