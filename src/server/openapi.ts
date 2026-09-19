export class OpenApiGenerator {
  static getSpecification(serverUrl: string = 'https://your-deployment.vercel.app'): Record<string, unknown> {
    return {
      openapi: '3.1.0',
      info: {
        title: 'MikroTik RouterOS v7 Certified Knowledge & Intelligence API',
        description: 'Zero-credential certified knowledge engine for MikroTik RouterOS v7. Provides 10-track certification runbooks, template generation, mangle order validation, configuration sanitization, and system prompt intelligence for ChatGPT & Claude.',
        version: '1.1.0',
      },
      servers: [
        {
          url: serverUrl,
          description: 'Production Knowledge Server',
        },
      ],
      paths: {
        '/api/v1/knowledge/tracks': {
          get: {
            operationId: 'listCertificationTracks',
            summary: 'List all 10 official MikroTik Certification tracks and curriculum topics',
            description: 'Returns available certification tracks including MTCNA, MTCRE, MTCINE, MTCTCE, MTCSWE, MTCSE, MTCIPv6E, MTCUME, MTCEWE, and MTCWE.',
            responses: {
              '200': {
                description: 'List of all 10 certification tracks',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          track: { type: 'string' },
                          title: { type: 'string' },
                          description: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/api/v1/knowledge/template': {
          get: {
            operationId: 'generateTemplate',
            summary: 'Generate production configuration script for any of the 10 MikroTik Certification tracks',
            description: 'Produces certified, vendor-neutral RouterOS v7 configuration scripts adhering to official best practices.',
            parameters: [
              {
                name: 'track',
                in: 'query',
                required: true,
                schema: {
                  type: 'string',
                  enum: [
                    'mtcna',
                    'mtcre',
                    'mtcine',
                    'mtctce',
                    'mtcswe',
                    'mtcse',
                    'mtcipv6e',
                    'mtcume',
                    'mtcewe',
                    'mtcwe',
                  ],
                },
                description: 'Certification track code (e.g. mtcswe, mtcine, mtctce)',
              },
            ],
            responses: {
              '200': {
                description: 'Certified configuration template script',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        track: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        script: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/api/v1/knowledge/validate': {
          post: {
            operationId: 'validateMangleOrder',
            summary: 'Validate firewall mangle placement and FIB table registration offline',
            description: 'Analyzes proposed firewall mangle placement against the deterministic 4-tier hierarchy (Bypass -> Client Overrides -> PCC -> MSS Clamping) without connecting to a router.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['routingMark'],
                    properties: {
                      routingMark: { type: 'string', description: 'Proposed routing table name (e.g. to_ISP1)' },
                      existingTables: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of registered routing tables with fib=yes',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Validation result',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        valid: { type: 'boolean' },
                        reason: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/api/v1/knowledge/sanitize': {
          post: {
            operationId: 'sanitizeConfiguration',
            summary: 'Sanitize and redact sensitive identifiers from any raw RouterOS configuration text',
            description: 'Redacts MAC addresses, serial numbers, passwords, preshared keys, and VPN identifiers offline so configurations can be safely shared with AI.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['configText'],
                    properties: {
                      configText: { type: 'string', description: 'Raw RouterOS configuration text or script' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Sanitized configuration text',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        sanitized: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/api/v1/knowledge/prompt': {
          get: {
            operationId: 'getCertifiedPrompt',
            summary: 'Retrieve certified RouterOS v7 Senior Network Engineer system prompt',
            description: 'Returns the optimized engineering system prompt enforcing 1-click copy-pasteable script blocks and vendor-neutral naming.',
            responses: {
              '200': {
                description: 'System prompt content',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        systemPrompt: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  }
}
