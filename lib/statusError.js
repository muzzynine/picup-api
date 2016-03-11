/**
 * Created by impyeong-gang on 12/17/15.
 */
module.exports = {
    400 : {
        name : "WrongParameter",
        type : "Application",
        message : "Received wrong argument set",
        detail : "",
        errorCode : 400
    },

    401 : {
        name : "Unauthorized",
        type : "Authorize",
        message : "Unauthorized",
        detail : "",
        errorCode : 401
    },

    403 : {
        name : "Forbidden",
        type : "Authentication",
        message : "Authentication failed",
        detail : "",
        errorCode : 403
    },

    404 : {
        name : "NotExistResource",
        type : "Application",
        message : "Request resource is not exist",
        detail : "",
        errorCode : 404
    },

    409 : {
        name : "OperationFailed",
        type : "Application",
        message : "Operation Failed",
        detail : "",
        errorCode : 409
    },

    410 : {
        name : "OperationSafetyFailed",
        type : "Application",
        message : "Operation Failed, But terminated safety",
        detail : "",
        errorCode : 410
    },

    412 : {
        name : "ConditionFailed",
        type : "Application",
        message : "Request failed, check your request condition",
        detail : "",
        errorCode : 412
    },

    420 : {
        name : "RedundantResource",
        type : "Application",
        message : "Request resource is redundant",
        detail : "",
        errorCode : 420
    },

    500 : {
        name : "InternalError",
        type : "Application",
        message : "Server intenral error",
        detail : "",
        errorCode : 500
    }
}