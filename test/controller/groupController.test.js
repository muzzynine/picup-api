var Promise = require('bluebird')
var _ = require('lodash')
var db = require('../../model_migration');
var Node = require('../../model_migration/node');
var groupController = require('../../controller/groupController');
var sync = require('../../lib/sync');
var logger = require('../../lib/logger')

describe('groupController - businessLogic for group job', function(){
    this.timeout(5000);
    var testUser;
    
    before(function(done){
	return db.user.create({
	    nickname : "test",
	    profile_path : "test"
	}).then(function(user){
	    testUser = user
	    done();
	}).catch(function(err){
	    done(err)
	});
    });
	
    describe('#createGroup - Create new group', function(){
	it('It works for me', function(done){
	    groupController.createGroup(testUser, "testGroup", 0, db).then(function(group){
		return db.user.getGroup(testUser, group.id).then(function(group){
		    if(group.group_name === "testGroup" && group.color === 0){
			return  done()
		    }
		    throw "Test Failed. expected group_name : testGroup, color 0, But actual group_name : " + group.group_name + " color : " + group.color
		});
	    }).catch(function(err){
		done(err);
	    });
	});
    });

    describe('#updateGroupName - group name change', function(){
	var testGroup;
	
	before(function(done){
	    groupController.createGroup(testUser, "testGroup", 0, db).then(function(group){
		testGroup = group;
		done();
	    }).catch(function(err){
		done(err);
	    });
	});
	
	it('It works for me', function(done){
	    groupController.updateGroupName(testUser, testGroup.id, "testNewGroup", db).then(function(group){
		return db.user.getGroup(testUser, group.id).then(function(found){
		    if(found.group_name === "testNewGroup") {
			return done()
		    }
		    throw "Test Failed. expected group_name : " + "testNewGroup" + ", But acutal group_name : " +found.group_name;
		});
	    }).catch(function(err){
		done(err)
	    });
	});
    });

    describe('#commitInternal - commit new delta for group', function(){
	var testGroup;
	var numberOfTestCase1 = 3;
	var numberOfTestCase2 = 3;

	before(function(done){
	    groupController.createGroup(testUser, "testGroup", 0, db).then(function(group){
		testGroup = group;
		done();
	    }).catch(function(err){
		done(err);
	    });
	});

	it('It works for me. Init commit (0 -> 1)', function(done){
	    var nodeArray = [];
	    var revision = 1;

	    for(var i = 0; i < numberOfTestCase1 ; i++) {
		nodeArray.push(new Node(null, testGroup.id, "testNodeRelPath"+i, "file", revision-1, sync.PRESENCE_ADD,"testNodeName"+i, testUser.id, testUser.id, "testNodeS3Path", "testNodeThumbnailPath"+i, null, Date.now(), Date.now(), Date.now()));
	    }

	    groupController.commitInternal2(testUser, testGroup.id, revision-1, nodeArray, db).then(function(commitResult){
		if(commitResult.uid === testUser.id && commitResult.group === testGroup.id && commitResult.revision === revision && commitResult.delta.length === numberOfTestCase1){
		    return done();
		}
		throw new Error("Test failed. expected {uid : " + testUser.id + ", group id : " + testGroup.id + ", revision : " + revision + ", length of delta : " + numberOfTestCase1 + "), But actual {uid : " + commitResult.uid + ", group id : " + commitResult.group + ", revision : " + commitResult.revision + ", length of delta : " + commitResult.delta.length)
	    }).catch(function(err){
		done(err);
	    });
	});

	it('It works for me. long commit (0 -> 2)', function(done){
	    var nodeArray = [];
	    var revision = 2;

	    for(var i = 0; i < numberOfTestCase2 ; i++){
		nodeArray.push(new Node(null, testGroup.id, "testNodeRelPath"+i, "file", revision-1, sync.PRESENCE_ADD,"testNodeName"+i, testUser.id, testUser.id, "testNodeS3Path", "testNodeThumbnailPath"+i, null, Date.now(), Date.now(), Date.now()));
	    }

	    
	    groupController.commitInternal2(testUser, testGroup.id, revision-1, nodeArray, db).then(function(commitResult){
		if(commitResult.uid === testUser.id && commitResult.group === testGroup.id && commitResult.revision === revision && commitResult.delta.length === numberOfTestCase2){
		    return done();
		}
		throw new Error("Test failed. expected {uid : " + testUser.id + ", group id : " + testGroup.id + ", revision : " + revision + ", length of delta : " + (numberOfTestCase1 + numberOfTestCase2) + "), But actual {uid : " + commitResult.uid + ", group id : " + commitResult.group + ", revision : " + commitResult.revision + ", length of delta : " + commitResult.delta.length)
	    }).catch(function(err){
		done(err);
	    });
	});
    });

    describe('#update - get between src to dst delta for update', function(done){
	var testGroup;

	before(function(done){
	    groupController.createGroup(testUser, "testGroup", 0, db).then(function(group){
		testGroup = group;
		done();
	    }).catch(function(err){
		done(err);
	    });
	});

	it('pass wrong argument(src revision is wrong)', function(done){
	    groupController.update(testUser, testGroup.gid, null, 3, db).then(function(){
		done(new Error("Test failed. expected err, but it works"));
	    }).catch(function(err){
		if(err.errorCode === 400) return done();
		done(new Error("Test failed. expected 400 err, but throw " + err.errorCode + " err"));
	    });
	});

	it('pass wrong argument(dst revision is wrong)', function(done){
    	    groupController.update(testUser, testGroup.gid, 0, null, db).then(function(){
		done(new Error("Test failed. expected err, but it works"));
	    }).catch(function(err){
		if(err.errorCode === 400) return done();
		done(new Error("Test failed. expected 400 err, but throw " + err.errorCode + " err"));
	    });
	});

	it('pass wrong argument(src > dst)', function(done){
	    groupController.update(testUser, testGroup.gid, 1, 0, db).then(function(){
		done(new Error("Test failed. expected err, but it works"));
	    }).catch(function(err){
		if(err.errorCode === 400) return done();
		done(new Error("Test failed. expected 400 err, but throw " + err.errorCode + " err"));
	    });
	});

	var numberOfRevision0 = 3;
	var numberOfRevision1 = 3;
	var nodeRevision0 = [];
	var nodeRevision1 = [];

	it('It works for me(0 -> 1 update)', function(done){
	    for(var i = 0; i < numberOfRevision0; i++){
		nodeRevision0.push(new Node(null, testGroup.id, "testNodeRelPath"+i, "file", 0, sync.PRESENCE_ADD,"testNodeName"+i, testUser.id, testUser.id, "testNodeS3Path", "testNodeThumbnailPath"+i, null, Date.now(), Date.now(), Date.now()));
	    }

	    return groupController.commitInternal2(testUser, testGroup.id, 0, nodeRevision0, db).then(function(commitInfo){
		return groupController.update(testUser, testGroup.id, 0, 1, db).then(function(delta){
		    if(delta.gid === testGroup.id && delta.delta.length === numberOfRevision0 && delta.revision === 1){
			return done();
		    }
		    throw new Error("Test failed. expected gid : " + testGroup.id + ", revision : 1, delta length : " + numberOfRevision0 + ", but acutal gid : " + delta.gid + ", revision : " + delta.revision + ", delta length : " + delta.delta.length)
		});
	    }).catch(function(err){
		done(err)
	    });	
	});

	it('It works for me(0 -> 2 update)', function(done){	    
	    for(var i = 0; i < numberOfRevision1; i++){
		nodeRevision1.push(new Node(null, testGroup.id, "testNodeRelPath"+i, "file", 0, sync.PRESENCE_ADD,"testNodeName"+i, testUser.id, testUser.id, "testNodeS3Path", "testNodeThumbnailPath"+i, null, Date.now(), Date.now(), Date.now()));
	    }

	    return groupController.commitInternal2(testUser, testGroup.id, 1, nodeRevision1, db).then(function(commitInfo){
		return groupController.update(testUser, testGroup.id, 0, 2, db).then(function(delta){
		    if(delta.gid === testGroup.id && delta.delta.length === (numberOfRevision0 + numberOfRevision1) && delta.revision === 2){
			return done();
		    }
		    throw new Error("Test failed. expected gid : " + testGroup.id + ", revision : 2, delta length : " + (numberOfRevision0 + numberOfRevision1) + ", but acutal gid : " + delta.gid + ", revision : " + delta.revision + ", delta length : " + delta.delta.length)
		});
	    }).catch(function(err){
		done(err)
	    });
	});	
    });
});
