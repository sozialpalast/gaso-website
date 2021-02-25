const { Sequelize, DataTypes } = require('sequelize');
const fs = require("fs/promises");
const crypto = require('crypto');

function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

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
            "logging": false
        });
    }
    loadModel() {
        this.user = this.sequelize.define("user", {
            "username": {
                type: DataTypes.STRING
            },
            "password": {
                type: DataTypes.STRING
            },
            "salt": {
                type: DataTypes.STRING
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
            "lastEdit": {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: null
            },
            "visible": {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            }
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
            }
        })
        this.category = this.sequelize.define("category", {
            "title": {
                type: DataTypes.STRING
            },
            "description": {
                type: DataTypes.STRING
            }
        })
        
        this.translation = this.sequelize.define("translation", {
            "content": DataTypes.TEXT,
            "language": DataTypes.STRING,
            "translatedBy": DataTypes.INTEGER
        })


        this.menuItem = this.sequelize.define("menuItem", {
            "title": DataTypes.STRING,
            "alt": DataTypes.STRING
        })

        //wooohoo relations
        this.user.hasOne(this.user, { foreignKey: "createdBy" });
        this.user.hasMany(this.post);
        this.post.belongsTo(this.user, {foreignKey: "postedBy"});
        this.user.hasMany(this.staticPage);
        this.staticPage.belongsTo(this.user, { foreignKey: "postedBy" });
        this.staticPage.belongsToMany(this.category, { through: "staticPageCategory" });
        this.category.belongsToMany(this.staticPage, { through: "staticPageCategory" });
        this.post.belongsToMany(this.category, { through: "postCategory" });
        this.category.belongsToMany(this.post, { through: "postCategory"})
        this.menuItem.belongsTo(this.staticPage);
        this.translation.belongsTo(this.user, {foreignKey: "translatedBy"});
        this.staticPage.hasMany(this.translation);
        this.post.hasMany(this.translation)

    }
    async createUser(data) {
        data.salt = makeid(255);
        data.password = crypto.createHash('sha256').update(data.salt + data.password + data.salt).digest('hex');
    }
    async syncModel() {
        await this.sequelize.sync();
        return;
    }
}
module.exports = database;