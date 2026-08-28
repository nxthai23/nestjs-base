// `@mikro-orm/decorators` ships as an ESM-only package (no CJS build) that
// Jest's CommonJS-based module runtime cannot `require()` directly. Unit
// tests never need these decorators to do anything (they don't boot a real
// ORM), so each one is a no-op. Any spec file that hits this needs
// `jest.mock('@mikro-orm/decorators/legacy')` — Jest then picks up this file
// automatically (manual mock convention).
const noopDecorator = () => () => undefined;

export const Entity = noopDecorator;
export const PrimaryKey = noopDecorator;
export const Property = noopDecorator;
export const SerializedPrimaryKey = noopDecorator;
export const OneToMany = noopDecorator;
export const ManyToOne = noopDecorator;
