const template = require("./template.js");
const express = require('express');
const session = require('express-session')
const bodyParser = require('body-parser');
const crypto = require('crypto');
const redis = require('redis')


function checkboxesToArrays(body, prefix, additional) {
    let cats = [];
    for (var i in body) {
        if (i.indexOf(prefix) == 0) {
            cats.push({ ...{ "categoryId": body[i] }, ...additional });
            delete body[i];
        }
    }
    return cats;

}

class webserver extends template {
    constructor() {
        super();
        this.app = express();

        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.set('trust proxy', 1) // trust first proxy


    }
    async startWebserver(port) {
        let sessTmp = {
            secret: this.config.cookieSecret,
            resave: false,
            saveUninitialized: true,
            cookie: { secure: false }
        }
        if (this.config.redisSession) {
            let RedisStore = require('connect-redis')(session)
            let redisClient = redis.createClient()
            sessTmp.store = new RedisStore({ client: redisClient });
        }
        this.app.use(session(sessTmp))
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
        this.app.use(express.static("web"));
        this.app.use(express.static(this.config.htmlLocation))
    }
    async registerBackend() {
        this.app.use(express.static("web"));
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
                res.send(this.renderTemplate("baseTemplate", "login", req.query.lang, { loginFailed: true }, false));
            }
            res.end();

        });
        this.app.get("/backend/login", async (req, res) => {
            res.send(this.renderTemplate("baseTemplate", "login", req.query.lang, {}, false));
            res.end();
        });
        this.app.get("/backend/logoff", (req, res) => {
            req.session.destroy();
            res.redirect("/backend/login");
            res.end();
        });

        this.app.get("/backend", async (req, res) => {
            if (!req.session.user) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            res.send(this.renderTemplate("adminTemplate", "adminHome", req.query.lang, { user: req.session.user }, false));
            res.end()
        });

        // USER MANAGEMENT

        this.app.get("/backend/users", async (req, res) => {
            if (!req.session.user || !req.session.user.isAdmin) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            let users = await this.user.findAll({ include: "createdByUser" });
            let userList = [];
            users.forEach((curr) => {
                if (curr.dataValues.createdByUser != null)
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
            res.send(this.renderTemplate("adminTemplate", "userOverview", req.query.lang, { user: req.session.user, userList: userList, edit: edit }, false));
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
            req.body.isAdmin = (req.body.isAdmin == "lol") ? true : false;
            let [usr, wasCreated] = await this.user.findOrCreate({
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


        //
        // BLOG POSTS
        //

        this.app.get("/backend/postOverview", async (req, res) => {
            if (!req.session.user) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            let posts = await this.post.findAll({
                "include": [
                    "postedByUser",
                    {
                        model: this.translation,
                        foreignKey: "forPostId",
                        as: "translations"
                    },
                    {
                        model: this.category,
                        as: "postCategories",
                        include: "translations"
                    }
                ]
            });
            let categories = await this.getCategories(req.query.lang);
            let postList = [];
            posts.forEach(curr => {
                if (!(!curr.dataValues.postedByUser)) {
                    curr.dataValues.postedByUser = curr.dataValues.postedByUser.dataValues;

                }
                let newCat = [];
                curr.postCategories.forEach(currCat => {
                    if (!!req.query.lang && req.query.lang != currCat.dataValues.language) {
                        console.log(currCat.dataValues)
                        currCat.dataValues.translations.forEach(currTrans => {
                            if (currTrans.dataValues.language == req.query.lang) {
                                currCat.dataValues.title = currTrans.dataValues.title;
                            }
                        })
                    }
                    newCat.push(currCat.dataValues);
                });
                curr.dataValues.postCategories = newCat;
                let newTrans = [];
                curr.dataValues.translations.forEach(currTrans => {
                    newTrans.push(currTrans.dataValues);
                })
                curr.dataValues.translations = newTrans;
                postList.push(curr.dataValues);
            })

            res.send(this.renderTemplate("adminTemplate", "postOverview", req.query.lang, { user: req.session.user, postList: postList, categories: categories }, false));
            res.end();
        })
        this.app.get("/backend/createPost", async (req, res) => {
            if (!req.session.user) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            let edit = null;
            let categories = await this.getCategories(req.query.lang);
            if (!!req.query.edit) {
                let editPost = await this.post.findOne({
                    "where": {
                        "id": req.query.edit
                    }, include: [
                        "translations",
                        "postCategories"
                    ]
                });
                let trans = [];
                editPost.translations.forEach(curr => {
                    trans.push(curr.dataValues);
                })
                let newCats = [];
                categories.forEach(currCat => {
                    editPost.postCategories.forEach(curr => {
                        if (currCat.id == curr.dataValues.id) {
                            currCat.checked = true;
                        }
                    })
                    newCats.push(currCat)
                })
                categories = newCats;
                edit = editPost.dataValues;
                edit.translations = trans;

            }

            res.send(
                this.renderTemplate("adminTemplate", "createEditPost", req.query.lang,
                    {
                        user: req.session.user, edit: edit, categories: categories
                    }, false)
            );
            res.end();
        })
        this.app.post("/backend/createPost", async (req, res) => {


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
            let categoryList = await this.getCategories(req.query.lang)

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
            let cats = checkboxesToArrays(req.body, "_cat", { "postId": newPost.dataValues.id });
            if (created) {

                await this.postCategory.bulkCreate(cats);
            }
            if (!created) {
                // check previously checked cats 
                let newCats = [];
                categoryList.forEach(curr => {
                    cats.forEach(currBod => {
                        if (currBod.id == curr.id) {
                            curr.checked = true;
                        }
                    })
                    newCats.push(curr);
                })
                // post with this title already existed
                if (req.body.id != newPost.dataValues.id) {
                    res.send(
                        this.renderTemplate("adminTemplate", "createEditPost",
                            req.query.lang, { user: req.session.user, edit: req.body, existed: true, categories: newCats }, false)
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
                    await this.postCategory.destroy({
                        where: {
                            postId: newPost.dataValues.id
                        }
                    })
                    await this.postCategory.bulkCreate(cats);
                    res.redirect("/backend/postOverview");
                }

            } else {
                res.redirect("/backend/postOverview");

            }
            res.end();
        });

        /// STATIC PAGES


        this.app.get("/backend/staticPageOverview", async (req, res) => {
            if (!req.session.user) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            let statics = await this.staticPage.findAll({
                "include": [
                    "postedByUser",

                    {
                        model: this.translation,
                        foreignKey: "forStaticId",
                        as: "translations"
                    },
                    {
                        model: this.category,
                        as: "staticPageCategories",
                        include: "translations"
                    }
                ]
            });
            let categories = await this.getCategories(req.query.lang);
            let staticPageList = [];
            statics.forEach(curr => {
                if (!(!curr.dataValues.postedByUser)) {
                    curr.dataValues.postedByUser = curr.dataValues.postedByUser.dataValues;

                }
                let newCat = [];
                curr.staticPageCategories.forEach(currCat => {
                    if (!!req.query.lang && req.query.lang != currCat.dataValues.language) {
                        console.log(currCat.dataValues)
                        currCat.dataValues.translations.forEach(currTrans => {
                            if (currTrans.dataValues.language == req.query.lang) {
                                currCat.dataValues.title = currTrans.dataValues.title;
                            }
                        })
                    }
                    newCat.push(currCat.dataValues);
                });
                curr.dataValues.staticPageCategories = newCat;
                let newTrans = [];
                curr.dataValues.translations.forEach(currTrans => {
                    newTrans.push(currTrans.dataValues);
                })
                curr.dataValues.translations = newTrans;
                staticPageList.push(curr.dataValues);
            })

            res.send(this.renderTemplate("adminTemplate", "staticPageOverview", req.query.lang, { user: req.session.user, staticPageList: staticPageList, categories: categories }, false));
            res.end();
        })
        this.app.get("/backend/createStaticPage", async (req, res) => {
            if (!req.session.user) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            let edit = null;
            let categories = await this.getCategories(req.query.lang);
            if (!!req.query.edit) {
                let editStaticPage = await this.staticPage.findOne({
                    "where": {
                        "id": req.query.edit
                    }, include: [
                        "translations",
                        "staticPageCategories"
                    ]
                });
                let trans = [];
                editStaticPage.translations.forEach(curr => {
                    trans.push(curr.dataValues);
                })
                let newCats = [];
                categories.forEach(currCat => {
                    editStaticPage.staticPageCategories.forEach(curr => {
                        if (currCat.id == curr.dataValues.id) {
                            currCat.checked = true;
                        }
                    })
                    newCats.push(currCat)
                })
                categories = newCats;
                edit = editStaticPage.dataValues;
                edit.translations = trans;

            }

            res.send(
                this.renderTemplate("adminTemplate", "createEditStaticPage", req.query.lang,
                    {
                        user: req.session.user, edit: edit, categories: categories
                    }, false)
            );
            res.end();
        })
        this.app.post("/backend/createStaticPage", async (req, res) => {


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
            let categoryList = await this.getCategories(req.query.lang)

            let defaults = req.body;
            defaults.postedBy = req.session.user.id;
            let where = {};
            if (req.body.edit == "true") {
                where.id = req.body.id
            } else {
                where.title = req.body.title
            }
            let [newStaticPage, created] = await this.staticPage.findOrCreate({
                where: where,
                include: ["staticPageCategories", "postedByUser"],
                defaults: defaults

            });
            console.log(newStaticPage)
            let cats = checkboxesToArrays(req.body, "_cat", { "staticPageId": newStaticPage.dataValues.id });
            if (created) {

                await this.staticPageCategory.bulkCreate(cats);
            }
            if (!created) {
                // check previously checked cats 
                let newCats = [];
                categoryList.forEach(curr => {
                    cats.forEach(currBod => {
                        if (currBod.id == curr.id) {
                            curr.checked = true;
                        }
                    })
                    newCats.push(curr);
                })
                // static page with this title already existed
                if (req.body.id != newStaticPage.dataValues.id) {
                    res.send(
                        this.renderTemplate("adminTemplate", "createEditStaticPage",
                            req.query.lang, { user: req.session.user, edit: req.body, existed: true, categories: newCats }, false)
                    );

                } else {
                    // edit static page!
                    delete req.body.id;
                    delete req.body.createdBy;
                    delete req.body.edit;
                    for (var i in req.body) {
                        newStaticPage[i] = req.body[i];
                    }
                    await newStaticPage.save();
                    await this.staticPageCategory.destroy({
                        where: {
                            staticPageId: newStaticPage.dataValues.id
                        }
                    })
                    await this.staticPageCategory.bulkCreate(cats);
                    res.redirect("/backend/staticPageOverview");
                }

            } else {
                res.redirect("/backend/staticPageOverview");

            }
            res.end();
        });

        // CATEGORIES

        this.app.get("/backend/createCategory", async (req, res) => {
            if (!req.session.user) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            res.send(
                this.renderTemplate("adminMiniTemplate", "createCategory",
                    req.query.lang, { user: req.session.user }, false)
            );
            res.end();
        });
        this.app.post("/backend/createCategory", async (req, res) => {
            if (!req.session.user) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            if (req.query.lang == undefined) {
                req.query.lang = this.config.standardLang;
            }
            if (req.body.title != undefined && req.body.language != undefined) {
                await this.category.create({
                    title: req.body.title,
                    language: req.body.language
                });
                res.redirect("/backend/postOverview");
                res.end();
            }
        })

        // TRANSLATOR
        this.app.get("/backend/translator", async (req, res) => {
            if (!req.session.user) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            let translationType = "";
            let noContent = false;
            switch (req.query.translationType) {
                case "post":
                    translationType = "post"
                    break;
                case "staticPage":
                    translationType = "staticPage"
                    break;
                case "category":
                    translationType = "category"
                    noContent = true;
                    break;
                default:
                    break;
            };
            let original = await this[translationType].findOne({
                where: {
                    id: req.query.originalId
                }
            });
            original = original.dataValues;
            original.content = this.renderAndSanitizeMD(original.content)
            let edit = {};
        
            if (!!req.query.edit) {
                edit = await this.translation.findOne({
                    where: {
                        id: req.query.edit
                    }
                });
                edit = edit.dataValues;
            }
            
            res.send(this.renderTemplate("adminTemplate", "translator",
                req.query.lang, { user: req.session.user, edit: edit, original: original, translationType: translationType, noContent: noContent }, false));
            res.end();

        });



        this.app.post("/backend/translator", async (req, res) => {
            if (!req.session.user) {
                res.redirect("/backend/login");
                res.end();
                return;
            }
            let defaults = {
                language: req.body.language,
                title: req.body.title,
                content: req.body.content,
                translatedBy: req.session.user.id
            };
            switch (req.body.translationType) {
                case "post":
                    defaults.forPostId = req.body.originalId
                    break;
                case "staticPage":
                    defaults.forStaticId = req.body.originalId
                    break;
                case "category":
                    defaults.forCategoryId = req.body.originalId
                    break;
                default:
                    res.end();
                    return;
                    break;
                
            };

            let [newTranslation, created] = await this.translation.findOrCreate({
                where: {
                    id: req.body.id
                },
                defaults: defaults
            });
            if (!created) {
                newTranslation.content = req.body.content;
                newTranslation.title = req.body.title;
                await newTranslation.save();
            }
            res.redirect("/backend");
            res.end();
        })
        // MAINTENANCE

        this.app.get("/backend/renderWebsite", async (req, res) => {
            await this.renderWebsite(true);
            res.redirect("/backend");
            res.end();
        })

    }

}
module.exports = webserver;