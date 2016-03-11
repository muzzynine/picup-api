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
router.use(passport.authenticate('bearer'),
    function (err, req, res, next){
        if(err) {
            res.status(err.errorCode);
            res.json(err);
            return;
        }
        next();
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


