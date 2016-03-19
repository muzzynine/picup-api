/**
 * Created by impyeong-gang on 1/18/16.
 */


var bunyan = require('bunyan');
var createCWStream = require('bunyan-cloudwatch');

Date.prototype.yyyymmdd = function() {
    var yyyy = this.getFullYear().toString();
    var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
    var dd  = this.getDate().toString();
    return yyyy + (mm[1]?mm:"0"+mm[0]) + (dd[1]?dd:"0"+dd[0]); // padding
};

var cwsStream = createCWStream({
    logGroupName : 'picupAWSInstances',
    logStreamName: new Date().yyyymmdd() + '/api',
    cloudWatchLogsOptions: {
        region: 'ap-northeast-1'
    }
});

bunyan.getLogger = function(name){
    if(process.env.NODE_ENV == 'development'){
	return bunyan.createLogger({
            name : name
	});
    } else if(process.env.NODE_ENV == 'production'){
	return bunyan.createLogger({
	            name : name,
	    streams: [
		{
		    stream: cwsStream,
		    type: 'raw'
		}
	    ]
	});
    }
};
