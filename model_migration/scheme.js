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
            id : {type: Sequelize.UUID, defaultValue:Sequelize.UUIDV1, primaryKey : true, field:'id'},
	    mail : {type: Sequelize.STRING(50), allowNull: true, field: 'mail'},
	    sex : {type: Sequelize.ENUM('male', 'female', 'unknown'), allowNull: false, field:'sex'},
	    birth : {type: Sequelize.BIGINT, allowNull: true, field: 'birth'},
	    phoneNumber : {type: Sequelize.STRING(20), allowNull: true, field: 'phoneNumber'},
            nickname : { type : Sequelize.STRING(40), allowNull: false, field: 'nickname'},
            profilePath : { type : Sequelize.STRING(150), allowNull: false, field: 'profilePath'},
	    latestReqDate : { type : Sequelize.BIGINT, defaultValue: Date.now(), allowNull : false, field: 'latestReqDate'},
	    countAddPhoto : { type : Sequelize.BIGINT, defaultValue: 0, allowNull : false, field: 'countAddPhoto'},
	    countDeletedPhoto : { type : Sequelize.BIGINT, defaultValue: 0, allowNull : false, field: 'countDeletedPhoto'},
	    usageStorage : { type : Sequelize.BIGINT, defaultValue: 0, allowNull : false, field: 'usageStorage'}
        },
	OPTION : {
	    tableName : "users"
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
            id : { type : Sequelize.UUID, defaultValue:Sequelize.UUIDV1, primaryKey: true, field: 'id'},
            groupName : { type : Sequelize.STRING(40), allowNull: false, field: 'groupName'},
            revision : { type : Sequelize.BIGINT, allowNull: false, field: 'revision'},
            createdDate : { type : Sequelize.BIGINT, allowNull: false, field: 'createdDate'},
            repository : { type : Sequelize.STRING(100), allowNull: false, field : 'repository'},
            color : { type : Sequelize.INTEGER, allowNull: false, field: 'color'},
            lastModDate : { type : Sequelize.BIGINT, defaultValue: Date.now(), allowNull : false, field: 'lastModDate'},
	    countPhoto : { type : Sequelize.BIGINT, defaultValue : 0, allowNull : false, field: 'countPhoto'},
	    countAlbum : { type : Sequelize.BIGINT, defaultValue : 0, allowNull : false, field: 'countAlbum'},
	    usageStorage : { type : Sequelize.BIGINT, defaultValue : 0, allowNull : false, field: 'usageStorage'}
        },
	OPTION : {
	    tableName : "groups"
	}
    },

    DELTA : {
        TABLE : "delta",
        SCHEME : {
            id : { type : Sequelize.UUID, defaultValue:Sequelize.UUIDV1, primaryKey: true, field: 'id'},
            revision : { type : Sequelize.BIGINT, allowNull: false, field: 'revision'},
            data : { type : Sequelize.TEXT, field: 'data'}
        },
	OPTION : {
	    tableName : "delta",
	    updatedAt : false
	}
    },

    AUTH : {
        TABLE : "auth",
        SCHEME : {
            id : { type : Sequelize.BIGINT, autoIncrement: true, primaryKey: true, field: 'id'},
            authId : {type : Sequelize.STRING(40), allowNull: false, field: 'authId'},
            authType : { type: Sequelize.ENUM('kakao', 'facebook'), allowNull: false, field: 'authType'},
	    isBan : {type : Sequelize.BOOLEAN, defaultValue: false, allowNull: false, field: 'isBan'}
        },
	OPTION : {
	    tableName : "auths"
	}
    },

    BAN_INFO : {
	TABLE : "banInfo",
	SCHEME : {
	    id : { type : Sequelize.BIGINT, autoIncrement: true, primaryKey: true, field: 'id'},
	    banReason : { type : Sequelize.STRING(100), defaultValue: "", allowNull: false, field: 'banReason'},
	    banStartDate : { type : Sequelize.BIGINT, allowNull : false, field: 'banStartDate'},
	    banDuration : { type : Sequelize.BIGINT, allowNull : false, field: 'banDuration'}
	},
	OPTION : {
	    tableName : "banInfos"
	}
    },


    ACCESS_TOKEN : {
        TABLE : "accessToken",
        SCHEME : {
            id : { type : Sequelize.BIGINT, autoIncrement: true, primaryKey: true, field: 'id'},
            accessToken : { type : Sequelize.STRING, allowNull: false, field: 'accessToken'},
            refreshToken : { type : Sequelize.STRING, allowNull: false, field : 'refreshToken'},
            expiredIn : { type : Sequelize.BIGINT, allowNull: false, field : 'expiredIn'},
            createdTime : { type : Sequelize.BIGINT, allowNull : false, field : 'createdTime'}
        },
	OPTION : {
	    tableName : "accessTokens"
	}
    },

    CLIENT : {
        TABLE : "client",
        SCHEME : {
            id : { type : Sequelize.BIGINT, autoIncrement: true, primaryKey: true, field:'id'},
            clientId : { type : Sequelize.STRING, allowNull: false, field:'clientId'},
            clientSecret : { type : Sequelize.STRING, allowNull: false, field:'clientSecret'}
        },
	OPTION : {
	    tableName : "clients"
	}
    },

    PUSH_REGISTRATION : {
        TABLE : "pushRegistration",
        SCHEME : {
            id : { type : Sequelize.BIGINT, autoIncrement: true, primaryKey: true, field:'id'},
            registrationId : { type : Sequelize.STRING, allowNull : false, field:'registrationId'}
        },
	OPTION : {
	    tableName : "pushRegistrations"
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
