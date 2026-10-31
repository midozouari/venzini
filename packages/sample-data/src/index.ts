// Deterministic sample-data generator (SDD 7.2, ADR-17): seed 42 builds the MVP fixtures
// and, later, the Prisma seed. Everything it produces is fake.
export { SAMPLE_DATA_SEED } from './prng';
export { generateFixtures, buildState, OPTIMAL_PLAN_ID, PAST_PLAN_ID } from './fixtures';
export { DEMO_PASSWORD } from './master';
export * from './schemas';
