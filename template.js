const handlebars = require("handlebars");
const fs = require("fs/promises");
const database = require("./database.js");

class template extends database {
    constructor() {
        super();
        this.config = null;
        this.baseTemplates = {};
        this.partials = {};
        this.baseTemplateFiles = {}
        this.translations = {}
        this.htmls = {};

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
        this.compileTemplates();
        return;
    }
    async loadStandardData() {
        this.standardData = JSON.parse(await fs.readFile("./standardData.json", "utf-8"));
    }
    async renderTemplate(baseTemplate, template = "NoTemplate", translation = this.config.standardLang, data, write = true, useStandardData = true) {
        data = { ...{ translation: this.translations[translation] }, ...data };
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
            await fs.writeFile("tmp/" + baseTemplate + template + translation+ ".html", content, "utf-8");
        }
        return content;
    }
    async renderLanding() {
        console.log(" RENDER BASE ")
        await this.renderTemplate(this.config.homepageBaseTemplate, this.config.homepageTemplate, this.config.standardLang, {});
    }
    async renderAllStaticPages() {
        let staticPageData = await this.staticPage.findAll({
            include: [
                {
                    model: this.user
                },
                {
                    model: this.category
                }
                
            ]
            
        })
        console.log(staticPageData);
    }
}

module.exports = template;