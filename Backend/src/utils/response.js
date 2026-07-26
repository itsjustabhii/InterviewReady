const { StatusCodes } = require('http-status-codes');

/**
 * Success response helper
 */
class ApiResponse {
  static success(res, data = null, message = 'Success', statusCode = StatusCodes.OK) {
    return res.status(statusCode).json({
      status: 'success',
      message,
      data,
    });
  }

  static created(res, data = null, message = 'Resource created successfully') {
    return res.status(StatusCodes.CREATED).json({
      status: 'success',
      message,
      data,
    });
  }

  static noContent(res) {
    return res.status(StatusCodes.NO_CONTENT).send();
  }

  static paginated(res, data, pagination, message = 'Success') {
    return res.status(StatusCodes.OK).json({
      status: 'success',
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasNextPage: pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrevPage: pagination.page > 1,
      },
    });
  }
}

module.exports = ApiResponse;

// Made with Bob
