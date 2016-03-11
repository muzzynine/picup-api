'use strict';

/**
 * Created by impyeong-gang on 10/7/15.
 */
var express = require('express');
var router = express.Router();
var AppError = require('../lib/appError');

var groupController = require('./../controller/groupController');

var bunyan = require('bunyan');
var log = bunyan.getLogger('RouterLogger');


module.exports = router;

/**
 * @api {post} /group 그룹을 생성한다.
 * @apiGroup Metadata
 *
 * @apiParam {String} group_name    생성할 그룹의 이름
 * @apiParam {Number} group_color   생성할 그룹의 컬러
 *
 * @apiSuccess {String}         group_id       서비스 전역적으로 유니크한 그룹 아이디
 * @apiSuccess {String}         group_name     그룹의 이름
 * @apiSuccess {Number}         last_mod_date  그룹이 생성된(변경된) 날짜
 * @apiSuccess {Number}         created_date   그룹이 생성된 날짜
 * @apiSuccess {Number}         revision       그룹의 리비전 (생성시 0)
 * @apiSuccess {String}         repos_url      그룹에 대해 접근할 때 사용할 url (서비스 endpoint)
 * @apiSuccess {String}         repos_uuid     그룹에 대해 접근할 떄 사용할 키
 * @apiSuccess {String}         s3path         그룹에 해당하는 AWS S3 URI
 * @apiSuccess {String}         s3key          그룹에 해당하는 AWS S3 ACCESS STRING
 * @apiSuccess {JSONArray}      member         그룹 맴버 리스트
 * @apiSuccess {group_color}    group_color    그룹 컬러
 *
 * @apiError 400 WrongParameter 파라미터가 잘못되었음
 * @apiError 403 Forbidden 인증 실패
 * @apiError 500 InternalError 서버 오류
 * @apiPermission picup-user
 *
 */

router.post('/', function (req, res) {
    var user = req.user;
    var group_name = req.body.group_name;
    var group_color = parseInt(req.body.group_color);

    var db = req.app.get('models');

    groupController.createGroup(user, group_name, group_color, db).then(function(group){
        res.status(200);
        res.json({
            group_id : group.id,
            group_name : group.group_name,
            last_mod_date : group.last_mod_date,
            created_date : group.created_date,
            revision : group.revision,
            s3path : group.repository,
            s3key : "not yet",
            group_color : group.color
        });
    }).catch(function(err){
        log.error("grpRouter#createGroup", {err:err}, {user : user.id});
        res.status(err.errorCode);
        res.json(err);
    });
});


/**
 * @api {get} /group/:gid 그룹의 정보를 제공한다.
 * @apiGroup Metadata
 *
 * @apiParam {String} gid           그룹 아이디
 *
 * @apiSuccess {String}         group_id       서비스 전역적으로 유니크한 그룹 아이디
 * @apiSuccess {String}         group_name     그룹의 이름
 * @apiSuccess {Number}         last_mod_date  그룹이 생성된(변경된) 날짜
 * @apiSuccess {Number}         created_date   그룹이 생성된 날짜
 * @apiSuccess {Number}         revision       그룹의 리비전 (생성시 0)
 * @apiSuccess {String}         repos_url      그룹에 대해 접근할 때 사용할 url (서비스 endpoint)
 * @apiSuccess {String}         repos_uuid     그룹에 대해 접근할 떄 사용할 키
 * @apiSuccess {String}         s3path         그룹에 해당하는 AWS S3 URI
 * @apiSuccess {String}         s3key          그룹에 해당하는 AWS S3 ACCESS STRING
 * @apiSuccess {JSONArray}      member         그룹 맴버 리스트
 * @apiSuccess {group_color}    group_color    그룹 컬러
 *
 * @apiError 400 WrongParameter 파라미터가 잘못되었음
 * @apiError 401 Unauthorized API 호출 권한이 없음
 * @apiError 403 Forbidden 인증 실패
 * @apiError 404 NotExistResource gid와 알맞는 그룹이 없음
 * @apiError 500 Internal 서버 오류
 * @apiPermission picup-user
 *
 */
router.get('/:gid', function (req, res) {
    //Parameter validate 해야함
    var user = req.user;
    var gid = req.params.gid;

    var db = req.app.get('models');

    groupController.getGroup(user, gid, db).then(function(group){
        res.status(200);
        res.json({
            group_id: group.id,
            group_name: group.group_name,
            revision: group.revision,
            last_mod_date : group.last_mod_date,
            created_date: group.created_date,
            s3key: "not yet",
            s3path: group.repository,
            group_color: group.color
        });
    }).catch(function(err){
        log.error("grpRouter#getGroup", {err:err}, {user : user.id});
        res.status(err.errorCode);
        res.json(err);
    });
});

/**
 * @api {post} /group/:gid 새로운 리비전을 커밋한다.
 * @apiGroup Metadata
 *
 * @apiParam {String} gid           그룹 아이디
 * @apiParam {Number} revision      현재 리비전 (커밋하기 전의 리비전)
 * @apiParam {JSONArray} delta      새로운 리비전으로 커밋하고자 하는 델타
 *
 * @apiSuccess {String}         uid            커밋 유저 아이디
 * @apiSuccess {String}         group_id       그룹 아이디
 * @apiSuccess {Number}         revision       그룹의 커밋된 후 리비전
 * @apiSuccess {JSONArray}    group_color      커밋에 반영된 리비전(추가 정보가 포함되어 있음)
 *
 * @apiError 400 WrongParameter 파라미터가 잘못되었음
 * @apiError 401 Unauthorized API 호출 권한이 없음
 * @apiError 403 Forbidden 인증 실패
 * @apiError 404 NotExistResource uid와 알맞는 사용자가 없음
 * @apiError 409 OperationSafetyFailed 커밋 실패, 재시도 요망
 * @apiError 410 OperationFailed 커밋 실패.
 * @apiError 500 Internal 서버 오류
 *
 * @apiPermission picup-user
 *
 */
router.post('/:gid', function (req, res) {
    var user = req.user;
    var gid = req.body.gid;
    var revision = req.body.revision;
    var deltaArray = req.body.delta;

    var db = req.app.get('models');

    groupController.commit2(user, gid, revision, deltaArray, db).then(function(result){
        res.status(200);
        res.json({
            uid: result[1].uid,
            gid: result[1].group,
            revision: result[1].revision,
            delta: result[1].delta,
            needBlocks : result[0]
        });
    }).catch(function(err){
	log.error("grpRouter#commit", {err:err}, {user : user.id});
        res.status(err.errorCode);
        res.json(err);
    });
});


/**
 * @api {post} /group/:gid/member 그룹에 맴버를 등록한다.
 * @apiGroup Metadata
 *
 * @apiParam {String} gid           그룹 아이디
 *
 * @apiSuccess {String}         uid            커밋 유저 아이디
 * @apiSuccess {String}         group_id       그룹 아이디
 *
 * @apiError 400 WrongParameter 파라미터가 잘못되었음
 * @apiError 401 Unauthorized API 호출 권한이 없음
 * @apiError 403 Forbidden 인증 실패
 * @apiError 404 NotExistResource uid와 알맞는 사용자가 없음 / 등록하고자 하는 그룹이 존재하지 않음
 * @apiError 420 RedundantResource 이미 그룹원으로 포함되어있는 유저일 경우
 * @apiError 500 Internal 서버 오류
 *
 * @apiPermission picup-user
 *
 */
router.post('/:gid/member', function (req, res) {
    var user = req.user;
    var gid = req.params.gid;

    var db = req.app.get('models');

    groupController.addGroupMember(user, gid, db).then(function(result){
        res.status(200);
        res.json({
            uid : result.uid,
            group_id : result.gid
        });
    }).catch(function(err){
        log.error("grpRouter#addGroupMember", {err:err}, {user : user.id});
        res.status(err.errorCode);
        res.json(err);
    });
});

/**
 * @api {post} /group/:gid/members 그룹의 맴버 정보를 제공한다.
 * @apiGroup Metadata
 *
 * @apiParam {String} gid           그룹 아이디
 *
 * @apiSuccess {String}         group_id       그룹 아이디
 * @apiSuccess {Number}         count          맴버의 숫자
 * @apiSuccess {JSONArray}      user_info      맴버들의 정보
 *
 * @apiError 400 WrongParameter 파라미터가 잘못되었음
 * @apiError 401 Unauthorized API 호출 권한이 없음
 * @apiError 403 Forbidden 인증 실패
 * @apiError 500 Internal 서버 오류
 *
 * @apiPermission picup-user
 *
 */
router.get('/:gid/members', function (req, res) {
    var gid = req.params.gid;
    var user = req.user;

    var db = req.app.get('models');

    /* validation */

    groupController.getGroupMember(user, gid, db).then(function(profiles){
        res.status(200);
        res.json({
            group_id: gid,
            count: profiles.count,
            user_info: profiles.user_info
        });
    }).catch(function(err){
        log.error("grpRouter#getGroupMember", {err:err}, {user : user.id});
        res.status(err.errorCode);
        res.json(err);
    });
});


/**
 * @api {post} /group/:gid/delta    startRev부터 endRev까지의 그룹 델타를 제공한다.
 * @apiGroup Metadata
 *
 * @apiParam {String} gid           그룹 아이디
 * @apiParam {Number} start_rev     요청 델타의 시작 리비전
 * @apiParam {Number} end_rev       요청 델타의 끝 리비전
 *
 * @apiSuccess {String}         group_id       그룹 아이디
 * @apiSuccess {Number}         revision       그룹의 커밋된 후 리비전
 * @apiSuccess {JSONArray}       delta      커밋에 반영된 리비전(추가 정보가 포함되어 있음)
 *
 * @apiError 400 WrongRequest 클라이언트로부터의 아규먼트 값이 올바르지 않음
 * @apiError 401 Unauthorized API 호출 권한이 없음
 * @apiError 403 Forbidden 인증 실패
 * @apiError 404 NotExistResource 델타를 요청하였으나 그룹 혹은 델타가 없음
 * @apiError 500 Internal 서버 오류
 *
 * @apiPermission picup-user
 *
 */
router.get('/:gid/delta', function (req, res) {
    var user = req.user;
    var gid = req.params.gid;

    var db = req.app.get('models');

    var startRev = parseInt(req.query.start_rev);
    var endRev = parseInt(req.query.target_rev);

    groupController.update(user, gid, startRev, endRev, db).then(function(result){
        res.status(200);
        res.json({
            gid: result.gid,
            revision: result.revision,
            delta: result.delta
        });
    }).catch(function(err){
        res.status(err.errorCode);
        res.json(err);
    });
});


/**
 * @api {post} /group/:gid/name    그룹의 이름을 변경한다
 * @apiGroup Metadata
 *
 * @apiParam {String} gid           그룹 아이디
 * @apiParam {String} group_name    변경하고 싶은 이름
 *
 * @apiSuccess {String}       group_id       그룹 아이디
 * @apiSuccess {String}       group_name     변경된 그룹 이름
 *
 * @apiError 400 WrongParameter 파라미터가 잘못되었음
 * @apiError 401 Unauthorized API 호출 권한이 없음
 * @apiError 403 Forbidden 인증 실패
 * @apiError 404 NotExistResource 델타를 요청하였으나 그룹 혹은 델타가 없음
 * @apiError 500 Internal 서버 오류
 *
 * @apiPermission picup-user
 *
 */
router.post('/:gid/name', function (req, res) {
    var user = req.user;
    var gid = req.params.gid;
    var group_name = req.body.group_name;

    var db = req.app.get('models');

    /* authentication */

    groupController.updateGroupName(user, gid, group_name, db).then(function(group){
        res.status(200);
        res.json({
            group_id : group.id,
            group_name : group.name
        });
    }).catch(function(err){
        log.error("grpRouter#updateGroupName", {err:err}, {user : user.id});
        res.status(err.errorCode);
        res.json(err);
    });
});


/**
 * @api {delete} /group/:gid 유저를 그룹에서 제외한다.
 * @apiGroup Metadata
 *
 * @apiParam {String} gid           그룹 아이디
 *
 * @apiSuccess {String}       gid       그룹 아이디
 * @apiSuccess {String}       uid     유저 아이디
 *
 * @apiError 400 WrongParameter 파라미터가 잘못되었음
 * @apiError 401 Unauthorized API 호출 권한이 없음
 * @apiError 403 Forbidden 인증 실패
 * @apiError 404 NotExistResource 델타를 요청하였으나 그룹 혹은 델타가 없음
 * @apiError 500 Internal 서버 오류
 *
 * @apiPermission picup-user
 *
 */
router.delete('/:gid', function (req, res) {
    var gid = req.params.gid;
    var user = req.user;

    var db = req.app.get('models');

    /* authenticate */

    groupController.deleteGroupMember(user, gid, db).then(function(result){
        res.status(200);
        res.json({
            uid : result.uid,
            gid : result.gid
        });
    }).catch(function(err){
        log.error("grpRouter#deleteGroupName", {err:err}, {user : user.id});
        res.status(err.errorCode);
        res.json(err);
    });
});

/**
 * @api {get} /group/:gid/invite    그룹에 대한 초대 url을 제공한다.
 * @apiGroup Metadata
 *
 * @apiParam {String} gid    그룹 아이디
 * @apiParam {String} agent  초대 url을 제공하는 유저의 유저아이디
 *
 * @apiSuccess {String} invite_url   그룹 초대 url
 *
 * @apiError 401 Unauthorized API 호출 권한이 없음
 * @apiError 403 Forbidden 인증 실패
 *
 * @apiPermission picup-user
 *
 */
/*이 메서드는 보안상 불리한 구조일 수 있으므로 보완이 필요함 */
router.get('/:gid/invite', function (req, res) {
    var gid = req.params.gid;
    var user = req.user;

    var db = req.app.get('models');

    groupController.getInviteUrl(user, gid, db).then(function(url){
        res.status(200);
        res.json({
            invite_url : url
        });
    }).catch(function(err){
        log.error("grpRouter#getInviteUrl", {err:err}, {user : user.id});
        res.status(err.errorCode);
        res.json(err);
    });
});

