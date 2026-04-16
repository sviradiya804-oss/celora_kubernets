const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const schemas = require('../models/schema'); // adjust path accordingly

const swaggerTemplate = {
  openapi: '3.0.0',
  info: {
    title: 'Dynamic API',
    version: '1.0.0'
  },
  tags: [],
  paths: {},
  components: {
    schemas: {}
  }
};

// Convert Mongoose types to Swagger types
const mongooseTypeToSwagger = (type) => {
  if (type === String) return { type: 'string' };
  if (type === Number) return { type: 'number' };
  if (type === Boolean) return { type: 'boolean' };
  if (type === Date) return { type: 'string', format: 'date-time' };
  if (Array.isArray(type)) return { type: 'array', items: { type: 'string' } };
  return { type: 'string' };
};

// Convert a schema object to Swagger schema
const generateSwaggerSchema = (schemaObj) => {
  const properties = {};
  for (const [key, val] of Object.entries(schemaObj)) {
    if (Array.isArray(val)) {
      properties[key] = {
        type: 'array',
        items: mongooseTypeToSwagger(val[0]?.type || String)
      };
    } else {
      properties[key] = mongooseTypeToSwagger(val.type || val);
    }
  }
  return {
    type: 'object',
    properties
  };
};

// Generate all RESTful paths for a model
const generatePaths = (name) => {
  const basePath = `/${name}`;

  return {
    [`${basePath}`]: {
      post: {
        tags: [name],
        summary: `Insert new ${name}`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${name}` }
            }
          }
        },
        responses: {
          200: { description: `${name} inserted successfully` }
        }
      },
      get: {
        tags: [name],
        summary: `Get all ${name}s (filtered)`,
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Filter query'
              }
            }
          }
        },
        responses: {
          200: { description: `List of ${name}s` }
        }
      },
      put: {
        tags: [name],
        summary: `Update existing ${name}`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${name}` }
            }
          }
        },
        responses: {
          200: { description: `${name} updated successfully` }
        }
      },
      delete: {
        tags: [name],
        summary: `Delete ${name} by filter`,
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Filter criteria for delete'
              }
            }
          }
        },
        responses: {
          200: { description: `${name} deleted successfully` }
        }
      }
    },
    [`${basePath}/{id}`]: {
      get: {
        tags: [name],
        summary: `Get ${name} by ID`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          200: { description: `${name} found` },
          404: { description: `${name} not found` }
        }
      }
    }
  };
};

// Add dynamic schemas and paths
for (const [key, value] of Object.entries(schemas)) {
  // Tag group title
  swaggerTemplate.tags.push({
    name: key,
    description: `${key.charAt(0).toUpperCase() + key.slice(1)} APIs`
  });

  // Schema and paths
  swaggerTemplate.components.schemas[key] = generateSwaggerSchema(value);
  Object.assign(swaggerTemplate.paths, generatePaths(key));
}

// Add static auth routes
swaggerTemplate.tags.push({ name: 'auth', description: 'Authentication APIs' });

swaggerTemplate.paths['/auth/register'] = {
  post: {
    tags: ['auth'],
    summary: 'Register a new user',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name', 'email', 'password', 'role'],
            properties: {
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              password: { type: 'string' },
              role: { type: 'string' }
            }
          }
        }
      }
    },
    responses: {
      201: { description: 'User registered' },
      400: { description: 'User already exists or role not found' }
    }
  }
};

swaggerTemplate.paths['/auth/login'] = {
  post: {
    tags: ['auth'],
    summary: 'Login user',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: { type: 'string', format: 'email' },
              password: { type: 'string' }
            }
          }
        }
      }
    },
    responses: {
      200: { description: 'Login successful' },
      401: { description: 'Invalid credentials' }
    }
  }
};

swaggerTemplate.paths['/auth/logout'] = {
  get: {
    tags: ['auth'],
    summary: 'Logout user',
    responses: {
      200: { description: 'Logout successful' }
    }
  }
};

// Save to swagger.yaml
const outputPath = path.join('./swagger.yaml'); // change as needed
fs.writeFileSync(outputPath, yaml.dump(swaggerTemplate));
console.log(` Swagger file generated at ${outputPath}`);
