var logger = require('../../lib/logger');
var awsS3 = require('../../lib/awsS3');
var sync = require('../../lib/sync');
var Node = require('../../model_migration/node');

describe('awsS3 - aws s3', function(){
    describe('#checkExistNodeObject', function(){
        it('It works for me', function(done) {
            var bucket = "bigfrog.picup.bakkess";
            var key = "56252a166ec40858a9c835ed/rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg";
	    var s3Path = bucket + "/" + key;
	    
            awsS3.checkExistNodeObject({s3Path : s3Path}).then(function (data) {
                done();
            }).catch(function(err){
		done(err);
	    });
        });

        it('not exist object', function(done){ 
            var bucket = "bigfrog.picup.bakkess";
            var key = "6252a166ec40858a9c835ed/rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg"; 
	    var s3Path = bucket + "/" + key;
	    
            awsS3.checkExistNodeObject({s3Path : s3Path}).then(function (data) {
                done(new Error('test failed'));
            }).catch(function(err){
		if(err.errorCode === 404){
		   return done();
		}
		done(new Error("Test failed. expected " + err.errorCode + "But actual, " + err.errorCode));
	    });
        });
    });

    describe('#checkExistThumbObject', function(){
        it('It works for me', function(done) {
            var bucket = "bigfrog.picup.bakkess";
            var key = "56252a166ec40858a9c835ed/rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg";
	    var s3ThumbnailPath = bucket + "/" + key;
	    
            awsS3.checkExistThumbObject({s3ThumbnailPath : s3ThumbnailPath}).then(function (data) {
                done();
            }).catch(function(err){
		done(err);
	    });
        });

        it('not exist object', function(done){ 
            var bucket = "bigfrog.picup.bakkess";
            var key = "6252a166ec40858a9c835ed/rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg"; 
	    var s3ThumbnailPath = bucket + "/" + key;
	    
            awsS3.checkExistThumbObject({s3ThumbnailPath : s3ThumbnailPath}).then(function (data) {
                done(new Error('test failed'));
            }).catch(function(err){
		if(err.errorCode === 404){
		   return done();
		}
		done(new Error("Test failed. expected " + err.errorCode + "But actual, " + err.errorCode));
	    });
        });
    });

    
    describe('#checkExistNodeObjectsBatch', function(){
	it('It works for me', function(done){
            var objects = [];
	    
            var node1 = new Node(null,
                "56252a166ec40858a9c835ed",
                "rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg",
                "file", null, null, null, null, null,
                "bigfrog.picup.bakkess/56252a166ec40858a9c835ed/rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg");
            var node2 = new Node(null,
                "562569d76f36d774d7c2b661",
                "kkong/mbezufsrg3cz660kby6k81la5kix3fwp.jpg",
                "file", null, null, null, null, null,
                "bigfrog.picup.bakkess/562569d76f36d774d7c2b661/kkong/mbezufsrg3cz660kby6k81la5kix3fwp.jpg");
            var node3 = new Node(null,
                "56252a166ec40858a9c835ed",
                "r/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg",
                "file", null, null, null, null, null,
                null);
            var node4 = new Node(null,
                "562569d76f36d774d7c2b661",
                "kong/mbezufsrg3cz660kby6k81la5kix3fwp.jpg",
                "file", null, null, null, null, null,
		 "bigfrog.picup.bakkess/562569d76f36d774d7c2b661/kong/mbezufsrg3cz660kby6k81la5kix3fwp.jpg");

	    objects.push(node1, node2, node3, node4);

	    awsS3.checkExistNodeObjectsBatch(objects).then(function(result){
		if(result.length === 2) return done();
		throw new Error('Test failed. Expected result length 4, but Actual ' + result.length);
	    }).catch(function(err){
		done(err);
	    });
	});

	it("node's presence 'delete' case", function(done){
	    var node = new Node(null,
				 "56252a166ec40858a9c835ed",
				 "rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg",
				 "file", null, sync.PRESENCE_DELETE, null, null, null,
				 "bigfrog.picup.bakkess/56252a166ec40858a9c835ed/rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg");
	    awsS3.checkExistNodeObjectsBatch([node]).then(function(result){
		if(result.length === 0) return done();
		throw new Error('Test failed. Expected result length 0, but actual ' + result.length);
	    }).catch(function(err){
		done(err);
	    });
	});

	it("node's s3Path 'default' case", function(done){
	    var node = new Node(null,
				 "56252a166ec40858a9c835ed",
				 "rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg",
				 "file", null, sync.PRESENCE_DELETE, null, null, null,
				 "default");

	    awsS3.checkExistNodeObjectsBatch([node]).then(function(result){
		if(result.length === 0) return done();
		throw new Error('Test failed. Expected result length 0, but actual ' + result.length);
	    }).catch(function(err){
		done(err);
	    });
	});

	it("node's s3Path undefined or null case", function(done){
	    var node1 = new Node(null,
				 "56252a166ec40858a9c835ed",
				 "rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg",
				 "file", null, null, null, null, null, null);

	    var node2 = new Node(null,
				 "56252a166ec40858a9c835ed",
				 "rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg",
				 "file", null, null, null, null, null, undefined);

	    awsS3.checkExistNodeObjectsBatch([node1, node2]).then(function(result){
		if(result.length === 2) {
		    return done();
		}
		throw new Error('Test failed. Expected result length 0, but actual ' + result.length);
	    }).catch(function(err){
		done(err);
	    });	
	});
    });

    describe('#checkExistThumbObjectsBatch', function(){
	it('It works for me', function(done){
            var objects = [];

	    //exist
            var node1 = new Node(null,
				 "56252a166ec40858a9c835ed",
				 "rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg",
				 "file", null, null, null, null, null, null,
				 "bigfrog.picup.bakkess/56252a166ec40858a9c835ed/rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg");
	    //exist
            var node2 = new Node(null,
				 "562569d76f36d774d7c2b661",
				 "kkong/mbezufsrg3cz660kby6k81la5kix3fwp.jpg",
				 "file", null, null, null, null, null, null,
				 "bigfrog.picup.bakkess/562569d76f36d774d7c2b661/kkong/mbezufsrg3cz660kby6k81la5kix3fwp.jpg");
	    //not exist
            var node3 = new Node(null,
				 "562569d76f36d774d7c2b661",
				 "kong/mbezufsrg3cz660kby6k81la5kix3fwp.jpg",
				 "file", null, null, null, null, null, null,
				 "bigfrog.picup.bakkess/562569d76f36d774d7c2b661/kong/mbezufsrg3cz660kby6k81la5kix3fwp.jpg");

	    objects.push(node1, node2, node3);

	    awsS3.checkExistThumbObjectsBatch(objects).then(function(result){
		if(result.length === 1) return done();
		throw new Error('Test failed. Expected result length 1, but Actual ' + result.length);
	    }).catch(function(err){
		done(err);
	    });
	});

	it("node's presence 'delete' case", function(done){
	    var node = new Node(null,
				 "56252a166ec40858a9c835ed",
				 "rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg",
				"file", null, sync.PRESENCE_DELETE, null, null, null, null,
				 "bigfrog.picup.bakkess/56252a166ec40858a9c835ed/rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg");
	    awsS3.checkExistNodeObjectsBatch([node]).then(function(result){
		if(result.length === 0) return done();
		throw new Error('Test failed. Expected result length 0, but actual ' + result.length);
	    }).catch(function(err){
		done(err);
	    });
	});

	it("node's s3Path 'default' case", function(done){
	    var node = new Node(null,
				 "56252a166ec40858a9c835ed",
				 "rr/i3ihwn7g2vupd8fxplobtereekdx1zad.jpg",
				"file", null, sync.PRESENCE_DELETE, null, null, null, null,
				 "default");

	    awsS3.checkExistNodeObjectsBatch([node]).then(function(result){
		if(result.length === 0) return done();
		throw new Error('Test failed. Expected result length 0, but actual ' + result.length);
	    }).catch(function(err){
		done(err);
	    });
	});
    });
});
