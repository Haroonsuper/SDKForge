export interface SampleSpec {
  id: string;
  name: string;
  format: 'openapi_v3' | 'swagger_v2' | 'postman_v2';
  description: string;
  content: string;
}

export const SAMPLE_SPECS: SampleSpec[] = [
  {
    id: 'fintech-payments',
    name: 'FinTech Payments & Invoicing API (OpenAPI 3.1)',
    format: 'openapi_v3',
    description: 'Enterprise payment processing, customers, transfers, and billing webhook endpoints with Bearer Auth.',
    content: JSON.stringify({
      openapi: '3.1.0',
      info: {
        title: 'NexusPay Global Financial API',
        version: '2.4.0',
        description: 'Next-generation payment gateway, invoice distribution, and customer balance operations.',
        contact: {
          name: 'NexusPay Developer Platform',
          email: 'api-support@nexuspay.dev'
        }
      },
      servers: [
        {
          url: 'https://api.nexuspay.dev/v2',
          description: 'Production Global Gateway'
        },
        {
          url: 'https://sandbox.nexuspay.dev/v2',
          description: 'Sandbox Testing Environment'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'API secret key or customer scoped JWT token'
          }
        },
        schemas: {
          Customer: {
            type: 'object',
            required: ['id', 'email', 'name', 'status'],
            properties: {
              id: { type: 'string', example: 'cus_99382f1a' },
              email: { type: 'string', format: 'email', example: 'alex@startup.io' },
              name: { type: 'string', example: 'Alex Morgan' },
              balanceCents: { type: 'integer', example: 450000 },
              currency: { type: 'string', example: 'USD' },
              status: { type: 'string', enum: ['active', 'delinquent', 'archived'] }
            }
          },
          PaymentIntent: {
            type: 'object',
            required: ['id', 'amountCents', 'currency', 'status', 'customerId'],
            properties: {
              id: { type: 'string', example: 'pi_3k928a' },
              amountCents: { type: 'integer', example: 12500 },
              currency: { type: 'string', example: 'USD' },
              customerId: { type: 'string', example: 'cus_99382f1a' },
              status: { type: 'string', enum: ['requires_payment_method', 'processing', 'succeeded', 'failed'] },
              clientSecret: { type: 'string', example: 'pi_3k928a_secret_abc123' },
              description: { type: 'string', example: 'Monthly Pro SaaS Seat' }
            }
          },
          CreatePaymentRequest: {
            type: 'object',
            required: ['amountCents', 'currency', 'customerId'],
            properties: {
              amountCents: { type: 'integer', example: 12500 },
              currency: { type: 'string', example: 'USD' },
              customerId: { type: 'string', example: 'cus_99382f1a' },
              description: { type: 'string', example: 'Monthly Pro SaaS Seat' },
              metadata: { type: 'object' }
            }
          },
          Invoice: {
            type: 'object',
            required: ['id', 'invoiceNumber', 'totalCents', 'paid'],
            properties: {
              id: { type: 'string', example: 'inv_81923' },
              invoiceNumber: { type: 'string', example: 'INV-2026-0042' },
              totalCents: { type: 'integer', example: 98000 },
              paid: { type: 'boolean', example: true },
              dueDate: { type: 'string', format: 'date-time' }
            }
          }
        }
      },
      security: [
        { bearerAuth: [] }
      ],
      paths: {
        '/customers': {
          get: {
            tags: ['Customers'],
            summary: 'List all registered customers',
            operationId: 'listCustomers',
            parameters: [
              {
                name: 'limit',
                in: 'query',
                required: false,
                schema: { type: 'integer', default: 20 },
                description: 'Number of records to return'
              },
              {
                name: 'startingAfter',
                in: 'query',
                required: false,
                schema: { type: 'string' },
                description: 'Pagination cursor cursor ID'
              }
            ],
            responses: {
              '200': {
                description: 'List of customers matching query',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Customer' }
                    }
                  }
                }
              }
            }
          },
          post: {
            tags: ['Customers'],
            summary: 'Create a new customer profile',
            operationId: 'createCustomer',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Customer' }
                }
              }
            },
            responses: {
              '201': {
                description: 'Customer created successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Customer' }
                  }
                }
              }
            }
          }
        },
        '/customers/{customerId}': {
          get: {
            tags: ['Customers'],
            summary: 'Get customer by unique identifier',
            operationId: 'getCustomerById',
            parameters: [
              {
                name: 'customerId',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'Unique customer identifier'
              }
            ],
            responses: {
              '200': {
                description: 'Customer retrieved',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Customer' }
                  }
                }
              }
            }
          },
          delete: {
            tags: ['Customers'],
            summary: 'Permanently archive customer',
            operationId: 'deleteCustomer',
            parameters: [
              {
                name: 'customerId',
                in: 'path',
                required: true,
                schema: { type: 'string' }
              }
            ],
            responses: {
              '200': {
                description: 'Customer archived'
              }
            }
          }
        },
        '/payments': {
          post: {
            tags: ['Payments'],
            summary: 'Create payment intent charge',
            operationId: 'createPaymentIntent',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreatePaymentRequest' }
                }
              }
            },
            responses: {
              '201': {
                description: 'Payment intent initialized',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/PaymentIntent' }
                  }
                }
              }
            }
          },
          get: {
            tags: ['Payments'],
            summary: 'Search past payment transactions',
            operationId: 'listPayments',
            parameters: [
              {
                name: 'status',
                in: 'query',
                required: false,
                schema: { type: 'string', enum: ['succeeded', 'failed', 'processing'] }
              }
            ],
            responses: {
              '200': {
                description: 'Array of payment records',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/PaymentIntent' }
                    }
                  }
                }
              }
            }
          }
        },
        '/invoices': {
          get: {
            tags: ['Invoicing'],
            summary: 'Retrieve billed invoices',
            operationId: 'listInvoices',
            responses: {
              '200': {
                description: 'Invoices array',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Invoice' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }, null, 2)
  },
  {
    id: 'petstore-v3',
    name: 'Petstore Universal API (OpenAPI 3.0)',
    format: 'openapi_v3',
    description: 'The canonical REST API reference covering Pets, Orders, and Store Inventory with API Key Auth.',
    content: JSON.stringify({
      openapi: '3.0.3',
      info: {
        title: 'Swagger Petstore 3.0',
        version: '1.0.19',
        description: 'Comprehensive pet adoption, inventory verification, and veterinary scheduling API.'
      },
      servers: [
        { url: 'https://petstore.swagger.io/v2' }
      ],
      components: {
        securitySchemes: {
          apiKeyHeader: {
            type: 'apiKey',
            name: 'X-API-KEY',
            in: 'header'
          }
        },
        schemas: {
          Pet: {
            type: 'object',
            required: ['id', 'name', 'status'],
            properties: {
              id: { type: 'integer', example: 101 },
              name: { type: 'string', example: 'Doggie' },
              category: { type: 'string', example: 'Dogs' },
              photoUrls: {
                type: 'array',
                items: { type: 'string' }
              },
              status: {
                type: 'string',
                enum: ['available', 'pending', 'sold'],
                example: 'available'
              }
            }
          },
          Order: {
            type: 'object',
            required: ['id', 'petId', 'quantity', 'status'],
            properties: {
              id: { type: 'integer', example: 1 },
              petId: { type: 'integer', example: 101 },
              quantity: { type: 'integer', example: 1 },
              shipDate: { type: 'string', format: 'date-time' },
              status: { type: 'string', enum: ['placed', 'approved', 'delivered'] },
              complete: { type: 'boolean', example: false }
            }
          }
        }
      },
      security: [{ apiKeyHeader: [] }],
      paths: {
        '/pet': {
          post: {
            tags: ['Pet'],
            summary: 'Add a new pet to the store',
            operationId: 'addPet',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Pet' }
                }
              }
            },
            responses: {
              '200': {
                description: 'Successful operation',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Pet' }
                  }
                }
              }
            }
          },
          put: {
            tags: ['Pet'],
            summary: 'Update an existing pet',
            operationId: 'updatePet',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Pet' }
                }
              }
            },
            responses: {
              '200': {
                description: 'Pet updated',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Pet' }
                  }
                }
              }
            }
          }
        },
        '/pet/findByStatus': {
          get: {
            tags: ['Pet'],
            summary: 'Finds Pets by status',
            operationId: 'findPetsByStatus',
            parameters: [
              {
                name: 'status',
                in: 'query',
                required: true,
                schema: { type: 'string', enum: ['available', 'pending', 'sold'] }
              }
            ],
            responses: {
              '200': {
                description: 'Matched pets list',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Pet' }
                    }
                  }
                }
              }
            }
          }
        },
        '/pet/{petId}': {
          get: {
            tags: ['Pet'],
            summary: 'Find pet by ID',
            operationId: 'getPetById',
            parameters: [
              {
                name: 'petId',
                in: 'path',
                required: true,
                schema: { type: 'integer' }
              }
            ],
            responses: {
              '200': {
                description: 'Pet found',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Pet' }
                  }
                }
              }
            }
          },
          delete: {
            tags: ['Pet'],
            summary: 'Deletes a pet',
            operationId: 'deletePet',
            parameters: [
              {
                name: 'petId',
                in: 'path',
                required: true,
                schema: { type: 'integer' }
              }
            ],
            responses: {
              '200': { description: 'Pet deleted' }
            }
          }
        },
        '/store/order': {
          post: {
            tags: ['Store'],
            summary: 'Place an order for a pet',
            operationId: 'placeOrder',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Order' }
                }
              }
            },
            responses: {
              '200': {
                description: 'Order created',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Order' }
                  }
                }
              }
            }
          }
        }
      }
    }, null, 2)
  },
  {
    id: 'postman-echo',
    name: 'Postman Echo Collection (Postman v2.1)',
    format: 'postman_v2',
    description: 'Standard Postman Collection format v2.1 with authentication headers, query parameters and request bodies.',
    content: JSON.stringify({
      info: {
        _postman_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'Postman Echo Utility Suite',
        description: 'Complete HTTP verification collection from Postman for testing headers, authentication, and payloads.',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: [
        {
          name: 'Utilities',
          item: [
            {
              name: 'Echo GET Request',
              request: {
                method: 'GET',
                header: [
                  { key: 'Accept', value: 'application/json' },
                  { key: 'User-Agent', value: 'SDKForge-TestRunner' }
                ],
                url: {
                  raw: 'https://postman-echo.com/get?user=alice&team=core',
                  protocol: 'https',
                  host: ['postman-echo', 'com'],
                  path: ['get'],
                  query: [
                    { key: 'user', value: 'alice', description: 'Target username' },
                    { key: 'team', value: 'core', description: 'Assigned division' }
                  ]
                },
                description: 'The HTTP GET request testing endpoint'
              }
            },
            {
              name: 'Echo POST Raw JSON',
              request: {
                method: 'POST',
                header: [
                  { key: 'Content-Type', value: 'application/json' }
                ],
                body: {
                  mode: 'raw',
                  raw: '{\n  "event": "order.completed",\n  "amount": 42.50,\n  "currency": "USD"\n}'
                },
                url: {
                  raw: 'https://postman-echo.com/post',
                  protocol: 'https',
                  host: ['postman-echo', 'com'],
                  path: ['post']
                },
                description: 'The HTTP POST request endpoint mirroring json bodies'
              }
            }
          ]
        },
        {
          name: 'Auth Verification',
          item: [
            {
              name: 'Bearer Token Check',
              request: {
                auth: {
                  type: 'bearer',
                  bearer: [
                    { key: 'token', value: 'demo_token_123', type: 'string' }
                  ]
                },
                method: 'GET',
                header: [],
                url: {
                  raw: 'https://postman-echo.com/bearer',
                  protocol: 'https',
                  host: ['postman-echo', 'com'],
                  path: ['bearer']
                },
                description: 'Validates Bearer token headers'
              }
            }
          ]
        }
      ]
    }, null, 2)
  }
];
