/**
 * Created by impyeong-gang on 12/7/15.
 */

var express = require('express');
var bodyParser = require('body-parser');
var config = require('./config/config');
var passport = require('passport');
var path = require('path');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var logging = require('./lib/logger');
var bunyan = require('bunyan');
var log = bunyan.getLogger('MainLogger');
var AppError = require('./lib/appError');


var app = express();

app.set('models', require('./model_migration'));
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

if(process.env.NODE_ENV == 'development'){
    console.log("Server running Development Mode");
    app.use(require('morgan')('dev'));
} else if(process.env.NODE_ENV == 'production'){
    console.log("Server running Production Mode");
}

// 304 disable
app.disable('etag');

// parser setup
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : false}));
// session setup

app.use(passport.initialize());

var auth = require('./lib/auth');
auth.setPassportStrategy();

var apiRouter = require('./router/router');
app.use('/api', apiRouter);

log.info("Picup API server listening...");
app.listen(8090);
