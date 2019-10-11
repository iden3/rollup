var writer = require('./writer.js');

const logInfo = process.env.NODE_ENV === 'development';
const defaultCode = 500;
const defaultResponse = {
  code: "UNKNOWN_ERROR",
  message: "This is emabarrasing, something went wrong while processing your request. Try again later, if the rror persist please contact support."
};

exports.onError = function(err, req, res, next) {
  let code;
  let response;
  if (logInfo) console.log(err);

  // Validation error
  if (err.failedValidation) {
    response = {
      code: "INPUT_VALIDATION_ERROR",
      message: `Incorrect value for "${err.paramName}" at ${err.path}.`
    };
    code = 401;
  }

  if (err.notImplemented) {
    response = {
      code: "FEATURE_NOT_IMPLEMENTED_YET",
      message: `This feature is not fully implemented yet. You can use the mockup data provided in this response but keep in mind that the values are reandomly generated.`,
      mockup: err.mockup
    };
    code = 501;
  }

  // Unknown error type
  if (response == undefined) {
    console.error(err);
    code = defaultCode;
    response = defaultResponse;
  }

  // Response
  writer.writeJson(res, response, code);
}
