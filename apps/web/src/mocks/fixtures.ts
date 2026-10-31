import { rawFixtures } from '@venzini/sample-data/fixtures';
import { Fixtures } from '@venzini/sample-data';

/** The SDD 7.2 fixtures, checked against the contracts once at start (SDD 7.1). */
export const fixtures: Fixtures = Fixtures.parse(rawFixtures);
