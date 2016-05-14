/**
 * Created by impyeong-gang on 12/7/15.
 */
module.exports = {
    server: {
	name: 'picup-api',
	version: ["0.0.1"],
	addr : 'http://192.168.123.100',
	port : '8090',
	url : {
	    group : '/api/group'
	},

	//in develop enviroment, just indirect to api endpoint.
	reverseProxy : {
	    addr : 'http://192.168.123.100',
	    port : '8000'
	}
    },

    S3: {
	apiVersions : '2006-03-01',
	originalBucket : "bigfrog.picup.bakkess",
	minionBucket : "bigfrog.picup.minions",
	profileBucket : "bigfrog.picup.profile"
    },

    authServer: {
	addr : '192.168.123.100',
	port : '8110',
	authPath : '/verify/token'
    },

    SESSION : {
	url : 'redis://picup-session.ui4wps.0001.apne1.cache.amazonaws.com:6379',
	//develop option
	disableTTL : false
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

    AMQP : {
	amqpAddr: "amqp://localhost:5672",

	QUEUE : {
	    name : "picup"
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
