/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "lead-from-here",
      home: "aws",
      removal: input?.stage === "production" ? "retain" : "remove",
      providers: {
        aws: {
          region: "eu-west-1",
        },
      },
    };
  },
  async run() {
    const connectionsTable = new sst.aws.Dynamo("ConnectionsTable", {
      fields: {
        connectionId: "string",
      },
      primaryIndex: { hashKey: "connectionId" },
      ttl: "expiresAt",
    });

    const votingStateTable = new sst.aws.Dynamo("VotingStateTable", {
      fields: {
        pk: "string",
      },
      primaryIndex: { hashKey: "pk" },
    });

    const websocketApi = new sst.aws.ApiGatewayWebSocket("WebSocketApi");

    const websocketHandler = new sst.aws.Function("WebSocketHandler", {
      handler: "lambda/index.handler",
      link: [connectionsTable, votingStateTable],
      runtime: "nodejs20.x",
      timeout: "30 seconds",
      memory: "256 MB",
      nodejs: {
        install: ["aws-sdk"],
      },
      environment: {
        CONNECTIONS_TABLE: connectionsTable.name,
        VOTING_TABLE: votingStateTable.name,
        API_ENDPOINT: websocketApi.managementEndpoint,
      },
      permissions: [
        sst.aws.permission({
          actions: ["execute-api:ManageConnections"],
          resources: ["*"],
        }),
      ],
    });

    websocketApi.route("$connect", websocketHandler.arn);
    websocketApi.route("$disconnect", websocketHandler.arn);
    websocketApi.route("$default", websocketHandler.arn);

    const restHandler = new sst.aws.Function("RestApiHandler", {
      handler: "lambda/index.restHandler",
      link: [connectionsTable, votingStateTable],
      runtime: "nodejs20.x",
      timeout: "30 seconds",
      memory: "256 MB",
      nodejs: {
        install: ["aws-sdk"],
      },
      environment: {
        CONNECTIONS_TABLE: connectionsTable.name,
        VOTING_TABLE: votingStateTable.name,
      },
    });

    const restApi = new sst.aws.ApiGatewayV2("RestApi");
    restApi.route("GET /reset", restHandler.arn);
    restApi.route("GET /status", restHandler.arn);

    // websocketApi.url omits the stage — derive the correct wss:// URL from
    // managementEndpoint (https://.../$default) which we know is correct.
    const websocketUrl = websocketApi.managementEndpoint.apply(
      (endpoint) => endpoint.replace("https://", "wss://")
    );

    const frontend = new sst.aws.StaticSite("Frontend", {
      path: "client",
      environment: {
        REACT_APP_WS_URL: websocketUrl,
        REACT_APP_BACKEND_URL: restApi.url,
      },
      build: {
        command: "npm run build",
        output: "build",
      },
      errorPage: "index.html",
    });

    return {
      websocketUrl: websocketApi.url,
      restApiUrl: restApi.url,
      frontendUrl: frontend.url,
      connectionsTable: connectionsTable.name,
      votingStateTable: votingStateTable.name,
    };
  },
});
