const { Sequelize, DataTypes } = require('sequelize');

class database {
    constructor(auto = true, connectionString) {
        if (auto) {
            this.createConnection(connectionString);
            this.loadModel();
        }
    }
    createConnection(connectionString) {
        this.sequelize = new Sequelize(connectionString);
    }
    loadModel() {
        const user = this.sequelize.define("user", {
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
            "joined": {
                type: DataTypes.DATE,
                defaultValue: this.sequelize.NOW
            },
            "createdBy": {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: null
            }

        })
        const post = this.sequelize.define("post", {
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
            }
        })
        const staticPage = this.sequelize.define("staticPage", {
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
        const category = this.sequelize.define("category", {
            "title": {
                type: DataTypes.STRING
            },
            "description": {
                type: DataTypes.STRING
            }
        })
        const menuItem = this.sequelize.define("menuItem", {
            "title": DataTypes.STRING,
            "alt": DataTypes.STRING
        })
        const translation = this.sequelize.define("translation", {
            "content": DataTypes.TEXT,
            "translatedBy": DataTypes.INTEGER
        })
        user.hasMany(post);
        post.belongsTo(user, {foreignKey: "postedBy"});
        user.hasMany(staticPage);
        staticPage.belongsTo(user, { foreignKey: "postedBy" });
        staticPage.belongsToMany(category);
        post.belongsToMany(category);
        menuItem.belongsTo(staticPage);
        translation.hasOne(user, {foreignKey: "translatedBy"});
        staticPage.hasMany(translation);
        post.hasMany(translation)

    }
    async syncModel() {
        await this.sequelize.sync();
        return;
    }
}