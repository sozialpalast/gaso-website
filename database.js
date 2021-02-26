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
        this.user.hasOne(this.user, { foreignKey: "createdBy", as: "createdByUser" });
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
        return await this.user.create(data);

    }
    async syncModel() {
        await this.sequelize.sync();
        return;
    }
}
module.exports = database;