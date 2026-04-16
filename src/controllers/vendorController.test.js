const { jest } = require('@jest/globals');
const { uploadToAzureBlob } = require('../../services/azureStorageService');
const controller = require('./vendorController');
const mongoose = require('mongoose');

// src/controllers/vendorController.test.js
// Example curl commands (useful reference):
// Single file upload:
// curl -X POST "http://localhost:3000/api/vendor/documents" -H "Authorization: Bearer <token>" -F "documentType=passport" -F "file=@/path/to/passport.png"
//
// Multiple files upload (send multiple files, server will pick by fieldname matching documentType):
// curl -X POST "http://localhost:3000/api/vendor/documents" -H "Authorization: Bearer <token>" -F "documentType=license" -F "passport=@/path/to/passport.png" -F "license=@/path/to/license.pdf"


let vendorFindById = jest.fn();
let vendorFindOne = jest.fn();
let vendorFindByIdAndUpdate = jest.fn();

// Mock mongoose before importing controller
jest.mock('mongoose', () => {
  // minimal stubs for models; delegate calls to outer-scope jest.fn vars so tests can set behavior
  const vendorModel = {
    findById: (...args) => vendorFindById(...args),
    findOne: (...args) => vendorFindOne(...args),
    findByIdAndUpdate: (...args) => vendorFindByIdAndUpdate(...args),
    countDocuments: jest.fn()
  };
  const vendorDiamondModel = {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn()
  };
  const orderModel = {
    countDocuments: jest.fn()
  };
  return {
    models: {},
    model: (name) => {
      if (name === 'vendorModel') return vendorModel;
      if (name === 'vendorDiamondModel') return vendorDiamondModel;
      if (name === 'orderModel') return orderModel;
      return {};
    },
    Types: { ObjectId: (id) => id }
  };
});

// Mock azure storage service
jest.mock('../../services/azureStorageService', () => {
  return {
    uploadToAzureBlob: jest.fn((buffer, filename) => Promise.resolve(`https://fake.azure/${filename}`))
  };
});


// Now import controller after mocks

function createRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  vendorFindById = jest.fn();
  vendorFindOne = jest.fn();
  vendorFindByIdAndUpdate = jest.fn();
  // replace the delegated functions inside the mocked mongoose model by re-mocking module singletons
  // rebind to new jest.fn references
  if (mongoose && mongoose.model) {
    const vm = mongoose.model('vendorModel');
    if (vm) {
      vm.findById = (...args) => vendorFindById(...args);
      vm.findOne = (...args) => vendorFindOne(...args);
      vm.findByIdAndUpdate = (...args) => vendorFindByIdAndUpdate(...args);
    }
  }
});

test('uploadDocuments - single file via req.file.buffer uploads and saves document', async () => {
  const vendorInstance = {
    _id: 'vendor1',
    vendorId: 'VND1',
    documents: [],
    save: jest.fn().mockResolvedValue(true),
    updatedOn: null
  };
  vendorFindById.mockResolvedValue(vendorInstance);

  // set azure mock to return a known URL
  uploadToAzureBlob.mockResolvedValue('https://fake.azure/passport.png');

  const req = {
    vendorId: 'vendor1',
    file: {
      buffer: Buffer.from('fakecontent'),
      originalname: 'passport.png'
    },
    files: undefined,
    body: {
      documentType: 'passport'
    }
  };
  const res = createRes();

  await controller.uploadDocuments(req, res);

  // assertions
  expect(vendorFindById).toHaveBeenCalledWith('vendor1');
  expect(uploadToAzureBlob).toHaveBeenCalled();
  expect(vendorInstance.documents.length).toBe(1);
  expect(vendorInstance.documents[0].documentType).toBe('passport');
  expect(vendorInstance.documents[0].documentUrl).toBe('https://fake.azure/passport.png');
  expect(vendorInstance.documents[0].verificationStatus).toBe('pending');
  expect(vendorInstance.save).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    success: true,
    message: 'Document uploaded successfully',
    document: expect.objectContaining({
      documentType: 'passport',
      documentUrl: 'https://fake.azure/passport.png',
      verificationStatus: 'pending'
    })
  }));
});

test('uploadDocuments - multiple files via req.files picks file by fieldname and uploads', async () => {
  const vendorInstance = {
    _id: 'vendor2',
    vendorId: 'VND2',
    documents: [],
    save: jest.fn().mockResolvedValue(true)
  };
  vendorFindById.mockResolvedValue(vendorInstance);

  // make azure return URL based on filename
  uploadToAzureBlob.mockImplementation((buffer, filename) => Promise.resolve(`https://fake.azure/${filename}`));

  const req = {
    vendorId: 'vendor2',
    file: undefined,
    files: [
      { fieldname: 'passport', buffer: Buffer.from('p'), originalname: 'passport.png' },
      { fieldname: 'license', buffer: Buffer.from('l'), originalname: 'license.pdf' }
    ],
    body: {
      documentType: 'license'
    }
  };
  const res = createRes();

  await controller.uploadDocuments(req, res);

  // assertions: license should be chosen
  expect(vendorFindById).toHaveBeenCalledWith('vendor2');
  expect(uploadToAzureBlob).toHaveBeenCalledWith(expect.any(Buffer), 'license.pdf');
  expect(vendorInstance.documents.length).toBe(1);
  expect(vendorInstance.documents[0].documentType).toBe('license');
  expect(vendorInstance.documents[0].documentUrl).toBe('https://fake.azure/license.pdf');
  expect(vendorInstance.save).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    success: true,
    document: expect.objectContaining({
      documentType: 'license',
      documentUrl: 'https://fake.azure/license.pdf',
      verificationStatus: 'pending'
    })
  }));
});

test('uploadDocuments - missing documentType returns 400', async () => {
  const req = {
    vendorId: 'vendorX',
    file: undefined,
    files: undefined,
    body: { } // no documentType
  };
  const res = createRes();

  await controller.uploadDocuments(req, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ message: 'Document type is required' });
});

test('uploadDocuments - vendor not found returns 404', async () => {
  vendorFindById.mockResolvedValue(null);

  const req = {
    vendorId: 'nonexistent',
    file: undefined,
    files: undefined,
    body: { documentType: 'passport' }
  };
  const res = createRes();

  await controller.uploadDocuments(req, res);

  expect(vendorFindById).toHaveBeenCalledWith('nonexistent');
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ message: 'Vendor not found' });
});