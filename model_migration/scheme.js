'use strict';

var Sequelize = require('sequelize');

/**
 * Created by impyeong-gang on 1/11/16.
 */
module.exports = {
    /*
     * USER TABLE
     * id : UUID Identifier
     * nickname : 변경 가능한 서비스 내의 유저 닉네임
     * profilePath : 프로필 사진 URL
     * latestReqDate : 사용자 최종 요청 시간
     * countAddCommit : 유저가 커밋한 Presence Add 카운트
     */
    
    USER : {
        TABLE : "user",
        SCHEME : {
            id : {type: Sequelize.UUID, defaultValue:Sequelize.UUIDV1, primaryKey : true},
	    mail : {type: Sequelize.STRING(50), allowNull: true},
	    sex : {type: Sequelize.ENUM('male', 'female', 'unknown'), allowNull: false},
	    birth : {type: Sequelize.BIGINT, allowNull: true},
	    phoneNumber : {type: Sequelize.STRING(20), allowNull: true},
            nickname : { type : Sequelize.STRING(40), allowNull: false},
            profile_path : { type : Sequelize.STRING(150), allowNull: false},
	    latestReqDate : { type : Sequelize.BIGINT, defaultValue: Date.now(), allowNull : false},
	    countAddPhoto : { type : Sequelize.BIGINT, defaultValue: 0, allowNull : false},
	    countDeletedPhoto : { type : Sequelize.BIGINT, defaultValue: 0, allowNull : false},
	    usageStorage : { type : Sequelize.BIGINT, defaultValue: 0, allowNull : false}
        }
    },

    /*
     * GROUP TABLE
     * id : UUID Identifier
     * groupName : 그룹 이름
     * revision : 그룹의 HEAD Revision
     * createdDate : 그룹이 생성된 시간
     * repository : 그룹의 AWS Bucket URI
     * color : 그룹의 컬러
     * last_mod_date : 그룹이 마지막으로 변경된 시간
     * countAlbum : 그룹에 속한 앨범의 수
     */


    GROUP : {
        TABLE : "groups",
        SCHEME : {
            id : { type : Sequelize.UUID, defaultValue:Sequelize.UUIDV1, primaryKey: true},
            group_name : { type : Sequelize.STRING(40), allowNull: false},
            revision : { type : Sequelize.BIGINT, allowNull: false},
            created_date : { type : Sequelize.BIGINT, allowNull: false },
            repository : { type : Sequelize.STRING(100), allowNull: false },
            color : { type : Sequelize.INTEGER, allowNull: false },
            last_mod_date : { type : Sequelize.BIGINT, defaultValue: Date.now(), allowNull : false},
	    countPhoto : { type : Sequelize.BIGINT, defaultValue : 0, allowNull : false},
	    countAlbum : { type : Sequelize.BIGINT, defaultValue : 0, allowNull : false},
	    usageStorage : { type : Sequelize.BIGINT, defaultValue : 0, allowNull : false}
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
