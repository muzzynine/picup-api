/**
 * Created by impyeong-gang on 12/21/15.
 */

var logger = require('../../lib/logger');
var Sync = require('../../lib/sync.js');
var should = require('should');

describe("Sync - syncronization module", function(){

    describe('#isBoundary', function(){
        it('1 revision calculate', function(){
            Sync.isBoundary(36, 37).should.be.equal(true);
        });
        it('another short prune revision calculate', function(){
            Sync.isBoundary(37, 43).should.be.equal(false);
        });
        it('zero revision caclulate', function(){
            Sync.isBoundary(0, 43).should.be.equal(false);
        });
        it('another far prune revision calculate', function(){
            Sync.isBoundary(32, 64).should.be.equal(false);
        });
    });

    describe('#getForwardRevision', function(){
        it('1 revision calculate', function(){
            Sync.getForwardRevision(36, 37).should.be.equal(37);
        });
        it('another prune calculate', function(){
            var result = Sync.getForwardRevision(32, 64);
            if(result !== null){
                throw new Error("test failed");
            }
        });
        it('zero revision calculate', function(){
            var result = Sync.getForwardRevision(0, 64);
            if(result !== null){
                throw new Error("test failed");
            }
        });
    });

    describe('#getRightmostToZero', function(){
        it('good case test', function(){
            var t_case = "1110110";
            Sync.getRightmostToZero(t_case).should.equal("1110100");
        });
    });

    describe('#getSkipDeltaNumber', function(){
        it('diff 1 delta number', function(){
            Sync.getSkipDeltaNumber(3).should.equal(2);
        });

        it('diff "to zero" delta number', function(){
            Sync.getSkipDeltaNumber(4).should.equal(0);
        });

        it('diff middle delta number', function(){
            Sync.getSkipDeltaNumber(12).should.equal(8);
        });
    });


    describe('#getDeltaList', function(){
        it('traverse short delta list', function(){
            var result = Sync.getDeltaList(4,5);
            result.should.deepEqual({
                backward : [],
                forward : [5]
            });
        });

        it('traverse middle delta list(no include 0 rev)', function(){
            var result = Sync.getDeltaList(39, 43);
            result.should.deepEqual({
                backward : [39, 38, 36],
                forward : [40, 42, 43]
            });
        });

        it('traverse long delta list(include 0 rev)', function(){
            var result = Sync.getDeltaList(3, 8);
            result.should.deepEqual({
                backward : [3, 2],
                forward : [8]
            });
        });

        it('traverse 0 start delta list', function(){
            var result = Sync.getDeltaList(0, 3);
            result.should.deepEqual({
                backward : [],
                forward : [2, 3]
            });
        });
    });


    describe('#S3PathGenerator', function(){
        it("good test case - file", function(){
            var bucketName = "bigfrog";
            var gid = 1;
            var relPath = "test";
            var type = "file";

            Sync.S3PathGenerator(bucketName, gid, relPath, type).should.equal("bigfrog/1/test");
        });

        it("good test case - dir", function(){
            var bucketName = "bigfrog";
            var gid = 1;
            var relPath = "test";
            var type = "dir";

            var url = Sync.S3PathGenerator(bucketName, gid, relPath, type);
            if(!url) throw new Error("test failed");

        });
    });

    describe('#S3PathSeparator', function(){
        it('good test case', function(){
            var s3uri = "bigfrog.picup.bakkess/hehehe/ehe/eew.jpg";
            var result = Sync.S3PathSeparator(s3uri);

            result.should.be.deepEqual({bucket : "bigfrog.picup.bakkess", key : "hehehe/ehe/eew.jpg"});
        });
    });
});










