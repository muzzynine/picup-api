
var db = require('../../model_migration');
var Group = require('../../model_migration/group');

describe('group - group model dao', function(){
    var testInfoObj = {};
    
    before(function(done){
	db.group.create({
	    group_name : "test",
	    revision : 0,
	    created_date : Date.now(),
	    last_mod_date : Date.now(),
	    repository : "testRepository",
	    color : 0
	}).then(function(created){
	    testInfoObj.group = created;
	    done();
	}).catch(function(err){
	    done(err);
	});
    });
	
	
    describe('#createGroup', function(){
	it('It works for me', function(){
	    var expected = {
		group_name : "test",
		group_color : "15",
	    }

	    db.connection.transaction(function(t){
		return Group.createGroup(expected.group_name, expected.group_color, t).then(function(actual){
		    if(expected.group_name === actual.group_name && expected.group_color === actual.group_color){
			return done();
		    }

		    throw new Error("Test failed. expected " + exepcted.group_name + ", " + expected.group_color + ", but actual " + actual.group_name + ", " + actual.group_color);
		});
	    }).catch(function(err){
		done(err);
	    });
	});
    });
});
