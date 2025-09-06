const { Entity } = require("../src/entity");
const { expect } = require("chai");
const uuid = require("uuid").v4;

const SERVICE = "TestService";
const ENTITY = "TestEntity";

let schema = {
  model: {
    service: SERVICE,
    entity: ENTITY,
    version: "1",
  },
  table: "electro",
  attributes: {
    id: {
      type: "string",
      default: () => uuid(),
    },
    sector: {
      type: "string",
      required: true,
    },
    name: {
      type: "string",
      required: true,
    },
    description: {
      type: "string",
    },
  },
  indexes: {
    primary: {
      pk: {
        field: "pk",
        facets: ["sector"],
      },
      sk: {
        field: "sk",
        facets: ["id"],
      },
    },
  },
};

describe("Batch Operations with AutoRetry", () => {
  let TestEntity;
  let mockClient;
  let callCount;

  beforeEach(() => {
    callCount = 0;
    mockClient = {
      get: (params) => ({ promise: () => Promise.resolve({}) }),
      put: (params) => ({ promise: () => Promise.resolve({}) }),
      update: (params) => ({ promise: () => Promise.resolve({}) }),
      delete: (params) => ({ promise: () => Promise.resolve({}) }),
      scan: (params) => ({ promise: () => Promise.resolve({}) }),
      query: (params) => ({ promise: () => Promise.resolve({}) }),
      transactWrite: (params) => ({ promise: () => Promise.resolve({}) }),
      transactGet: (params) => ({ promise: () => Promise.resolve({}) }),
      createSet: (value) => Array.isArray(value) ? new Set(value) : new Set([value]),
      batchGet: (params) => {
        callCount++;
        return {
          promise: () => Promise.resolve(mockBatchGetResponse(params, callCount))
        };
      },
      batchWrite: (params) => {
        callCount++;
        return {
          promise: () => Promise.resolve(mockBatchWriteResponse(params, callCount))
        };
      }
    };

    TestEntity = new Entity(schema, { client: mockClient });
  });

  function mockBatchGetResponse(params, attempt) {
    const table = Object.keys(params.RequestItems)[0];
    const keys = params.RequestItems[table].Keys;
    
    if (attempt === 1) {
      // First attempt: return partial success with unprocessed items
      return {
        Responses: {
          [table]: [
            {
              pk: keys[0].pk,
              sk: keys[0].sk,
              name: "Test Item 1",
              description: "Description 1",
              __edb_e__: ENTITY,
              __edb_v__: "1"
            }
          ]
        },
        UnprocessedKeys: {
          [table]: {
            Keys: keys.slice(1) // Return remaining keys as unprocessed
          }
        }
      };
    } else if (attempt === 2) {
      // Second attempt: process some more items
      return {
        Responses: {
          [table]: keys.slice(0, -1).map(key => ({
            pk: key.pk,
            sk: key.sk,
            name: `Test Item ${key.sk.split('#')[1]}`,
            description: `Description ${key.sk.split('#')[1]}`,
            __edb_e__: ENTITY,
            __edb_v__: "1"
          }))
        },
        UnprocessedKeys: {
          [table]: {
            Keys: keys.slice(-1) // Return last key as unprocessed
          }
        }
      };
    } else {
      // Third attempt: process all remaining items
      return {
        Responses: {
          [table]: keys.map(key => ({
            pk: key.pk,
            sk: key.sk,
            name: `Test Item ${key.sk.split('#')[1]}`,
            description: `Description ${key.sk.split('#')[1]}`,
            __edb_e__: ENTITY,
            __edb_v__: "1"
          }))
        },
        UnprocessedKeys: {}
      };
    }
  }

  function mockBatchWriteResponse(params, attempt) {
    const table = Object.keys(params.RequestItems)[0];
    const requests = params.RequestItems[table];
    
    if (attempt === 1) {
      // First attempt: return partial success with unprocessed items
      return {
        UnprocessedItems: {
          [table]: requests.slice(1) // Return remaining requests as unprocessed
        }
      };
    } else if (attempt === 2) {
      // Second attempt: process some more items
      return {
        UnprocessedItems: {
          [table]: requests.slice(-1) // Return last request as unprocessed
        }
      };
    } else {
      // Third attempt: process all remaining items
      return {
        UnprocessedItems: {}
      };
    }
  }

  describe("batchGet with autoretry", () => {
    it("Should retry unprocessed items until completion", async () => {
      const keys = [
        { sector: "A1", id: "item1" },
        { sector: "A1", id: "item2" },
        { sector: "A1", id: "item3" }
      ];

      const result = await TestEntity.get(keys).go({ autoretry: 3 });

      expect(callCount).to.equal(3); // Should make 3 calls
      expect(result.data).to.have.lengthOf(3); // Should return all items
      expect(result.unprocessed).to.have.lengthOf(0); // No unprocessed items
      expect(result.retryAttempts).to.equal(2); // 2 retry attempts after initial
    });

    it("Should stop retrying when maxRetries is reached", async () => {
      const keys = [
        { sector: "A1", id: "item1" },
        { sector: "A1", id: "item2" },
        { sector: "A1", id: "item3" }
      ];

      const result = await TestEntity.get(keys).go({ autoretry: 1 });

      expect(callCount).to.equal(2); // Should make 2 calls (initial + 1 retry)
      expect(result.data).to.have.lengthOf(2); // Should return partially processed items
      expect(result.unprocessed).to.have.lengthOf(1); // One unprocessed item remains
      expect(result.retryAttempts).to.equal(1); // 1 retry attempt
    });

    it("Should not retry when autoretry is 0", async () => {
      const keys = [
        { sector: "A1", id: "item1" },
        { sector: "A1", id: "item2" },
        { sector: "A1", id: "item3" }
      ];

      const result = await TestEntity.get(keys).go({ autoretry: 0 });

      expect(callCount).to.equal(1); // Should make only 1 call
      expect(result.data).to.have.lengthOf(1); // Should return only initial items
      expect(result.unprocessed).to.have.lengthOf(2); // Two unprocessed items remain
      expect(result.retryAttempts).to.equal(0); // No retry attempts
    });

    it("Should not retry when autoretry is not specified", async () => {
      const keys = [
        { sector: "A1", id: "item1" },
        { sector: "A1", id: "item2" },
        { sector: "A1", id: "item3" }
      ];

      const result = await TestEntity.get(keys).go();

      expect(callCount).to.equal(1); // Should make only 1 call
      expect(result.data).to.have.lengthOf(1); // Should return only initial items
      expect(result.unprocessed).to.have.lengthOf(2); // Two unprocessed items remain
      expect(result.retryAttempts).to.equal(0); // No retry attempts
    });

    it("Should handle invalid autoretry values", async () => {
      const keys = [
        { sector: "A1", id: "item1" },
        { sector: "A1", id: "item2" }
      ];

      // Test negative value
      const result1 = await TestEntity.get(keys).go({ autoretry: -1 });
      expect(result1.retryAttempts).to.equal(0);

      // Test non-integer value
      const result2 = await TestEntity.get(keys).go({ autoretry: 1.5 });
      expect(result2.retryAttempts).to.equal(0);

      // Test string value
      const result3 = await TestEntity.get(keys).go({ autoretry: "5" });
      expect(result3.retryAttempts).to.equal(0);
    });
  });

  describe("batchPut with autoretry", () => {
    it("Should retry unprocessed items until completion", async () => {
      const items = [
        { sector: "A1", name: "Item 1", description: "Description 1" },
        { sector: "A1", name: "Item 2", description: "Description 2" },
        { sector: "A1", name: "Item 3", description: "Description 3" }
      ];

      const result = await TestEntity.put(items).go({ autoretry: 3 });

      expect(callCount).to.equal(3); // Should make 3 calls
      expect(result.unprocessed).to.have.lengthOf(0); // No unprocessed items
      expect(result.retryAttempts).to.equal(2); // 2 retry attempts after initial
    });

    it("Should stop retrying when maxRetries is reached", async () => {
      const items = [
        { sector: "A1", name: "Item 1", description: "Description 1" },
        { sector: "A1", name: "Item 2", description: "Description 2" },
        { sector: "A1", name: "Item 3", description: "Description 3" }
      ];

      const result = await TestEntity.put(items).go({ autoretry: 1 });

      expect(callCount).to.equal(2); // Should make 2 calls (initial + 1 retry)
      expect(result.unprocessed).to.have.lengthOf(1); // One unprocessed item remains
      expect(result.retryAttempts).to.equal(1); // 1 retry attempt
    });

    it("Should not retry when autoretry is 0", async () => {
      const items = [
        { sector: "A1", name: "Item 1", description: "Description 1" },
        { sector: "A1", name: "Item 2", description: "Description 2" },
        { sector: "A1", name: "Item 3", description: "Description 3" }
      ];

      const result = await TestEntity.put(items).go({ autoretry: 0 });

      expect(callCount).to.equal(1); // Should make only 1 call
      expect(result.unprocessed).to.have.lengthOf(2); // Two unprocessed items remain
      expect(result.retryAttempts).to.equal(0); // No retry attempts
    });
  });

  describe("batchDelete with autoretry", () => {
    it("Should retry unprocessed items until completion", async () => {
      const keys = [
        { sector: "A1", id: "item1" },
        { sector: "A1", id: "item2" },
        { sector: "A1", id: "item3" }
      ];

      const result = await TestEntity.delete(keys).go({ autoretry: 3 });

      expect(callCount).to.equal(3); // Should make 3 calls
      expect(result.unprocessed).to.have.lengthOf(0); // No unprocessed items
      expect(result.retryAttempts).to.equal(2); // 2 retry attempts after initial
    });

    it("Should stop retrying when maxRetries is reached", async () => {
      const keys = [
        { sector: "A1", id: "item1" },
        { sector: "A1", id: "item2" },
        { sector: "A1", id: "item3" }
      ];

      const result = await TestEntity.delete(keys).go({ autoretry: 1 });

      expect(callCount).to.equal(2); // Should make 2 calls (initial + 1 retry)
      expect(result.unprocessed).to.have.lengthOf(1); // One unprocessed item remains  
      expect(result.retryAttempts).to.equal(1); // 1 retry attempt
    });

    it("Should not retry when autoretry is 0", async () => {
      const keys = [
        { sector: "A1", id: "item1" },
        { sector: "A1", id: "item2" },
        { sector: "A1", id: "item3" }
      ];

      const result = await TestEntity.delete(keys).go({ autoretry: 0 });

      expect(callCount).to.equal(1); // Should make only 1 call
      expect(result.unprocessed).to.have.lengthOf(2); // Two unprocessed items remain
      expect(result.retryAttempts).to.equal(0); // No retry attempts
    });
  });

  describe("Edge cases", () => {
    it("Should handle empty unprocessed items", async () => {
      // Mock client that never returns unprocessed items
      const mockSuccessClient = {
        get: (params) => ({ promise: () => Promise.resolve({}) }),
        put: (params) => ({ promise: () => Promise.resolve({}) }),
        update: (params) => ({ promise: () => Promise.resolve({}) }),
        delete: (params) => ({ promise: () => Promise.resolve({}) }),
        scan: (params) => ({ promise: () => Promise.resolve({}) }),
        query: (params) => ({ promise: () => Promise.resolve({}) }),
        transactWrite: (params) => ({ promise: () => Promise.resolve({}) }),
        transactGet: (params) => ({ promise: () => Promise.resolve({}) }),
        createSet: (value) => Array.isArray(value) ? new Set(value) : new Set([value]),
        batchWrite: (params) => ({ promise: () => Promise.resolve({ UnprocessedItems: {} }) }),
        batchGet: (params) => {
          const table = Object.keys(params.RequestItems)[0];
          const keys = params.RequestItems[table].Keys;
          return {
            promise: () => Promise.resolve({
              Responses: {
                [table]: keys.map(key => ({
                  pk: key.pk,
                  sk: key.sk,
                  name: `Test Item`,
                  __edb_e__: ENTITY,
                  __edb_v__: "1"
                }))
              },
              UnprocessedKeys: {}
            })
          };
        }
      };

      const SuccessEntity = new Entity(schema, { client: mockSuccessClient });
      const keys = [{ sector: "A1", id: "item1" }];
      
      const result = await SuccessEntity.get(keys).go({ autoretry: 5 });

      expect(result.retryAttempts).to.equal(0); // No retries needed
      expect(result.unprocessed).to.have.lengthOf(0);
      expect(result.data).to.have.lengthOf(1);
    });

    it("Should handle client errors during retry", async () => {
      let errorOnRetry = false;
      const mockErrorClient = {
        get: (params) => ({ promise: () => Promise.resolve({}) }),
        put: (params) => ({ promise: () => Promise.resolve({}) }),
        update: (params) => ({ promise: () => Promise.resolve({}) }),
        delete: (params) => ({ promise: () => Promise.resolve({}) }),
        scan: (params) => ({ promise: () => Promise.resolve({}) }),
        query: (params) => ({ promise: () => Promise.resolve({}) }),
        transactWrite: (params) => ({ promise: () => Promise.resolve({}) }),
        transactGet: (params) => ({ promise: () => Promise.resolve({}) }),
        createSet: (value) => Array.isArray(value) ? new Set(value) : new Set([value]),
        batchWrite: (params) => ({ promise: () => Promise.resolve({ UnprocessedItems: {} }) }),
        batchGet: (params) => {
          if (errorOnRetry) {
            return {
              promise: () => Promise.reject(new Error("DynamoDB Error"))
            };
          }
          
          errorOnRetry = true; // Next call will error
          const table = Object.keys(params.RequestItems)[0];
          const keys = params.RequestItems[table].Keys;
          
          return {
            promise: () => Promise.resolve({
              Responses: {
                [table]: []
              },
              UnprocessedKeys: {
                [table]: { Keys: keys }
              }
            })
          };
        }
      };

      const ErrorEntity = new Entity(schema, { client: mockErrorClient });
      const keys = [{ sector: "A1", id: "item1" }];
      
      try {
        await ErrorEntity.get(keys).go({ autoretry: 3 });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("DynamoDB Error");
      }
    });
  });
});