/**
 * Created by impyeong-gang on 12/8/15.
 */
var express = require('express');
var router = express.Router();

module.exports = router;


/**
 * @api {get} /invite/:gid?from=<from> 초대 페이지를 랜더링하여 보여준다
 * @apiGroup Metadata
 *
 * @apiParam {String} gid   그룹 아이디
 * @apiParam {String} from  초대 url을 제공하는 유저의 유저아이디
 *
 * @apiPermission none
 *
 */
router.get('/:gid', function(req, res, next) {
    var gid = req.params.gid;
    var from = req.query.from;

    res.writeHead(302, {
        'Location' : 'hourlink://join?gid=' + gid
    });
    res.end();

//    res.render('invite', { gid: gid, from: from });
});