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
	addr : 'http://54.238.255.69',
	port : '8090',
	url : {
	    group : '/api/group'
	},

	//in develop enviroment, just indirect to api endpoint.
	reverse_proxy : {
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

    auth_server: {
	addr : '54.238.255.255',
	port : '8110',
	authPath : '/verify/token'
    },

    DB: {
	MYSQL:{
	    HOST : 'bigfrfog-picup.cpcmirt0kyjt.ap-northeast-2.rds.amazonaws.com',
	    DATABASE : 'picup',
	    PROTOCOL: 'mysql',
	    PORT: 3306,
	    USERNAME : 'muzzynine',
	    PASSWORD : 'su1c1delog1c'
	}
    },

    sessionStore : {
	option : {
	    host: 'localhost',
	    port: '8543'
	},

	secret : "bigfrogdevs"
    },

    AMQP : {
	amqpAddr: "amqp://bigfrogcorp.com:5672",

	QUEUE : {
	    name : "picup"
	}
    }
};
