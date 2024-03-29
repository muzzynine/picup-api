/**
 * Created by impyeong-gang on 12/7/15.
 */
module.exports = {
    server: {
	        /* https option
        certificate : null,
        key : null,
		*/
	name: 'picup-api',
	version: ["0.0.1"],
	addr : 'internal-picup-api-elb-220257608.ap-northeast-1.elb.amazonaws.com',
	port : '80',
	url : {
	    group : '/api/group'
	},

	//in develop enviroment, just indirect to api endpoint.
	reverseProxy : {
	    addr : 'http://h3.bigfrogcorp.com',
	    port : '80'
	}
    },

    S3: {
	apiVersions : '2006-03-01',
	originalBucket : "bigfrog.picup.bakkess",
	minionBucket : "bigfrog.picup.minions",
	profileBucket : "bigfrog.picup.profile"
    },

    authServer: {
	addr : 'internal-picup-auth-elb-1133570721.ap-northeast-1.elb.amazonaws.com',
	port : '80',
	authPath : '/verify/token'
    },

    SESSION : {
	url : 'redis://picup-session.ui4wps.0001.apne1.cache.amazonaws.com:6379',
	disableTTL : true
    },


    DB: {
	MYSQL:{
	    HOST : 'picup.cluster-cqm2majqgqx4.ap-northeast-1.rds.amazonaws.com',
	    DATABASE : 'picup',
	    PROTOCOL: 'mysql',
	    PORT: 3306,
	    USERNAME : 'muzzynine',
	    PASSWORD : 'su1c1delog1c'
	}
    },

    AWS : {
	region : 'ap-northeast-1'
    },

    MQ : {
	awsConfig : {
	    region : 'ap-northeast-1'
	},
	queueName : 'picup-mq',
	queueUrl : 'https://sqs.ap-northeast-1.amazonaws.com/063860250091/picup-mq',
	bodyFormat : 'json'
    }
};
