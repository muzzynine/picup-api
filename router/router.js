'use strict';

/**
 * Created by impyeong-gang on 9/17/15.
 */
var express = require('express');
var passport = require('passport');

var router = express.Router();
var grpRouter = require('./grpRouter');
var membershipRouter = require('./membershipRouter');
var inviteRouter = require('./inviteRouter');

var utils = require('./../utils/utils');
var appError = require('./../lib/appError');
var auth = require('./../lib/auth');

var bunyan = require('bunyan');
var log = bunyan.getLogger('RouterLogger');

module.exports = router;


router.use('/invite', inviteRouter);
router.use(function(req, res, next){
    passport.authenticate('bearer', { session : false }, function(err, user, info){
	if(err){
	    log.error("#verifyBearer", {err : err}, {stack : err.stack});
	    if(err.isAppError){
		res.status(err.errorCode);
		res.json(err);
	    } else {
		res.status(500);
		res.json({});
	    }
	    return;
	}
	if(!user){
	    var error = appError.throwAppError(401, "Unauthorized");
	    res.status(error.errorCode);
	    res.json(error);
	    return;
	}

	req.user = user;
	next();
    })(req, res, next);
});
			 


//router.use(auth.checkScope, auth.errorHandler);

router.get('/hello', function (req, res) {
    console.log(req.authInfo);
    console.log(req.user);
    res.status(200);
    res.json({
        "message": "hello"
    });
});


router.use('/group', grpRouter);
router.use('/membership', membershipRouter);


