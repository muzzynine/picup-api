/**
 * Created by impyeong-gang on 2/11/16.
 */
var dbInit = require('../../model_migration');
var NodeDelta = require('../../model_migration/nodeDelta');
var should = require('should');
var _ = require('lodash');

var testNodeDeltaInstantiateMany = function(num){
    var forSave = [];
    for(var i = 0 ; i < num; i++){
        var testNode = new NodeDelta({
            nid: "testNid" + i + Date.now(),
            revision: i,
            presence: "testPresence" + i + Date.now(),
            s3Path : "testS3Path"
        });
        forSave.push(testNode);
    }
    return forSave;
};

var testNodeDeltaInstantiateOne = function(){
    return new NodeDelta({
        nid: "testNid" + Date.now(),
        revision: 1,
        presence: "testPresence" + Date.now(),
        s3Path : "testS3Path"
    });
};

describe('NodeDelta - node delta dao', function(){
    this.timeout(5000);
    
    describe('#getLatestNodeDelta', function(){
        var nodeDelta = testNodeDeltaInstantiateOne();

        before(function(done){
            NodeDelta.create(nodeDelta, function(err){
                if(err) return done(err);
                else done();
            })
        });

        after(function(done){
            NodeDelta.delete(nodeDelta, function(err){
                if(err) return done(err);
                else done();
            })
        });

        it('it works for me', function(done){
            NodeDelta.getLatestNodeDelta(nodeDelta.nid).then(function(delta){
                done();
            }).catch(function(err){
                done(err);
            })
        })

        it('not exist node delta(not exist nid)', function(done){
            NodeDelta.getLatestNodeDelta("notExistNid").then(function(delta){
                done(new Error("Test failed. expected NotExistError, actual " + delta))
            }).catch(function(err){
                if(err.errorCode === 404) done();
                else done(new Error("Test failed. expected NotExistError, actual " + err))
            })
        })
    });

    describe('#getLatestNodeDeltaBatch', function(){
        var testNumberSize = 100;
        var nodeDeltas = testNodeDeltaInstantiateMany(testNumberSize);
        before(function(done){
            NodeDelta.batchPut(nodeDeltas, function(err, result){
                if(err) return done(err);
                else done();
            })
        });

        after(function(done){
            NodeDelta.batchDelete(nodeDeltas, function(err){
                if(err) return done(err);
                else done();
            })
        });

        it('it works for me', function(done){
            var testNidsArray = [];
            _.forEach(nodeDeltas, function(delta){
                testNidsArray.push({nid : delta.nid});
            });
            NodeDelta.getLatestNodeDeltaBatch(testNidsArray).then(function(nodeDeltas){
                if(nodeDeltas.length === testNumberSize) return done();
                else done(new Error("test failed. expected " + testNumberSize + ", actual " + nodeDeltas.length));
            }).catch(function(err){
                done(new Error("test failed, reasion " + err ));
            });
        })
    })

    describe('#getNodeDeltaByNidAndRev', function(){
        var nodeDelta = testNodeDeltaInstantiateOne();

        before(function(done){
            NodeDelta.create(nodeDelta, function(err){
                if(err) return done(err);
                else done();
            })
        });

        after(function(done){
            NodeDelta.delete(nodeDelta, function(err){
                if(err) return done(err);
                else done();
            })
        });

        it('it works for me', function(done){
            NodeDelta.getNodeDeltaByNidAndRev(nodeDelta.nid, nodeDelta.revision).then(function(nodeDelta){
                done();
            }).catch(function(err){
                done(err);
            })
        })

        it('not exist node delta(not exist nid)', function(done){
            NodeDelta.getNodeDeltaByNidAndRev("notExistNid", nodeDelta.revision).then(function(delta){
                done(new Error("Test failed. expected NotExistError, actual " + delta))
            }).catch(function(err){
                if(err.errorCode === 404) done();
                else done(new Error("Test failed. expected NotExistError, actual " + err))
            })
        })

        it('not exist node delta(not exist revision)', function(done){
            NodeDelta.getNodeDeltaByNidAndRev(nodeDelta.nid, Date.now()).then(function(delta){
                done(new Error("Test failed. expected NotExistError, actual " + delta))
            }).catch(function(err){
                if(err.errorCode === 404) done();
                else done(new Error("Test failed. expected NotExistError, actual " + err))
            })
        })
    });

    describe('#getNodeDeltaByBetweenRev', function(done){
        var nodeDelta = testNodeDeltaInstantiateOne();

        before(function(done){
            NodeDelta.create(nodeDelta, function(err){
                if(err) return done(err);
                else done();
            })
        });

        after(function(done){
            NodeDelta.delete(nodeDelta, function(err){
                if(err) return done(err);
                else done();
            })
        });

        it('It works for me', function(done){
            NodeDelta.getNodeDeltaByBetweenRev(nodeDelta.nid, 0, 8).then(function(delta){
                if(delta.length === 1) done();
                else done(new Error("test failed. expected 1 deltas, But actual " + delta.length + delta));
            }).catch(function(err){
                done(err);
            });
        });

        it('not exist node delta(find by nid)', function(done){
            NodeDelta.getNodeDeltaByBetweenRev("notExist", 0, 8).then(function(deltas){
                done(new Error("test failed, expected notExistError, actual " + deltas))
            }).catch(function(err){
                if(err.errorCode === 404) done();
                else done(err);
            })
        });

        it('not exist node delta between src to dst', function(done){
            NodeDelta.getNodeDeltaByBetweenRev(nodeDelta.nid, 4, 8).then(function(deltas){
                done(new Error("test failed, expected notExistError, actual " + deltas))
            }).catch(function(err){
                if(err.errorCode === 404) done();
                else done(err);
            })
        })
    })

    describe('#getNodeDeltaByBetweenRevBatch', function(){
        var numberOfTestNode = 100;
        var testNodes = testNodeDeltaInstantiateMany(numberOfTestNode);
        before(function(done){
            NodeDelta.batchPut(testNodes, function(err, result){
                if(err) return done(err);
                else done();
            })
        });

        after(function(done){
            NodeDelta.batchDelete(testNodes, function(err){
                if(err) return done(err);
                else done();
            })
        });

        it('It works for me', function(done){
            NodeDelta.getNodeDeltaByBetweenRevBatch(testNodes, -1, 100).then(function(found){
                if(found.length === numberOfTestNode) done();
                else done(new Error("Test failed. expected " + numberOfTestNode + ", actual " + found.length));
            }).catch(function(err){
                done(err);
            })
        });

        it('1 nodes not exist', function(done){
            NodeDelta.getNodeDeltaByBetweenRevBatch(testNodes, 0, 100).then(function(found){
                done(new Error("Test failed. expected NotExistResource, but actual " + found.toString()));
            }).catch(function(err){
                if(err.errorCode === 404) done();
                else done(new Error("Test failed. expected NotExistResource, but actual " + err));
            })
        })
    });

    describe('#addNodeDeltaBatch', function(done){
        var testCaseSize = 99;
        var toAddNodeArray;
        var toUpsertNode;
        var newOne;
        before(function(done){
            toAddNodeArray = testNodeDeltaInstantiateMany(testCaseSize);
            toUpsertNode = testNodeDeltaInstantiateOne();

            toUpsertNode.save(function(err){
                if(err) done(err);
                else done();
            })
        });

        after(function(done){
            var deleteNodes = _.concat(toAddNodeArray, toUpsertNode, newOne);
            NodeDelta.batchDelete(deleteNodes, function(err){
                if(err) done(err);
                else done();
            })
        });

        it('It works for me', function(done){
            NodeDelta.addNodeDeltaBatch(toAddNodeArray).then(function(){
                done();
            }).catch(function(err){
                done(err);
            })
        });

        it('Upsert well done', function(done){
            newOne = testNodeDeltaInstantiateOne();
            toUpsertNode.s3Path = "changed";
            NodeDelta.addNodeDeltaBatch([toUpsertNode, newOne]).then(function(){
                return NodeDelta.getNodeDeltaByNidAndRev(toUpsertNode.nid, toUpsertNode.revision).then(function(upserted){
                    return NodeDelta.getNodeDeltaByNidAndRev(newOne.nid, newOne.revision).then(function(added){
                        if(upserted.s3Path === "changed") done();
                        else done(new Error("Test failed. expected upsertNode's s3Path 'changed', saved exist, actual " + upserted.s3Path));

                    })
                })
            }).catch(function(err){
                done(err);
            })
        })
    })
});
