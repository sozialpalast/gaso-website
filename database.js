const { Sequelize, DataTypes } = require('sequelize');
const fs = require("fs/promises");
const crypto = require('crypto');
const { throws } = require('assert');
const moment = require("moment")

class database {
    constructor(connectionString) {
        this.connectionString = connectionString;
        var { Op } = require("sequelize");
        this.Op = Op;
    }
    async loadConfig() {
        this.config = JSON.parse(await fs.readFile("config.json", "utf-8"));
    }
    createConnection() {
        this.sequelize = new Sequelize(this.connectionString, {
            "logging": true
        });
    }
    loadModel() {
        this.user = this.sequelize.define("user", {
            "username": {
                type: DataTypes.STRING
            },
            password: {
                type: Sequelize.STRING,
                get() {
                    return () => this.getDataValue('password')
                }
            },
            salt: {
                type: Sequelize.STRING,
                get() {
                    return () => this.getDataValue('salt')
                }
            },
            "displayName": {
                type: DataTypes.STRING
            },
            "isAdmin": {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            "createdBy": {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: null
            }

        })
        this.post = this.sequelize.define("post", {
            "title": {
                type: DataTypes.STRING
            },
            "content": {
                type: DataTypes.TEXT
            },
            "postedBy": {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            "style": {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: null
            },
            "visible": {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            "language": DataTypes.STRING
        })
        this.staticPage = this.sequelize.define("staticPage", {
            "title": {
                type: DataTypes.STRING
            },
            "content": {
                type: DataTypes.TEXT
            },
            "postedBy": {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            "style": {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: null
            },
            "visible": {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            "language": DataTypes.STRING
        })
        this.category = this.sequelize.define("category", {
            "title": {
                type: DataTypes.STRING
            },
            "language": DataTypes.STRING
        })
        
        this.translation = this.sequelize.define("translation", {
            "content": DataTypes.TEXT,
            "title": {
                type: DataTypes.TEXT,
                allowNull: true,
                defaultValue: null
            },
            "forPostId": {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: null
            },
            "forStaticId": {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: null
            },
            "forCategoryId": {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: null
            },
            "language": DataTypes.STRING,
            "translatedBy": DataTypes.INTEGER
        })


        this.menuItem = this.sequelize.define("menuItem", {
            "title": DataTypes.STRING,
            "alt": DataTypes.STRING
        })

        this.postCategory = this.sequelize.define("postCategory", {
            "id": {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            "postId": DataTypes.INTEGER,
            "categoryId": DataTypes.INTEGER
        })
        this.staticPageCategory = this.sequelize.define("staticPageCategory", {
            "id": {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            "staticPageId": DataTypes.INTEGER,
            "categoryId": DataTypes.INTEGER
        })
        this.user.generateSalt = function () {
            return crypto.randomBytes(16).toString('base64')
        }
        this.user.encryptPassword = function (plainText, salt) {
            return crypto
                .createHash('RSA-SHA256')
                .update(plainText)
                .update(salt)
                .digest('hex')
        }
        const setSaltAndPassword = user => {
            if (user.changed('password')) {
                user.salt = this.user.generateSalt()
                console.log(user.password(), user.salt(), this.user.encryptPassword(user.password(), user.salt()));
                user.password = this.user.encryptPassword(user.password(), user.salt())
            }
        }
        this.user.beforeCreate(setSaltAndPassword)
        this.user.beforeUpdate(setSaltAndPassword)
        let usr = this.user;
        this.user.prototype.correctPassword = function (enteredPassword) {
            console.log(enteredPassword)
            return usr.encryptPassword(enteredPassword, this.salt()) === this.password()
        }
        //wooohoo relations
        this.user.belongsTo(this.user, { foreignKey: "createdBy", as: "createdByUser" });
        this.menuItem.belongsTo(this.staticPage);
        // posts
        this.user.hasMany(this.post);
        this.post.belongsTo(this.user, { foreignKey: "postedBy", as: "postedByUser" });
        // statics
        this.user.hasMany(this.staticPage);
        this.staticPage.belongsTo(this.user, { foreignKey: "postedBy", as: "postedByUser" });
        // categories
        this.staticPage.belongsToMany(this.category, { through: this.staticPageCategory, as: "staticPageCategories" });
        this.category.belongsToMany(this.staticPage, { through: this.staticPageCategory, as: "staticPageCategories" });

        this.post.belongsToMany(this.category, { through: this.postCategory, as: "postCategories" });
        this.category.belongsToMany(this.post, { through: this.postCategory, as: "postCategories" })
        //translations
        this.translation.belongsTo(this.user, { foreignKey: "translatedBy" });
        
        this.staticPage.hasMany(this.translation, { as: "translations", foreignKey: "forStaticId" });
        this.translation.belongsTo(this.staticPage, { foreignKey: "forStaticId" });
        
        this.post.hasMany(this.translation, { as: "translations", foreignKey: "forPostId"})
        this.translation.belongsTo(this.post, { foreignKey: "forPostId" });
        
        this.category.hasMany(this.translation, {foreignKey: "forCategoryId", as: "translations"});
    }
    async createUser(data) {
        return await this.user.create(data);

    }
    async syncModel() {
        await this.sequelize.sync({ alter: true, force: false });
        await this.user.findOrCreate({
            where: {
                "username": "admin"
            },
            defaults: {
                "username": "admin",
                "password": "admin",
                "isAdmin": true,
                "displayName": "Administrator"
            }
        });
        return;
    }
    async getCategories(lang = null) {
        let categories = await this.category.findAll({
            "include": {
                model: this.translation,
                as: "translations"
            }
        })
        let categoryList = [];
        categories.forEach(curr => {
            let translationsList = [];
            curr.dataValues.translations.forEach(currTrans => {
                //console.log(curr, currTrans.dataValues);
                translationsList.push(currTrans.dataValues);
                if (currTrans.dataValues.language === lang ) {
                    curr.dataValues.title = currTrans.dataValues.content;

                }
            })
            curr.dataValues.translations = translationsList;
            categoryList.push(curr.dataValues);
        })
        
        return categoryList;
        
    }
}
module.exports = database;