/**
 * Created by impyeong-gang on 12/18/15.
 */
var AppError = require('./appError');
var _ = require('lodash');
var utils = require('../utils/utils');

var bunyan = require('bunyan');
var log = bunyan.getLogger('ModuleLogger');


exports.PRESENCE_ADD = "add";
exports.PRESENCE_DELETE = "deleted";
exports.PRESENCE_REPLACE = "replace";

exports.KIND_DIR = "dir";
exports.KIND_FILE = "file";

/** 차후에 커밋용과 업데이트용을 나누어야함 **/
/**
 * startRev와 endRev사이의 skip-delta revision들을 계산한다.
 * @param src startRev
 * @param dst endRev
 * @param backward for Recursive, buffer
 * @param forward for Recursive, buffer
 * @returns {*}
 */
var getDeltaList = function (src, dst) {
    var switching = false;
    var resultDelta = {
        backward: [],
        forward: []
    };
    try{
        (function getDeltaList(_src, _dst) {

            if (_src === _dst) {
                resultDelta.forward.push(_src);
                return;
            }
            if (_src === 0) {
                var dstBinary = _dst.toString(2);
                var shortest = Math.pow(2, dstBinary.length - 1);
                switching = true;
                return getDeltaList(shortest, _dst);
            }
            if (isBoundary(_src, _dst)) {
                if (switching) {
                    resultDelta.forward.push(_src);
                } else {
                    switching = true;
                }
                var f_src = getForwardRevision(_src, _dst);
                return getDeltaList(f_src, _dst);
            } else {
                resultDelta.backward.push(_src);
                var b_src = getSkipDeltaNumber(_src);
                return getDeltaList(b_src, _dst);
            }
        })(src, dst);
    } catch (err){
        log.error("Sync#genDeltaList/compute error", {err:err});
        throw AppError.throwAppError(409);
    }

    return resultDelta;
};

/* long commit시 탐색해야할 델타리스트를 구한다. */
var computeTraversal = function(revision){
    var startRev = getSkipDeltaNumber(revision);
    var endRev = revision-1;

    //long commit case의 경우 탐색해야 하는 리비전 넘버 셋을 구하고,
    //해당하는 리비전을 돌며 델타를 매핑해야한다.
    var src = parseInt(startRev);
    var dst = parseInt(endRev);

    /* src와 dst로 탐색해야 하는 리비전 넘버셋을 구한다
     * 커밋의 경우 항상 dst가 endRev와 endRev의 Skip-delta rev 사이에 속하기 때문에 forward만 발생한다.*/
    try {
        var deltaTraversalInfo = getDeltaList(src, dst);
        return deltaTraversalInfo;
    } catch (err) {
        throw AppError.throwAppError(500, err.toString());
    }
};

/**
 * src가 dst로 가기 위한 알맞은 가지를 선택한다
 * @param src
 * @param dst
 */
var getForwardRevision = function (src, dst) {
    var srcBinary = src.toString(2);
    var dstBinary = dst.toString(2);
    var matched = "";


    for (var i = 0; i < srcBinary.length; i++) {
        if (srcBinary[i] !== dstBinary[i]) {
            break;
        }
        matched += srcBinary[i];
    }

    // 다른 레벨의 가지거나, 처음부터 일치하지 않는 경우 null 리턴
    if (srcBinary.length !== dstBinary.length || matched.length === 0) {
        return null;
    }

    var matchedIndex = matched.length - 1;

    var result = srcBinary.substr(0, matchedIndex + 1) +
        dstBinary[matchedIndex + 1] +
        srcBinary.substr(matchedIndex + 2, srcBinary.length);

    return parseInt(result, 2);
};

/**
 * src가 dst와 같은 가지 내에 있는지 검사한다.
 * 0은 들어오지 않는다고 가정한다
 * @param src
 * @param dst
 */
var isBoundary = function (src, dst) {
    var srcBinary = src.toString(2);
    var dstBinary = dst.toString(2);
    var matched = "";

    //another far prune, fast except
    if (srcBinary.length !== dstBinary.length) {
        return false;
    }

    /*
     * src와 dst가 같은 가지임을 검사하는 방법은
     * src와 dst를 가장 높은 자리부터 같은지 확인하고,
     * src가 일치한 자리 이후부터 끝까지 0이 아니라면 다른 가지이다.
     * 이것은 skip-delta의 특성에 기인한 것으로
     * skip-delta는 가장 오른쪽의 비트를 0으로 한 2진수를 가리킨다.
     * 이 때 가리키지 않는다는 것은 도달하지 않는다는 것이다
     *
     * src와 dst가 큰 가지 안에서 (2^n의 차이 안에서) 같이 있게 된다면
     * 마지막 한 비트와 첫 비트를 제외한 중간비트로 가지가 나뉘게 된다.
     * 이 때, 중간비트에서 내려가며 가지가 갈라지는 모양새이므로,
     * src가 dst를 포함하는 조건은 시작 비트의 길이와 값이 같고
     * 같은 자리의 중간비트가 달라지는 자리부터, src의 이후 비트가 모두 0이라면
     * src는 dst를 포함한다.
     *
     * 예)
     *      src : 10011000
     *      dst : 10011111
     *
     * 위의 경우를 예로 설명하자면 스킵델타의 특성상, dst를 재귀적으로 skip-delta 연산을 하게 된다면,
     * src가 될 것이다.
     * 이것은 즉, src는 dst의 조상임을 말한다.
     *
     * 하지만,
     *      src : 1011001
     *      dst : 1010011
     *
     * 와 같은 예는 dst가 skip-delta 연산을 하게 된다 하더라도 src에 도달할 수 없다.
     * 즉 중간비트의 형이 달라지는 순간 이후 src가 0이 아니게 되면 src는 dst를 포함하지 않는다.
     *
     */
    for (var i = 0; i < srcBinary.length; i++) {
        if (srcBinary[i] !== dstBinary[i]) {
            break;
        }
        matched += srcBinary[i];
    }

    for (var j = matched.length; j < srcBinary.length; j++) {
        if (srcBinary[j] !== '0') {
            return false;
        }
    }
    return true;
};


/**
 * revnum의 binary right-most '1' bit를 0으로 치환한 값을 구한다.
 * @param revnum
 * @returns {Number}
 */
var getSkipDeltaNumber = function (revnum) {
    var src = revnum.toString(2);
    var dst = getRightmostToZero(src);
    return parseInt(dst, 2);

};

var getRightmostToZero = function (bin) {
    var result = "";
    for (var i = bin.length - 1; i >= 0; i--) {
        var char = bin.charAt(i);

        if (char === '1') {
            result = bin.substring(0, i) + '0' + result;
            break;
        }
        result = char + result;
    }

    return result;
};

/**
 * 커밋을 위한 이전 델타들과 새로운 델타를 조합하여 새로운 리비전에 대한 델타를 생성한다.
 * @param prevChangeSet 커밋에 필요한 이전 델타 값
 * @param newChangeSet 새로운 델타 값
 * @returns {*}
 */
var generateDifferenceCommitData = function(forward){
    return utils.sumDeltaListForCommit(forward);
};

/**
 * 업데이트를 위한 이전 델타들과 새로운 델타를 조합하여 새로운 리비전에 대한 델타를 생성한다.
 * @param prevChangeSet 커밋에 필요한 이전 델타 값
 * @param newChangeSet 새로운 델타 값
 * @returns {*}
 */
var generateDifferenceUpdateData = function(backward, forward){
    var forwardList = utils.sumDeltaListForUpdate(forward);
    var backwardList = utils.sumDeltaListForUpdate(backward);

    return utils.diffDeltaList(forwardList, backwardList);
};


var S3PathGenerator = function(bucketName, gid, relPath, type) {
    var s3path;
    if(type === 'file') {
        s3path = bucketName + "/" + gid + "/" + relPath;
    } else if(type === 'dir'){
        s3path = bucketName + "/" + gid + "/" + relPath + "/" + Date.now() + ".jpg";
    }
    return s3path;
};

var S3ThumbnailPathGenerator = function(s3Path, thumbnailBucketName){
    var key = S3PathSeparator(s3Path).key;

    return thumbnailBucketName + "/" + key;
};

var S3PathSeparator = function(s3Uri){
    var separatedS3Uri = _.split(s3Uri, '/');
    var bucket = separatedS3Uri[0];
    var key = "";
    for(var i = 1; i < separatedS3Uri.length ; i++){
        key += separatedS3Uri[i];
        if(i != separatedS3Uri.length -1){
            key += "/";
        }
    }
    return {bucket : bucket, key : key};
};

exports.getDeltaList = getDeltaList;
exports.getSkipDeltaNumber = getSkipDeltaNumber;
exports.generateDifferenceCommitData = generateDifferenceCommitData;
exports.generateDifferenceUpdateData = generateDifferenceUpdateData;
exports.isBoundary = isBoundary;
exports.getSkipDeltaNumber = getSkipDeltaNumber;
exports.getForwardRevision = getForwardRevision;
exports.getRightmostToZero = getRightmostToZero;
exports.S3PathGenerator = S3PathGenerator;
exports.S3PathSeparator = S3PathSeparator;
exports.S3ThumbnailPathGenerator = S3ThumbnailPathGenerator;
exports.computTeraversal = computeTraversal;
