import { createFakePay } from "./fakepay.js";

export const createProviderRegistry = () => {
  const factories = new Map();

  return {
    register: (name, factory) => {
      if (factories.has(name)) {
        throw new Error(`Payment provider already registered: ${name}`);
      }
      factories.set(name, factory);
    },

    has: (name) => factories.has(name),

    names: () => [...factories.keys()],

    create: (name, options) => {
      const factory = factories.get(name);
      if (!factory) {
        throw new Error(`Unknown payment provider: ${name}. Registered: ${[...factories.keys()].join(", ")}`);
      }
      return factory(options);
    },
  };
};

export const providers = createProviderRegistry();

providers.register("fakepay", createFakePay);
