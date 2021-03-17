const handlebars = require("handlebars");
const marked = require("marked");
const sanitizeHtml = require('sanitize-html');
const fs = require("fs/promises");
const database = require("./database.js");

const moment = require("moment")
class template extends database {
    constructor() {
        super();
        this.baseTemplates = {};
        this.partials = {};
        this.baseTemplateFiles = {}
        this.translations = {}
        this.htmls = {};
        this.sanitizeHtml = sanitizeHtml;
        
        
    }
    renderAndSanitizeMD(input) {
        if (input == null) {
            return "";
        }
        input = marked(input, {
            breaks: true
        });
        input = sanitizeHtml(input)
        return input;
    }
    async loadTemplates() {
        
        // loads templates to memory for further processing
        try {
            let baseTemplateList = await fs.readdir("templates");
            let partialList = await fs.readdir("templates/partials");
            let translationsList = await fs.readdir("translations");
            for await (const file of baseTemplateList) {
                if (file.substr(file.length - 4) == ".hbs") {
                    console.log("Reading ", file)
                    this.baseTemplateFiles[file.substr(0, file.length - 4)] = await fs.readFile("templates/" + file, { encoding: "utf-8" });
                }
            }
            for await (const file of partialList) {
                if (file.substr(file.length - 4) == ".hbs") {
                    console.log("Reading and Compiling ", file);
                    handlebars.registerPartial(file.substr(0, file.length - 4), await fs.readFile("templates/partials/" + file, { encoding: "utf-8" }));
                }
            }
            for await (const file of translationsList) {
                if (file.substr(file.length - 5) == ".json") {
                    console.log("Reading Translation ", file);
                    try {
                        this.translations[file.substr(0, file.length - 5)] = JSON.parse(await fs.readFile("translations/" + file, { encoding: "utf-8" }));
                    } catch (e) {
                        throw e;
                    }
                }
            }
        } catch (e) {
            throw e;
        }
        Promise.resolve();
    }
    compileTemplates() {
        console.log("Compiling Base Templates");
        for (var template in this.baseTemplateFiles) {
            console.log("Compiling " + template + "...");
            this.baseTemplates[template] = handlebars.compile(this.baseTemplateFiles[template]);
            console.log("Compiled ", template)
        }
        
    }
    async initTemplate() {
        await this.loadConfig();
        await this.loadTemplates();
        await this.loadStandardData();
        let conf = this.config
        handlebars.registerHelper("formatDate", function (datetime) {
            if (moment) {
                // can use other formats like 'lll' too
                return moment(datetime).format(conf.dateFormat);
            }
            else {
                return datetime;
            }
        });
        this.compileTemplates();
        let upper = this;
        handlebars.registerHelper("postPreview", function (data) {
            data.content.contentShort = upper.renderAndSanitizeMD(data.content.content.substr(0, conf.postPreviewLength) + "...")
            let html = upper.renderTemplate("emptyBase", "postPreview", data.post.language, {
                content: data.content,
                post: data.post,
                categories: data.categories
            }, false);
            return html;
        })
        return;
    }
    async loadStandardData() {
        this.standardData = JSON.parse(await fs.readFile("./standardData.json", "utf-8"));
    }
    renderTemplate(baseTemplate, template = "NoTemplate", translation = this.config.standardLang, data, write = true, writepath, useStandardData = true) {
        data = { ...{ translation: { ...this.translations[this.config.fallbackLang], ...this.translations[translation] } }, ...data };
        data.template = template;
        console.log(data);
        if (useStandardData) {
            data = { ...this.standardData, ...data };
        }
        if (this.baseTemplates[baseTemplate] == undefined) {
            console.log(this.baseTemplates, baseTemplate);
            throw Error("Template " + baseTemplate + " not compiled");
        }
        console.log("Rendering " + baseTemplate);
        let content = this.baseTemplates[baseTemplate](data);
        if (!this.htmls[baseTemplate])
            this.htmls[baseTemplate] = {};
        if (!this.htmls[baseTemplate][template]) 
            this.htmls[baseTemplate][template] = {}
        this.htmls[baseTemplate][template][translation] = content;
        if (write) {
            this.writer(writepath, content)
        }
        return content;
    }
    async writer(writepath, content) {
        await fs.writeFile(writepath, content, "utf-8");

    }
    async renderLanding(write) {
        console.log(" RENDER BASE ")
        let postList = [];
        let queryData = {
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
            ],
            "where": {
                "visible": true
            }
        }
        

        let systemTrans = this.translations;
        let backupLang = this.config.backupLang;
        let posts = await this.post.findAll(queryData);
        for (var i in systemTrans) {
            posts.forEach(async post => {
                let output = {};
                let foundCorrectLanguage = false;
                let trans = [{
                    "title": post.dataValues.title, "language": post.dataValues.language,
                    "content": post.dataValues.content, "urlTitle": this.titleUrlSafe(post.dataValues.title)
                }];
                post.dataValues.postedByUser = post.dataValues.postedByUser.dataValues
                post.dataValues.translations.forEach(curr => {
                    curr.dataValues.urlTitle = this.titleUrlSafe(curr.dataValues.title)
                    trans.push(curr.dataValues);
                });
                post.dataValues.translations = trans;
                
                trans.forEach(async curr => {
                    if (curr.language == systemTrans[i].translationLang) {
                        // correct language!
                        foundCorrectLanguage = true;
                    } else if (curr.language == backupLang && !foundCorrectLanguage) {
                        // found backupLanguage
                    } else {
                        // do not need this language
                        return;
                    }
                    let cats = []
                    post.dataValues.postCategories.forEach(currCat => {
                        let found = false;
                        currCat.dataValues.translations.forEach(currCatTrans => {
                            if (currCatTrans.dataValues.language == curr.language) {
                                cats.push(currCatTrans.dataValues);
                                found = true;
                            }
                        })
                        if (!found) {
                            cats.push(currCat.dataValues);
                        }
                    })
                    
                    output = { content: curr, post: post.dataValues, categories: cats }
                })
                postList.push(output);


            })
            this.renderTemplate(this.config.homepageBaseTemplate, this.config.homepageTemplate, this.translations[i].translationLang, {post: postList}, true, this.config.htmlLocation + "/" + this.translations[i].translationLang + "/index.html");
        }
        
        
    }
    async createFolderStructure(base) {
        let languageQuery = await this.translation.findAll(
            { attributes: [[this.sequelize.fn('DISTINCT', this.sequelize.col('language')), 'language']] });
        languageQuery.forEach(async curr => {
            try {
                await fs.mkdir(base + "/" + curr.dataValues.language);
                await fs.mkdir(base + "/" + curr.dataValues.language + "/posts")

            } catch (e) {
                return;
            }
        })
        for (var i in this.translations) {
            try {
                await fs.mkdir(base + "/" + this.translations[i].translationLang);
                await fs.mkdir(base + "/" + this.translations[i].translationLang + "/posts")
            } catch (e) {
                return;
            }
        }
        
    }
    titleUrlSafe(title) {
        return title.replaceAll(" ", "-")
    }
    async renderStaticPage(save, id = null, lang = null) {

        let htmls = [];
        let finder = "findAll"
        let upper = this;
        let queryData = {
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
        }
        if (id != null) {
            queryData.where = {
                "id": id
            }
            finder = "findOne"
        }


        let staticPages = await this.staticPage[finder](queryData);
        staticPages.forEach(async page => {
            let trans = [{
                "title": page.dataValues.title, "language": page.dataValues.language,
                "content": page.dataValues.content, "urlTitle": this.titleUrlSafe(page.dataValues.title)
            }];
            page.dataValues.postedByUser = page.dataValues.postedByUser.dataValues
            page.dataValues.translations.forEach(curr => {
                curr.dataValues.urlTitle = this.titleUrlSafe(curr.dataValues.title)
                trans.push(curr.dataValues);
            });
            page.dataValues.translations = trans;
            
            trans.forEach(async curr => {
                let cats = []
                page.dataValues.staticPageCategories.forEach(currCat => {
                    let found = false;
                    currCat.dataValues.translations.forEach(currCatTrans => {
                        if (currCatTrans.dataValues.language == curr.language) {
                            cats.push(currCatTrans.dataValues);
                            found = true;
                        }
                    })
                    if (!found) {
                        cats.push(currCat.dataValues);
                    }
                })
                curr.content = this.renderAndSanitizeMD(curr.content)
                let html = this.renderTemplate("baseTemplate", "static", curr.language, {
                    content: curr,
                    page: page.dataValues,
                    categories: cats
                }, save, upper.config.htmlLocation + "/" + curr.language + "/" + curr.urlTitle + ".html");
                htmls.push({id: page.dataValues.id, language: curr.language, html: html})
            })

            
        })
        return htmls;
    
        
    }
    async renderPost(save, id = null, lang = null) {
        let upper = this;
        let htmls = [];
        let finder = "findAll"
        let queryData = {
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
        }
        if (id != null) {
            queryData.where = {
                "id": id
            }
            finder = "findOne"
        }


        let posts = await this.post[finder](queryData);
        posts.forEach(async post => {
            let trans = [{
                "title": post.dataValues.title, "language": post.dataValues.language,
                "content": post.dataValues.content, "urlTitle": this.titleUrlSafe(post.dataValues.title)
            }];
            post.dataValues.postedByUser = post.dataValues.postedByUser.dataValues
            post.dataValues.translations.forEach(curr => {
                curr.dataValues.urlTitle = this.titleUrlSafe(curr.dataValues.title)
                trans.push(curr.dataValues);
            });
            post.dataValues.translations = trans;

            trans.forEach(async curr => {
                let cats = []
                post.dataValues.postCategories.forEach(currCat => {
                    let found = false;
                    currCat.dataValues.translations.forEach(currCatTrans => {
                        if (currCatTrans.dataValues.language == curr.language) {
                            cats.push(currCatTrans.dataValues);
                            found = true;
                        }
                    })
                    if (!found) {
                        cats.push(currCat.dataValues);
                    }
                })
                let html = this.renderTemplate("baseTemplate", "post", curr.language, {
                    content: curr,
                    post: post.dataValues,
                    categories: cats
                }, save, upper.config.htmlLocation + "/" + curr.language + "/posts/" + curr.urlTitle + ".html");
                htmls.push({ id: post.dataValues.id, language: curr.language, html: html })
            })


        })
        return htmls;


    }
    async renderWebsite(save) {
        if (save) await this.createFolderStructure(this.config.htmlLocation);
        await this.renderStaticPage(save);
        await this.renderPost(save)
        await this.renderLanding(save);
    }
}

module.exports = template;