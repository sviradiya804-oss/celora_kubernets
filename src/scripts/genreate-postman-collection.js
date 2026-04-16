const fs = require('fs');
const path = require('path');

// Load your schemas
const schemas = require('../models/schema');

const baseApiUrl = 'https://celora-backend.vercel.app/api';
const token = '<YOUR_JWT_TOKEN>';

function getSampleValue(fieldSchema) {
  // If it's an array
  if (Array.isArray(fieldSchema)) {
    const itemType = typeof fieldSchema[0];

    if (itemType === 'object' && fieldSchema[0] !== null) {
      // Nested object inside array
      return [
        Object.keys(fieldSchema[0]).reduce((acc, key) => {
          acc[key] = getSampleValue(fieldSchema[0][key]);
          return acc;
        }, {})
      ];
    }

    return ['value1', 'value2'];
  }

  // If it's a function (like String, Number, Date)
  if (typeof fieldSchema === 'function') {
    switch (fieldSchema.name) {
      case 'String':
        return 'Sample String';
      case 'Number':
        return 100;
      case 'Boolean':
        return true;
      case 'Date':
        return '2025-01-01T00:00:00Z';
      default:
        return 'Unknown Type';
    }
  }

  // Complex Mongoose-style schema definition
  const type = fieldSchema.type?.name || typeof fieldSchema.type;

  switch (type) {
    case 'String':
      if (fieldSchema.enum) return fieldSchema.enum[0];
      if (fieldSchema.unique) return 'unique@example.com';
      if (fieldSchema.ref) return '607c859b3f8adb0015134412'; // ObjectId reference
      return 'Sample String';

    case 'Number':
      return 100;

    case 'Boolean':
      return true;

    case 'Date':
      return '2025-01-01T00:00:00Z';

    case 'Array':
      const itemType = fieldSchema.type?.of?.name || '';
      if (itemType === 'String') return ['value1', 'value2'];
      if (itemType === 'Object') return [{}];
      if (fieldSchema.type?.of?.enum) return [fieldSchema.type.of.enum[0]];
      return [];

    case 'Object':
      if (fieldSchema.fields) {
        // Handle nested fields like `qa`
        const obj = {};
        for (const key in fieldSchema.fields) {
          obj[key] = getSampleValue(fieldSchema.fields[key]);
        }
        return obj;
      }
      return {};

    default:
      return 'Unknown Type';
  }
}

// Base Postman collection structure
const postmanCollection = {
  info: {
    name: 'Celora Backend API',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: []
};

Object.keys(schemas).forEach((schemaName) => {
  const url = `${baseApiUrl}/${schemaName}`;
  const exampleId = '12345';

  // Folder per schema
  const folder = {
    name: schemaName,
    item: []
  };

  // POST - Create
  folder.item.push({
    name: 'Create',
    request: {
      method: 'POST',
      header: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Authorization', value: `Bearer ${token}` }
      ],
      body: {
        mode: 'raw',
        raw: JSON.stringify(
          Object.keys(schemas[schemaName]).reduce((acc, field) => {
            // Skip fields that end with "Id" (e.g., dataId, blogId)
            if (field.endsWith('Id')) return acc;
            acc[field] = getSampleValue(schemas[schemaName][field]);
            return acc;
          }, {})
        )
      },
      url: {
        raw: url,
        protocol: 'https',
        host: ['celora-backend', 'vercel', 'app'],
        path: ['api', schemaName]
      }
    }
  });
  // GET ALL
  folder.item.push({
    name: 'List All',
    request: {
      method: 'GET',
      header: [{ key: 'Authorization', value: `Bearer ${token}` }],
      url: {
        raw: url,
        protocol: 'https',
        host: ['celora-backend', 'vercel', 'app'],
        path: ['api', schemaName]
      }
    }
  });

  // GET ONE
  folder.item.push({
    name: 'Get One',
    request: {
      method: 'GET',
      header: [{ key: 'Authorization', value: `Bearer ${token}` }],
      url: {
        raw: `${url}/${exampleId}`,
        protocol: 'https',
        host: ['celora-backend', 'vercel', 'app'],
        path: ['api', schemaName, exampleId]
      }
    }
  });

  // PUT - Update
  folder.item.push({
    name: 'Update',
    request: {
      method: 'PUT',
      header: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Authorization', value: `Bearer ${token}` }
      ],
      body: {
        mode: 'raw',
        raw: JSON.stringify({ '<fieldToUpdate>': 'updatedValue' })
      },
      url: {
        raw: `${url}/${exampleId}`,
        protocol: 'https',
        host: ['celora-backend', 'vercel', 'app'],
        path: ['api', schemaName, exampleId]
      }
    }
  });

  // DELETE
  folder.item.push({
    name: 'Delete',
    request: {
      method: 'DELETE',
      header: [{ key: 'Authorization', value: `Bearer ${token}` }],
      url: {
        raw: `${url}/${exampleId}`,
        protocol: 'https',
        host: ['celora-backend', 'vercel', 'app'],
        path: ['api', schemaName, exampleId]
      }
    }
  });

  postmanCollection.item.push(folder);
});

// Save to file
const outputPath = path.join(__dirname, 'postman_collection.json');
fs.writeFileSync(outputPath, JSON.stringify(postmanCollection, null, 2));

console.log(` Postman collection saved at: ${outputPath}`);
