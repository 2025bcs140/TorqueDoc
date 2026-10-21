import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnose, findUnknownSymptomIds } from '../src/services/diagnosisEngine';
import { Cause, Symptom } from '../src/types';

const symptoms: Symptom[] = [
  {
    id: 's_shared',
    label: 'Shared symptom',
    category: 'engine',
    vehicleTypes: ['car', 'motorcycle'],
    causeIds: ['c_shared'],
  },
  {
    id: 's_car_only',
    label: 'Car-only symptom',
    category: 'engine',
    vehicleTypes: ['car'],
    causeIds: ['c_shared'],
  },
  {
    id: 's_moto_only',
    label: 'Motorcycle-only symptom',
    category: 'drive_chain_clutch',
    vehicleTypes: ['motorcycle'],
    causeIds: ['c_shared'],
  },
  {
    id: 's_single',
    label: 'Single-sign symptom',
    category: 'brakes',
    vehicleTypes: ['car', 'motorcycle'],
    causeIds: ['c_single'],
  },
  {
    id: 's_pair_a',
    label: 'Pair A',
    category: 'engine',
    vehicleTypes: ['car'],
    causeIds: ['c_pair'],
  },
  {
    id: 's_pair_b',
    label: 'Pair B',
    category: 'engine',
    vehicleTypes: ['car'],
    causeIds: ['c_pair'],
  },
];

const causes: Cause[] = [
  {
    id: 'c_shared',
    label: 'Shared cause',
    severity: 'medium',
    vehicleTypes: ['car', 'motorcycle'],
    repairGuideId: 'rg_shared',
  },
  {
    id: 'c_single',
    label: 'Single-sign cause',
    severity: 'urgent',
    vehicleTypes: ['car', 'motorcycle'],
    repairGuideId: 'rg_single',
  },
  {
    id: 'c_pair',
    label: 'Pair cause',
    severity: 'low',
    vehicleTypes: ['car'],
    repairGuideId: 'rg_pair',
  },
];

const catalog = { symptoms, causes };

test('motorcycle confidence does not count car-only symptoms as missing', () => {
  const matches = diagnose(['s_shared'], 'motorcycle', catalog);
  const match = matches.find((candidate) => candidate.cause.id === 'c_shared');

  assert.ok(match, 'the shared cause should match');
  // For a motorcycle the cause has two applicable signs (shared + moto-only),
  // not three. Counting the car-only symptom would produce 1/3.
  assert.equal(match.totalLinkedSymptoms, 2);
  assert.equal(match.confidence, 0.5);
  assert.deepEqual(match.matchedSymptomIds, ['s_shared']);
  assert.deepEqual(match.matchedSymptoms, [{ id: 's_shared', label: 'Shared symptom' }]);
});

test('car confidence counts car-only symptoms', () => {
  const matches = diagnose(['s_shared'], 'car', catalog);
  const match = matches.find((candidate) => candidate.cause.id === 'c_shared');

  assert.ok(match);
  assert.equal(match.totalLinkedSymptoms, 2);
  assert.equal(match.confidence, 0.5);
});

test('causes that do not apply to the vehicle type are excluded', () => {
  const matches = diagnose(['s_pair_a'], 'motorcycle', catalog);
  assert.equal(matches.length, 0);
});

test('empty selection returns no matches', () => {
  assert.deepEqual(diagnose([], 'car', catalog), []);
});

test('higher coverage ranks first, then more matched signs', () => {
  const matches = diagnose(['s_pair_a', 's_pair_b', 's_single'], 'car', catalog);

  assert.deepEqual(
    matches.map((match) => match.cause.id),
    ['c_pair', 'c_single']
  );
  assert.equal(matches[0].confidence, 1);
  assert.equal(matches[1].confidence, 1);
  assert.equal(matches[0].matchedSymptomIds.length, 2);
});

test('ties are broken by severity', () => {
  const tieCatalog = {
    symptoms: [
      {
        id: 's_one',
        label: 'One',
        category: 'engine' as const,
        vehicleTypes: ['car' as const],
        causeIds: ['c_low', 'c_urgent'],
      },
    ],
    causes: [
      {
        id: 'c_low',
        label: 'Low cause',
        severity: 'low' as const,
        vehicleTypes: ['car' as const],
        repairGuideId: 'rg_low',
      },
      {
        id: 'c_urgent',
        label: 'Urgent cause',
        severity: 'urgent' as const,
        vehicleTypes: ['car' as const],
        repairGuideId: 'rg_urgent',
      },
    ],
  };

  const matches = diagnose(['s_one'], 'car', tieCatalog);
  assert.deepEqual(
    matches.map((match) => match.cause.id),
    ['c_urgent', 'c_low']
  );
});

test('findUnknownSymptomIds only accepts symptoms for the vehicle type', () => {
  assert.deepEqual(findUnknownSymptomIds(['s_shared', 'nope'], 'car', catalog), ['nope']);
  assert.deepEqual(findUnknownSymptomIds(['s_car_only'], 'motorcycle', catalog), ['s_car_only']);
});
