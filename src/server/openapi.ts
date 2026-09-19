export class OpenApiGenerator {
  static getSpecification(serverUrl: string = 'https://your-deployment.vercel.app'): Record<string, unknown> {
    return {
      openapi: '3.1.0',
      info: {
        title: 'MikroTik RouterOS v7 Certified Automation API',
        description: 'Production-grade enterprise automation API for MikroTik RouterOS v7. Supports security auditing, policy routing, certified template generation, and atomic CLI execution.',
        version: '1.1.0',
      },
      servers: [
        {
          url: serverUrl,
          description: 'Production API Server',
        },
      ],
      paths: {
        '/api/v1/action/status': {
          get: {
            operationId: 'getSystemStatus',
            summary: 'Get RouterOS system health, CPU, memory, and uptime',
            responses: {
              '200': {
                description: 'System status summary',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
        },
        '/api/v1/action/audit': {
          get: {
            operationId: 'runSecurityAudit',
            summary: 'Run 10-Pillar Security Audit for RouterOS v7',
            responses: {
              '200': {
                description: 'Security audit report with numbered findings (F-01..F-10)',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
        },
        '/api/v1/action/route-force': {
          post: {
            operationId: 'forceRouting',
            summary: 'Safely assign client IP to specific routing table (ISP1/ISP2) with 4-tier mangle order verification',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['ip', 'table'],
                    properties: {
                      ip: { type: 'string', description: 'Client IP address (e.g. 192.168.88.50)' },
                      table: { type: 'string', description: 'Target routing mark table (e.g. to_ISP1)' },
                      comment: { type: 'string', description: 'Descriptive comment for rule' },
                      dryRun: { type: 'boolean', description: 'Simulate without applying changes' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Route enforcement result',
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
            },
          },
        },
        '/api/v1/action/exec': {
          post: {
            operationId: 'executeCommand',
            summary: 'Execute raw RouterOS CLI script atomically via REST /execute or API fallback',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['command'],
                    properties: {
                      command: { type: 'string', description: 'Raw RouterOS CLI command' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Execution response',
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
            },
          },
        },
        '/api/v1/action/template': {
          get: {
            operationId: 'generateTemplate',
            summary: 'Generate certified configuration template for any of 10 MikroTik Certification tracks',
            parameters: [
              {
                name: 'track',
                in: 'query',
                required: true,
                schema: {
                  type: 'string',
                  enum: ['mtcna', 'mtcre', 'mtcine', 'mtctce', 'mtcswe', 'mtcse', 'mtcipv6e', 'mtcume', 'mtcewe', 'mtcwe'],
                },
                description: 'Certification track code',
              },
            ],
            responses: {
              '200': {
                description: 'Certified configuration template script',
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT or API Key',
            description: 'Enter your MTIK_API_KEY as Bearer token',
          },
        },
      },
      security: [
        {
          BearerAuth: [],
        },
      ],
    };
  }
}
