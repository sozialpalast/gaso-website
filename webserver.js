const template = require("./template.js");
const express = require('express');
const session = require('express-session')
const bodyParser = require('body-parser');
const crypto = require('crypto');

function checkboxesToArrays(body, catName, prefix) {
    body[catName] = [];
    for (var i in body) {
        if (i.indexOf(prefix) == 0) {
            body.categories.push({ "id": body[i] });
            delete body[i];
        }
    }
    return body;

}

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
                if (!!curr.dataValues.createdByUser)
                    curr.dataValues.createdByUser = curr.dataValues.createdByUser.dataValues;
                userList.push(curr.dataValues);
            })
            let edit = null;
            if (!(!req.query.edit)) {
                let uff = await this.user.findOne({
                    where: {
                        id: req.query.edit
                    },
                    include: [
                        "createdByUser"
                    ]
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
            
            
            if (req.body.password !== req.body.password2) {
                res.send(this.translations[req.query.lang = this.config.standardLang]["passwordUnmatch"]);
                res.end();
                return;
            }
            if (req.body.password == "") {
                console.log("No Pass, undefined")
                delete req.body.password;
            }
            delete req.body.password2;
            
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
        this.app.get("/backend/postOverview", async (req, res) => {
            if (!req.session.user) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            let posts = await this.post.findAll({
                "include": [
                    "postedByUser",
                    "translations",
                    "postCategories"
                ]
            });
            let postList = [];
            posts.forEach(curr => {
                if (!(!curr.dataValues.postedByUser)) {
                    curr.dataValues.postedByUser = curr.dataValues.postedByUser.dataValues;
                }
                postList.push(curr.dataValues);
            })
            res.send(await this.renderTemplate("adminTemplate", "postOverview", req.query.lang, { user: req.session.user, postList: postList }, false));
            res.end();
        })
        this.app.get("/backend/createPost", async (req, res) => {
            if (!req.session.user) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            let edit = null;
            if (!!req.query.edit) {
                let editPost = await this.post.findOne({
                    "where": {
                        "id": req.query.edit
                    }
                });
                
                edit = editPost.dataValues;
                
            }
            res.send(
                await this.renderTemplate("adminTemplate", "createEditPost", req.query.lang, { user: req.session.user, edit: edit }, false)
            );
            res.end();
        })
        this.app.post("/backend/createPost", async (req, res) => {
            
            req.body = checkboxesToArrays(req.body, "categories", "_cat");
            if (!req.session.user) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            if (req.body.visible == "true") {
                req.body.visible = true;
            } else {
                req.body.visible = false;
            }
            
            let defaults = req.body;
            defaults.postedBy = req.session.user.id;
            let where = {};
            if (req.body.edit == "true") {
                where.id = req.body.id
            } else {
                where.title = req.body.title
            }
            let [newPost, created] = await this.post.findOrCreate({
                where: where,
                include: ["postCategories", "postedByUser"],
                defaults: defaults
                
            });
            console.log(newPost)
            if (!created) {

                // post with this title already existed
                if (req.body.id != newPost.dataValues.id) {
                    res.send(
                        await this.renderTemplate("adminTemplate", "createEditPost",
                            req.query.lang, { user: req.session.user, edit: req.body, existed: true }, false)
                    );
                    
                } else {
                    // edit post!
                    delete req.body.id;
                    delete req.body.createdBy;
                    delete req.body.edit;
                    for (var i in req.body) {
                        newPost[i] = req.body[i];
                    }
                    await newPost.save();
                    res.redirect("/backend/postOverview");
                }
                
            } else {
                res.redirect("/backend/postOverview");
                
            }
            res.end();
        });
        this.app.get("/backend/logoff", (req, res) => {
            req.session.destroy();
            res.redirect("/backend/login");
            res.end();
        });

    }

}
module.exports = webserver;