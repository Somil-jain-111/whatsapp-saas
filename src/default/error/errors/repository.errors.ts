export const REPOSITORY_ERRORS = {
  REPOSITORY_FACTORY_NOT_INITIALIZED: {
    code: "REP_001",
    message: "RepositoryFactory is not initialized",
    statusCode: 500,
  },

  REPOSITORY_NOT_FOUND: {
    code: "REP_002",
    message: "Repository not found",
    statusCode: 500,
  },

  INVALID_REPOSITORY_NAME: {
    code: "REP_003",
    message: "Invalid repository name: {repositoryName}",
    statusCode: 500,
  },

  REPOSITORY_INITIALIZATION_FAILED: {
    code: "REP_004",
    message: "Repository initialization failed",
    statusCode: 500,
  },

  REPOSITORY_OPERATION_FAILED: {
    code: "REP_005",
    message: "Repository operation failed",
    statusCode: 500,
  },
} as const;
