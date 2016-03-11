'use strict';

/**
 * Created by impyeong-gang on 10/29/15.
 */
var express  = require('express');
var router = express.Router();

var membershipController = require('../controller/membershipController');

var bunyan = require('bunyan');
var log = bunyan.getLogger('RouterLogger');


module.exports = router;

/**
 * @api {get} /membership/:uid  유저에 대한 정보를 제공한다
 * @apiGroup Metadata
 *
 *
 * @apiSuccess {String} uid   유저 아이디
 * @apiSuccess {String} nickname   유저 별명
 * @apiSuccess {String} profile_s3path   프로필 사진 경로
 * @apiSuccess {String[]} group  유저가 속한 그룹 아이디
 *
 * @apiError 401 Unauthorized API 호출 권한이 없음
 * @apiError 403 Forbidden 인증 실패
 * @apiError 404 NotExistResource 유저가 존재하지 않음
 * @apiError 500 Internal 서버 오류
 *
 * @apiPermission picup-user
 *
 */
router.get('/profile', function (req, res) {
    var user = req.user;

    var db = req.app.get('models');

    membershipController.getMyProfile(user, db).then(function(profile){
        res.status(200);
        res.json({
            uid: profile.id,
            nickname: profile.nickname,
            profile_s3path: profile.profile_s3path,
            auth_type: profile.auth_type,
            group: profile.group
        });
    }).catch(function(err){
        res.status(err.errorCode);
        res.json(err);
    });
});

/**
 * @api {get} /membership/:uid  uid에 해당하는 유저에 대한 정보를 제공한다
 * @apiGroup Metadata
 *
 * @apiParam {String} uid    유저 아이디
 *
 * @apiSuccess {String} uid   유저 아이디
 * @apiSuccess {String} nickname   유저 별명
 * @apiSuccess {String} profile_s3path   프로필 사진 경로
 * @apiSuccess {String[]} group  유저가 속한 그룹 아이디
 *
 * @apiError 401 Unauthorized API 호출 권한이 없음
 * @apiError 403 Forbidden 인증 실패
 * @apiError 404 NotExistResource 유저가 존재하지 않음
 * @apiError 500 Internal 서버 오류
 *
 * @apiPermission picup-user
 *
 */
router.get('/:uid/profile', function (req, res) {
    var uid = req.params.uid;

    var db = req.app.get('models');

    membershipController.getProfile(uid, db).then(function(user){
        res.status(200);
        res.json({
            uid: user.id,
            nickname: user.nickname,
            profile_s3path: user.profile_s3path,
            group: user.group
        });
    }).catch(function(err){
        res.status(err.errorCode);
        res.json(err);
    });
});

/**
 * @api {get} /membership/:uid/profile/s3path  유저가 프로필 사진을 올릴 경로를 제공한다.
 * @apiGroup Metadata
 *
 * @apiParam {String} uid    유저 아이디
 *
 * @apiSuccess {String} uid   유저 아이디
 * @apiSuccess {String} profile_s3path   프로필 사진 경로
 *
 * @apiError 401 Unauthorized API 호출 권한이 없음
 * @apiError 403 Forbidden 인증 실패
 * @apiError 500 Internal 서버 오류
 *
 * @apiPermission picup-user
 *
 */
/* uri 변경해야함 uid 노필요 */
router.get('/:uid/profile/s3path', function (req, res) {
    var user = req.user;

    /* authentication */

    var db = req.app.get('models');

    membershipController.getUserProfilePath(user, db).then(function(path){
        res.status(200);
        res.json({
            uid : user.id,
            profile_s3path : path
        });
    }).catch(function(err){
        log.error("grpRouter#getUserProfilePath", {err:err}, {user : user.id});
        res.status(err.errorCode);
        res.json(err);
    });
});


/**
 * @api {post} /membership/:uid/profile/ 유저의 정보를 변경한다
 * @apiGroup Metadata
 *
 * @apiParam {String} uid    유저 아이디
 * @apiParam {String} nickname  유저 별명
 * @apiParam {String} s3path  유저 프로필 사진 경로
 *
 * @apiSuccess {String} uid    유저 아이디
 * @apiSuccess {String} nickname  유저 별명
 * @apiSuccess {String} s3path  유저 프로필 사진 경로
 *
 * @apiError 401 Unauthorized API 호출 권한이 없음
 * @apiError 403 Forbidden 인증 실패
 * @apiError 500 Internal 서버 오류
 *
 * @apiPermission picup-user
 *
 */
/*uri 변경 필요 uid 노 필요 */
router.post('/:uid/profile', function (req, res) {
    var user = req.user;
    var nickname = req.body.nickname;
    var s3path = req.body.profile_s3path;

    var db = req.app.get('models');

    /*authentication*/
    membershipController.setProfile(user, nickname, s3path, db).then(function(user){
        res.status(200);
        res.json({
            uid: user.id,
            nickname: user.nickname,
            profile_s3path: user.profile_s3path
        });
    }).catch(function(err){
        log.error("grpRouter#setProfile", {err:err}, {user : user.id});
        res.status(err.errorCode);
        res.json(err);
    });
});

/**
 * @api {post} /membership/:uid/profile/ 유저의 정보를 변경한다
 * @apiGroup Metadata
 *
 * @apiParam {String} uid    유저 아이디
 * @apiParam {String} nickname  유저 별명
 * @apiParam {String} s3path  유저 프로필 사진 경로
 *
 * @apiSuccess {String} uid    유저 아이디
 * @apiSuccess {String} nickname  유저 별명
 * @apiSuccess {String} s3path  유저 프로필 사진 경로
 *
 * @apiError 401 Unauthorized API 호출 권한이 없음
 * @apiError 403 Forbidden 인증 실패
 * @apiError 500 Internal 서버 오류
 *
 * @apiPermission picup-user
 *
 */
