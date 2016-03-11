'use strict';

var Sequelize = require('sequelize');

/**
 * Created by impyeong-gang on 1/11/16.
 */
module.exports = {
    USER : {
        TABLE : "user",
        SCHEME : {
            id : {type: Sequelize.UUID, defaultValue:Sequelize.UUIDV1, primaryKey : true},
            nickname : { type : Sequelize.STRING(40), allowNull: false},
            profile_path : { type : Sequelize.STRING, allowNull: false }
        }
    },

    GROUP : {
        TABLE : "groups",
        SCHEME : {
            id : { type : Sequelize.UUID, defaultValue:Sequelize.UUIDV1, primaryKey: true},
            group_name : { type : Sequelize.STRING(40), allowNull: false},
            revision : { type : Sequelize.BIGINT, allowNull: false},
            created_date : { type : Sequelize.BIGINT, allowNull: false },
            repository : { type : Sequelize.STRING, allowNull: false },
            color : { type : Sequelize.INTEGER, allowNull: false },
            last_mod_date : { type : Sequelize.BIGINT, defaultValue: Date.now(), allowNull : false}
        }
    },

    DELTA : {
        TABLE : "delta",
        SCHEME : {
            id : { type : Sequelize.UUID, defaultValue:Sequelize.UUIDV1, primaryKey: true},
            revision : { type : Sequelize.BIGINT, allowNull: false},
            data : { type : Sequelize.TEXT }
        }
    },

    AUTH : {
        TABLE : "auth",
        SCHEME : {
            id : { type : Sequelize.BIGINT, autoIncrement: true, primaryKey: true},
            auth_id : {type : Sequelize.STRING(40), allowNull: false},
            auth_type : { type: Sequelize.ENUM('kakao', 'facebook'), allowNull: false }
        }
    },

    ACCESS_TOKEN : {
        TABLE : "accessToken",
        SCHEME : {
            id : { type : Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
            access_token : { type : Sequelize.STRING, allowNull: false},
            refresh_token : { type : Sequelize.STRING, allowNull: false},
            expired_in : { type : Sequelize.BIGINT, allowNull: false},
            created_time : { type : Sequelize.BIGINT, allowNull : false}
        }
    },

    CLIENT : {
        TABLE : "client",
        SCHEME : {
            id : { type : Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
            client_id : { type : Sequelize.STRING, allowNull: false},
            client_secret : { type : Sequelize.STRING, allowNull: false}
        }
    },

    PUSH_REGISTRATION : {
        TABLE : "pushRegistration",
        SCHEME : {
            id : { type : Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
            registration_id : { type : Sequelize.STRING, allowNull : false }
        }
    },

    NODE_META : {
        TABLE : "nodeMeta",
        SCHEME : {
            gid : { type : String, hashKey: true },
            nid : { type : String, rangeKey: true },
            relPath : { type : String, required : true, index: { global:false, rangeKey:'gid', name:'gid-relPath-index', project: true, throughput: 1} },
            kind : { type : String, required : true },
            author : { type : String, required : true },
            uploadedDate : { type : Number },
            exif : { type : Object }
        }
    },

    NODE_DELTA : {
        TABLE : "nodeDelta",
        SCHEME : {
            nid : { type : String, hashKey: true },
            revision : { type : Number, rangeKey: true},
            presence : { type : String, require : true },
            s3Path : { type : String },
            s3ThumbnailPath : { type : String },
            name : { type : String },
            owner : { type : String },
            updatedDate : { type:Number },
            createdDate : { type:Number }
        }
    }
};
