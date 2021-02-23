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
              

    }
    
    async loadTemplates() {
        // loads templates to memory for further processing
        try {
            let baseTemplateList = await fs.readdir("templates");
            let partialList = await fs.readdir("templates/partials");
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
    renderTemplate(baseTemplate, data, useStandardData = true) {
        if (useStandardData) {
            data = { ...this.standardData, ...data };
        }
        if (this.baseTemplates[baseTemplate] == undefined) 
            return Error("Template " + baseTemplate + " not compiled");
        console.log("Rendering " + baseTemplate);
        return this.baseTemplates[baseTemplate](data);
    }
    async renderStaticPages() {
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
    }
}

module.exports = template;