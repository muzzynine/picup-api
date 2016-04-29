/**
 * Created by impyeong-gang on 2/11/16.
 */
var Promise = require('bluebird');
var dbInit = require('../../model_migration');
var Group = dbInit.group;
var Node = require('../../model_migration/node');
var NodeMeta = require('../../model_migration/nodeMeta');
var NodeDelta = require('../../model_migration/nodeDelta');
var Sync = require('../../lib/sync');
var UUID = require('node-uuid');
var should = require('should');
var _ = require('lodash');

var testNodeInstantiateMany = function(num, presence){
    var forSave = [];
    for(var i = 0 ; i < num; i++){
        var testNode = new Node(
            "testNode" + i + Date.now(),
            "testGroup" + i + Date.now(),
            "testRelPath" + i + Date.now(),
            "testKind",
            Date.now(),
            presence || "testPresnce",
            "testName",
            "testOwner",
            "testAuthor",
            "testS3Path",
            "testS3ThumbnailPath",
            "testExif",
            Date.now(),
            Date.now(),
            Date.now()
        );
        forSave.push(testNode);
    }
    return forSave;
};

var testNodeInstantiateOne = function(presence){
    return new Node(
        "testNode" + Date.now(),
        "testGroup" + Date.now(),
        "testRelPath" + Date.now(),
        "testKind",
        Date.now(),
        presence || "testPresnce",
        "testName",
        "testOwner",
        "testAuthor",
        "testS3Path",
        "testS3ThumbnailPath",
        "testExif",
        Date.now(),
        Date.now(),
        Date.now()
    );
};

describe('Node - node dao(contain meta, delta)', function(){
    this.timeout(5000);
    describe.skip('#generateNodeInfo', function(){
        it("good test case", function(){
            var deltaArray = [];

            var gid = UUID.v1();
            function obj(gid, relPath, presence, kind, name, s3path){
                return {
                    gid : gid,
                    relPath : relPath,
                    presence : presence,
                    kind : kind,
                    name : name,
                    s3Path : s3path
                }
            }

            deltaArray.push(obj(gid, "node1", "add", "dir", "hello", "default"));
            deltaArray.push(obj(gid, "node2", "add", "file", "hello", "bigfrog.picup.bakkess/node2/node2"));
            deltaArray.push(obj(gid, "node3", "add", "dir", "hello", "bigfrog.picup.bakkess/node3/node3"));
            deltaArray.push(obj(gid, "node4", "add", "dir", "hello", "bigfrog.picup.bakkess/node3/node3"));
            deltaArray.push(obj(gid, "node5", "replace", "dir", "jaebal", "default"));
            deltaArray.push(obj(gid, "node6", "delete", "file"));

            var newDeltaArray = Node.generateNodeInfo(deltaArray, "test_user", gid, 5);
            newDeltaArray.should.have.length(6);
        });
    });

    describe.skip('Node#incrementRevi22sion', function(){
        var testNode = testNodeInstantiateOne();

        it('It works for me', function(){
            var oldRevision = testNode.revision;
            testNode.incrementRevision();
            testNode.revision.should.equal(oldRevision + 1);
        });
    });

    describe.skip('#addNodeBatch', function(){
        var testNodeSize = 100;
        var testNodeSize2 = 200;
        var toSaveNode = testNodeInstantiateMany(testNodeSize, "add");
        var toSaveNode2 = testNodeInstantiateMany(testNodeSize2, "add");

        it('It works for me(node size 100)', function(done){
            return Node.addNodeBatch(toSaveNode).then(function(added){
                if(added.length === testNodeSize) return done();
                done(new Error("Test failed. expected " + testNodeSize + ", actual " + added.length));
            }).catch(function(err){
                done(err);
            });
        });

        it('It works for me(node size > 100', function(done){
            return Node.addNodeBatch(toSaveNode2).then(function(added){
                if(added.length === testNodeSize2) return done();
                done(new Error("Test failed. expected " + testNodeSize2 + ", actual " + added.length));
            }).catch(function(err){
                done(err);
            });
	});
    });

    describe.skip('#replaceNodeBatch', function(){
        var testNode;
        var testNodeSize = 3;
        var testNode2;

        before(function(done){
            testNode = testNodeInstantiateMany(testNodeSize, "add");
            testNode2 = testNodeInstantiateMany(testNodeSize, "add");

            return Node.addNodeBatch(testNode).then(function(saved){
                testNode = saved;
                return Node.addNodeBatch(testNode2).then(function(saved2){
                    testNode2 = saved2;
                    done();
                })
            }).catch(function(err){
                done(err);
            });
        });

        it('It works for me (New revision delta add)', function(done){
            var clone = testNode.slice(0);
            _.forEach(clone, function(node){
               node.revision += 2;
                node.presence = "replace";
            });

            return Node.replaceNodeBatch(clone).then(function(replaced){
                var jobs = [];
                _.forEach(replaced, function(node){
                    jobs.push(NodeMeta.getNodeMetaByIds(node.gid, node.nid));
                    jobs.push(NodeDelta.getNodeDeltaByNidAndRev(node.nid, node.revision));
                    var found = _.find(clone, {nid : node.nid});
                    jobs.push(NodeDelta.getNodeDeltaByNidAndRev(found.nid, found.revision));
                });

                Promise.settle(jobs).then(function(results){
                    _.forEach(results, function(result){
                        if(!result.isFulfilled()){
                            return done(new Error(result.reason()));
                        }
                    });
                    done();
                })

            })
        });

        it('It works for me(If same revision, Upsert)', function(done){
            var clone = testNode2.slice(0);
            _.forEach(clone, function(node){
                node.revision += 2;
                node.presence = "replace";
            });

            return Node.replaceNodeBatch(clone).then(function(replaced){
                replaced[0].name = "replaced";
                replaced[1].revision += 2;
                replaced[2].revision += 2;
                return Node.replaceNodeBatch(replaced).then(function(replaced2){
                    var immutable = _.find(replaced2, {gid : replaced[0].gid, nid : replaced[0].nid, revision : replaced[0].revision});
                    if(immutable && immutable.name == "replaced" && replaced2.length === testNodeSize) done();
                    else throw "Test failed";
                })
            }).catch(function(err){
                done(err);
            })
        })
    })

    describe.skip('#deleteNodeBatch', function(){
        //#deleteNodeBatch is same logic with #replaceNodeBatch
    });

    describe('#getAliveNodes3', function(){
	var addNode = [];
	var deleteNode = [];
	var replaceNode = [];
	var replaceNode2 = [];
	var prepare = [];
	var prevNode = [];
	
	var testGroup = Group.build({
	    group_name : "testGroup",
	    revision : 0,
	    created_date : Date.now(),
	    repository : "testRepo",
	    color : 1,
	    last_mod_date : Date.now()
	});

	var dupNodeId1 = UUID.v1();
	var dupNodeId2 = UUID.v1();
	var dupNodeId3 = UUID.v1();
	var dupNodeId4 = UUID.v1();
	var dupNodeId5 = UUID.v1();
	

	prepare.push(
	    new Node(dupNodeId5, testGroup.id, "testRelPath5", "file", 1, Sync.PRESENCE_ADD, null, null, "testAuthor"),
	    new Node(dupNodeId4, testGroup.id, "testRelPath4", "file", 1, Sync.PRESENCE_ADD, null, null, "testAuthor")
	);
	

	addNode.push(
	    new Node(dupNodeId1, testGroup.id, "testRelPath1", "file", 1, Sync.PRESENCE_ADD, null, null, "testAuthor"),
	    new Node(dupNodeId2, testGroup.id, "testRelPath2", "file", 1, Sync.PRESENCE_ADD, null, null, "testAuthor"),
	    new Node(dupNodeId3, testGroup.id, "testRelPath3", "file", 1, Sync.PRESENCE_ADD, null, null, "testAuthor")
	);

	deleteNode.push(
	    new Node(dupNodeId1, testGroup.id, "testRelPath1", "file", 2, Sync.PRESENCE_DELETE, null, null, "testAuthor"),
	    new Node(dupNodeId4, testGroup.id, "testRelPath4", "file", 3, Sync.PRESENCE_DELETE, null, null, "testAuthor"),
	    new Node(dupNodeId3, testGroup.id, "testRelPath3", "file", 3, Sync.PRESENCE_DELETE, null, null, "testAuthor")
	);
	    
	replaceNode.push(
	    new Node(dupNodeId2, testGroup.id, "testRelPath2", "file", 2, Sync.PRESENCE_REPLACE, null, null, "testAuthor"),
	    new Node(dupNodeId3, testGroup.id, "testRelPath3", "file", 2, Sync.PRESENCE_REPLACE, null, null, "testAuthor")
	);

	replaceNode2.push(
	    new Node(dupNodeId5, testGroup.id, "testRelPath5", "file", 4, Sync.PRESENCE_REPLACE, null, null, "testAuthor"),
	    new Node(dupNodeId2, testGroup.id, "testRelPath2", "file", 3, Sync.PRESENCE_REPLACE, null, null, "testAuthor")
	);

	before(function(done){
	    Node.saveNodeBatch(prepare).then(function(){
		
		return Node.saveNodeBatch(addNode).then(function(savedAdd){
		    _.forEach(savedAdd, function(node){
			prevNode.push({
			    nid : node.nid,
			    revision : node.revision
			});
		    });
		    return Node.saveNodeBatch(deleteNode).then(function(savedDelete){
			_.forEach(savedDelete, function(node){
			    prevNode.push({
				nid : node.nid,
				revision : node.revision
			    });
			});

			return Node.saveNodeBatch(replaceNode).then(function(savedReplace){
			    _.forEach(savedReplace, function(node){
				prevNode.push({
				    nid : node.nid,
				    revision : node.revision
				});
			    });
			    return Node.saveNodeBatch(replaceNode2).then(function(savedReplace2){
				_.forEach(savedReplace2, function(node){
				    prevNode.push({
					nid : node.nid,
					revision : node.revision
				    });
				});
				done();
			    });
			});
		    });
		})
	    }).catch(function(err){
		done(err);
	    });
	});

	it('Its works for me', function(done){
	    var toCommit = [new Node(UUID.v1(), testGroup.id, "testRelPath6", "file", 5, Sync.PRESENCE_ADD)];
	    var expected = [];
	    expected.push(addNode[0], deleteNode[0], addNode[1], replaceNode2[1], addNode[2], deleteNode[2], deleteNode[1], replaceNode2[0], toCommit[0]);

	    Node.getAliveNodes3(prevNode, toCommit).then(function(result){
		expected = _.map(expected, function(node){
		    return {
			nid : node.nid,
			revision : node.revision
		    }
		});

		function sortBy(a, b){
		    if(a.revision > b.revision){
			return 1;
		    }
		    if(a.revision < b.revision){
			return -1;
		    }
		    else return 0;
		}
		
		if(_.isEqual(expected.sort(sortBy), result.sort(sortBy))) return done()
		 
		throw new Error("Test failed. expected " + expected.toString() + " But actual " + result.toString());
	    }).catch(function(err){
		done(err);
	    });
	});						
    });


    describe.skip('#saveNodeBatch', function(){
	var testNodeCount = 50;
        var nodeChunkedSize = 20;
        var toAddNode = testNodeInstantiateMany(testNodeCount, "add");

	before(function(done){
	    return Node.saveNodeBatch(toAddNode).then(function(saved){
		done();
	    }).catch(function(err){
		console.log(err);
		done(err);
	    });
	});

	/* IWFM에 대한 테스트 슈트는 이미 DB에 저장한 노드들을
	 * 대상으로 변경할 노드, 삭제할 노드, Upsert할 노드들을 나눈
	 * 후 해당 목적에 따라 변경을 가하고, #saveNodeBatch를 한
	 * 후에, 변경이 적용되었는지 확인하는 방식으로 진행한다. */
	it('It works for me', function(done){
	    //Replace, Delete, Upsert 할 노드들을 분류함.
            var chunked =_.chunk(toAddNode, nodeChunkedSize);
            var toReplaceNode = chunked[0];
            var toDeleteNode = chunked[1];
            var toUpsertNode = chunked[2];

	    var replaceNode = toReplaceNode.slice(0);
	    var deleteNode = toDeleteNode.slice(0);
	    var upsertNode = toUpsertNode.slice(0);

	    //해당 Presence에 따라 정보를 변경한다. 동시에 델타 키들을 추후에 find에 쓰기위해 분류하여 저장한다.
            _.forEach(toReplaceNode, function(node){
                node.presence = "replace";
                node.revision += 1;
            });

            _.forEach(toDeleteNode, function(node){
                node.presence = "delete";
                node.revision += 1;
            });

            _.forEach(toUpsertNode, function(node){
                node.name = "upsert";
            });

	    //Test
            return Node.saveNodeBatch(_.concat(toReplaceNode, toDeleteNode, toUpsertNode)).then(function(saved){
	        var addedNode = [];  
                var replacedNode = [];
                var deletedNode = [];

                _.forEach(saved, function(savedNode){
                    if(savedNode.presence === "replace") {
			replacedNode.push(savedNode);
		    }
                    else if(savedNode.presence === "delete") {
			deletedNode.push(savedNode);
                    }
		    else addedNode.push(savedNode);
                });
		
		return NodeDelta.getNodeDeltaByNidAndRevBatch(replaceNode).then(function(replaceBefore){
		    return NodeDelta.getNodeDeltaByNidAndRevBatch(deleteNode).then(function(deleteBefore){
			return NodeDelta.getNodeDeltaByNidAndRevBatch(upsertNode).then(function(upsert){
			    if(replaceBefore.length === replacedNode.length &&
			       deleteBefore.length === deletedNode.length &&
			       upsert.length === addedNode.length){

				_.forEach(upsertNode, function(node){
				    if(node.name !== 'upsert'){
					return done(
					    new Error("Test failed. expected 'upsert' name, But actual" + node.name + " name")
					)
				    }
				});

				return done();				
			    } 
			    done(new Error("Test failed. expected " +
					   " replace : " + replaceBefore.length +
					   " delete : " + deleteBefore.length +
					   " upsert : " + upsert.length +
					   ", But actual " +
					   " replace : " + replacedNode.length +
					   " delete : " + deletedNode.length +
					   " upsert : " + addedNode.length));
			});
		    });
		});
            }).catch(function(err){
                done(err);
            })
        })
    })
});
