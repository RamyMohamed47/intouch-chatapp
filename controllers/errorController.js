const getValidationErrorMessage = (err) =>
  Object.values(err.errors)
    .map((error) => error.message)
    .join(". ");

const sendError = (err, res) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || "error";
  const message = err.isOperational ? err.message : "Something went wrong";

  res.status(statusCode).json({
    status,
    message,
  });
};

const handleError = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  let error = err;

  if (err.name === "ValidationError") {
    error = {
      statusCode: 400,
      status: "fail",
      message: getValidationErrorMessage(err),
      isOperational: true,
    };
  }

  if (process.env.NODE_ENV !== "test") {
    console.error(err);
  }

  sendError(error, res);
};

export default handleError;
