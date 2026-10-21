import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG_VERSION,
  CAUSES,
  REPAIR_GUIDES,
  SYMPTOMS,
} from '../src/data/catalog';
import { VehicleType } from '../src/types';

const VEHICLE_TYPES: VehicleType[] = ['car', 'motorcycle'];

function assertUnique(ids: string[], label: string): void {
  assert.equal(new Set(ids).size, ids.length, `${label} contains duplicate ids`);
}

test('catalog version is set', () => {
  assert.match(CATALOG_VERSION, /^\d{4}-\d{2}-\d{2}\.\d+$/);
});

test('catalog ids are unique and cross-references resolve', () => {
  assertUnique(SYMPTOMS.map((s) => s.id), 'SYMPTOMS');
  assertUnique(CAUSES.map((c) => c.id), 'CAUSES');
  assertUnique(REPAIR_GUIDES.map((g) => g.id), 'REPAIR_GUIDES');

  const causeIds = new Set(CAUSES.map((c) => c.id));
  const guideIds = new Set(REPAIR_GUIDES.map((g) => g.id));

  for (const symptom of SYMPTOMS) {
    assert.ok(symptom.label.trim().length > 0, `${symptom.id} has an empty label`);
    assert.ok(symptom.vehicleTypes.length > 0, `${symptom.id} has no vehicle types`);
    assert.ok(symptom.causeIds.length > 0, `${symptom.id} links to no causes`);
    for (const causeId of symptom.causeIds) {
      assert.ok(causeIds.has(causeId), `${symptom.id} references missing cause ${causeId}`);
    }
    assertUnique(symptom.causeIds, `${symptom.id}.causeIds`);
  }

  for (const cause of CAUSES) {
    assert.ok(cause.label.trim().length > 0, `${cause.id} has an empty label`);
    assert.ok(cause.vehicleTypes.length > 0, `${cause.id} has no vehicle types`);
    assert.ok(
      guideIds.has(cause.repairGuideId),
      `${cause.id} references missing guide ${cause.repairGuideId}`
    );
  }

  for (const guide of REPAIR_GUIDES) {
    assert.ok(guide.title.trim().length > 0, `${guide.id} has an empty title`);
    assert.ok(guide.vehicleTypes.length > 0, `${guide.id} has no vehicle types`);
    assert.ok(guide.estimatedMinutes > 0, `${guide.id} has a non-positive time estimate`);
    assert.ok(guide.toolsNeeded.length > 0, `${guide.id} has no tools listed`);
    assert.ok(guide.steps.length > 0, `${guide.id} has no steps`);
    for (const step of guide.steps) {
      assert.ok(step.trim().length > 0, `${guide.id} has an empty step`);
    }
  }
});

test('every cause has evidence for every supported vehicle type', () => {
  for (const cause of CAUSES) {
    for (const type of cause.vehicleTypes) {
      const evidence = SYMPTOMS.filter(
        (symptom) => symptom.vehicleTypes.includes(type) && symptom.causeIds.includes(cause.id)
      );
      assert.ok(
        evidence.length > 0,
        `${cause.id} supports ${type} but has no ${type} symptom evidence`
      );
    }
  }
});

test('every symptom links to a cause that applies to each of its vehicle types', () => {
  const byId = new Map(CAUSES.map((cause) => [cause.id, cause]));

  for (const symptom of SYMPTOMS) {
    for (const type of symptom.vehicleTypes) {
      const applicable = symptom.causeIds.some((causeId) =>
        byId.get(causeId)?.vehicleTypes.includes(type)
      );
      assert.ok(applicable, `${symptom.id} has no applicable cause for ${type}`);
    }
  }
});

test('every repair guide is referenced and supports its causes vehicle types', () => {
  const byGuide = new Map(REPAIR_GUIDES.map((guide) => [guide.id, guide]));

  for (const cause of CAUSES) {
    const guide = byGuide.get(cause.repairGuideId);
    assert.ok(guide, `${cause.id} references missing guide ${cause.repairGuideId}`);
    for (const type of cause.vehicleTypes) {
      assert.ok(
        guide.vehicleTypes.includes(type),
        `${guide.id} does not support ${type}, but cause ${cause.id} does`
      );
    }
  }

  const referenced = new Set(CAUSES.map((cause) => cause.repairGuideId));
  for (const guide of REPAIR_GUIDES) {
    assert.ok(referenced.has(guide.id), `${guide.id} is not referenced by any cause`);
  }
});

test('catalog only uses known vehicle types', () => {
  for (const item of [...SYMPTOMS, ...CAUSES, ...REPAIR_GUIDES]) {
    for (const type of item.vehicleTypes) {
      assert.ok(VEHICLE_TYPES.includes(type), `${item.id} has unknown vehicle type ${type}`);
    }
  }
});
