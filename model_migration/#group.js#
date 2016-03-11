/**
 * Created by impyeong-gang on 1/11/16.
 */
var GroupScheme = require('./scheme').GROUP;
var AppError = require('../lib/appError');
var config = require('../config');
var Promise = require('bluebird');
var bunyan = require('bunyan');
var log = bunyan.getLogger('DataModelLogger');

var HOST_URI = config.server.reverse_proxy.addr + ":" + config.server.reverse_proxy.port;
var BUCKET_INFO = config.S3.originalBucket;

module.exports = function(connection){
    var Group = connection.define(GroupScheme.TABLE, GroupScheme.SCHEME,
        {
            instanceMethods: {
                countTask: function(){

                }
            }
        });

    Group.createGroup = function(name, color, transaction){
        return new Promise(function(resolve, reject){
            return Group.create({
                group_name : name,
                revision : 0,
                created_date : Date.now(),
                last_mod_date : Date.now(),
                repository : BUCKET_INFO,
                color : color
            }, {transaction: transaction}).then(function(group){
                resolve(group);
            }).catch(function(err){
                log.error("Group#createGroup/Internal Database(RDBMS) error", {err :err});
                reject(AppError.throwAppError(500));
            });
        })
    };

    Group.createDeltaWithTransaction = function(group, revision, data, transaction){
        return new Promise(function(resolve, reject){
            var formattedData = JSON.stringify(data);
            return group.createDelta({
                revision : revision,
                data : formattedData
            }, {transaction : transaction}).then(function(delta){
                resolve(delta);
            }).catch(function(err){
                log.error("Group#createDeltaWithTransaction/Internal Database(RDBMS) error", {err :err});
                reject(AppError.throwAppError(500));
            });
        })
    };

    Group.commitApply = function(group, revision, transaction){
        return new Promise(function(resolve, reject){
            return group.update({
                revision : revision
            }, {transaction : transaction}).then(function(){
                resolve();
            }).catch(function(err){
                log.error("Group#commitApply/Internal Database(RDBMS) error", {err :err});
                reject(AppError.throwAppError(500));
            })
        })
    };

    Group.commitApply2 = function(group, revision, commitNodeInfo, transaction){
        return new Promise(function(resolve, reject){
            Group.createDeltaWithTransaction(group, revision, commitNodeInfo, transaction).then(function(delta){
                return group.update({
                    revision: revision
                }, {transaction : transaction}).then(function(){
                    resolve();
                }).catch(function(err){
                    reject(err);
                })
            }).catch(function(err){
                reject(err);
            })
        })
    };

    Group.findGroupById = function(gid){
        return new Promise(function(resolve, reject){
            return Group.findById(gid).then(function(group){
                if(!group){
                    return reject(AppError.throwAppError(404));
                }
                resolve(group);
            }).catch(function(err){
                log.error("Group#findGroupById/Internal Database(RDBMS) error", {err :err});
                return reject(AppError.throwAppError(500));
            });

        })
    };

    Group.updateGroupName = function(group, newName){
        return new Promise(function(resolve, reject){
            return group.update({
                group_name : newName
            }).then(function(){
		group.group_name = newName
                resolve(group);
            }).catch(function(err){
                log.error("Group#updateGroupName/Internal Database(RDBMS) error", {err :err});
                reject(AppError.throwAppError(500));
            })
        })
    };

    Group.getMemberList = function(gid){
        return new Promise(function(resolve, reject){
            return Group.findGroupById(gid).then(function(group){
                group.getUsers().then(function(users){
                    resolve(users);
                }).catch(function(err){
                    reject(AppError.throwAppError(500));
                })
            }).catch(function(err){
                log.error("Group#getMemberList/Internal Database(RDBMS) error", {err :err});
                reject(AppError.throwAppError(500));
            })
        })
    };

    Group.addMember = function(gid, user, fn){
        return new Promise(function(resolve, reject){
            return Group.authenticate(gid, user.id).then(function(group){
                group.addUser(user).then(function(){
                    resolve(group);
                }).catch(function(err){
                    log.error("Group#addMember/Internal Database(RDBMS) error", {err :err});
                    reject(AppError.throwAppError(500));
                })
            }).catch(function(err){
                reject(err);
            })
        })
    };

    Group.deleteMember = function(gid, user, fn){
        return new Promise(function(resolve, reject){
            return Group.findById(gid).then(function(group){
                if(!group){
                    return reject(AppError.throwAppError(404));
                }
                return group.removeUser(user).then(function(){
                    resolve(group);
                }).catch(function(err){
                    log.error("Group#deleteMember/Internal Database(RDBMS) error", {err :err});
                    reject(AppError.throwAppError(500));
                })
            })
        })
    };

    Group.getInviteUrl = function(uid, gid) {
        var baseUrl = HOST_URI;
        baseUrl += "/api/invite";
        baseUrl += "/".concat(gid);
        baseUrl += "?".concat("from").concat("=").concat(uid);

        return baseUrl;
    };

    Group.getMemberProfile = function(group){
        return new Promise(function(resolve, reject){
            //권한 체크 안함
            return group.getUsers().then(function(users){
                var result = {
                    count : 0,
                    user_info : []
                };
                users.forEach(function(user){
                    result.count++;
                    result.user_info.push({
                        uid : user.id,
                        nickname : user.nickname,
                        pic_s3path : user.profile_path
                    });
                });
                resolve(result);
            }).catch(function(err){
                log.error("Group#getMemberProfile/Internal Database(RDBMS) error", {err :err});
                reject(AppError.throwAppError(500));
            });
        })
    };

    Group.getDeltaByGidAndRevision = function(gid, rev, fn){
        return new Promise(function(resolve, reject){
            return Group.findGroupById(gid).then(function(group){
                group.getDeltas({
                    where : {
                        revision : rev
                    }
                }).then(function(deltas){
                    if(deltas.length === 0){
                        return reject(AppError.throwAppError(404));
                    }
                    resolve(deltas[0]);
                });
            }).catch(function(err){
                log.error("Group#getDeltaByGidAndRevision/Internal Database(RDBMS) error", {err :err});
                reject(err);
            });
        })
    };

    Group.getDeltaSet = function(group, traversalInfo){
        return new Promise(function(resolve, reject){
            if (traversalInfo.backward.length > 0 && traversalInfo.forward.length > 0) {
                group.getDeltas({
                    where: {
                        revision: {
                            $in: traversalInfo.backward
                        }
                    }
                }).then(function (backwards) {
                    if (backwards.length !== traversalInfo.backward.length) {
                        log.error("Group#getDeltaSet/DB actually delta info is not equal with expected info", {err: err}, {group: group.id});
                        return reject(AppError.throwAppError(500));
                    }

                    //Delta serialize (JSON -> Array)
                    backwards.forEach(function (bDelta) {
                        bDelta.data = JSON.parse(bDelta.data);
                    });

                    group.getDeltas({
                        where: {
                            revision: {
                                $in: traversalInfo.forward
                            }
                        }
                    }).then(function (forwards) {
                        if (forwards.length !== traversalInfo.forward.length) {
                            log.error("Group#getDeltaSet/DB actually delta info is not equal with expected info", {err: err}, {group: group.id});
                            return reject(AppError.throwAppError(500));
                        }

                        //Delta serialize (JSON -> Array)
                        forwards.forEach(function (fDelta) {
                            fDelta.data = JSON.parse(fDelta.data);
                        });

                        resolve({
                            backward: backwards,
                            forward: forwards
                        });
                    }).catch(function (err) {
                        reject(AppError.throwAppError(500));
                    });
                }).catch(function (err) {
                    log.error("Group#getDeltaSet/Internal Database(RDBMS) error", {err: err});
                    reject(AppError.throwAppError(500));
                })

            } else if (traversalInfo.backward.length > 0 && !(traversalInfo.forward.length > 0)) {
                group.getDeltas({
                    where: {
                        revision: {
                            $in: traversalInfo.backward
                        }
                    }
                }).then(function (backwards) {
                    if (backwards.length !== traversalInfo.backward.length) {
                        log.error("Group#getDeltaSet/DB actually delta info is not equal with expected info", {err: err}, {group: group.id});
                        return reject(AppError.throwAppError(500));
                    }

                    backwards.forEach(function (bDelta) {
                        bDelta.data = JSON.parse(bDelta.data);
                    });

                    resolve({
                        backward: backwards,
                        forward: []
                    });

                }).catch(function (err) {
                    log.error("Group#getDeltaSet/Internal Database(RDBMS) error", {err: err});
                    reject(AppError.throwAppError(500));
                })

            } else {
                group.getDeltas({
                    where: {
                        revision: {
                            $in: traversalInfo.forward
                        }
                    }
                }).then(function (forwards) {
                    if (forwards.length !== traversalInfo.forward.length) {
                        log.error("Group#getDeltaSet/DB actually delta info is not equal with expected info", {err: err}, {group: group.id});
                        return reject(AppError.throwAppError(500));
                    }

                    forwards.forEach(function (fDelta) {
                        fDelta.data = JSON.parse(fDelta.data);
                    });

                    resolve({
                        backward: [],
                        forward: forwards
                    });
                }).catch(function (err) {
                    log.error("Group#getDeltaSet/Internal Database(RDBMS) error", {err: err});
                    reject(AppError.throwAppError(500));
                })
            }
        })
    };


    Group.getDeltaSetWithTransaction = function(group, traversalInfo, transaction){
        if(traversalInfo.backward.length > 0 && traversalInfo.forward.length > 0) {
            return new Promise(function(resolve, reject){
                return group.getDeltas({
                    where: {
                        revision: {
                            $in: traversalInfo.backward
                        }
                    }
                }, {transaction: transaction}).then(function (backwards) {
                    if (backwards.length !== traversalInfo.backward.length) {
                        log.error("Group#getDeltaSet/DB actually delta info is not equal with expected info", {err :err}, {group : group.id});
                        return reject(AppError.throwAppError(500));
                    }

                    //Delta serialize (JSON -> Array)
                    backwards.forEach(function(bDelta){
                        bDelta.data = JSON.parse(bDelta.data);
                    });

                    return group.getDeltas({
                        where: {
                            revision: {
                                $in: traversalInfo.forward
                            }
                        }
                    }).then(function (forwards) {
                        if (forwards.length !== traversalInfo.forward.length) {
                            log.error("Group#getDeltaSet/DB actually delta info is not equal with expected info", {err :err}, {group : group.id});
                            return reject(AppError.throwAppError(500));
                        }
                        //Delta serialize (JSON -> Array)
                        forwards.forEach(function(fDelta){
                            fDelta.data = JSON.parse(fDelta.data);
                        });

                        return resolve({
                            backward: backwards,
                            forward: forwards
                        });
                    }).catch(function (err) {
                        log.error("Group#getDeltaSet/Internal Database(RDBMS) error", {err :err});
                        return reject(AppError.throwAppError(500));
                    })
                }).catch(function (err) {
                    log.error("Group#getDeltaSet/Internal Database(RDBMS) error", {err :err});
                    return reject(AppError.throwAppError(500));
                })
            })
        } else if(traversalInfo.backward.length > 0 && !(traversalInfo.forward.length > 0)){
            return new Promise(function(resolve, reject){
                return group.getDeltas({
                    where : {
                        revision: {
                            $in : traversalInfo.backward
                        }
                    }
                }).then(function(backwards){
                    if(backwards.length !== traversalInfo.backward.length){
                        log.error("Group#getDeltaSet/DB actually delta info is not equal with expected info", {err :err}, {group : group.id});
                        return reject(AppError.throwAppError(500));
                    }

                    backwards.forEach(function(bDelta){
                        bDelta.data = JSON.parse(bDelta.data);
                    });

                    return resolve({
                        backward: backwards,
                        forward: []
                    });
                }).catch(function(err){
                    log.error("Group#getDeltaSet/Internal Database(RDBMS) error", {err :err});
                    return reject(AppError.throwAppError(500));
                })
            })
        } else {
            return new Promise(function(resolve, reject){
                return group.getDeltas({
                    where : {
                        revision: {
                            $in : traversalInfo.forward
                        }
                    }
                }).then(function(forwards){
                    if(forwards.length !== traversalInfo.forward.length){
                        log.error("Group#getDeltaSet/DB actually delta info is not equal with expected info", {err :err}, {group : group.id});
                        return reject(AppError.throwAppError(500));
                    }

                    forwards.forEach(function(fDelta){
                        fDelta.data = JSON.parse(fDelta.data);
                    });

                    return resolve({
                        backward: [],
                        forward: forwards
                    });
                }).catch(function(err){
                    log.error("Group#getDeltaSet/Internal Database(RDBMS) error", {err :err});
                    return reject(AppError.throwAppError(500));
                })
            });
        }
    };

    return Group;
};

