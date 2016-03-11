/**
 * Created by impyeong-gang on 2/11/16.
 */
'use strict'

var dbInit = require('../../model_migration');
var NodeMeta = require('../../model_migration/nodeMeta');
var should = require('should');
var _ = require('lodash');


var testNodeMetaInstantiateMany = function(num){
    var forSave = [];
    for(var i = 0 ; i < num; i++){
        var testNode = new NodeMeta({
            gid: "testGroup" + i + Date.now(),
            nid: "testNode" + i + Date.now(),
            relPath: "testRelPath" + i + Date.now(),
            kind: "testKind",
            author: "testAuthor"
        });
        forSave.push(testNode);
    }
    return forSave;
};

var testNodeMetaInstantiateOne = function(){
    return new NodeMeta({
        gid: "testGroup" + Date.now(),
        nid: "testNode" + Date.now(),
        relPath: "testRelPath" + Date.now(),
        kind: "testKind",
        author: "testAuthor"
    });
};

describe("nodeMeta - node's meta infomation dao", function(){
    describe('#findNodeById', function(){
        var testNode = testNodeMetaInstantiateOne();

        before(function(done){
            testNode.save(function(err){
                if(err){
                    return done(err);
                }
                done();
            })
        });

        after(function(done){
            testNode.delete(function(err){
                if(err){
                    return done(err);
                }
                done();
            })
        });

        it('it works for me', function(done){
            NodeMeta.getNodeMetaByIds(testNode.gid, testNode.nid).then(function(nodeMeta){
                done();
            }).catch(function(err){
                done(err);
            });
        });
    });

    describe('#findNodeByIdBatch', function(){
        var savedNodes;
        var testNodesNumber = 50;
        before(function(done){
            var nodes = testNodeMetaInstantiateMany(testNodesNumber);
            NodeMeta.batchPut(nodes, function(err){
                if(err){
                    return done(err);
                }
                savedNodes = nodes;
                done();
            })
        });

        after(function(done){
            NodeMeta.batchDelete(savedNodes, function(err){
                if(err){
                    return done(err);
                }
                done();
            })
        });

        it('it works for me', function(done){
            var source = savedNodes.slice(0);
            var testNodeArray = [];

            _.forEach(source, function(node){
                testNodeArray.push({gid : node.gid, nid : node.nid});
            });

            NodeMeta.getNodeMetaByIdsBatch(testNodeArray).then(function(nodes){
                if(nodes.length===testNodesNumber) done();
                else done(new Error("test failed : expected " + testNodesNumber + ", but actual " + nodes.length))
            }).catch(function(err){
                done(err);
            })
        });
    });

    describe('#getNodeMetaByGidAndRelPath', function(){
        var testNode = testNodeMetaInstantiateOne();

        before(function(done){
            testNode.save(function(err){
                if(err){
                    return done(err);
                }
                done();
            })
        });

        after(function(done){
            testNode.delete(function(err){
                if(err){
                    return done(err);
                }
                done();
            })
        });

        it('it works for me', function(done){
            NodeMeta.getNodeMetaByGidAndRelPath(testNode.gid, testNode.relPath).then(function(nodeMeta){
                done();
            }).catch(function(err){
                done(err)
            })
        })
    })

    describe('#getNodeMetaByGidAndRelPathBatch', function(){
        var testNodesNumber = 50;
        var savedNodes;

        before(function(done){
            var nodes = testNodeMetaInstantiateMany(testNodesNumber);
            NodeMeta.batchPut(nodes, function(err){
                if(err){
                    return done(err);
                }
                savedNodes = nodes;
                done();
            })
        });

        after(function(done){
            NodeMeta.batchDelete(savedNodes, function(err){
                if(err){
                    return done(err);
                }
                done();
            })
        });

        it('it works for me', function(done){
            var source = savedNodes.slice(0);
            var testNodeArray = [];

            _.forEach(source, function(node){
                testNodeArray.push({gid : node.gid, relPath : node.relPath});
            });

            NodeMeta.getNodeMetaByGidAndRelPathBatch(testNodeArray).then(function(nodes){
                if(nodes.length===testNodesNumber) done();
                else done(new Error("test failed : expected " + testNodesNumber + ", but actual " + nodes.length))
            }).catch(function(err){
                done(err);
            })
        })
    })

    describe('#addNodeMetaBatch', function(){
        var testNodeNumber = 100;
        var nodes;

        before(function(){
            nodes = testNodeMetaInstantiateMany(testNodeNumber);
        });

        after(function(done){
            NodeMeta.batchDelete(nodes, function(err){
                if(err){
                    return done(err);
                }
                done();
            })
        });

        it('it works for me', function(done){
            NodeMeta.addNodeMetaBatch(nodes).then(function(result){
                if(result.length === testNodeNumber) done();
                else done(new Error("error"));
            }).catch(function(err){
                done(err);
            })
        })
    })
});
