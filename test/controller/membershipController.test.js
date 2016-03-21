var _ = require('lodash');
var db = require('../../model_migration');
var MembershipController = require('../../controller/membershipController')
var User = require('../../model_migration');

describe('membershipController - businness logic for membership job', function(){
    this.timeout(5000);

    var testBaseInfo = {};

    before(function(done){
	db.user.create({
	    nickname : "test",
	    profile_path : "test"
	}).then(function(user){
	    return db.auth.create({
		auth_id : "test",
		auth_type : "kakao"
	    }).then(function(auth){
		return user.setAuth(auth).then(function(){
		    testBaseInfo.user = user;
		    testBaseInfo.auth = auth;
		
		    done();
		});
	    });
	}).catch(function(err){
	    done(err);
	});
    })

    describe('#getMyProfile', function(){
	it('It works for me', function(done){
	    var user = testBaseInfo.user;
	    var auth = testBaseInfo.auth;

	    MembershipController.getMyProfile(user, db).then(function(result){
		if(result.id == user.id && result.nickname == user.nickname &&
		   result.profile_s3path == user.profile_path &&
		   result.auth_type == auth.auth_type){

		   return done();
		}

		throw new Error("Test failed. expected "
				+ user.id + " " + user.nickname + " " + user.profile_path + " " + auth.auth_type + ", but actual " + result.id + " " + result.nickname + " " + result.profile_s3path + " " + result.auth_type);

	    }).catch(function(err){
		console.log(err);
		done(err);
	    });
	});

	it('try for not exist profile', function(done){
	    db.user.create({
		nickname : "notExist",
		profile_path : "notExistProfile"
	    }).then(function(user){
		return MembershipController.getMyProfile(user, db).then(function(result){
		    if(result){
			done(new Error("Test failed."));
		    }
		}).catch(function(err){
		    if(err.errorCode === 404){
			return done();
		    }

		    done(new Error("Test failed. expected 404 error, but actual " + err.errorCode + " error"));
		});
	    }).catch(function(err){
		done(err);
	    });
	});
    });
});
		
		













